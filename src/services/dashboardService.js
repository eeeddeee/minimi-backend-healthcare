import Patient from "../models/patientModel.js";
import MedicationReminder from "../models/medicationReminderModel.js";
import PatientActivity from "../models/activityModel.js";
import Behavior from "../models/behaviorLogModel.js";
import SystemLog from "../models/systemLogModel.js";
import Caregiver from "../models/caregiverModel.js";
import FamilyMember from "../models/familyModel.js";
import { StatusCodes } from "http-status-codes";
import { ensureAccessToPatient } from "../utils/accessControl.js";

export const getUserDashboard = async (user) => {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  let patientIds = [];
  const uid = String(user._id || user.id);

  // Step 1: Get patient IDs based on role
  switch (user.role) {
    case "patient":
      // Patient: find their own patient record
      const patientRecord = await Patient.findOne({ patientUserId: user._id })
        .select("_id")
        .lean();
      if (patientRecord) {
        patientIds = [patientRecord._id];
      }
      break;

    case "caregiver":
      // Caregiver: find all patients where they are primary or secondary caregiver
      const caregiverPatients = await Patient.find({
        $or: [
          { primaryCaregiverId: { $in: [user._id] } },
          { secondaryCaregiverIds: { $in: [user._id] } },
        ],
      })
        .select("_id")
        .lean();
      patientIds = caregiverPatients.map((p) => p._id);
      break;

    case "family":
      // Family: find all patients where they are family member
      const familyPatients = await Patient.find({
        familyMemberIds: { $in: [user._id] },
      })
        .select("_id")
        .lean();
      patientIds = familyPatients.map((p) => p._id);
      break;

    case "nurse":
      // Nurse: find all patients assigned to them
      const nursePatients = await Patient.find({
        nurseIds: { $in: [user._id] },
      })
        .select("_id")
        .lean();
      patientIds = nursePatients.map((p) => p._id);
      break;

    case "hospital":
      // Hospital: all patients in their hospital
      const hospitalPatients = await Patient.find({
        hospitalId: user.hospitalId || user._id,
      })
        .select("_id")
        .lean();
      patientIds = hospitalPatients.map((p) => p._id);
      break;

    case "super_admin":
      // Super admin: all patients
      const allPatients = await Patient.find({}).select("_id").lean();
      patientIds = allPatients.map((p) => p._id);
      break;

    default:
      throw {
        statusCode: StatusCodes.FORBIDDEN,
        message: "Invalid user role",
      };
  }

  if (patientIds.length === 0) {
    return {
      recentActivities: [],
      upcomingMedications: [],
      todaySchedules: [],
      counts: {
        activities: 0,
        medications: 0,
        schedules: 0,
        patients: 0,
      },
    };
  }

  // Step 2: Fetch 4 latest activities across all assigned patients
  const recentActivities = await PatientActivity.find({
    patientId: { $in: patientIds },
  })
    .sort({ createdAt: -1 })
    .limit(4)
    .select("-__v")
    .populate({
      path: "patientId",
      select: "patientUserId patientNumber",
      populate: {
        path: "patientUserId",
        select: "firstName lastName email",
      },
    })
    .lean();

  // Step 3: Fetch 2 latest upcoming medications across all assigned patients
  const upcomingMedications = await MedicationReminder.find({
    patientId: { $in: patientIds },
    status: "active",
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
  })
    .sort({ startDate: 1, createdAt: -1 })
    .limit(2)
    .select("-__v")
    .populate({
      path: "createdBy",
      select: "firstName lastName email",
    })
    .populate({
      path: "patientId",
      select: "patientUserId patientNumber",
      populate: {
        path: "patientUserId",
        select: "firstName lastName email",
      },
    })
    .lean();

  // Step 4: Fetch 3 latest today's schedules across all assigned patients
  const todaySchedules = await PatientActivity.find({
    patientId: { $in: patientIds },
    "schedule.start": {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  })
    .sort({ "schedule.start": 1 })
    .limit(3)
    .select("-__v")
    .populate({
      path: "patientId",
      select: "patientUserId patientNumber",
      populate: {
        path: "patientUserId",
        select: "firstName lastName email",
      },
    })
    .lean();

  // Step 5: Log the action
  await SystemLog.create({
    action: "user_dashboard_viewed",
    entityType: "Dashboard",
    performedBy: user._id,
    metadata: {
      userRole: user.role,
      patientCount: patientIds.length,
      activitiesCount: recentActivities.length,
      medicationsCount: upcomingMedications.length,
      schedulesCount: todaySchedules.length,
    },
  });

  return {
    recentActivities,
    upcomingMedications,
    todaySchedules,
    counts: {
      activities: recentActivities.length,
      medications: upcomingMedications.length,
      schedules: todaySchedules.length,
      patients: patientIds.length,
    },
  };
};

export const getPatientDailyTracking = async (user, patientId, date = null) => {
  // Verify access to patient
  const patient = await ensureAccessToPatient(user, patientId);

  // Parse date or use today
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  // Parallel fetch all data for better performance
  const [behaviorData, medicationsDue, activities] = await Promise.all([
    // 1. Behavior data for the day (sleep quality, mood, incidents)
    Behavior.findOne({
      patientId: patientId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .select("-__v")
      .populate({
        path: "createdBy",
        select: "firstName lastName email",
      })
      .populate({
        path: "updatedBy",
        select: "firstName lastName email",
      })
      .populate({
        path: "incidents.reportedBy",
        select: "firstName lastName email",
      })
      .lean(),

    // 2. Due medications from MedicationReminder table
    MedicationReminder.find({
      patientId: patientId,
      status: "active",
      startDate: { $lte: endOfDay },
      $or: [{ endDate: { $gte: startOfDay } }, { endDate: null }],
    })
      .select("-__v")
      .populate({
        path: "createdBy",
        select: "firstName lastName email",
      })
      .lean(),

    // 3. Activities for the day
    PatientActivity.find({
      patientId: patientId,
      "schedule.start": {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .sort({ "schedule.start": 1 })
      .select("-__v")
      .lean(),
  ]);

  // Process medications to get today's specific times
  const todayMedicationSchedule = medicationsDue.map((med) => {
    return {
      _id: med._id,
      medicationName: med.medicationName,
      dosage: med.dosage,
      notes: med.notes,
      frequency: med.frequency,
      specificTimes: med.specificTimes || [],
      createdBy: med.createdBy,
    };
  });

  // Calculate summary statistics
  const summary = {
    sleepQuality: behaviorData?.sleepQuality?.qualityRating
      ? {
          rating: behaviorData.sleepQuality.qualityRating,
          hours: behaviorData.sleepQuality.hoursSlept || 0,
        }
      : null,
    mood: behaviorData?.mood?.moodType || null,
    incidents: {
      total: behaviorData?.incidents?.length || 0,
      bySeverity: {
        minor:
          behaviorData?.incidents?.filter((i) => i.severity === "minor")
            .length || 0,
        moderate:
          behaviorData?.incidents?.filter((i) => i.severity === "moderate")
            .length || 0,
        severe:
          behaviorData?.incidents?.filter((i) => i.severity === "severe")
            .length || 0,
      },
    },
    medicationsDue: medicationsDue.length,
    activitiesCompleted: activities.filter((act) => act.status === "completed")
      .length,
    activitiesTotal: activities.length,
  };

  // Calculate total counts across all categories
  const totalCounts = {
    sleepQualityRecorded: behaviorData?.sleepQuality?.qualityRating ? 1 : 0,
    moodRecorded: behaviorData?.mood?.moodType ? 1 : 0,
    totalIncidents: behaviorData?.incidents?.length || 0,
    totalMedicationsDue: medicationsDue.length,
    totalActivities: activities.length,
    totalActivitiesCompleted: activities.filter(
      (act) => act.status === "completed"
    ).length,
    totalActivitiesPending: activities.filter(
      (act) => act.status === "pending" || act.status === "scheduled"
    ).length,
  };

  // Log the action
  await SystemLog.create({
    action: "patient_daily_tracking_viewed",
    entityType: "DailyTracking",
    performedBy: user._id,
    entityId: patientId,
    metadata: {
      userRole: user.role,
      patientId: patientId,
      date: startOfDay,
      hasBehaviorData: !!behaviorData,
      incidentCount: behaviorData?.incidents?.length || 0,
      medicationsDue: medicationsDue.length,
      activities: activities.length,
    },
  });

  return {
    date: startOfDay,
    patientId: patientId,
    behavior: behaviorData
      ? {
          sleepQuality: behaviorData.sleepQuality || null,
          mood: behaviorData.mood || null,
          incidents: behaviorData.incidents || [],
          notes: behaviorData.notes || null,
          createdBy: behaviorData.createdBy,
          updatedBy: behaviorData.updatedBy,
          createdAt: behaviorData.createdAt,
          updatedAt: behaviorData.updatedAt,
        }
      : null,
    medicationsDue: todayMedicationSchedule,
    activities: activities,
    summary: summary,
    totalCounts: totalCounts,
  };
};

// export const getPatientDailyTracking = async (user, patientId, date = null) => {
//   // Verify access to patient
//   const patient = await ensureAccessToPatient(user, patientId);

//   // Parse date or use today
//   const targetDate = date ? new Date(date) : new Date();
//   const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
//   const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

//   // Parallel fetch all data for better performance
//   const [sleepQuality, moods, medicationLogs, activities, todayMedications] =
//     await Promise.all([
//       // 1. Sleep Quality for the day
//       SleepQuality.findOne({
//         patientId: patientId,
//         date: {
//           $gte: startOfDay,
//           $lte: endOfDay,
//         },
//       })
//         .select("-__v")
//         .populate({
//           path: "createdBy",
//           select: "firstName lastName email",
//         })
//         .lean(),

//       // 2. Moods for the day (can be multiple entries)
//       Mood.find({
//         patientId: patientId,
//         date: {
//           $gte: startOfDay,
//           $lte: endOfDay,
//         },
//       })
//         .sort({ createdAt: -1 })
//         .select("-__v")
//         .populate({
//           path: "createdBy",
//           select: "firstName lastName email",
//         })
//         .lean(),

//       // 3. Medication logs for the day
//       MedicationReminder.find({
//         patientId: patientId,
//         date: {
//           $gte: startOfDay,
//           $lte: endOfDay,
//         },
//       })
//         .sort({ scheduledTime: 1 })
//         .select("-__v")
//         .populate({
//           path: "medicationReminderId",
//           select: "medicationName dosage notes",
//         })
//         .populate({
//           path: "takenBy",
//           select: "firstName lastName email",
//         })
//         .lean(),

//       // 4. Activities for the day
//       PatientActivity.find({
//         patientId: patientId,
//         "schedule.start": {
//           $gte: startOfDay,
//           $lte: endOfDay,
//         },
//       })
//         .sort({ "schedule.start": 1 })
//         .select("-__v")
//         .lean(),

//       // 5. Today's scheduled medications (from medication reminders)
//       MedicationReminder.find({
//         patientId: patientId,
//         status: "active",
//         startDate: { $lte: endOfDay },
//         $or: [{ endDate: { $gte: startOfDay } }, { endDate: null }],
//       })
//         .select("medicationName dosage specificTimes notes frequency")
//         .lean(),
//     ]);

//   // Calculate summary statistics
//   const summary = {
//     sleepQuality: sleepQuality
//       ? {
//           rating: sleepQuality.qualityRating,
//           hours: sleepQuality.hoursSlept,
//         }
//       : null,
//     mood: moods.length > 0 ? moods[0].moodType : null, // Latest mood
//     medicationCompliance: {
//       total: medicationLogs.length,
//       taken: medicationLogs.filter((log) => log.status === "taken").length,
//       missed: medicationLogs.filter((log) => log.status === "missed").length,
//       pending: medicationLogs.filter((log) => log.status === "pending").length,
//     },
//     activitiesCompleted: activities.filter((act) => act.status === "completed")
//       .length,
//     activitiesTotal: activities.length,
//   };

//   // Log the action
//   await SystemLog.create({
//     action: "patient_daily_tracking_viewed",
//     entityType: "DailyTracking",
//     performedBy: user._id,
//     entityId: patientId,
//     metadata: {
//       userRole: user.role,
//       patientId: patientId,
//       date: startOfDay,
//       hasSleepData: !!sleepQuality,
//       moodEntries: moods.length,
//       medicationLogs: medicationLogs.length,
//       activities: activities.length,
//     },
//   });

//   return {
//     date: startOfDay,
//     patientId: patientId,
//     sleepQuality: sleepQuality || null,
//     moods: moods,
//     medications: {
//       logs: medicationLogs,
//       scheduled: todayMedications,
//     },
//     activities: activities,
//     summary: summary,
//   };
// };
