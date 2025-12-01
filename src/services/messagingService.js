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
  // Create sorted participant set for comparison
  const allParticipantIds = [...participantUserIds, creatorId].map(String);
  const sortedParticipants = [...new Set(allParticipantIds)].sort();

  // Check if conversation already exists with exact same participants
  const existingConversation = await Conversation.findOne({
    "participants.userId": { $all: sortedParticipants },
    $expr: {
      $eq: [{ $size: "$participants" }, sortedParticipants.length],
    },
  }).lean();

  if (existingConversation) {
    // Check if conversation is not deleted/archived
    if (!existingConversation.isDeleted && !existingConversation.isArchived) {
      throw {
        statusCode: StatusCodes.CONFLICT,
        message: "Conversation already exists with these participants.",
        existingConversationId: existingConversation._id,
      };
    } else {
      // If deleted/archived, restore it
      await Conversation.findByIdAndUpdate(existingConversation._id, {
        isDeleted: false,
        isArchived: false,
        updatedAt: new Date(),
      });
      return existingConversation;
    }
  }

  const participants = sortedParticipants.map((uid) => ({
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
// export const createThread = async ({
//   subject,
//   participantUserIds,
//   creatorId,
// }) => {
//   const set = new Set(participantUserIds.map(String));
//   set.add(String(creatorId));
//   const participants = Array.from(set).map((uid) => ({
//     userId: uid,
//     lastReadAt: null,
//   }));

//   const convo = await Conversation.create([
//     {
//       subject: subject || "",
//       participants,
//     },
//   ]);

//   const saved = convo[0].toObject();

//   await SystemLog.create({
//     action: "conversation_created",
//     entityType: "Conversation",
//     entityId: saved._id,
//     performedBy: creatorId,
//   });

//   return saved;
// };

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
      deeplink: "MessageScreen",
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

  //super admin
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

  // hospital
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
  }
  // nurse
  else if (role === "nurse") {
    // Find all patients assigned to this nurse
    const patients = await Patient.find({ nurseIds: userId })
      .select("patientUserId primaryCaregiverId secondaryCaregiverIds")
      .lean();

    // Collect all the patient IDs
    userIdsToShow = patients
      .map((p) => p.patientUserId)
      .filter((id) => id && id.toString())
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
  // caregiver
  else if (role === "caregiver") {
    // Find the caregiver record to get assigned nurseId
    const caregiver = await Caregiver.findOne({ caregiverUserId: userId })
      .select("createdBy nurseId")
      .lean();

    // Find all patients assigned to this caregiver
    const patients = await Patient.find({
      $or: [{ primaryCaregiverId: userId }, { secondaryCaregiverIds: userId }],
    })
      .select("patientUserId hospitalId")
      .lean();

    // Collect patient user IDs
    userIdsToShow = patients
      .map((p) => p.patientUserId)
      .filter((id) => id && id.toString())
      .map((id) => id.toString());

    // Add ONLY the assigned nurse
    if (caregiver?.nurseId) {
      userIdsToShow.push(caregiver.nurseId.toString());
    }

    // Add hospital user who created the caregiver
    if (caregiver?.createdBy) {
      userIdsToShow.push(caregiver.createdBy.toString());
    }

    // Find family members of all assigned patients
    for (const patient of patients) {
      if (patient._id) {
        const familyMembers = await FamilyMember.find({
          patientId: patient._id,
        })
          .select("familyMemberUserId")
          .lean();

        familyMembers.forEach((family) => {
          if (family.familyMemberUserId) {
            userIdsToShow.push(family.familyMemberUserId.toString());
          }
        });
      }
    }

    // Remove duplicates and ensure valid IDs
    userIdsToShow = [...new Set(userIdsToShow)].filter(
      (id) => id && id.toString()
    );
  }

  // patient
  else if (role === "patient") {
    const patient = await Patient.findOne({ patientUserId: userId })
      .select(
        "nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds createdBy"
      )
      .lean();

    if (patient) {
      const collected = [
        ...(patient.nurseIds || []),
        ...(patient.primaryCaregiverId || []),
        ...(patient.secondaryCaregiverIds || []),
        ...(patient.familyMemberIds || []),
      ]
        .filter((id) => id && id.toString().length > 0)
        .map((id) => id.toString());

      userIdsToShow = collected;

      // Use createdBy directly - yeh hospital user ID hai
      if (patient.createdBy && patient.createdBy.toString()) {
        userIdsToShow.push(patient.createdBy.toString());
        console.log(
          "Added hospital user via createdBy:",
          patient.createdBy.toString()
        );
      }
    }

    // Remove any empty/null IDs
    userIdsToShow = userIdsToShow.filter(
      (id) => id && id.toString() && id.toString().length > 0
    );
  }

  // family
  else if (role === "family") {
    // find which patient(s) this family user is attached to
    const familyRelations = await FamilyMember.find({
      familyMemberUserId: userId,
    })
      .select("patientId")
      .lean();

    if (familyRelations.length) {
      for (const relation of familyRelations) {
        const patient = await Patient.findById(relation.patientId)
          .select(
            "patientUserId primaryCaregiverId secondaryCaregiverIds nurseIds createdBy"
          )
          .lean();

        if (!patient) continue;

        // add the patient
        if (patient.patientUserId) {
          userIdsToShow.push(patient.patientUserId.toString());
        }

        // add caregivers
        if (patient.primaryCaregiverId) {
          userIdsToShow.push(patient.primaryCaregiverId.toString());
        }
        if (patient.secondaryCaregiverIds?.length) {
          patient.secondaryCaregiverIds.forEach((id) => {
            if (id && id.toString()) {
              userIdsToShow.push(id.toString());
            }
          });
        }

        // add nurses
        if (patient.nurseIds?.length) {
          patient.nurseIds.forEach((id) => {
            if (id && id.toString()) {
              userIdsToShow.push(id.toString());
            }
          });
        }

        // add hospital from patient
        if (patient.createdBy && patient.createdBy.toString()) {
          userIdsToShow.push(patient.createdBy.toString());
          console.log(
            "Added hospital user via createdBy:",
            patient.createdBy.toString()
          );
        }
      }
    }

    // Remove any empty/null IDs before proceeding
    userIdsToShow = userIdsToShow.filter(
      (id) => id && id.toString() && id.toString().length > 0
    );
  } else {
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
