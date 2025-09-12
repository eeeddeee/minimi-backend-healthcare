import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video", "document", "audio"],
      required: true
    },
    key: { type: String, required: true },
    originalName: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true }
  },
  { _id: true }
);

const incidentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: [
      "fall",
      "wandering",
      "aggression",
      "self-harm",
      "medication-error",
      "other"
    ],
    required: true
  },
  description: { type: String, required: true },
  severity: { type: Number, min: 1, max: 5, required: true },
  actionTaken: { type: String },
  status: {
    type: String,
    enum: ["open", "investigating", "resolved", "closed"],
    default: "open"
  },
  occurredAt: { type: Date, default: Date.now, required: true },
  attachments: { type: [attachmentSchema], default: [] },
  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
});

incidentSchema.index({ patientId: 1, occurredAt: -1 });
incidentSchema.index({ status: 1 });

const Incident = mongoose.model("Incident", incidentSchema);
export default Incident;
