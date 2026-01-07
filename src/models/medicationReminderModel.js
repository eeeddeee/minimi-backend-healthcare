import mongoose from "mongoose";

const medicationReminderSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  medicationName: {
    type: String,
    required: true,
  },
  dosage: {
    type: String,
    required: true,
  },
  notes: {
    type: String,
  },
  frequency: {
    type: String,
    enum: ["daily", "weekly", "bi-weekly", "monthly", "as needed"],
    required: true,
  },
  specificTimes: [
    {
      type: String,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
    },
  ],
  startDate: {
    type: Date,
    required: true,
  },
  endDate: Date,
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  logs: [
    {
      date: {
        type: Date,
        required: true,
      },
      time: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      status: {
        type: String,
        enum: ["taken", "missed", "skipped", "partial"],
        required: true,
      },
      notedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      notes: String,
    },
  ],
  lastNotifiedAt: {
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

// Indexes for medication reminders
medicationReminderSchema.index({ patientId: 1, status: 1 });
medicationReminderSchema.index({ patientId: 1, endDate: 1 });

const MedicationReminder = mongoose.model(
  "MedicationReminder",
  medicationReminderSchema
);
export default MedicationReminder;
