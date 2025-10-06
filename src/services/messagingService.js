import { StatusCodes } from "http-status-codes";
import Conversation from "../models/conversationModel.js";
import Message from "../models/messageModel.js";
import SystemLog from "../models/systemLogModel.js";
import { getSignedUrlForKey } from "../utils/s3.js";
import { emitToConversation, emitToUsers } from "../sockets/sockets.js";
import User from "../models/userModel.js";
import Hospital from "../models/hospitalModel.js";
import Nurse from "../models/nurseModel.js";
import Patient from "../models/patientModel.js";
import Caregiver from "../models/caregiverModel.js";
import FamilyMember from "../models/familyModel.js";
import { notifyUsers } from "../utils/notify.js";

// Create thread
export const createThread = async ({
  subject,
  participantUserIds,
  creatorId,
}) => {
  const set = new Set(participantUserIds.map(String));
  set.add(String(creatorId));
  const participants = Array.from(set).map((uid) => ({
    userId: uid,
    lastReadAt: null,
  }));

  const convo = await Conversation.create([
    {
      subject: subject || "",
      participants,
    },
  ]);

  const saved = convo[0].toObject();

  await SystemLog.create({
    action: "conversation_created",
    entityType: "Conversation",
    entityId: saved._id,
    performedBy: creatorId,
  });

  return saved;
};

export const listThreads = async ({ userId, page = 1, limit = 10 }) => {
  const q = { "participants.userId": userId, isArchived: false };

  const threads = await Conversation.find(q)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .select("-__v")
    .populate({
      path: "participants.userId",
      select:
        "_id email firstName lastName role profile_image socketId lastSeen online",
    })
    .lean();

  // Process each thread to extract participant data
  for (let thread of threads) {
    if (thread.participants && thread.participants.length > 0) {
      // Find the other participant (not the current user)
      const otherParticipant = thread.participants.find(
        (participant) =>
          participant.userId &&
          participant.userId._id.toString() !== userId.toString()
      );

      // If found, move the user data to the main thread object
      if (otherParticipant && otherParticipant.userId) {
        thread.user = {
          _id: otherParticipant.userId._id,
          email: otherParticipant.userId.email,
          firstName: otherParticipant.userId.firstName,
          lastName: otherParticipant.userId.lastName,
          role: otherParticipant.userId.role,
          profile_image: otherParticipant.userId.profile_image,
          socketId: otherParticipant.userId.socketId,
          lastSeen: otherParticipant.userId.lastSeen,
          online: otherParticipant.userId.online,
          lastReadAt: otherParticipant.lastReadAt,
        };
      }

      delete thread.participants;
    }
  }

  await SystemLog.create({
    action: "conversations_viewed",
    entityType: "Conversation",
    performedBy: userId,
    metadata: { page, limit, count: threads.length },
  });

  return {
    participants: threads,
  };
};

export const getThreadById = async (id) => {
  const convo = await Conversation.findById(id)
    .select("-__v")
    .populate({
      path: "participants.userId",
      select: "_id email firstName lastName role profile_image",
    })
    .lean();

  if (!convo)
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Conversation not found",
    };

  // Transform participants to include full user data
  if (convo.participants && convo.participants.length > 0) {
    convo.participants = convo.participants.map((participant) => {
      if (participant.userId && typeof participant.userId === "object") {
        return {
          userId: participant.userId._id,
          lastReadAt: participant.lastReadAt,
          user: {
            _id: participant.userId._id,
            email: participant.userId.email,
            firstName: participant.userId.firstName,
            lastName: participant.userId.lastName,
            role: participant.userId.role,
            profile_image: participant.userId.profile_image,
            socketId: participant.userId.socketId,
            lastSeen: participant.userId.lastSeen,
            online: participant.userId.online,
          },
        };
      }
      return participant;
    });
  }

  await SystemLog.create({
    action: "conversation_viewed",
    entityType: "Conversation",
    entityId: id,
  });

  return { thread: convo };
};

export const postMessage = async ({
  conversationId,
  senderId,
  content,
  attachments = [],
}) => {
  const convo = await Conversation.findById(conversationId)
    .select("participants")
    .lean();

  if (!convo)
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Conversation not found",
    };

  // Find the receiver (the other participant)
  const participants = convo.participants.map((p) => p.userId.toString());
  const otherParticipants = participants.filter(
    (id) => id !== senderId.toString()
  );

  if (otherParticipants.length === 0) {
    throw {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "No other participants found in conversation",
    };
  }

  const receiverId = otherParticipants[0];

  const msg = await Message.create([
    {
      conversationId,
      senderId,
      receiverId,
      content:
        content || (attachments.length ? "(attachment)" : "(no content)"),
      attachments,
      isRead: false,
    },
  ]);

  const saved = msg[0].toObject();

  // Update conversation last message metadata
  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      lastMessageAt: new Date(),
      lastMessagePreview: content ? content.slice(0, 200) : "(attachment)",
    },
    $currentDate: { updatedAt: true },
  });

  try {
    // Notify all users in the conversation room
    emitToConversation(conversationId, "new-message", {
      message: saved,
      conversationId,
    });

    // Also notify all participants individually
    const participantIds = convo.participants.map((p) => p.userId.toString());
    emitToUsers(participantIds, "message-notification", {
      message: saved,
      conversationId,
    });
  } catch (socketError) {
    console.error("Socket notification failed:", socketError);
  }

  try {
    // Sender ka naam/email for a nicer title
    const sender = await User.findById(senderId)
      .select("firstName lastName email")
      .lean();

    const fullName =
      [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") ||
      sender?.email ||
      "Someone";

    const preview =
      saved.content && saved.content.trim()
        ? saved.content.slice(0, 140)
        : attachments.length
          ? "(attachment)"
          : "(no content)";

    // Target only recipients (all participants except sender)
    const recipientUserIds = convo.participants
      .map((p) => p.userId.toString())
      .filter((id) => id !== String(senderId));

    await notifyUsers({
      userIds: recipientUserIds,
      type: "message",
      title: `New message from ${fullName}`,
      message: preview,
      data: {
        conversationId,
        messageId: saved._id,
        senderId,
        attachmentsCount: attachments.length,
      },
      priority: "normal",
      emitEvent: "notification:new",
      emitCount: true,
    });
  } catch (notifyErr) {
    console.error("Message notification (REST) failed:", notifyErr);
  }

  await SystemLog.create({
    action: "message_sent",
    entityType: "Message",
    entityId: saved._id,
    performedBy: senderId,
    metadata: { conversationId, attachmentsCount: attachments.length },
  });

  return saved;
};

// List messages in a thread
export const listMessages = async ({
  conversationId,
  page = 1,
  limit = 20,
}) => {
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean(),
    Message.countDocuments({ conversationId }),
  ]);

  await SystemLog.create({
    action: "messages_viewed",
    entityType: "Message",
    metadata: { conversationId, page, limit, count: messages.length },
  });

  return {
    messages,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const markThreadRead = async ({ conversationId, userId }) => {
  const updatedConvo = await Conversation.findOneAndUpdate(
    { _id: conversationId, "participants.userId": userId },
    {
      $set: { "participants.$.lastReadAt": new Date() },
      $currentDate: { updatedAt: true },
    },
    { new: true }
  ).lean();

  if (!updatedConvo) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Conversation or participant not found",
    };
  }

  // Mark ALL unread messages as read
  await Message.updateMany(
    {
      conversationId,
      receiverId: userId,
      isRead: false,
    },
    {
      $set: { isRead: true },
    }
  );

  await SystemLog.create({
    action: "conversation_mark_read",
    entityType: "Conversation",
    entityId: conversationId,
    performedBy: userId,
  });

  return updatedConvo;
};

export const softDeleteMessage = async ({
  messageId,
  userId,
  conversationId,
}) => {
  // Verify user has access to this conversation
  const conversation = await Conversation.findById(conversationId);
  if (
    !conversation ||
    !conversation.participants.some(
      (p) => p.userId.toString() === userId.toString()
    )
  ) {
    throw {
      statusCode: StatusCodes.FORBIDDEN,
      message: "Access denied to conversation",
    };
  }

  // Find the message
  const message = await Message.findById(messageId);
  if (!message) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Message not found",
    };
  }

  // Check if user already deleted this message
  const alreadyDeleted = message.deletedBy.some(
    (entry) => entry.userId.toString() === userId.toString()
  );

  if (!alreadyDeleted) {
    // Add user to deletedBy array
    message.deletedBy.push({
      userId: userId,
      deletedAt: new Date(),
    });

    // If all participants have deleted, mark as completely deleted
    const participantIds = conversation.participants.map((p) =>
      p.userId.toString()
    );
    const deletedByCount = message.deletedBy.length;

    if (deletedByCount >= participantIds.length) {
      message.isDeleted = true;
    }

    await message.save();
  }

  const updatedMessage = await Message.findById(messageId)
    .populate("senderId", "firstName lastName profile_image")
    .populate("receiverId", "firstName lastName profile_image")
    .lean();

  await SystemLog.create({
    action: "message_deleted",
    entityType: "Message",
    entityId: messageId,
    performedBy: userId,
    metadata: { conversationId, softDelete: true },
  });

  return updatedMessage;
};

export const getAvailableUsersForChat = async (loggedInUser) => {
  const userId = loggedInUser._id;
  const role = loggedInUser.role;

  let userIdsToShow = [];

  // 👑 super admin: sab (khud ko chorh kar)
  if (role === "super_admin") {
    const allUsers = await User.find({
      isActive: true,
      _id: { $ne: userId },
    })
      .select(
        "_id email firstName lastName role profile_image socketId lastSeen online"
      )
      .lean();
    return allUsers;
  }

  // 🏥 hospital: apne create kiye hue users + jis super_admin ne hospital create kiya
  else if (role === "hospital") {
    const usersCreated = await User.find({ createdBy: userId })
      .select("_id")
      .lean();
    userIdsToShow = usersCreated.map((u) => u._id.toString());

    const hospital = await Hospital.findOne({ hospitalUserId: userId })
      .select("createdBy")
      .lean();
    if (hospital?.createdBy) {
      userIdsToShow.push(hospital.createdBy.toString());
    }
  } else if (role === "nurse") {
    // Find all patients assigned to this nurse
    const patients = await Patient.find({ nurseIds: userId })
      .select("patientUserId primaryCaregiverId secondaryCaregiverIds")
      .lean();

    // Collect all the patient IDs
    userIdsToShow = patients
      .map((p) => p.patientUserId)
      .filter((id) => id && id.toString()) // filter out null/empty IDs
      .map((id) => id.toString());

    // Collect caregivers associated with the patients
    patients.forEach((p) => {
      if (p.primaryCaregiverId) {
        userIdsToShow.push(p.primaryCaregiverId.toString());
      }
      if (p.secondaryCaregiverIds) {
        p.secondaryCaregiverIds.forEach((caregiver) => {
          if (caregiver) {
            userIdsToShow.push(caregiver.toString());
          }
        });
      }
    });

    // Find the creator of the nurse (who created this nurse)
    const nurse = await Nurse.findOne({ nurseUserId: userId })
      .select("createdBy")
      .lean();
    if (nurse?.createdBy) {
      // Add the creator of the nurse to the list
      userIdsToShow.push(nurse.createdBy.toString());
    }

    // Now, get all caregivers associated with this nurse
    const caregivers = await Caregiver.find({ nurseId: userId })
      .select("caregiverUserId")
      .lean();
    caregivers.forEach((caregiver) => {
      if (caregiver.caregiverUserId) {
        userIdsToShow.push(caregiver.caregiverUserId.toString());
      }
    });

    // Ensure all userIdsToShow are valid and non-empty
    userIdsToShow = userIdsToShow.filter((id) => id && id.toString());
  }

  // 🧑‍🦽 caregiver: jinko assign hai wohi patients
  else if (role === "caregiver") {
    const patients = await Patient.find({
      $or: [{ primaryCaregiverId: userId }, { secondaryCaregiverIds: userId }],
    })
      .select("patientUserId")
      .lean();
    userIdsToShow = patients
      .map((p) => p.patientUserId)
      .filter((id) => id && id.toString()) // filter out null/empty IDs
      .map((id) => id.toString());
  }

  // 🧑‍🤝‍🧑 patient: apni assigned nurse(s), caregiver(s), family members
  else if (role === "patient") {
    const patient = await Patient.findOne({ patientUserId: userId })
      .select(
        "nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds"
      )
      .lean();

    if (patient) {
      const {
        nurseIds = [],
        primaryCaregiverId = null,
        secondaryCaregiverIds = [],
        familyMemberIds = [],
      } = patient;

      // collect sab ids (nulls clean + string me convert)
      const collected = [
        ...nurseIds,
        primaryCaregiverId,
        ...(secondaryCaregiverIds || []),
        ...(familyMemberIds || []),
      ]
        .filter((id) => id && id.toString()) // filter out null/empty IDs
        .map((id) => id.toString());

      userIdsToShow = collected;
    } else {
      // agar patient profile hi na mile to empty list
      userIdsToShow = [];
    }
  }

  // ❌ koi aur role
  else {
    throw {
      statusCode: 403,
      message: "You do not have permission to view user list for chat.",
    };
  }

  if (!userIdsToShow.length) return [];

  const uniqueUserIds = [...new Set(userIdsToShow)];

  // final fetch (khud ko exclude)
  const users = await User.find({
    _id: { $in: uniqueUserIds, $ne: userId },
  })
    .select(
      "_id email firstName lastName role profile_image socketId lastSeen online"
    )
    .lean();

  return users;
};

// export const postMessage = async ({
//   conversationId,
//   senderId,
//   content,
//   attachments = []
// }) => {
//   const convo = await Conversation.findById(conversationId)
//     .select("participants")
//     .lean();

//   if (!convo)
//     throw {
//       statusCode: StatusCodes.NOT_FOUND,
//       message: "Conversation not found"
//     };

//   // Find the receiver (the other participant)
//   const participants = convo.participants.map((p) => p.userId.toString());
//   const otherParticipants = participants.filter(
//     (id) => id !== senderId.toString()
//   );

//   if (otherParticipants.length === 0) {
//     throw {
//       statusCode: StatusCodes.BAD_REQUEST,
//       message: "No other participants found in conversation"
//     };
//   }

//   const receiverId = otherParticipants[0];

//   const msg = await Message.create([
//     {
//       conversationId,
//       senderId,
//       receiverId,
//       content:
//         content || (attachments.length ? "(attachment)" : "(no content)"),
//       attachments,
//       isRead: false
//     }
//   ]);

//   const saved = msg[0].toObject();

//   // Update conversation last message metadata
//   await Conversation.findByIdAndUpdate(conversationId, {
//     $set: {
//       lastMessageAt: new Date(),
//       lastMessagePreview: content ? content.slice(0, 200) : "(attachment)"
//     },
//     $currentDate: { updatedAt: true }
//   });

//   await SystemLog.create({
//     action: "message_sent",
//     entityType: "Message",
//     entityId: saved._id,
//     performedBy: senderId,
//     metadata: { conversationId, attachmentsCount: attachments.length }
//   });

//   return saved;
// };

// export const postMessage = async ({
//   conversationId,
//   senderId,
//   content,
//   attachments = []
// }) => {
//   const convo = await Conversation.findById(conversationId)
//     .select("participants")
//     .lean();

//   if (!convo)
//     throw {
//       statusCode: StatusCodes.NOT_FOUND,
//       message: "Conversation not found"
//     };

//   // Find the receiver (the other participant)
//   const participants = convo.participants.map((p) => p.userId.toString());
//   const otherParticipants = participants.filter(
//     (id) => id !== senderId.toString()
//   );

//   if (otherParticipants.length === 0) {
//     throw {
//       statusCode: StatusCodes.BAD_REQUEST,
//       message: "No other participants found in conversation"
//     };
//   }

//   const receiverId = otherParticipants[0];

//   const msg = await Message.create([
//     {
//       conversationId,
//       senderId,
//       receiverId,
//       content:
//         content || (attachments.length ? "(attachment)" : "(no content)"),
//       attachments,
//       isRead: false
//     }
//   ]);

//   const saved = msg[0].toObject();

//   // Update conversation last message metadata
//   await Conversation.findByIdAndUpdate(conversationId, {
//     $set: {
//       lastMessageAt: new Date(),
//       lastMessagePreview: content ? content.slice(0, 200) : "(attachment)"
//     },
//     $currentDate: { updatedAt: true }
//   });

//   // Send real-time notifications via Socket.IO
//   try {
//     // Notify all users in the conversation room
//     emitToConversation(conversationId, "new-message", {
//       message: saved,
//       conversationId
//     });

//     // Also notify all participants individually
//     const participantIds = convo.participants.map((p) => p.userId.toString());
//     emitToUsers(participantIds, "message-notification", {
//       message: saved,
//       conversationId
//     });
//   } catch (socketError) {
//     console.error("Socket notification failed:", socketError);
//   }

//   await SystemLog.create({
//     action: "message_sent",
//     entityType: "Message",
//     entityId: saved._id,
//     performedBy: senderId,
//     metadata: { conversationId, attachmentsCount: attachments.length }
//   });

//   return saved;
// };

// export const getAvailableUsersForChat = async (loggedInUser) => {
//   const userId = loggedInUser._id;
//   const role = loggedInUser.role;

//   let userIdsToShow = [];

//   // super admin: sab (khud ko chorh kar)
//   if (role === "super_admin") {
//     const allUsers = await User.find({
//       isActive: true,
//       _id: { $ne: userId }
//     })
//       .select(
//         "_id email firstName lastName role profile_image socketId lastSeen online"
//       )
//       .lean();
//     return allUsers;
//   }

//   // hospital: apne create kiye hue users + jis super_admin ne hospital create kiya
//   else if (role === "hospital") {
//     const usersCreated = await User.find({ createdBy: userId })
//       .select("_id")
//       .lean();
//     userIdsToShow = usersCreated.map((u) => u._id.toString());

//     const hospital = await Hospital.findOne({ hospitalUserId: userId })
//       .select("createdBy")
//       .lean();
//     if (hospital?.createdBy) {
//       userIdsToShow.push(hospital.createdBy.toString());
//     }
//   }

//   // nurse: jinko assign hai wohi patients
//   else if (role === "nurse") {
//     const patients = await Patient.find({ nurseIds: userId })
//       .select("patientUserId")
//       .lean();
//     userIdsToShow = patients
//       .map((p) => p.patientUserId)
//       .filter(Boolean)
//       .map((id) => id.toString());
//   }

//   // caregiver: jinko assign hai wohi patients
//   else if (role === "caregiver") {
//     const patients = await Patient.find({
//       $or: [{ primaryCaregiverId: userId }, { secondaryCaregiverIds: userId }]
//     })
//       .select("patientUserId")
//       .lean();
//     userIdsToShow = patients
//       .map((p) => p.patientUserId)
//       .filter(Boolean)
//       .map((id) => id.toString());
//   }

//   // patient: apni assigned nurse(s), caregiver(s), family members
//   else if (role === "patient") {
//     const patient = await Patient.findOne({ patientUserId: userId })
//       .select(
//         "nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds"
//       )
//       .lean();

//     if (patient) {
//       const {
//         nurseIds = [],
//         primaryCaregiverId = null,
//         secondaryCaregiverIds = [],
//         familyMemberIds = []
//       } = patient;

//       // collect sab ids (nulls clean + string me convert)
//       const collected = [
//         ...nurseIds,
//         primaryCaregiverId,
//         ...(secondaryCaregiverIds || []),
//         ...(familyMemberIds || [])
//       ]
//         .filter(Boolean)
//         .map((id) => id.toString());

//       userIdsToShow = collected;
//     } else {
//       // agar patient profile hi na mile to empty list
//       userIdsToShow = [];
//     }
//   }

//   else {
//     throw {
//       statusCode: 403,
//       message: "You do not have permission to view user list for chat."
//     };
//   }

//   if (!userIdsToShow.length) return [];

//   const uniqueUserIds = [...new Set(userIdsToShow)];

//   // final fetch (khud ko exclude)
//   const users = await User.find({
//     _id: { $in: uniqueUserIds, $ne: userId }
//   })
//     .select(
//       "_id email firstName lastName role profile_image socketId lastSeen online"
//     )
//     .lean();

//   return users;
// };

// export const getAvailableUsersForChat = async (loggedInUser) => {
//   const userId = loggedInUser._id;
//   const role = loggedInUser.role;

//   let userIdsToShow = [];

//   // Super Admin: See all users
//   if (role === "super_admin") {
//     const allUsers = await User.find({
//       isActive: true,
//       _id: { $ne: userId }
//     })
//       .select(
//         "_id email firstName lastName role profile_image socketId lastSeen online"
//       )
//       .lean();
//     return allUsers;
//   }

//   // Hospital: See users created by this hospital
//   else if (role === "hospital") {
//     const usersCreated = await User.find({ createdBy: userId })
//       .select("_id")
//       .lean();
//     userIdsToShow = usersCreated.map((u) => u._id.toString());

//     // Get who created this hospital
//     const hospital = await Hospital.findOne({ hospitalUserId: userId })
//       .select("createdBy")
//       .lean();
//     if (hospital?.createdBy) {
//       userIdsToShow.push(hospital.createdBy.toString());
//     }
//   }

//   //  Nurse: See patients assigned to this nurse
//   else if (role === "nurse") {
//     const patients = await Patient.find({ nurseIds: userId })
//       .select("patientUserId")
//       .lean();
//     userIdsToShow = patients.map((p) => p.patientUserId.toString());
//   }

//   // Caregiver: See patients assigned to this caregiver
//   else if (role === "caregiver") {
//     const patients = await Patient.find({
//       $or: [{ primaryCaregiverId: userId }, { secondaryCaregiverIds: userId }]
//     })
//       .select("patientUserId")
//       .lean();
//     userIdsToShow = patients.map((p) => p.patientUserId.toString());
//   }

//   // 🧑‍🤝‍🧑 patient: apni assigned nurse(s), caregiver(s), family members
//   else if (role === "patient") {
//     const patient = await Patient.findOne({ patientUserId: userId })
//       .select(
//         "nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds"
//       )
//       .lean();

//     if (patient) {
//       const {
//         nurseIds = [],
//         primaryCaregiverId = null,
//         secondaryCaregiverIds = [],
//         familyMemberIds = []
//       } = patient;

//       // collect sab ids (nulls clean + string me convert)
//       const collected = [
//         ...nurseIds,
//         primaryCaregiverId,
//         ...(secondaryCaregiverIds || []),
//         ...(familyMemberIds || [])
//       ]
//         .filter(Boolean)
//         .map((id) => id.toString());

//       userIdsToShow = collected;
//     } else {
//       // agar patient profile hi na mile to empty list
//       userIdsToShow = [];
//     }
//   }

//   // Any other role: Access denied
//   else {
//     throw {
//       statusCode: 403,
//       message: "You do not have permission to view user list for chat."
//     };
//   }

//   //  Fetch users if list isn't empty
//   if (userIdsToShow.length === 0) return [];

//   const uniqueUserIds = [...new Set(userIdsToShow)];

//   const users = await User.find({ _id: { $in: uniqueUserIds } })
//     .select(
//       "_id email firstName lastName role profile_image socketId lastSeen online"
//     )
//     .lean();

//   return users;
// };

//   let associatedUserIds = new Set();

//   try {
//     switch (userRole) {
//       case "super_admin":
//         // Super admin can see all users
//         const allUsers = await User.find({ isActive: true })
//           .select("_id firstName lastName role profile_image online lastSeen socketId")
//           .lean();
//         return allUsers;

//       case "hospital":
//         // Hospital user can see all users in their hospital
//         const hospital = await Hospital.findOne({ hospitalUserId: userId });
//         if (!hospital) return [];

//         // Get all users belonging to this hospital
//         // Nurses in this hospital
//         const hospitalNurses = await Nurse.find({ hospitalId: hospital._id })
//           .select("nurseUserId")
//           .lean();
//         hospitalNurses.forEach(nurse => associatedUserIds.add(nurse.nurseUserId.toString()));

//         // Patients in this hospital
//         const hospitalPatients = await Patient.find({ hospitalId: hospital._id })
//           .select("patientUserId")
//           .lean();
//         hospitalPatients.forEach(patient => associatedUserIds.add(patient.patientUserId.toString()));

//         // Caregivers in this hospital
//         const hospitalCaregivers = await Caregiver.find({ hospitalId: hospital._id })
//           .select("caregiverUserId")
//           .lean();
//         hospitalCaregivers.forEach(caregiver => associatedUserIds.add(caregiver.caregiverUserId.toString()));

//         break;

//       case "nurse":
//         // Nurse can see their patients and assigned caregivers
//         const nurse = await Nurse.findOne({ nurseUserId: userId });
//         if (!nurse) return [];

//         // Get patients assigned to this nurse
//         const nursePatients = await Patient.find({ nurseIds: userId })
//           .select("patientUserId")
//           .lean();
//         nursePatients.forEach(patient => associatedUserIds.add(patient.patientUserId.toString()));

//         // Get caregivers assigned to same patients
//         const nursePatientIds = nursePatients.map(p => p._id);
//         const nurseCaregivers = await Caregiver.find({
//           patientId: { $in: nursePatientIds }
//         }).select("caregiverUserId").lean();
//         nurseCaregivers.forEach(caregiver => associatedUserIds.add(caregiver.caregiverUserId.toString()));

//         // Add hospital admin
//         if (nurse.hospitalId) {
//           const hospitalAdmin = await Hospital.findOne({ _id: nurse.hospitalId })
//             .select("hospitalUserId")
//             .lean();
//           if (hospitalAdmin) {
//             associatedUserIds.add(hospitalAdmin.hospitalUserId.toString());
//           }
//         }
//         break;

//       case "caregiver":
//         // Caregiver can see their patients, nurses, and family members
//         const caregiver = await Caregiver.findOne({ caregiverUserId: userId });
//         if (!caregiver) return [];

//         // Get patients assigned to this caregiver
//         const caregiverPatients = await Patient.find({
//           $or: [
//             { primaryCaregiverId: userId },
//             { secondaryCaregiverIds: userId }
//           ]
//         }).select("patientUserId").lean();
//         caregiverPatients.forEach(patient => associatedUserIds.add(patient.patientUserId.toString()));

//         // Get nurses for these patients
//         const caregiverPatientIds = caregiverPatients.map(p => p._id);
//         const caregiverNurses = await Nurse.find({
//           patientId: { $in: caregiverPatientIds }
//         }).select("nurseUserId").lean();
//         caregiverNurses.forEach(nurse => associatedUserIds.add(nurse.nurseUserId.toString()));

//         // Get family members for these patients
//         const caregiverFamilyMembers = await FamilyMember.find({
//           patientId: { $in: caregiverPatientIds }
//         }).select("familyMemberUserId").lean();
//         caregiverFamilyMembers.forEach(family => associatedUserIds.add(family.familyMemberUserId.toString()));

//         // Add hospital admin and assigned nurse
//         if (caregiver.hospitalId) {
//           const hospitalAdmin = await Hospital.findOne({ _id: caregiver.hospitalId })
//             .select("hospitalUserId")
//             .lean();
//           if (hospitalAdmin) {
//             associatedUserIds.add(hospitalAdmin.hospitalUserId.toString());
//           }
//         }
//         if (caregiver.nurseId) {
//           associatedUserIds.add(caregiver.nurseId.toString());
//         }
//         break;

//       case "family":
//         // Family member can see their patient, nurses, and caregivers
//         const familyMember = await FamilyMember.findOne({ familyMemberUserId: userId });
//         if (!familyMember) return [];

//         // Get patient details
//         const patient = await Patient.findById(familyMember.patientId);
//         if (!patient) return [];

//         // Add the patient
//         associatedUserIds.add(patient.patientUserId.toString());

//         // Get nurses for this patient
//         const familyNurses = await Nurse.find({ patientId: patient._id })
//           .select("nurseUserId")
//           .lean();
//         familyNurses.forEach(nurse => associatedUserIds.add(nurse.nurseUserId.toString()));

//         // Get caregivers for this patient
//         const familyCaregivers = await Caregiver.find({ patientId: patient._id })
//           .select("caregiverUserId")
//           .lean();
//         familyCaregivers.forEach(caregiver => associatedUserIds.add(caregiver.caregiverUserId.toString()));

//         // Add hospital admin
//         if (patient.hospitalId) {
//           const hospitalAdmin = await Hospital.findOne({ _id: patient.hospitalId })
//             .select("hospitalUserId")
//             .lean();
//           if (hospitalAdmin) {
//             associatedUserIds.add(hospitalAdmin.hospitalUserId.toString());
//           }
//         }
//         break;

//       case "patient":
//         // Patient can see their nurses, caregivers, and family members
//         const patientUser = await Patient.findOne({ patientUserId: userId });
//         if (!patientUser) return [];

//         // Add nurses
//         patientUser.nurseIds.forEach(nurseId => {
//           if (nurseId) associatedUserIds.add(nurseId.toString());
//         });

//         // Add primary caregivers
//         patientUser.primaryCaregiverId.forEach(caregiverId => {
//           if (caregiverId) associatedUserIds.add(caregiverId.toString());
//         });

//         // Add secondary caregivers
//         patientUser.secondaryCaregiverIds.forEach(caregiverId => {
//           if (caregiverId) associatedUserIds.add(caregiverId.toString());
//         });

//         // Add family members
//         patientUser.familyMemberIds.forEach(familyId => {
//           if (familyId) associatedUserIds.add(familyId.toString());
//         });

//         // Add hospital admin
//         if (patientUser.hospitalId) {
//           const hospitalAdmin = await Hospital.findOne({ _id: patientUser.hospitalId })
//             .select("hospitalUserId")
//             .lean();
//           if (hospitalAdmin) {
//             associatedUserIds.add(hospitalAdmin.hospitalUserId.toString());
//           }
//         }
//         break;

//       default:
//         return [];
//     }

//     // Remove current user and any null/undefined values
//     associatedUserIds.delete(userId.toString());
//     const uniqueUserIds = Array.from(associatedUserIds).filter(id => id);

//     if (uniqueUserIds.length === 0) {
//       return [];
//     }

//     // Get user details
//     const users = await User.find({
//       _id: { $in: uniqueUserIds },
//       isActive: true
//     })
//     .select("_id firstName lastName role profile_image online lastSeen socketId")
//     .lean();

//     await SystemLog.create({
//       action: "associated_users_viewed",
//       entityType: "User",
//       performedBy: userId,
//       metadata: { role: userRole, count: users.length }
//     });

//     return users;

//   } catch (error) {
//     console.error("Error in getAssociatedUsers:", error);
//     return [];
//   }
// };

// export const getAssociatedUsers = async (userId, userRole) => {
//   let associatedUserIds = [];

//   switch (userRole) {
//     case "super_admin":
//       // Super admin can see all users
//       const allUsers = await User.find({ isActive: true })
//         .select("_id firstName lastName role profile_image online lastSeen")
//         .lean();
//       return allUsers;

//     case "hospital":
//       // Hospital can see all users in their hospital
//       const hospital = await Hospital.findOne({ hospitalUserId: userId });
//       if (!hospital) return [];

//       // Get all nurses, patients, caregivers in this hospital
//       const hospitalNurses = await Nurse.find({ hospitalId: hospital._id })
//         .select("nurseUserId")
//         .lean();
//       const hospitalPatients = await Patient.find({ hospitalId: hospital._id })
//         .select("patientUserId")
//         .lean();
//       const hospitalCaregivers = await Caregiver.find({
//         hospitalId: hospital._id
//       })
//         .select("caregiverUserId")
//         .lean();

//       associatedUserIds = [
//         ...hospitalNurses.map((n) => n.nurseUserId),
//         ...hospitalPatients.map((p) => p.patientUserId),
//         ...hospitalCaregivers.map((c) => c.caregiverUserId)
//       ];
//       break;

//     case "nurse":
//       // Nurse can see their patients and assigned caregivers
//       const nurse = await Nurse.findOne({ nurseUserId: userId });
//       if (!nurse) return [];

//       // Get patients assigned to this nurse
//       const nursePatients = await Patient.find({ nurseIds: userId })
//         .select("patientUserId")
//         .lean();

//       // Get caregivers assigned to same patients
//       const nursePatientIds = nursePatients.map((p) => p.patientUserId);
//       const nurseCaregivers = await Caregiver.find({
//         patientId: { $in: nursePatientIds }
//       })
//         .select("caregiverUserId")
//         .lean();

//       associatedUserIds = [
//         ...nursePatients.map((p) => p.patientUserId),
//         ...nurseCaregivers.map((c) => c.caregiverUserId),
//         nurse.hospitalId // Hospital admin
//       ];
//       break;

//     case "caregiver":
//       // Caregiver can see their patients, nurses, and family members
//       const caregiver = await Caregiver.findOne({ caregiverUserId: userId });
//       if (!caregiver) return [];

//       // Get patients assigned to this caregiver
//       const caregiverPatients = await Patient.find({
//         $or: [{ primaryCaregiverId: userId }, { secondaryCaregiverIds: userId }]
//       })
//         .select("patientUserId")
//         .lean();

//       // Get nurses for these patients
//       const caregiverPatientIds = caregiverPatients.map((p) => p.patientUserId);
//       const caregiverNurses = await Nurse.find({
//         patientId: { $in: caregiverPatientIds }
//       })
//         .select("nurseUserId")
//         .lean();

//       // Get family members for these patients
//       const caregiverFamilyMembers = await FamilyMember.find({
//         patientId: { $in: caregiverPatientIds }
//       })
//         .select("familyMemberUserId")
//         .lean();

//       associatedUserIds = [
//         ...caregiverPatients.map((p) => p.patientUserId),
//         ...caregiverNurses.map((n) => n.nurseUserId),
//         ...caregiverFamilyMembers.map((f) => f.familyMemberUserId),
//         caregiver.hospitalId, // Hospital admin
//         caregiver.nurseId // Assigned nurse
//       ].filter((id) => id); // Remove null/undefined
//       break;

//     case "family":
//       // Family member can see their patient, nurses, and caregivers
//       const familyMember = await FamilyMember.findOne({
//         familyMemberUserId: userId
//       });
//       if (!familyMember) return [];

//       // Get patient details
//       const patient = await Patient.findById(familyMember.patientId);
//       if (!patient) return [];

//       // Get nurses and caregivers for this patient
//       const familyNurses = await Nurse.find({ patientId: patient._id })
//         .select("nurseUserId")
//         .lean();
//       const familyCaregivers = await Caregiver.find({ patientId: patient._id })
//         .select("caregiverUserId")
//         .lean();

//       associatedUserIds = [
//         patient.patientUserId,
//         ...familyNurses.map((n) => n.nurseUserId),
//         ...familyCaregivers.map((c) => c.caregiverUserId),
//         patient.hospitalId // Hospital admin
//       ];
//       break;

//     case "patient":
//       // Patient can see their nurses, caregivers, and family members
//       const patientUser = await Patient.findOne({ patientUserId: userId });
//       if (!patientUser) return [];

//       associatedUserIds = [
//         ...patientUser.nurseIds,
//         ...patientUser.primaryCaregiverId,
//         ...patientUser.secondaryCaregiverIds,
//         ...patientUser.familyMemberIds,
//         patientUser.hospitalId
//       ];
//       break;

//     default:
//       return [];
//   }

//   // Remove duplicates and current user
//   const uniqueUserIds = [
//     ...new Set(associatedUserIds.map((id) => id.toString()))
//   ].filter((id) => id !== userId.toString());

//   // Get user details
//   const users = await User.find({
//     _id: { $in: uniqueUserIds },
//     isActive: true
//   })
//     .select(
//       "_id firstName lastName role profile_image online lastSeen socketId"
//     )
//     .lean();

//   await SystemLog.create({
//     action: "associated_users_viewed",
//     entityType: "User",
//     performedBy: userId,
//     metadata: { role: userRole, count: users.length }
//   });

//   return users;
// };
