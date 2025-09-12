import mongoose from "mongoose";

const familyMemberSchema = new mongoose.Schema(
  {
    familyMemberUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true
    },
    relationship: {
      type: String,
      required: true,
      enum: ["spouse", "parent", "child", "sibling", "guardian", "other"]
    },
    canMakeAppointments: {
      type: Boolean,
      default: false
    },
    canAccessMedicalRecords: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const FamilyMember = mongoose.model("FamilyMember", familyMemberSchema);
export default FamilyMember;