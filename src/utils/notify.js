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
}) => {
  console.log("\n=============================");
  console.log("📨 notifyUsers STARTED");
  console.log("=============================");

  console.log("➡️  userIds:", userIds);
  console.log("➡️  title:", title);
  console.log("➡️  message:", message);
  console.log("➡️  type:", type);
  console.log("➡️  data:", data);

  if (!userIds.length) return [];

  const docs = userIds.map((id) => ({
    userId: id,
    type,
    title,
    message,
    data,
    priority,
  }));

  console.log("📝 Creating notifications in DB...");

  const created = await Notification.insertMany(docs, { ordered: false });

  console.log("✅ Notifications inserted:", created.length);

  userIds.forEach((uid, i) => {
    console.log(`📡 Emitting socket notification to user: ${uid}`);
    emitToUsers([uid], emitEvent, created[i]);

    if (emitCount) {
      console.log(`🔢 Emitting notification count +1 for user: ${uid}`);
      emitToUsers([uid], "notification:count", { delta: 1 });
    }
  });

  if (sendFCM) {
    console.log("📌 Fetching users for FCM tokens...");

    const users = await User.find(
      { _id: { $in: userIds }, fcmToken: { $ne: null } },
      { fcmToken: 1 }
    );

    console.log("📱 Users found with FCM tokens:", users.length);

    const tokens = users.map((u) => u.fcmToken).filter(Boolean);

    console.log("➡️  FCM Tokens:", tokens);

    if (tokens.length > 0) {
      console.log("🚀 Sending FCM notification...");

      await sendFCMToUsers(
        tokens,
        { title, message },
        {
          type,
          priority,
          notificationId: created[0]?._id,
          deeplink: data.deeplink,
          ...data,
        }
      );

      console.log("✅ FCM Notification sent successfully!");
    } else {
      console.log("⚠️ No valid FCM tokens. Skipping FCM.");
    }
  } else {
    console.log("⚠️ FCM sending disabled (sendFCM = false)");
  }

  console.log("=============================");
  console.log("📨 notifyUsers FINISHED");
  console.log("=============================\n");

  return created;
};
//   // Send FCM notifications
//   if (sendFCM) {
//     await sendFCMToUsers(
//       userIds,
//       { title, message },
//       {
//         type,
//         priority,
//         notificationId: created[0]?._id,
//         deeplink: data.deeplink,
//         ...data,
//       }
//     );
//   }

//   return created;
// };

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
    // if not found / deleted / role mismatch → do nothing
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

  // only for nurse/caregiver and valid submitter
  const role = submitter?.role;
  const allowed =
    submitter &&
    !submitter.isDeleted &&
    (role === "nurse" || role === "caregiver");
  if (!allowed) return [];

  // resolve hospital admin userId
  const hospitalUserId = resource?.createdBy || submitter?.createdBy;
  if (!hospitalUserId) return [];

  // make a neat name & safe comment preview
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

  const title = `New feedback on “${resource?.title || "Training"}”`;
  const stars = typeof rating === "number" ? `${rating}/5` : "feedback";
  const message =
    `${role === "nurse" ? "Nurse" : "Caregiver"} ${prettyName} submitted ${stars}` +
    (previewShort ? ` — "${previewShort}"` : ".");

  // send to hospital only (role-guarded)
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
  assignedByUserId, // optional (for message context)
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

  // role-guard to avoid accidental blast
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
    message: `You have been added as “${relationship}” for ${patientName} by ${by}.`,
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

  // role-guard to ensure it only goes to nurse
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
    title: "Caregiver assigned to you",
    message: `${cgName} has been assigned to you by ${byName}.`,
    sendFCM,
    data: {
      kind: "assign_caregiver_to_nurse_nurse_side",
      caregiverUserId,
      nurseUserId,
      assignedByUserId: assignedByUserId || null,
      deeplink: `/caregivers/${caregiverUserId}`,
    },
  });
};
