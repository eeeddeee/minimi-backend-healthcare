import mongoose from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import { v4 as uuidv4 } from "uuid";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      required: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    phone: {
      type: String,
      // validate: {
      //   validator: function (v) {
      //     return validator.isMobilePhone(v, "any", { strictMode: true });
      //   },
      //   message: (props) => `${props.value} is not a valid phone number!`
      // },
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: [
        "super_admin",
        "hospital",
        "nurse",
        "caregiver",
        "family",
        "patient",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    languagePreference: {
      type: String,
      enum: ["en", "es", "hi", "bn", "ta", "zh"],
      default: "en",
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    profile_image: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    accessToken: {
      type: String,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    // HIPAA Unique Identifier
    securityId: {
      type: String,
      default: uuidv4,
      unique: true,
      immutable: true,
    },
    isPasswordChanged: { type: Boolean, default: false },
    reset_password_token: {
      type: String,
    },
    reset_password_expiry: {
      type: Date,
    },
    // Socket.io related fields
    socketId: {
      type: String,
      select: false,
    },
    online: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isPayment: {
      type: Boolean,
      default: false,
    },
    subscription: {
      subscriptionId: { type: String },
      status: { type: String, enum: ["ACTIVE", "CANCELLED"], default: null },
      currentPeriodEnd: { type: Date },
      dueDate: { type: Date },
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Remove sensitive fields from API responses
        delete ret.passwordHash;
        delete ret.accessToken;
        delete ret.refreshToken;
        delete ret._id;
        delete ret.__v;
        ret.id = doc._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// HIPAA-required indexes
userSchema.index({ email: 1, securityId: 1 });

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();

  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    next();
  } catch (err) {
    next(new Error("Password hashing failed"));
  }
});

// Audit logging on update
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full name (avoids storing redundant PHI)
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for full address
userSchema.virtual("fullAddress").get(function () {
  return `${this.street}, ${this.city}, ${this.state} ${this.postalCode}, ${this.country}`;
});

// Session timeout (30 minutes inactivity)
userSchema.methods.checkSessionExpiry = function () {
  return Date.now() - this.updatedAt > 30 * 60 * 1000;
};

const User = mongoose.model("User", userSchema);
export default User;
