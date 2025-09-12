import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    hospitalUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    hospitalName: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true,
      maxlength: 100
    },
    hospitalType: {
      type: String,
      // enum: [
      //   "Government",
      //   "Private",
      //   "Specialty",
      //   "Multi-specialty",
      //   "Teaching"
      // ],
      required: true
    },
    hospitalLicenseNumber: {
      type: String,
      required: true,
      unique: true
    },
    website: {
      type: String
    },
    isVerified: {
      type: Boolean,
      default: true
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
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Unique License Number Index
hospitalSchema.index({ hospitalLicenseNumber: 1 }, { unique: true });


const Hospital = mongoose.model("Hospital", hospitalSchema);
export default Hospital;
