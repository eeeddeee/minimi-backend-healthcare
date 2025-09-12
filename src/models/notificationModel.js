// models/notificationModel.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  // recipient of the notification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  // optional: for patient-scoped events (so we can enforce access)
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    index: true
  },

  type: {
    type: String,
    enum: [
      "ai_risk",
      "medication",
      "behavior",
      "activity",
      "incident",
      "message",
      "report",
      "system"
    ],
    required: true
  },

  title: { type: String, required: true },
  message: { type: String, required: true },

  // optional deep-link/context payload
  data: { type: Object, default: {} },

  priority: {
    type: String,
    enum: ["low", "normal", "high", "critical"],
    default: "normal"
  },

  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false } // flip to true when you want email fallback
  },

  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },

  isAcknowledged: { type: Boolean, default: false }, // explicit “seen/ack” separate from read
  acknowledgedAt: { type: Date, default: null },

  isDeleted: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
});

notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1 });

notificationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
