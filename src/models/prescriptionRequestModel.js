import mongoose from "mongoose";

const prescriptionRequestSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
    index: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [
    {
      drugName: { type: String, required: true },
      dosage: { type: String, required: true },
      quantity: { type: Number, min: 1, required: true },
      frequency: { type: String, required: true }, // e.g., "1 tablet BID"
      notes: String
    }
  ],
  pharmacyVendor: { type: String, default: "INTEGRATION_TBD" },
  status: {
    type: String,
    enum: ["pending", "submitted", "failed"],
    default: "pending"
  },
  vendorOrderId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
});

const PrescriptionRequest = mongoose.model(
  "PrescriptionRequest",
  prescriptionRequestSchema
);
export default PrescriptionRequest;
