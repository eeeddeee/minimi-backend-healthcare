import mongoose from "mongoose";

const patientStatusHistorySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
    index: true
  },
  fromStatus: {
    type: String,
    enum: ["active", "inactive", "deceased", "discharged", null],
    default: null
  },
  toStatus: {
    type: String,
    enum: ["active", "inactive", "deceased", "discharged"],
    required: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  notes: {
    type: String
  },
  effectiveAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Helpful compound index for timelines
patientStatusHistorySchema.index({ patientId: 1, effectiveAt: -1 });

const PatientStatusHistory = mongoose.model(
  "PatientStatusHistory",
  patientStatusHistorySchema
);

export default PatientStatusHistory;
