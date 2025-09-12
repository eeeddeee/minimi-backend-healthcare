import User from "../models/userModel.js";
import Patient from "../models/patientModel.js";
import Hospital from "../models/hospitalModel.js";
import Caregiver from "../models/caregiverModel.js";
import Nurse from "../models/nurseModel.js";
import FamilyMember from "../models/familyModel.js";
import MedicationReminder from "../models/medicationReminderModel.js";
import Incident from "../models/incidentModel.js";
import Conversation from "../models/conversationModel.js";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";

const startOf = (d) => new Date(d.setHours(0,0,0,0));
const addDays = (date, days) => new Date(date.getTime() + days*24*60*60*1000);

export const getOverview = async ({ from, to } = {}) => {
  const now = new Date();
  const last7 = addDays(startOf(new Date(now)), -7);
  const last30 = addDays(startOf(new Date(now)), -30);

  // users by role
  const usersByRoleAgg = await User.aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } }
  ]);
  const usersByRole = Object.fromEntries(usersByRoleAgg.map(x => [x._id, x.count]));

  // totals
  const [hospitalsTotal, patientsTotal, nursesTotal, caregiversTotal, familyTotal] = await Promise.all([
    Hospital.countDocuments({}),
    Patient.countDocuments({}),
    Nurse.countDocuments({}),
    Caregiver.countDocuments({}),
    FamilyMember.countDocuments({})
  ]);

  // patients by status
  const patientsByStatusAgg = await Patient.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  const patientsByStatus = Object.fromEntries(patientsByStatusAgg.map(x => [x._id, x.count]));

  // new users/patients last 7/30 days
  const [newUsers7, newUsers30, newPatients7, newPatients30] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: last7 } }),
    User.countDocuments({ createdAt: { $gte: last30 } }),
    Patient.countDocuments({ createdAt: { $gte: last7 } }),
    Patient.countDocuments({ createdAt: { $gte: last30 } })
  ]);

  // incidents by type (last 30 days)
  const incidentsAgg = await Incident.aggregate([
    { $match: { occurredAt: { $gte: last30 } } },
    { $group: { _id: "$type", count: { $sum: 1 } } }
  ]);
  const incidentsByType = Object.fromEntries(incidentsAgg.map(x => [x._id, x.count]));

  // average medication adherence (last 30 days)
  const medAgg = await MedicationReminder.aggregate([
    { $match: { startDate: { $lte: new Date() } } },
    { $unwind: "$logs" },
    { $match: { "logs.date": { $gte: last30 } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        taken: { $sum: { $cond: [{ $eq: ["$logs.status", "taken"]], 1, 0] } }
      }
    }
  ]);
  const medTotal = medAgg[0]?.total || 0;
  const adherenceAvg30d = medTotal ? Math.round((medAgg[0].taken / medTotal) * 100) : 0;

  // active conversations (last 7 days)
  const activeConversations7d = await Conversation.countDocuments({ lastMessageAt: { $gte: last7 } });

  // recent activity (last 10 logs)
  const recentActivity = await SystemLog.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .select("action entityType performedBy createdAt metadata")
    .populate({ path: "performedBy", select: "firstName lastName role" })
    .lean();

  return {
    totals: {
      users: Object.values(usersByRole).reduce((a,b)=>a+b,0),
      hospitals: hospitalsTotal,
      patients: patientsTotal,
      nurses: nursesTotal,
      caregivers: caregiversTotal,
      familyMembers: familyTotal
    },
    usersByRole,
    patientsByStatus,
    newEntities: {
      usersLast7: newUsers7,
      usersLast30: newUsers30,
      patientsLast7: newPatients7,
      patientsLast30: newPatients30
    },
    incidentsByTypeLast30: incidentsByType,
    medicationAdherenceAvgLast30: adherenceAvg30d,
    activeConversationsLast7: activeConversations7d,
    recentActivity
  };
};
