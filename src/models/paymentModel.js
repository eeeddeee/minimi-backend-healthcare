import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    email: {
      type: String,
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    subscriptionId: { type: String },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd",
    },
    cancellationNote: { type: String, default: null },
    cancellationFeedback: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED","CANCELLED"],
      default: "PENDING",
    },
    startDate: { type: Date },
    dueDate: { type: Date }, 
  },
  { timestamps: true }
);

const PrescriptionRequest = mongoose.model(
  "Payment",
  paymentSchema
);
export default PrescriptionRequest;
