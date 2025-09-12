import Patient from "../models/patientModel.js";
import User from "../models/userModel.js";
import MedicationReminder from "../models/medicationReminderModel.js";
import BehaviorLog from "../models/behaviorLogModel.js";
import Incident from "../models/incidentModel.js";

export const exportPatientFhir = async (patientId) => {
  const patient = await Patient.findById(patientId)
    .populate("patientUserId")
    .lean();
  if (!patient) throw { statusCode: 404, message: "Patient not found" };

  const user = patient.patientUserId || {};
  const meds = await MedicationReminder.find({ patientId }).lean();
  const behaviors = await BehaviorLog.find({ patientId })
    .sort({ date: -1 })
    .limit(50)
    .lean();
  const incidents = await Incident.find({ patientId })
    .sort({ occurredAt: -1 })
    .limit(50)
    .lean();

  // FHIR-lite bundle
  const bundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: String(patient._id),
          active: patient.status === "active",
          name: [{ family: user?.lastName, given: [user?.firstName] }],
          telecom: [{ system: "phone", value: user?.phone }],
          gender: user?.gender,
          birthDate: user?.dateOfBirth
            ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
            : undefined,
          address: [
            {
              line: [user?.street],
              city: user?.city,
              state: user?.state,
              postalCode: user?.postalCode,
              country: user?.country
            }
          ]
        }
      },
      ...meds.map((m) => ({
        resource: {
          resourceType: "MedicationRequest",
          id: String(m._id),
          status: m.status === "active" ? "active" : "completed",
          intent: "order",
          medicationCodeableConcept: { text: m.medicationName },
          subject: { reference: `Patient/${patient._id}` },
          dosageInstruction: [{ text: `${m.dosage} ${m.frequency}` }],
          authoredOn: new Date(m.startDate).toISOString()
        }
      })),
      ...behaviors.map((b) => ({
        resource: {
          resourceType: "Observation",
          id: String(b._id),
          status: "final",
          code: { text: "Daily Behavior/Mood" },
          subject: { reference: `Patient/${patient._id}` },
          effectiveDateTime: new Date(b.date).toISOString(),
          valueString: b.mood || "n/a",
          note: b.notes ? [{ text: b.notes }] : undefined
        }
      })),
      ...incidents.map((i) => ({
        resource: {
          resourceType: "Observation",
          id: String(i._id),
          status: "final",
          code: { text: `Incident: ${i.type}` },
          subject: { reference: `Patient/${patient._id}` },
          effectiveDateTime: new Date(i.occurredAt).toISOString(),
          valueString: `severity=${i.severity}; action=${i.actionTaken || "-"}`,
          note: [{ text: i.description }]
        }
      }))
    ]
  };

  return { bundle };
};

export const importPatientFhir = async (patientId, bundle, performedBy) => {
  // Placeholder: validate + map minimal fields (e.g., MedicationRequest -> MedicationReminder)
  // For now, just return echo with counts so you can implement later.
  const counts = {
    total: (bundle.entry || []).length,
    medicationRequests: (bundle.entry || []).filter(
      (e) => e.resource?.resourceType === "MedicationRequest"
    ).length,
    observations: (bundle.entry || []).filter(
      (e) => e.resource?.resourceType === "Observation"
    ).length
  };
  return {
    imported: false,
    stats: counts,
    message: "Import mapping not implemented yet"
  };
};
