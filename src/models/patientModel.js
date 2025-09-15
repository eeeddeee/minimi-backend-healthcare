import mongoose from "mongoose";

const patientSchema = new mongoose.Schema({
  patientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },
  primaryCaregiverId: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  secondaryCaregiverIds: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  ],
  familyMemberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  nurseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  patientNumber: {
    type: String,
    unique: true,
    // required: true
  },
  bloodGroup: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
  },
  medicalConditions: [{ type: String }],
  allergies: [{ type: String }],
  currentMedications: [
    {
      name: String,
      dosage: String,
      frequency: String,
      startDate: Date,
      endDate: Date,
      prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    }
  ],
  height: Number,
  weight: Number,
  primaryPhysician: String,
  emergencyContacts: [
    {
      name: String,
      relationship: String,
      phone: String,
      email: String
    }
  ],
  insurance: {
    provider: String,
    policyNumber: String,
    expiry: Date
  },
  status: {
    type: String,
    enum: ["active", "inactive", "deceased", "discharged"],
    default: "active"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  isDeleted: { type: Boolean, default: false },
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
patientSchema.pre("save", async function (next) {
  if (this.isNew) {
    // Find the latest patient to get the last patient number
    const lastPatient = await this.constructor
      .findOne()
      .sort({ createdAt: -1 })
      .limit(1);

    let nextPatientNumber = "PTN00001";

    if (lastPatient && lastPatient.patientNumber) {

      const lastPatientNumber = lastPatient.patientNumber;
      const numericPart = parseInt(lastPatientNumber.replace("PTN", ""));
      nextPatientNumber = `PTN${(numericPart + 1).toString().padStart(5, "0")}`;
    }


    this.patientNumber = nextPatientNumber;
  }
  next();
});

patientSchema.index({ nurseIds: 1 });

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;