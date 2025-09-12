// import mongoose from "mongoose";

// const participantSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true
//     },
//     lastReadAt: { type: Date, default: null }
//   },
//   { _id: false }
// );

// const conversationSchema = new mongoose.Schema({
//   // REMOVE patientId field completely
//   subject: {
//     type: String,
//     trim: true,
//     default: "Chat Conversation"
//   },
//   participants: {
//     type: [participantSchema],
//     required: true,
//     validate: {
//       validator: function (participants) {
//         return participants.length >= 2;
//       },
//       message: "Conversation must have at least 2 participants"
//     }
//   },
//   lastMessageAt: { type: Date, default: null, index: true },
//   lastMessagePreview: { type: String, default: "" },
//   isArchived: { type: Boolean, default: false },
//   isGroup: { type: Boolean, default: false },
//   groupName: { type: String, default: "" },
//   groupImage: { type: String, default: "" },

//   createdAt: { type: Date, default: Date.now, immutable: true },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Update indexes (remove patientId related indexes)
// conversationSchema.index({ "participants.userId": 1, lastMessageAt: -1 });
// conversationSchema.index({ isGroup: 1, lastMessageAt: -1 });

// conversationSchema.pre("save", function (next) {
//   this.updatedAt = Date.now();
//   next();
// });

// const Conversation = mongoose.model("Conversation", conversationSchema);
// export default Conversation;

import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    lastReadAt: { type: Date, default: null }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema({
  subject: { type: String, trim: true },
  participants: { type: [participantSchema], required: true }, // unique userIds expected
  lastMessageAt: { type: Date, default: null, index: true },
  lastMessagePreview: { type: String, default: "" },
  isArchived: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ "participants.userId": 1 });
conversationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
