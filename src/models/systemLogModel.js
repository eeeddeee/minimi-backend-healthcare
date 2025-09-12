import mongoose from "mongoose";

const systemLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true
      // enum: [
      //   "user_login",
      //   "user_logout",
      //   "password_change",
      //   "password_reset",
      //   "api_access",
      //   "user_created",
      //   "password_changed",
      //   "hospital_created",
      //   "hospitals_viewed",
      //   "hospital_viewed",
      //   "hospital_updated",
      //   "hospital_deleted",
      //   "nurse_created",
      //   "nurses_viewed",
      //   "nurse_viewed",
      //   "nurse_updated",
      //   "nurse_deleted",
      //   "caregiver_created",
      //   "caregivers_viewed",
      //   "caregiver_viewed",
      //   "caregiver_updated",
      //   "caregiver_deleted",
      //   "patient_created",
      //   "patients_viewed",
      //   "patient_viewed",
      //   "patient_updated",
      //   "patient_deleted",
      //   "family_created",
      //   "family_viewed",
      //   "family_viewed",
      //   "family_updated",
      //   "family_deleted",
      //   "medication_reminder_created"
      // ]
    },
    entityType: {
      type: String,
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

systemLogSchema.index({ entityType: 1, entityId: 1 });
systemLogSchema.index({ action: 1, timestamp: -1 });

export default mongoose.model("SystemLog", systemLogSchema);



// import mongoose from "mongoose";

// const systemLogSchema = new mongoose.Schema({
//   action: { type: String, required: true, index: true },          // e.g., "user_created"
//   entityType: { type: String, required: true, index: true },       // e.g., "User"
//   entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
//   performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
//   metadata: { type: Object, default: {} },
//   ip: { type: String, default: null },
//   userAgent: { type: String, default: null },
//   createdAt: { type: Date, default: Date.now, immutable: true }
// });

// systemLogSchema.index({ createdAt: -1 });

// const SystemLog = mongoose.model("SystemLog", systemLogSchema);
// export default SystemLog;
