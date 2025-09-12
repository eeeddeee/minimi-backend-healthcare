import mongoose from "mongoose";

const nurseSchema = new mongoose.Schema({
  nurseUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital"
  },
  NurselicenseNumber: {
    type: String,
    required: true
  },
  specialization: {
    type: String
  },
  yearsOfExperience: {
    type: Number
  },
  nurseShifts: [
    {
      type: String,
      enum: ["morning", "afternoon", "night"]
    }
  ],
  department: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Nurse = mongoose.model("Nurse", nurseSchema);
export default Nurse;
