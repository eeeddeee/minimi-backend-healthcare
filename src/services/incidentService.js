import Incident from "../models/incidentModel.js";
import SystemLog from "../models/systemLogModel.js";
import { getSignedUrlForKey } from "../utils/s3.js";

export const createIncident = async (data, createdBy, session) => {
  const incident = await Incident.create([{ ...data, reportedBy: createdBy }], {
    session
  });
  await SystemLog.create(
    [
      {
        action: "incident_created",
        entityType: "Incident",
        entityId: incident[0]._id,
        performedBy: createdBy,
        metadata: { patientId: data.patientId, type: data.type }
      }
    ],
    { session }
  );
  return incident[0].toObject();
};

export const getIncidents = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const incidents = await Incident.find(filters)
    .skip(skip)
    .limit(limit)
    .populate("patientId", "patientNumber")
    .populate("reportedBy", "firstName lastName role")
    .lean();

  for (const inc of incidents) {
    if (Array.isArray(inc.attachments)) {
      inc.attachments = await Promise.all(
        inc.attachments.map(async (a) => ({
          ...a,
          url: await getSignedUrlForKey(a.key)
        }))
      );
    }
  }

  const total = await Incident.countDocuments(filters);
  return {
    incidents,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

export const getIncidentById = async (id) => {
  const incident = await Incident.findById(id)
    .populate("patientId", "patientNumber")
    .populate("reportedBy", "firstName lastName role")
    .lean();
  if (!incident) throw { statusCode: 404, message: "Incident not found" };

  if (Array.isArray(incident.attachments)) {
    incident.attachments = await Promise.all(
      incident.attachments.map(async (a) => ({
        ...a,
        url: await getSignedUrlForKey(a.key)
      }))
    );
  }
  return incident;
};

export const updateIncident = async (id, data, updatedBy) => {
  const updated = await Incident.findByIdAndUpdate(
    id,
    { ...data, updatedAt: Date.now() },
    { new: true }
  ).lean();
  if (!updated) throw { statusCode: 404, message: "Incident not found" };

  await SystemLog.create({
    action: "incident_updated",
    entityType: "Incident",
    entityId: id,
    performedBy: updatedBy
  });
  return updated;
};

export const updateIncidentStatus = async (id, status, updatedBy) => {
  return updateIncident(id, { status }, updatedBy);
};

export const addAttachments = async (id, attachments, updatedBy) => {
  const incident = await Incident.findByIdAndUpdate(
    id,
    { $push: { attachments: { $each: attachments } }, updatedAt: Date.now() },
    { new: true }
  ).lean();
  if (!incident) throw { statusCode: 404, message: "Incident not found" };

  await SystemLog.create({
    action: "incident_attachments_added",
    entityType: "Incident",
    entityId: id,
    performedBy: updatedBy,
    metadata: { count: attachments.length }
  });
  return incident;
};
