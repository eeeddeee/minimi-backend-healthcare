import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video", "document", "audio"],
      required: true
    },
    key: { type: String, required: true }, // S3 object key
    originalName: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true }
  },
  { _id: true }
);

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      deletedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  attachments: [
    {
      type: {
        type: String,
        enum: ["image", "video", "document", "audio"]
      },
      url: String,
      thumbnail: String,
      originalName: String,
      size: Number
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Indexes for messaging system
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isRead: 1 });
messageSchema.index({ receiverId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;

