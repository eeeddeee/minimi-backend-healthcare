import mongoose from "mongoose";

const behaviorLogSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  caregiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  mood: {
    type: String,
    enum: [
      "happy",
      "sad",
      "anxious",
      "agitated",
      "calm",
      "confused",
      "depressed",
      "angry"
    ]
  },
  sleep: {
    duration: {
      type: Number,
      min: 0,
      max: 24
    },
    quality: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  activities: [
    {
      name: String,
      duration: Number,
      notes: String
    }
  ],
  meals: [
    {
      type: {
        type: String,
        enum: ["breakfast", "lunch", "dinner", "snack"]
      },
      description: String,
      intake: {
        type: Number,
        min: 0,
        max: 100
      }
    }
  ],
  incidents: [
    {
      type: {
        type: String,
        enum: ["fall", "wandering", "aggression", "self-harm", "other"]
      },
      description: String,
      severity: {
        type: Number,
        min: 1,
        max: 5
      },
      actionTaken: String
    }
  ],
  notes: String,
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

// Indexes for faster querying
behaviorLogSchema.index({ patientId: 1, date: -1 });
behaviorLogSchema.index({ caregiverId: 1, date: -1 });

const BehaviorLog = mongoose.model("BehaviorLog", behaviorLogSchema);
export default BehaviorLog;
