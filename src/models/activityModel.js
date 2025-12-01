import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  caregiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  nurseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  name: {
    type: String,
    required: true,
  },
  description: String,
  schedule: {
    start: {
      type: Date,
      required: true,
    },
    end: Date,
    recurrence: {
      type: String,
      enum: ["none", "daily", "weekly", "bi-weekly", "monthly"],
      default: "none",
    },
  },
  status: {
    type: String,
    enum: ["scheduled", "in-progress", "completed", "cancelled"],
    default: "scheduled",
  },
  notes: String,
  outcome: {
    type: String,
    enum: ["excellent", "good", "fair", "poor"],
  },
  isNotified: {
    type: Boolean,
    default: false,
    index: true,
  },
  notifiedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for activities
activitySchema.index({ patientId: 1, "schedule.start": 1 });
activitySchema.index({ caregiverId: 1, status: 1 });

const Activity = mongoose.model("Activity", activitySchema);
export default Activity;
