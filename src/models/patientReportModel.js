import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["weekly", "monthly", "custom"],
    required: true
  },
  period: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  content: {
    summary: String,
    behaviorTrends: [
      {
        metric: String,
        values: [Number],
        labels: [String]
      }
    ],
    medicationAdherence: {
      type: Number,
      min: 0,
      max: 100
    },
    activityParticipation: {
      type: Number,
      min: 0,
      max: 100
    },
    incidentCount: Number,
    notes: String
  },
  sharedWith: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Indexes for reports
reportSchema.index({ patientId: 1, "period.end": -1 });
reportSchema.index({ generatedBy: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;
