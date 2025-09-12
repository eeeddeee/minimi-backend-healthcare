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
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"]
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"]
    },
    phone: {
      type: String,
      // validate: {
      //   validator: function (v) {
      //     return validator.isMobilePhone(v, "any", { strictMode: true });
      //   },
      //   message: (props) => `${props.value} is not a valid phone number!`
      // },
      required: true
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
        "patient"
      ]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    languagePreference: {
      type: String,
      enum: ["en", "es", "hi", "bn", "ta", "zh"],
      default: "en"
    },
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true
    },
    profile_image: {
      type: String
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"]
    },
    lastLogin: {
      type: Date,
      default: null
    },
    accessToken: {
      type: String,
      select: false
    },
    refreshToken: {
      type: String,
      select: false
    },
    // HIPAA Unique Identifier
    securityId: {
      type: String,
      default: uuidv4,
      unique: true,
      immutable: true
    },
    isPasswordChanged: { type: Boolean, default: false },
    reset_password_token: {
      type: String
    },
    reset_password_expiry: {
      type: Date
    },
    // Socket.io related fields
    socketId: {
      type: String,
      select: false
    },
    online: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        // required: true
      },
    updatedAt: {
      type: Date,
      default: Date.now
    }
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
      }
    },
    toObject: { virtuals: true }
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


// //Corrected User Schema

// import mongoose from "mongoose";
// import bcrypt from "bcrypt";
// import validator from "validator";
// import { v4 as uuidv4 } from "uuid";
// // import SystemLog from "./systemLogModel.js";

// const userSchema = new mongoose.Schema(
//   {
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       required: true,
//       index: true
//     },
//     passwordHash: {
//       type: String,
//       required: true,
//       select: false
//     },
//     firstName: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: [50, "First name cannot exceed 50 characters"]
//     },
//     lastName: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: [50, "Last name cannot exceed 50 characters"]
//     },
//     phone: {
//       type: String,
//       validate: {
//         validator: function (v) {
//           return validator.isMobilePhone(v, "any", { strictMode: true });
//         },
//         message: (props) => `${props.value} is not a valid phone number!`
//       },
//       required: true
//     },
//     role: {
//       type: String,
//       required: true,
//       enum: [
//         "super_admin",
//         "hospital",
//         "nurse",
//         "caregiver",
//         "family",
//         "patient"
//       ]
//     },
//     isActive: {
//       type: Boolean,
//       default: true
//     },
//     languagePreference: {
//       type: String,
//       enum: ["en", "es", "hi", "bn", "ta", "zh"],
//       default: "en"
//     },
//     street: {
//       type: String,
//       required: true,
//       trim: true
//     },
//     city: {
//       type: String,
//       required: true,
//       trim: true
//     },
//     state: {
//       type: String,
//       required: true,
//       trim: true
//     },
//     country: {
//       type: String,
//       required: true,
//       trim: true
//     },
//     postalCode: {
//       type: String,
//       required: true,
//       trim: true
//     },
//     profile_image: {
//       type: String
//     },
//     dateOfBirth: {
//       type: Date
//     },
//     gender: {
//       type: String,
//       enum: ["male", "female", "other"]
//     },
//     lastLogin: {
//       type: Date,
//       default: null
//     },
//     accessToken: {
//       type: String,
//       select: false
//     },
//     refreshToken: {
//       type: String,
//       select: false
//     },
//     // HIPAA Unique Identifier
//     securityId: {
//       type: String,
//       default: uuidv4,
//       unique: true,
//       immutable: true
//     },
//     isPasswordChanged: { type: Boolean, default: false },
//     reset_password_token: {
//       type: String
//     },
//     reset_password_expiry: {
//       type: Date
//     },
//     createdAt: {
//       type: Date,
//       default: Date.now,
//       immutable: true
//     },
//     updatedAt: {
//       type: Date,
//       default: Date.now
//     }
//   },
//   {
//     toJSON: {
//       virtuals: true,
//       transform: function (doc, ret) {
//         // Remove sensitive fields from API responses
//         delete ret.passwordHash;
//         delete ret.accessToken;
//         delete ret.refreshToken;
//         delete ret._id;
//         delete ret.__v;
//         ret.id = doc._id;
//         return ret;
//       }
//     },
//     toObject: { virtuals: true }
//   }
// );

// // HIPAA-required indexes
// userSchema.index({ email: 1, securityId: 1 });

// // Password hashing middleware
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("passwordHash")) return next();

//   try {
//     this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
//     next();
//   } catch (err) {
//     next(new Error("Password hashing failed"));
//   }
// });

// // Audit logging on update
// userSchema.pre("save", function (next) {
//   this.updatedAt = Date.now();
//   next();
// });

// // // PHI access logging (HIPAA requirement)
// // userSchema.post("save", function (doc) {
// //   SystemLog.create({
// //     action: "user_created",
// //     entityType: "User",
// //     entityId: doc._id,
// //     modifiedFields: Object.keys(doc.modifiedPaths())
// //   });
// // });

// // Virtual for full name (avoids storing redundant PHI)
// userSchema.virtual("fullName").get(function () {
//   return `${this.firstName} ${this.lastName}`;
// });

// // Virtual for full address
// userSchema.virtual("fullAddress").get(function () {
//   return `${this.street}, ${this.city}, ${this.state} ${this.postalCode}, ${this.country}`;
// });

// // Session timeout (30 minutes inactivity)
// userSchema.methods.checkSessionExpiry = function () {
//   return Date.now() - this.updatedAt > 30 * 60 * 1000;
// };

// const User = mongoose.model("User", userSchema);
// export default User;

// // import mongoose from "mongoose";
// // import bcrypt from "bcrypt";
// // import validator from "validator";
// // import { v4 as uuidv4 } from "uuid";
// // // import SystemLog from "./systemLogModel.js";

// // const userSchema = new mongoose.Schema(
// //   {
// //     email: {
// //       type: String,
// //       required: [true, "Email is required"],
// //       unique: true,
// //       lowercase: true,
// //       validate: [validator.isEmail, "Invalid email address"],
// //       index: true
// //     },
// //     passwordHash: {
// //       type: String,
// //       required: [true, "Password hash is required"],
// //       select: false
// //     },
// //     firstName: {
// //       type: String,
// //       required: [true, "First name is required"],
// //       trim: true,
// //       maxlength: [50, "First name cannot exceed 50 characters"]
// //     },
// //     lastName: {
// //       type: String,
// //       required: [true, "Last name is required"],
// //       trim: true,
// //       maxlength: [50, "Last name cannot exceed 50 characters"]
// //     },
// //     phone: {
// //       type: String,
// //       validate: {
// //         validator: function (v) {
// //           return validator.isMobilePhone(v, "any", { strictMode: true });
// //         },
// //         message: (props) => `${props.value} is not a valid phone number!`
// //       },
// //       required: [true, "Phone number is required"]
// //     },
// //     role: {
// //       type: String,
// //       required: true,
// //       enum: [
// //         "super_admin",
// //         "hospital",
// //         "nurse",
// //         "caregiver",
// //         "family",
// //         "patient"
// //       ],
// //     },
// //     isActive: {
// //       type: Boolean,
// //       default: true
// //     },
// //     languagePreference: {
// //       type: String,
// //       enum: ["en", "es", "hi", "bn", "ta", "zh"],
// //       default: "en"
// //     },
// //     street: {
// //       type: String,
// //       required: [true, "Street address is required"],
// //       trim: true
// //     },
// //     city: {
// //       type: String,
// //       required: [true, "City is required"],
// //       trim: true
// //     },
// //     state: {
// //       type: String,
// //       required: [true, "State is required"],
// //       trim: true
// //     },
// //     country: {
// //       type: String,
// //       required: [true, "Country is required"],
// //       trim: true
// //     },
// //     postalCode: {
// //       type: String,
// //       required: [true, "Postal code is required"],
// //       trim: true
// //     },
// //     lastLogin: {
// //       type: Date,
// //       default: null
// //     },
// //     accessToken: {
// //       type: String,
// //       select: false
// //     },
// //     refreshToken: {
// //       type: String,
// //       select: false
// //     },
// //     // HIPAA Unique Identifier
// //     securityId: {
// //       type: String,
// //       default: uuidv4,
// //       unique: true,
// //       immutable: true
// //     },
// //     isPasswordChanged: { type: Boolean, default: false },
// //     reset_password_token: {
// //       type: String
// //     },
// //     reset_password_expiry: {
// //       type: Date
// //     },
// //     createdAt: {
// //       type: Date,
// //       default: Date.now,
// //       immutable: true
// //     },
// //     updatedAt: {
// //       type: Date,
// //       default: Date.now
// //     },

// //     // // Role-Specific References
// //     // hospitalId: {
// //     //   type: mongoose.Schema.Types.ObjectId,
// //     //   ref: "Hospital",
// //     //   required: function () {
// //     //     return this.role === "nurse" || this.role === "caregiver";
// //     //   }
// //     // },
// //     // patientIds: [
// //     //   {
// //     //     type: mongoose.Schema.Types.ObjectId,
// //     //     ref: "Patient",
// //     //     validate: {
// //     //       validator: function (v) {
// //     //         return ["caregiver", "family"].includes(this.role);
// //     //       }
// //     //     }
// //     //   }
// //     // ],
// //     // // Professional Credentials
// //     // licenseNumber: {
// //     //   type: String,
// //     //   required: function () {
// //     //     return this.role === "nurse";
// //     //   },
// //     //   select: false // Sensitive credential
// //     // },

// //     // // Family Relationship
// //     // relationshipToPatient: {
// //     //   type: String,
// //     //   required: function () {
// //     //     return this.role === "family";
// //     //   },
// //     //   maxlength: 100
// //     // },

// //   },
// //   {
// //     toJSON: {
// //       virtuals: true,
// //       transform: function (doc, ret) {
// //         // Remove sensitive fields from API responses
// //         delete ret.passwordHash;
// //         delete ret.accessToken;
// //         delete ret.refreshToken;
// //         // delete ret.licenseNumber;
// //         delete ret._id;
// //         delete ret.__v;
// //         ret.id = doc._id;
// //         return ret;
// //       }
// //     },
// //     toObject: { virtuals: true }
// //   }
// // );

// // // HIPAA-required indexes
// // userSchema.index({ email: 1, securityId: 1 });
// // // userSchema.index({ hospitalId: 1, role: 1 });

// // // Password hashing middleware
// // userSchema.pre("save", async function (next) {
// //   if (!this.isModified("passwordHash")) return next();

// //   try {
// //     this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
// //     next();
// //   } catch (err) {
// //     next(new Error("Password hashing failed"));
// //   }
// // });

// // // Audit logging on update
// // userSchema.pre("save", function (next) {
// //   this.updatedAt = Date.now();
// //   next();
// // });

// // // PHI access logging (HIPAA requirement)
// // userSchema.post("save", function (doc) {
// //   SystemLog.create({
// //     action: "user_modified",
// //     entityType: "User",
// //     entityId: doc._id,
// //     modifiedFields: Object.keys(doc.modifiedPaths())
// //   });
// // });

// // // Virtual for full name (avoids storing redundant PHI)
// // userSchema.virtual("fullName").get(function () {
// //   return `${this.firstName} ${this.lastName}`;
// // });

// // // Virtual for full address
// // hospitalSchema.virtual("fullAddress").get(function () {
// //   return `${this.street}, ${this.city}, ${this.state} ${this.postalCode}, ${this.country}`;
// // });

// // // Session timeout (30 minutes inactivity)
// // userSchema.methods.checkSessionExpiry = function () {
// //   return Date.now() - this.updatedAt > 30 * 60 * 1000;
// // };

// // const User = mongoose.model("User", userSchema);
// // export default User;

// // // import mongoose from "mongoose";
// // // import mongooseEncryption from "mongoose-encryption";
// // // import dotenv from "dotenv";
// // // dotenv.config();

// // // // const encryptField = function (value) {
// // // //   if (!value) return value;
// // // //   return value;
// // // // };

// // // // Define schema for user model
// // // const userSchema = new mongoose.Schema({
// // //   full_name: {
// // //     type: String,
// // //     required: function () {
// // //       return this.provider === "local";
// // //     }
// // //   },
// // //   email: {
// // //     type: String,
// // //     required: true,
// // //     unique: true,
// // //     // set: encryptField
// // //   },
// // //   password: {
// // //     type: String,
// // //     required: function () {
// // //       return this.provider === "local";
// // //     }
// // //   },
// // //   google_id: {
// // //     type: String
// // //   },
// // //   provider: {
// // //     type: String,
// // //     enum: ["local", "google"],
// // //     default: "local"
// // //   },
// // //   phone: {
// // //     type: String,
// // //     // set: encryptField
// // //   },
// // //   country: {
// // //     type: String
// // //   },
// // //   postal_code: {
// // //     type: String
// // //   },
// // //   address: {
// // //     type: String,
// // //     // set: encryptField
// // //   },
// // //   jwt_token: {
// // //     type: String
// // //   },
// // //   refresh_token: {
// // //     type: String,
// // //     // set: encryptField
// // //   },
// // //   reset_password_token: {
// // //     type: String
// // //   },
// // //   reset_password_expiry: {
// // //     type: Date
// // //   },
// // //   setupToken: {
// // //     type: String
// // //   },
// // //   setupTokenExpires: {
// // //     type: Date
// // //   },
// // //   login_code: {
// // //     type: Number
// // //   },
// // //   login_code_expiry: {
// // //     type: Date
// // //   },
// // //   role: {
// // //     type: String,
// // //     enum: [
// // //       "super_admin",
// // //       "hospital",
// // //       "patient",
// // //       "family_member",
// // //       "nurse",
// // //       "caregiver"
// // //     ]
// // //   },
// // //   profile_image: {
// // //     type: String
// // //   },
// // //   gender: {
// // //     type: String
// // //   },
// // //   dob: {
// // //     type: Date
// // //   },
// // //   active: {
// // //     type: Boolean,
// // //     default: true
// // //   },
// // //   city: {
// // //     type: String
// // //   },
// // //   createdBy: {
// // //     type: String
// // //   },
// // //   createdAt: {
// // //     type: Date,
// // //     default: Date.now
// // //   },
// // //   updatedAt: {
// // //     type: Date,
// // //     default: Date.now
// // //   },
// // //   lastAccess: {
// // //     type: Date
// // //   },
// // //   lastAccessIP: {
// // //     type: String,
// // //     // set: encryptField
// // //   },
// // //   failedLoginAttempts: {
// // //     type: Number,
// // //     default: 0
// // //   },
// // //   accountLocked: {
// // //     type: Boolean,
// // //     default: false
// // //   },
// // //   accountLockedUntil: {
// // //     type: Date
// // //   },
// // //   passwordChangedAt: {
// // //     type: Date
// // //   },
// // //   passwordHistory: [
// // //     {
// // //       password: String,
// // //       changedAt: Date
// // //     }
// // //   ],
// // //   auditLogs: [
// // //     {
// // //       action: String,
// // //       fieldChanged: String,
// // //       timestamp: { type: Date, default: Date.now },
// // //       modifiedBy: String,
// // //       metadata: {
// // //         ipAddress: String,
// // //         userAgent: String
// // //       }
// // //     }
// // //   ]
// // // });

// // // // userSchema.plugin(mongooseEncryption, {
// // // //   encryptionKey: Buffer.from(process.env.ENCRYPTION_KEY, "base64"),
// // // //   signingKey: Buffer.from(process.env.SIGNATURE_KEY, "base64"),
// // // //   encryptedFields: [
// // // //     "email",
// // // //     "phone",
// // // //     "address",
// // // //     "refresh_token"
// // // //   ],
// // // //   requireAuthenticationCode: false,
// // // //   additionalAuthenticatedFields: ["_id", "role"]
// // // // });

// // // export default mongoose.model("User", userSchema);

// // // // import mongoose from "mongoose";
// // // // import mongooseEncryption from "mongoose-encryption";
// // // // import dotenv from "dotenv";
// // // // dotenv.config();

// // // // const encryptField = function (value) {
// // // //   if (!value) return value;
// // // //   return value;
// // // // };

// // // // // Define schema for user model
// // // // const userSchema = new mongoose.Schema({
// // // //   full_name: {
// // // //     type: String,
// // // //     required: function () {
// // // //       return this.provider === "local";
// // // //     }
// // // //   },
// // // //   email: {
// // // //     type: String,
// // // //     required: true,
// // // //     unique: true,
// // // //     set: encryptField
// // // //   },
// // // //   password: {
// // // //     type: String,
// // // //     required: function () {
// // // //       return this.provider === "local";
// // // //     }
// // // //   },
// // // //   google_id: {
// // // //     type: String
// // // //   },
// // // //   provider: {
// // // //     type: String,
// // // //     enum: ["local", "google"],
// // // //     default: "local"
// // // //   },
// // // //   phone: {
// // // //     type: String,
// // // //     set: encryptField
// // // //   },
// // // //   country: {
// // // //     type: String
// // // //   },
// // // //   postal_code: {
// // // //     type: String
// // // //   },
// // // //   address: {
// // // //     type: String,
// // // //     set: encryptField
// // // //   },
// // // //   jwt_token: {
// // // //     type: String
// // // //   },
// // // //   reset_password_token: {
// // // //     type: String
// // // //   },
// // // //   reset_password_expiry: {
// // // //     type: Date
// // // //   },
// // // //   login_code: {
// // // //     type: Number
// // // //   },
// // // //   login_code_expiry: {
// // // //     type: Date
// // // //   },
// // // //   role: {
// // // //     type: String,
// // // //     enum: [
// // // //       "super_admin",
// // // //       "hospital",
// // // //       "patient",
// // // //       "family_member",
// // // //       "nurse",
// // // //       "doctor"
// // // //     ]
// // // //   },
// // // //   profile_image: {
// // // //     type: String
// // // //   },
// // // //   gender: {
// // // //     type: String
// // // //   },
// // // //   dob: {
// // // //     type: Date
// // // //   },
// // // //   active: {
// // // //     type: Boolean,
// // // //     default: true
// // // //   },
// // // //   city: {
// // // //     type: String
// // // //   },
// // // //   createdBy: {
// // // //     type: String
// // // //   },
// // // //   createdAt: {
// // // //     type: Date,
// // // //     default: Date.now
// // // //   },
// // // //   updatedAt: {
// // // //     type: Date,
// // // //     default: Date.now
// // // //   },
// // // //   lastAccess: { type: Date },
// // // //   lastAccessIP: { type: String, set: encryptField },
// // // //   failedLoginAttempts: { type: Number, default: 0 },
// // // //   accountLocked: { type: Boolean, default: false },
// // // //   auditLogs: [
// // // //     {
// // // //       action: String,
// // // //       fieldChanged: String,
// // // //       timestamp: { type: Date, default: Date.now },
// // // //       modifiedBy: String
// // // //     }
// // // //   ]
// // // // });

// // // // userSchema.plugin(mongooseEncryption, {
// // // //   encryptionKey: Buffer.from(process.env.ENCRYPTION_KEY, "base64"),
// // // //   signingKey: Buffer.from(process.env.SIGNATURE_KEY, "base64"),
// // // //   encryptedFields: ["email", "phone", "address"],
// // // //   requireAuthenticationCode: false,
// // // //   additionalAuthenticatedFields: ["_id", "role"]
// // // // });

// // // // export default mongoose.model("User", userSchema);
