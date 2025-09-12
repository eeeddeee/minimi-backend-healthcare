import mongoose from "mongoose";

const caregiverSchema = new mongoose.Schema({
  caregiverUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
    nurseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
  certification: {
    type: String
  },
  yearsOfExperience: {
    type: Number
  },
  languagesSpoken: [
    {
      type: String
    }
  ],
  availability: [{
    type: String,
    enum: ["full-time", "part-time", "on-call"]
  }],
  caregiverShifts: [
    {
      type: String,
      enum: ["morning", "afternoon", "night"]
    }
  ],
  hourlyRate: {
    type: Number
  },
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

const Caregiver = mongoose.model("Caregiver", caregiverSchema);
export default Caregiver;
