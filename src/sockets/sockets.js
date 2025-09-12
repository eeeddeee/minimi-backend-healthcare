// src/sockets/sockets.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import Conversation from "../models/conversationModel.js";
import Message from "../models/messageModel.js";

/**
 * Socket.IO singleton
 */
let io = null;

/**
 * Verify JWT from handshake
 */
const verifyToken = (token) => {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
};

/**
 * Initialize socket.io server
 */
export const initSocket = (httpServer) => {
  if (io) return io;

  // CORS origins
  const origins = process.env.SOCKET_CORS_ORIGINS
    ? process.env.SOCKET_CORS_ORIGINS.split(",").map((s) => s.trim())
    : [
        "*",
        "http://localhost:5173",
        "https://minimi-frontend-healthcare.vercel.app"
      ];

  io = new Server(httpServer, {
    cors: {
      origin: origins,
      methods: ["GET", "POST"],
      credentials: true
    },
    path: process.env.SOCKET_PATH || "/socket.io"
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers["x-auth-token"];

    const user = verifyToken(token);
    if (!user) {
      const err = new Error("Unauthorized socket");
      err.data = { status: 401 };
      return next(err);
    }
    socket.user = user;
    return next();
  });

  io.on("connection", async (socket) => {
    const userId = String(socket.user._id || socket.user.id);
    console.log(`User ${userId} connected with socket ID: ${socket.id}`);

    try {
      // Update user with socket ID and online status
      const user = await User.findByIdAndUpdate(
        userId,
        {
          socketId: socket.id,
          online: true,
          lastSeen: new Date()
        },
        { new: true }
      );

      if (!user) {
        socket.emit("error", { message: "User not found" });
        socket.disconnect();
        return;
      }

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Broadcast user online status to relevant users
      socket.broadcast.emit("user-online", { userId, online: true });
    } catch (error) {
      console.error("Error updating user online status:", error);
      socket.emit("error", { message: "Server error updating status" });
    }

    socket.on("send-message", async (data) => {
      try {
        const { conversationId, content, senderId, attachments = [] } = data;

        // ✅ ONLY VERIFY ACCESS, DON'T CREATE MESSAGE
        const conversation = await Conversation.findById(conversationId);
        if (
          !conversation ||
          !conversation.participants.some(
            (p) => p.userId.toString() === senderId
          )
        ) {
          socket.emit("error", { message: "Access denied to conversation" });
          return;
        }

        // ✅ JUST EMIT THE MESSAGE DATA, DON'T SAVE TO DB
        const messageData = {
          conversationId,
          senderId,
          content:
            content || (attachments.length ? "(attachment)" : "(no content)"),
          attachments,
          isRead: false,
          createdAt: new Date()
        };

        // ✅ EMIT TO CONVERSATION ROOM (frontend will handle display)
        io.to(`conversation:${conversationId}`).emit(
          "new-message",
          messageData
        );

        // ✅ EMIT NOTIFICATIONS TO PARTICIPANTS
        const participantIds = conversation.participants.map((p) =>
          p.userId.toString()
        );
        participantIds.forEach((userId) => {
          if (userId !== senderId) {
            io.to(`user:${userId}`).emit("message-notification", messageData);
          }
        });
      } catch (error) {
        console.error("Error handling send-message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("mark-conversation-read", async (data) => {
      try {
        const { conversationId } = data;
        const userId = socket.user._id || socket.user.id;

        // Update in database
        await Conversation.findOneAndUpdate(
          { _id: conversationId, "participants.userId": userId },
          { $set: { "participants.$.lastReadAt": new Date() } }
        );

        await Message.updateMany(
          {
            conversationId,
            receiverId: userId,
            isRead: false
          },
          { $set: { isRead: true } }
        );

        // Notify other participants
        socket.to(`conversation:${conversationId}`).emit("conversation-read", {
          conversationId,
          userId,
          readAt: new Date()
        });
      } catch (error) {
        console.error("Error marking conversation read:", error);
      }
    });

    socket.on("delete-message", async (data) => {
      try {
        const { messageId, conversationId } = data;
        const userId = socket.user._id || socket.user.id;

        // Verify access
        const conversation = await Conversation.findById(conversationId);
        if (
          !conversation ||
          !conversation.participants.some((p) => p.userId.toString() === userId)
        ) {
          socket.emit("error", { message: "Access denied to conversation" });
          return;
        }

        // Soft delete the message
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        const alreadyDeleted = message.deletedBy.some(
          (entry) => entry.userId.toString() === userId
        );

        if (!alreadyDeleted) {
          message.deletedBy.push({
            userId: userId,
            deletedAt: new Date()
          });

          const participantIds = conversation.participants.map((p) =>
            p.userId.toString()
          );
          if (message.deletedBy.length >= participantIds.length) {
            message.isDeleted = true;
          }

          await message.save();
        }

        const updatedMessage = await Message.findById(messageId)
          .populate("senderId", "firstName lastName profile_image")
          .populate("receiverId", "firstName lastName profile_image")
          .lean();

        // Notify all participants
        io.to(`conversation:${conversationId}`).emit("message-deleted", {
          messageId,
          conversationId,
          deletedBy: userId,
          updatedMessage
        });
      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // Handle conversation joining
    socket.on("join-conversation", (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        console.log(`User ${userId} joined conversation ${conversationId}`);
      }
    });

    // Handle conversation leaving
    socket.on("leave-conversation", (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        console.log(`User ${userId} left conversation ${conversationId}`);
      }
    });

    // Handle typing indicators
    socket.on("typing-start", (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit("user-typing", {
        userId,
        conversationId,
        typing: true
      });
    });

    socket.on("typing-stop", (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit("user-typing", {
        userId,
        conversationId,
        typing: false
      });
    });

    // Handle disconnection
    socket.on("disconnect", async (reason) => {
      console.log(`User ${userId} disconnected: ${reason}`);

      try {
        // Update user offline status
        await User.findByIdAndUpdate(userId, {
          online: false,
          lastSeen: new Date()
        });

        // Broadcast user offline status
        socket.broadcast.emit("user-offline", { userId, online: false });
      } catch (error) {
        console.error("Error updating user offline status:", error);
      }
    });

    // Handle manual disconnect with cleanup
    socket.on("disconnect-manual", async () => {
      try {
        await User.findByIdAndUpdate(userId, {
          online: false,
          lastSeen: new Date()
        });
        socket.broadcast.emit("user-offline", { userId, online: false });
        socket.disconnect();
      } catch (error) {
        console.error("Error in manual disconnect:", error);
      }
    });
  });

  return io;
};

/**
 * Get the io instance
 */
export const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};

/**
 * Simple emit helpers for messaging
 */
export const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};

export const emitToConversation = (conversationId, event, payload) => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
};

export const emitToUsers = (userIds = [], event, payload) => {
  if (!io || !userIds.length) return;
  userIds.forEach(userId => {
    io.to(`user:${userId}`).emit(event, payload);
  });
};





// // src/sockets/sockets.js
// import { Server } from "socket.io";
// import jwt from "jsonwebtoken";
// import User from "../models/userModel.js";
// import Conversation from "../models/conversationModel.js";
// import Message from "../models/messageModel.js";
// /**
//  * Socket.IO singleton
//  */
// let io = null;

// /**
//  * Verify JWT from handshake
//  */
// const verifyToken = (token) => {
//   if (!token) return null;
//   try {
//     const payload = jwt.verify(token, process.env.JWT_SECRET);
//     return payload;
//   } catch {
//     return null;
//   }
// };

// /**
//  * Initialize socket.io server
//  */
// export const initSocket = (httpServer) => {
//   if (io) return io;

//   // CORS origins
//   const origins = process.env.SOCKET_CORS_ORIGINS
//     ? process.env.SOCKET_CORS_ORIGINS.split(",").map((s) => s.trim())
//     : [
//         "*",
//         "http://localhost:5173",
//         "https://minimi-frontend-healthcare.vercel.app"
//       ];

//   io = new Server(httpServer, {
//     cors: {
//       origin: origins,
//       methods: ["GET", "POST"],
//       credentials: true
//     },
//     path: process.env.SOCKET_PATH || "/socket.io"
//   });

//   io.use((socket, next) => {
//     const token =
//       socket.handshake.auth?.token ||
//       socket.handshake.query?.token ||
//       socket.handshake.headers["x-auth-token"];

//     const user = verifyToken(token);
//     if (!user) {
//       const err = new Error("Unauthorized socket");
//       err.data = { status: 401 };
//       return next(err);
//     }
//     socket.user = user;
//     return next();
//   });

//   io.on("connection", async (socket) => {
//     const userId = String(socket.user._id || socket.user.id);
//     console.log(`User ${userId} connected with socket ID: ${socket.id}`);

//     try {
//       // Update user with socket ID and online status
//       const user = await User.findByIdAndUpdate(
//         userId,
//         {
//           socketId: socket.id,
//           online: true,
//           lastSeen: new Date()
//         },
//         { new: true }
//       );

//       if (!user) {
//         socket.emit("error", { message: "User not found" });
//         socket.disconnect();
//         return;
//       }

//       // Join user's personal room
//       socket.join(`user:${userId}`);

//       // Broadcast user online status to relevant users
//       // You might want to emit this to the user's contacts or conversations
//       socket.broadcast.emit("user-online", { userId, online: true });
//     } catch (error) {
//       console.error("Error updating user online status:", error);
//       socket.emit("error", { message: "Server error updating status" });
//     }

//     socket.on("send-message", async (data) => {
//       try {
//         const { conversationId, content, senderId, attachments = [] } = data;

//         // Verify user has access to this conversation
//         const conversation = await Conversation.findById(conversationId);
//         if (
//           !conversation ||
//           !conversation.participants.some(
//             (p) => p.userId.toString() === senderId
//           )
//         ) {
//           socket.emit("error", { message: "Access denied to conversation" });
//           return;
//         }

//         // Find receiver (other participant)
//         const participants = conversation.participants.map((p) =>
//           p.userId.toString()
//         );
//         const otherParticipants = participants.filter((id) => id !== senderId);
//         const receiverId = otherParticipants[0];

//         // Create and save the message
//         const message = await Message.create({
//           conversationId,
//           senderId,
//           receiverId,
//           content:
//             content || (attachments.length ? "(attachment)" : "(no content)"),
//           attachments,
//           isRead: false
//         });

//         // Populate sender info for the frontend
//         const populatedMessage = await Message.findById(message._id)
//           .populate("senderId", "firstName lastName profile_image")
//           .populate("receiverId", "firstName lastName profile_image")
//           .lean();

//         // Update conversation last message
//         await Conversation.findByIdAndUpdate(conversationId, {
//           lastMessageAt: new Date(),
//           lastMessagePreview: content ? content.slice(0, 200) : "(attachment)",
//           updatedAt: new Date()
//         });

//         // ✅ EMIT TO CONVERSATION ROOM
//         io.to(`conversation:${conversationId}`).emit(
//           "new-message",
//           populatedMessage
//         );

//         // ✅ EMIT NOTIFICATIONS TO PARTICIPANTS
//         const participantIds = conversation.participants.map((p) =>
//           p.userId.toString()
//         );
//         participantIds.forEach((userId) => {
//           if (userId !== senderId) {
//             io.to(`user:${userId}`).emit(
//               "message-notification",
//               populatedMessage
//             );
//           }
//         });
//       } catch (error) {
//         console.error("Error handling send-message:", error);
//         socket.emit("error", { message: "Failed to send message" });
//       }
//     });

//     socket.on("mark-conversation-read", async (data) => {
//       try {
//         const { conversationId } = data;
//         const userId = socket.user._id || socket.user.id;

//         // Update in database
//         await Conversation.findOneAndUpdate(
//           { _id: conversationId, "participants.userId": userId },
//           { $set: { "participants.$.lastReadAt": new Date() } }
//         );

//         await Message.updateMany(
//           {
//             conversationId,
//             receiverId: userId,
//             isRead: false
//           },
//           { $set: { isRead: true } }
//         );

//         // Notify other participants
//         socket.to(`conversation:${conversationId}`).emit("conversation-read", {
//           conversationId,
//           userId,
//           readAt: new Date()
//         });
//       } catch (error) {
//         console.error("Error marking conversation read:", error);
//       }
//     });

//     // Handle conversation joining
//     socket.on("join-conversation", (conversationId) => {
//       if (conversationId) {
//         socket.join(`conversation:${conversationId}`);
//         console.log(`User ${userId} joined conversation ${conversationId}`);
//       }
//     });

//     // Handle conversation leaving
//     socket.on("leave-conversation", (conversationId) => {
//       if (conversationId) {
//         socket.leave(`conversation:${conversationId}`);
//         console.log(`User ${userId} left conversation ${conversationId}`);
//       }
//     });

//     // Handle typing indicators
//     socket.on("typing-start", (data) => {
//       const { conversationId } = data;
//       socket.to(`conversation:${conversationId}`).emit("user-typing", {
//         userId,
//         conversationId,
//         typing: true
//       });
//     });

//     socket.on("typing-stop", (data) => {
//       const { conversationId } = data;
//       socket.to(`conversation:${conversationId}`).emit("user-typing", {
//         userId,
//         conversationId,
//         typing: false
//       });
//     });

//     // Handle disconnection
//     socket.on("disconnect", async (reason) => {
//       console.log(`User ${userId} disconnected: ${reason}`);

//       try {
//         // Update user offline status
//         await User.findByIdAndUpdate(userId, {
//           online: false,
//           lastSeen: new Date()
//           // Don't clear socketId if you want to track last connection
//         });

//         // Broadcast user offline status
//         socket.broadcast.emit("user-offline", { userId, online: false });
//       } catch (error) {
//         console.error("Error updating user offline status:", error);
//       }
//     });

//     // Handle manual disconnect with cleanup
//     socket.on("disconnect-manual", async () => {
//       try {
//         await User.findByIdAndUpdate(userId, {
//           online: false,
//           lastSeen: new Date()
//         });
//         socket.broadcast.emit("user-offline", { userId, online: false });
//         socket.disconnect();
//       } catch (error) {
//         console.error("Error in manual disconnect:", error);
//       }
//     });
//   });

//   return io;
// };


// /**
//  * Get the io instance
//  */
// export const getIO = () => {
//   if (!io) throw new Error("Socket.IO not initialized");
//   return io;
// };

// /**
//  * Simple emit helpers for messaging
//  */
// export const emitToUser = (userId, event, payload) => {
//   if (!io) return;
//   io.to(`user:${userId}`).emit(event, payload);
// };

// export const emitToConversation = (conversationId, event, payload) => {
//   if (!io) return;
//   io.to(`conversation:${conversationId}`).emit(event, payload);
// };

// export const emitToUsers = (userIds = [], event, payload) => {
//   if (!io || !userIds.length) return;
//   userIds.forEach(userId => {
//     io.to(`user:${userId}`).emit(event, payload);
//   });o.to(`user:${userId}`).emit(event, payload);
//   // });
// };