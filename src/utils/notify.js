import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import { emitToUsers } from "../sockets/sockets.js";
import ELearningResource from "../models/eLearningResourceModel.js";
import Patient from "../models/patientModel.js";
import Caregiver from "../models/caregiverModel.js";
import Nurse from "../models/nurseModel.js";
import FamilyMember from "../models/familyModel.js";
import { sendFCMToUsers } from "../services/fcmService.js";

export const notifyUsers = async ({
  userIds = [],
  type = "system",
  title,
  message,
  data = {},
  priority = "normal",
  emitEvent = "notification:new",
  emitCount = true,
  sendFCM = true,
  deeplink,
}) => {
  if (!userIds.length) return [];

  const docs = userIds.map((id) => ({
    userId: id,
    type,
    title,
    message,
    data,
    priority,
    deeplink,
  }));

  const created = await Notification.insertMany(docs, { ordered: false });

  // Emit socket events
  userIds.forEach((uid, i) => {
    emitToUsers([uid], emitEvent, created[i]);

    if (emitCount) {
      emitToUsers([uid], "notification:count", { delta: 1 });
    }
  });

  // Send FCM notifications
  if (sendFCM) {
    await sendFCMToUsers(
      userIds,
      { title, message },
      {
        type,
        priority: "high",
        notificationId: created[0]?._id,
        deeplink,
        ...data,
      }
    );
  }

  return created;
};

export const notifySuperAdmins = async ({
  type = "system",
  title,
  message,
  data = {},
  priority = "normal",
  emitEvent = "notification:new",
  sendFCM = true,
}) => {
  const supers = await User.find({
    role: "super_admin",
    isDeleted: { $ne: true },
  })
    .select("_id")
    .lean();

  const ids = supers.map((u) => u._id);
  if (!ids.length) return [];

  return notifyUsers({
    userIds: ids,
    type,
    title,
    message,
    data,
    priority,
    emitEvent,
    sendFCM,
  });
};

export const notifyUser = async ({
  userId,
  requireRole,
  type = "system",
  title,
  message,
  data = {},
  priority = "normal",
  emitEvent = "notification:new",
  emitCount = true,
  sendFCM = true,
}) => {
  if (!userId) return [];

  if (requireRole) {
    const u = await User.findById(userId).select("_id role isDeleted").lean();
    if (!u || u.isDeleted || u.role !== requireRole) return [];
  }

  return notifyUsers({
    userIds: [userId],
    type,
    title,
    message,
    data,
    priority,
    emitEvent,
    emitCount,
    sendFCM,
  });
};

export const notifyHospitalStaff = async ({
  hospitalUserId,
  title,
  message,
  data = {},
  type = "system",
  priority = "normal",
  emitEvent = "notification:new",
  emitCount = true,
  roles = ["nurse", "caregiver"],
  excludeUserId,
  sendFCM = true,
}) => {
  if (!hospitalUserId) return [];

  const q = {
    role: { $in: roles },
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    createdBy: hospitalUserId,
  };

  const staff = await User.find(q).select("_id").lean();
  let ids = staff.map((u) => String(u._id));

  if (excludeUserId) {
    const ex = String(excludeUserId);
    ids = ids.filter((id) => id !== ex);
  }
  if (!ids.length) return [];

  return notifyUsers({
    userIds: ids,
    type,
    title,
    message,
    data,
    priority,
    emitEvent,
    emitCount,
    sendFCM,
  });
};

export const notifyHospitalOnFeedback = async ({
  resourceId,
  submittedByUserId,
  rating,
  comment,
  emitEvent = "notification:new",
  emitCount = true,
  sendFCM = true,
}) => {
  if (!resourceId || !submittedByUserId) return [];

  const [resource, submitter] = await Promise.all([
    ELearningResource.findById(resourceId).select("_id title createdBy").lean(),
    User.findById(submittedByUserId)
      .select("_id role firstName lastName email createdBy isDeleted")
      .lean(),
  ]);

  const role = submitter?.role;
  const allowed =
    submitter &&
    !submitter.isDeleted &&
    (role === "nurse" || role === "caregiver");
  if (!allowed) return [];

  const hospitalUserId = resource?.createdBy || submitter?.createdBy;
  if (!hospitalUserId) return [];

  const prettyName =
    [submitter?.firstName, submitter?.lastName].filter(Boolean).join(" ") ||
    submitter?.email ||
    (role === "nurse" ? "Nurse" : "Caregiver");

  const preview = (comment || "").trim();
  const previewShort = preview
    ? preview.length > 140
      ? preview.slice(0, 140) + "…"
      : preview
    : "";

  const title = `New feedback on "${resource?.title || "Training"}"`;
  const stars = typeof rating === "number" ? `${rating}/5` : "feedback";
  const message =
    `${role === "nurse" ? "Nurse" : "Caregiver"} ${prettyName} submitted ${stars}` +
    (previewShort ? ` — "${previewShort}"` : ".");

  return notifyUser({
    userId: hospitalUserId,
    requireRole: "hospital",
    type: "system",
    title,
    message,
    priority: "normal",
    emitEvent,
    emitCount,
    sendFCM,
    data: {
      kind: "elearning_feedback_submitted",
      resourceId,
      submittedBy: submittedByUserId,
      submittedByRole: role,
      rating,
      commentPreview: previewShort,
      deeplink: `/e-learning/${resourceId}`,
    },
  });
};

const getUserPrettyName = (u) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "User";

const getPatientPrettyName = async (patientId) => {
  const p = await Patient.findById(patientId).select("patientUserId").lean();
  if (!p?.patientUserId) return "Patient";
  const u = await User.findById(p.patientUserId)
    .select("firstName lastName email")
    .lean();
  return getUserPrettyName(u) || "Patient";
};

const prettyName = (u) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "User";

const getPatientUser = async (patientId) => {
  const p = await Patient.findById(patientId).select("patientUserId").lean();
  if (!p?.patientUserId) return null;
  return User.findById(p.patientUserId)
    .select("_id role firstName lastName email")
    .lean();
};

export const notifyAssignNurseToPatient = async ({
  patientId,
  nurseUserId,
  assignedByUserId,
  type = "activity",
  priority = "normal",
  sendFCM = true,
}) => {
  if (!patientId || !nurseUserId) return [];

  const [nurse, assigner] = await Promise.all([
    User.findById(nurseUserId)
      .select("_id role firstName lastName email")
      .lean(),
    assignedByUserId
      ? User.findById(assignedByUserId)
          .select("firstName lastName email")
          .lean()
      : null,
  ]);

  if (!nurse || nurse.role !== "nurse") return [];

  const patientName = await getPatientPrettyName(patientId);
  const by = assigner ? getUserPrettyName(assigner) : "Hospital";

  return notifyUser({
    userId: nurseUserId,
    requireRole: "nurse",
    type,
    priority,
    title: "New patient assigned",
    message: `${patientName} has been assigned to you by ${by}.`,
    sendFCM,
    data: {
      kind: "assign_nurse_to_patient",
      patientId,
      nurseUserId,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/patients/${patientId}`,
    },
  });
};

export const notifyAssignCaregiverToNurse = async ({
  caregiverUserId,
  nurseUserId,
  assignedByUserId,
  type = "activity",
  priority = "normal",
  sendFCM = true,
}) => {
  if (!caregiverUserId || !nurseUserId) return [];

  const [caregiver, nurse, assigner] = await Promise.all([
    User.findById(caregiverUserId)
      .select("_id role firstName lastName email")
      .lean(),
    User.findById(nurseUserId).select("firstName lastName email").lean(),
    assignedByUserId
      ? User.findById(assignedByUserId)
          .select("firstName lastName email")
          .lean()
      : null,
  ]);

  if (!caregiver || caregiver.role !== "caregiver") return [];

  const nurseName = getUserPrettyName(nurse) || "Nurse";
  const by = assigner ? getUserPrettyName(assigner) : "Hospital";

  return notifyUser({
    userId: caregiverUserId,
    requireRole: "caregiver",
    type,
    priority,
    title: "Assigned to a nurse",
    message: `You have been assigned to ${nurseName} by ${by}.`,
    sendFCM,
    data: {
      kind: "assign_caregiver_to_nurse",
      nurseUserId,
      caregiverUserId,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/nurses/${nurseUserId}`,
    },
  });
};

export const notifyAssignCaregiverToPatient = async ({
  patientId,
  caregiverUserId,
  isPrimary = false,
  assignedByUserId,
  type = "activity",
  priority = "normal",
  sendFCM = true,
}) => {
  if (!patientId || !caregiverUserId) return [];

  const [caregiver, assigner] = await Promise.all([
    User.findById(caregiverUserId)
      .select("_id role firstName lastName email")
      .lean(),
    assignedByUserId
      ? User.findById(assignedByUserId)
          .select("firstName lastName email")
          .lean()
      : null,
  ]);

  if (!caregiver || caregiver.role !== "caregiver") return [];

  const patientName = await getPatientPrettyName(patientId);
  const by = assigner ? getUserPrettyName(assigner) : "Hospital";
  const roleText = isPrimary ? "primary caregiver" : "secondary caregiver";

  return notifyUser({
    userId: caregiverUserId,
    requireRole: "caregiver",
    type,
    priority,
    title: `Assigned as ${roleText}`,
    message: `You have been added as ${roleText} for ${patientName} by ${by}.`,
    sendFCM,
    data: {
      kind: "assign_caregiver_to_patient",
      patientId,
      caregiverUserId,
      isPrimary: !!isPrimary,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/patients/${patientId}`,
    },
  });
};

export const notifyAssignFamilyToPatient = async ({
  patientId,
  familyMemberUserId,
  relationship = "family",
  assignedByUserId,
  type = "activity",
  priority = "normal",
  sendFCM = true,
}) => {
  if (!patientId || !familyMemberUserId) return [];

  const [familyUser, assigner] = await Promise.all([
    User.findById(familyMemberUserId)
      .select("_id firstName lastName email role")
      .lean(),
    assignedByUserId
      ? User.findById(assignedByUserId)
          .select("firstName lastName email")
          .lean()
      : null,
  ]);

  if (!familyUser) return [];

  const patientName = await getPatientPrettyName(patientId);
  const by = assigner ? getUserPrettyName(assigner) : "Hospital";

  return notifyUsers({
    userIds: [familyMemberUserId],
    type,
    priority,
    title: "Added as family member",
    message: `You have been added as "${relationship}" for ${patientName} by ${by}.`,
    sendFCM,
    data: {
      kind: "assign_family_to_patient",
      patientId,
      familyMemberUserId,
      relationship,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/patients/${patientId}`,
    },
  });
};

export const notifyPatientAboutNurseAssignment = async ({
  patientId,
  nurseUserId,
  assignedByUserId,
  type = "activity",
  priority = "normal",
  sendFCM = true,
}) => {
  if (!patientId || !nurseUserId) return [];

  const [patientUser, nurse, assigner] = await Promise.all([
    getPatientUser(patientId),
    User.findById(nurseUserId).select("_id firstName lastName email").lean(),
    assignedByUserId
      ? User.findById(assignedByUserId)
          .select("firstName lastName email")
          .lean()
      : null,
  ]);
  if (!patientUser) return [];

  const nurseName = prettyName(nurse) || "Nurse";
  const by = assigner ? prettyName(assigner) : "Hospital";

  return notifyUser({
    userId: patientUser._id,
    requireRole: "patient",
    type,
    priority,
    title: "Your nurse has been assigned",
    message: `${nurseName} has been assigned as your nurse by ${by}.`,
    sendFCM,
    data: {
      kind: "assign_nurse_to_patient_patient_side",
      patientId,
      nurseUserId,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/patients/${patientId}`,
    },
  });
};

export const notifyPatientAboutCaregiverAssignment = async ({
  patientId,
  caregiverUserId,
  isPrimary = false,
  assignedByUserId,
  type = "activity",
  priority = "normal",
  sendFCM = true,
}) => {
  if (!patientId || !caregiverUserId) return [];

  const [patientUser, caregiver, assigner] = await Promise.all([
    getPatientUser(patientId),
    User.findById(caregiverUserId)
      .select("_id firstName lastName email")
      .lean(),
    assignedByUserId
      ? User.findById(assignedByUserId)
          .select("firstName lastName email")
          .lean()
      : null,
  ]);
  if (!patientUser) return [];

  const cgName = prettyName(caregiver) || "Caregiver";
  const by = assigner ? prettyName(assigner) : "Hospital";
  const roleText = isPrimary ? "primary caregiver" : "secondary caregiver";

  return notifyUser({
    userId: patientUser._id,
    requireRole: "patient",
    type,
    priority,
    title: "Caregiver assigned to you",
    message: `${cgName} has been added as your ${roleText} by ${by}.`,
    sendFCM,
    data: {
      kind: "assign_caregiver_to_patient_patient_side",
      patientId,
      caregiverUserId,
      isPrimary: !!isPrimary,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/patients/${patientId}`,
    },
  });
};

export const notifyNurseAboutCaregiverAssignment = async ({
  caregiverUserId,
  nurseUserId,
  assignedByUserId,
  type = "activity",
  priority = "normal",
  emitEvent = "notification:new",
  emitCount = true,
  sendFCM = true,
}) => {
  if (!caregiverUserId || !nurseUserId) return [];

  const [nurse, caregiver, assigner] = await Promise.all([
    User.findById(nurseUserId)
      .select("_id role firstName lastName email")
      .lean(),
    User.findById(caregiverUserId)
      .select("_id role firstName lastName email")
      .lean(),
    assignedByUserId
      ? User.findById(assignedByUserId)
          .select("firstName lastName email")
          .lean()
      : null,
  ]);

  if (!nurse || nurse.role !== "nurse") return [];

  const cgName = getUserPrettyName(caregiver) || "Caregiver";
  const byName = assigner ? getUserPrettyName(assigner) : "Hospital";

  return notifyUser({
    userId: nurseUserId,
    requireRole: "nurse",
    type,
    priority,
    emitEvent,
    emitCount,
    sendFCM,
    title: "Caregiver assigned to you",
    message: `${cgName} has been assigned to you by ${byName}.`,
    data: {
      kind: "assign_caregiver_to_nurse_nurse_side",
      caregiverUserId,
      nurseUserId,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/caregivers/${caregiverUserId}`,
    },
  });
};

// ✅ NEW FUNCTION: Notify all family members about caregiver assignment
export const notifyFamilyMembersAboutCaregiverAssignment = async ({
  patientId,
  caregiverUserId,
  isPrimary = false,
  assignedByUserId,
  type = "activity",
  priority = "normal",
  sendFCM = true,
}) => {
  if (!patientId || !caregiverUserId) return [];

  try {
    // 1. Get patient to fetch family member IDs
    const patient = await Patient.findById(patientId)
      .select("familyMemberIds patientUserId")
      .lean();

    if (
      !patient ||
      !patient.familyMemberIds ||
      !patient.familyMemberIds.length
    ) {
      console.log(`No family members found for patient ${patientId}`);
      return [];
    }

    // 2. Get caregiver, patient, and assigner info
    const [caregiver, patientUser, assigner] = await Promise.all([
      User.findById(caregiverUserId)
        .select("_id firstName lastName email")
        .lean(),
      patient.patientUserId
        ? User.findById(patient.patientUserId)
            .select("firstName lastName email")
            .lean()
        : null,
      assignedByUserId
        ? User.findById(assignedByUserId)
            .select("firstName lastName email")
            .lean()
        : null,
    ]);

    // 3. Prepare notification message
    const caregiverName = prettyName(caregiver) || "Caregiver";
    const patientName = prettyName(patientUser) || "Patient";
    const by = assigner ? prettyName(assigner) : "Hospital";
    const roleText = isPrimary ? "primary caregiver" : "secondary caregiver";

    const title = "Caregiver assigned to family member";
    const message = `${caregiverName} has been assigned as ${roleText} for ${patientName} by ${by}.`;

    // 4. Get all active family member user IDs
    const familyUsers = await User.find({
      _id: { $in: patient.familyMemberIds },
      role: "family",
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    const familyUserIds = familyUsers.map((u) => String(u._id));

    if (!familyUserIds.length) {
      console.log(`No active family members found for patient ${patientId}`);
      return [];
    }

    // 5. Send notifications to all family members
    return notifyUsers({
      userIds: familyUserIds,
      type,
      priority,
      title,
      message,
      sendFCM,
      data: {
        kind: "caregiver_assigned_to_family_patient",
        patientId,
        caregiverUserId,
        isPrimary: !!isPrimary,
        assignedByUserId: assignedByUserId || null,
        deeplink: `/patients/${patientId}`,
      },
    });
  } catch (error) {
    console.error(
      "Error notifying family members about caregiver assignment:",
      error
    );
    return [];
  }
};

/**
 * Helper: Get all users related to a patient
 * Returns: { hospitalId, nurseIds, caregiverIds, familyMemberIds, patientUserId }
 */
const getPatientRelatedUsers = async (patientId) => {
  const patient = await Patient.findById(patientId)
    .select(
      "hospitalId patientUserId nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds"
    )
    .lean();

  if (!patient) return null;

  const caregiverIds = [
    ...(patient.primaryCaregiverId || []),
    ...(patient.secondaryCaregiverIds || []),
  ];

  return {
    hospitalId: patient.hospitalId,
    nurseIds: patient.nurseIds || [],
    caregiverIds,
    familyMemberIds: patient.familyMemberIds || [],
    patientUserId: patient.patientUserId,
  };
};

/**
 * ✅ NOTIFICATION 1: Activity Created
 * Sent immediately when activity is created
 */
export const notifyActivityCreated = async ({
  activityId,
  activityName,
  patientId,
  scheduledAt,
  createdByUserId,
  sendFCM = true,
}) => {
  console.log("\n🔔 notifyActivityCreated CALLED");
  console.log("   activityId:", activityId);
  console.log("   activityName:", activityName);
  console.log("   patientId:", patientId);

  try {
    // 1. Get all related users
    const related = await getPatientRelatedUsers(patientId);
    if (!related) {
      console.log("   ❌ Patient not found");
      return [];
    }

    // 2. Get patient name
    const patientName = await getPatientPrettyName(patientId);

    // 3. Get creator name
    const creator = await User.findById(createdByUserId)
      .select("firstName lastName email role")
      .lean();
    const creatorName = prettyName(creator) || "Someone";
    const creatorRole =
      creator?.role === "nurse"
        ? "Nurse"
        : creator?.role === "caregiver"
          ? "Caregiver"
          : "Staff";

    // 4. Format scheduled time
    const scheduleTime = scheduledAt
      ? new Date(scheduledAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Not scheduled";

    // 5. Prepare notification content
    const title = "New Activity Created";
    const message = `${creatorRole} ${creatorName} created "${activityName}" for ${patientName}. Scheduled: ${scheduleTime}`;

    // 6. Collect all user IDs to notify
    const userIdsToNotify = [
      related.hospitalId,
      ...related.nurseIds,
      ...related.caregiverIds,
      ...related.familyMemberIds,
      related.patientUserId,
    ]
      .filter(Boolean)
      .map(String)
      .filter((id) => id !== String(createdByUserId)); // Exclude creator

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIdsToNotify)];

    console.log("   📨 Notifying users:", uniqueUserIds.length);

    if (!uniqueUserIds.length) {
      console.log("   ⚠️ No users to notify");
      return [];
    }

    // 7. Send notifications
    return notifyUsers({
      userIds: uniqueUserIds,
      type: "activity",
      title,
      message,
      data: {
        kind: "activity_created",
        activityId,
        activityName,
        patientId,
        scheduledAt,
        createdByUserId,
        deeplink: `/activities/${activityId}`,
      },
      priority: "normal",
      sendFCM,
    });
  } catch (error) {
    console.error("❌ Error in notifyActivityCreated:", error);
    return [];
  }
};

/**
 * ✅ NOTIFICATION 2: Activity Scheduled Time Reached
 * Sent automatically when activity's scheduled time arrives
 */
export const notifyActivityScheduled = async ({
  activityId,
  activityName,
  patientId,
  scheduledAt,
  description = "",
  sendFCM = true,
}) => {
  console.log("\n⏰ notifyActivityScheduled CALLED");
  console.log("   activityId:", activityId);
  console.log("   activityName:", activityName);
  console.log("   scheduledAt:", scheduledAt);

  try {
    // 1. Get all related users
    const related = await getPatientRelatedUsers(patientId);
    if (!related) {
      console.log("   ❌ Patient not found");
      return [];
    }

    // 2. Get patient name
    const patientName = await getPatientPrettyName(patientId);

    // 3. Format time
    const timeStr = new Date(scheduledAt).toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 4. Prepare notification content
    const title = "⏰ Activity Reminder";
    const message = `It's time for "${activityName}" for ${patientName} (${timeStr})`;

    // 5. Collect all user IDs to notify
    const userIdsToNotify = [
      related.hospitalId,
      ...related.nurseIds,
      ...related.caregiverIds,
      ...related.familyMemberIds,
      related.patientUserId,
    ]
      .filter(Boolean)
      .map(String);

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIdsToNotify)];

    console.log("   📨 Notifying users:", uniqueUserIds.length);

    if (!uniqueUserIds.length) {
      console.log("   ⚠️ No users to notify");
      return [];
    }

    // 6. Send notifications with HIGH priority
    return notifyUsers({
      userIds: uniqueUserIds,
      type: "activity",
      title,
      message,
      data: {
        kind: "activity_scheduled_time",
        activityId,
        activityName,
        patientId,
        scheduledAt,
        description,
        deeplink: `/activities/${activityId}`,
      },
      priority: "high", // ✅ High priority for scheduled reminders
      sendFCM,
    });
  } catch (error) {
    console.error("❌ Error in notifyActivityScheduled:", error);
    return [];
  }
};

/**
 * ✅ OPTIONAL: Notify Activity Completed
 * You can use this when activity is marked as completed
 */
export const notifyActivityCompleted = async ({
  activityId,
  activityName,
  patientId,
  completedByUserId,
  sendFCM = true,
}) => {
  try {
    const related = await getPatientRelatedUsers(patientId);
    if (!related) return [];

    const patientName = await getPatientPrettyName(patientId);

    const completedBy = await User.findById(completedByUserId)
      .select("firstName lastName email role")
      .lean();
    const completedByName = prettyName(completedBy) || "Someone";

    const title = "Activity Completed";
    const message = `"${activityName}" for ${patientName} was completed by ${completedByName}`;

    const userIdsToNotify = [
      related.hospitalId,
      ...related.nurseIds,
      ...related.caregiverIds,
      ...related.familyMemberIds,
      related.patientUserId,
    ]
      .filter(Boolean)
      .map(String)
      .filter((id) => id !== String(completedByUserId));

    const uniqueUserIds = [...new Set(userIdsToNotify)];

    if (!uniqueUserIds.length) return [];

    return notifyUsers({
      userIds: uniqueUserIds,
      type: "activity",
      title,
      message,
      data: {
        kind: "activity_completed",
        activityId,
        activityName,
        patientId,
        completedByUserId,
        deeplink: `/activities/${activityId}`,
      },
      priority: "normal",
      sendFCM,
    });
  } catch (error) {
    console.error("❌ Error in notifyActivityCompleted:", error);
    return [];
  }
};

/**
 * ✅ NOTIFICATION: Daily Journal Created
 * Sent when a daily journal entry is created
 */
export const notifyDailyJournalCreated = async ({
  journalId,
  patientId,
  date,
  mood,
  createdByUserId,
  sendFCM = true,
}) => {
  console.log("\n🔔 notifyDailyJournalCreated CALLED");
  console.log("   journalId:", journalId);
  console.log("   patientId:", patientId);

  try {
    // 1. Get all related users
    const related = await getPatientRelatedUsers(patientId);
    if (!related) {
      console.log("   ❌ Patient not found");
      return [];
    }

    // 2. Get patient name
    const patientName = await getPatientPrettyName(patientId);

    // 3. Get creator name
    const creator = await User.findById(createdByUserId)
      .select("firstName lastName email role")
      .lean();
    const creatorName = prettyName(creator) || "Someone";
    const creatorRole =
      creator?.role === "nurse"
        ? "Nurse"
        : creator?.role === "caregiver"
          ? "Caregiver"
          : "Staff";

    // 4. Format date
    const dateStr = new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // 5. Prepare notification content
    const title = "New Daily Journal Entry";
    const moodText = mood ? ` (Mood: ${mood})` : "";
    const message = `${creatorRole} ${creatorName} added a daily journal for ${patientName} on ${dateStr}${moodText}`;

    // 6. Collect all user IDs to notify
    const userIdsToNotify = [
      related.hospitalId,
      ...related.nurseIds,
      ...related.caregiverIds,
      ...related.familyMemberIds,
      related.patientUserId,
    ]
      .filter(Boolean)
      .map(String)
      .filter((id) => id !== String(createdByUserId)); // Exclude creator

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIdsToNotify)];

    console.log("   📨 Notifying users:", uniqueUserIds.length);

    if (!uniqueUserIds.length) {
      console.log("   ⚠️ No users to notify");
      return [];
    }

    // 7. Send notifications
    return notifyUsers({
      userIds: uniqueUserIds,
      type: "activity",
      title,
      message,
      data: {
        kind: "daily_journal_created",
        journalId,
        patientId,
        date,
        mood,
        createdByUserId,
        deeplink: `/daily-journals/${journalId}`,
      },
      priority: "normal",
      sendFCM,
    });
  } catch (error) {
    console.error("❌ Error in notifyDailyJournalCreated:", error);
    return [];
  }
};

/**
 * ✅ NOTIFICATION: Medication Reminder Created
 * Sent when a medication reminder is created
 */
export const notifyMedicationReminderCreated = async ({
  reminderId,
  patientId,
  medicationName,
  dosage,
  frequency,
  startDate,
  endDate,
  createdByUserId,
  sendFCM = true,
}) => {
  console.log("\n🔔 notifyMedicationReminderCreated CALLED");
  console.log("   reminderId:", reminderId);
  console.log("   medicationName:", medicationName);
  console.log("   patientId:", patientId);

  try {
    // 1. Get all related users
    const related = await getPatientRelatedUsers(patientId);
    if (!related) {
      console.log("   ❌ Patient not found");
      return [];
    }

    // 2. Get patient name
    const patientName = await getPatientPrettyName(patientId);

    // 3. Get creator name
    const creator = await User.findById(createdByUserId)
      .select("firstName lastName email role")
      .lean();
    const creatorName = prettyName(creator) || "Someone";
    const creatorRole =
      creator?.role === "nurse"
        ? "Nurse"
        : creator?.role === "caregiver"
          ? "Caregiver"
          : "Staff";

    // 4. Format dates
    const startStr = new Date(startDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = endDate
      ? new Date(endDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "Ongoing";

    // 5. Prepare notification content
    const title = "New Medication Reminder";
    const dosageText = dosage ? ` (${dosage})` : "";
    const message = `${creatorRole} ${creatorName} added medication reminder "${medicationName}${dosageText}" for ${patientName}. Frequency: ${frequency}, Duration: ${startStr} - ${endStr}`;

    // 6. Collect all user IDs to notify
    const userIdsToNotify = [
      related.hospitalId,
      ...related.nurseIds,
      ...related.caregiverIds,
      ...related.familyMemberIds,
      related.patientUserId,
    ]
      .filter(Boolean)
      .map(String)
      .filter((id) => id !== String(createdByUserId)); // Exclude creator

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIdsToNotify)];

    console.log("   📨 Notifying users:", uniqueUserIds.length);

    if (!uniqueUserIds.length) {
      console.log("   ⚠️ No users to notify");
      return [];
    }

    // 7. Send notifications
    return notifyUsers({
      userIds: uniqueUserIds,
      type: "activity",
      title,
      message,
      data: {
        kind: "medication_reminder_created",
        reminderId,
        medicationName,
        dosage,
        frequency,
        patientId,
        startDate,
        endDate,
        createdByUserId,
        deeplink: `/medications/reminders/${reminderId}`,
      },
      priority: "normal",
      sendFCM,
    });
  } catch (error) {
    console.error("❌ Error in notifyMedicationReminderCreated:", error);
    return [];
  }
};

/**
 * ✅ NOTIFICATION: Medication Reminder Time Reached
 * Sent automatically when medication's scheduled time arrives
 */
export const notifyMedicationReminderDue = async ({
  reminderId,
  medicationName,
  dosage,
  patientId,
  scheduledTime,
  notes = "",
  sendFCM = true,
}) => {
  console.log("\n⏰ notifyMedicationReminderDue CALLED");
  console.log("   reminderId:", reminderId);
  console.log("   medicationName:", medicationName);
  console.log("   scheduledTime:", scheduledTime);

  try {
    // 1. Get all related users
    const related = await getPatientRelatedUsers(patientId);
    if (!related) {
      console.log("   ❌ Patient not found");
      return [];
    }

    // 2. Get patient name
    const patientName = await getPatientPrettyName(patientId);

    // 3. Format time
    const timeStr = new Date(scheduledTime).toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 4. Prepare notification content
    const title = "💊 Medication Reminder";
    const dosageText = dosage ? ` (${dosage})` : "";
    const message = `Time to take "${medicationName}${dosageText}" for ${patientName} at ${timeStr}`;

    // 5. Collect all user IDs to notify
    const userIdsToNotify = [
      related.hospitalId,
      ...related.nurseIds,
      ...related.caregiverIds,
      ...related.familyMemberIds,
      related.patientUserId,
    ]
      .filter(Boolean)
      .map(String);

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIdsToNotify)];

    console.log("   📨 Notifying users:", uniqueUserIds.length);

    if (!uniqueUserIds.length) {
      console.log("   ⚠️ No users to notify");
      return [];
    }

    // 6. Send notifications with HIGH priority
    return notifyUsers({
      userIds: uniqueUserIds,
      type: "medication",
      title,
      message,
      data: {
        kind: "medication_reminder_due",
        reminderId,
        medicationName,
        dosage,
        patientId,
        scheduledTime,
        notes,
        deeplink: `/medications/reminders/${reminderId}`,
      },
      priority: "high", // ✅ High priority for medication reminders
      sendFCM,
    });
  } catch (error) {
    console.error("❌ Error in notifyMedicationReminderDue:", error);
    return [];
  }
};
