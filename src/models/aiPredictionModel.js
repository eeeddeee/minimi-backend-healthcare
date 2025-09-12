import mongoose from "mongoose";

const aiPredictionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  predictionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  predictedMood: {
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
  predictedSleepQuality: {
    type: Number,
    min: 1,
    max: 5
  },
  riskFactors: [
    {
      type: {
        type: String,
        enum: [
          "fall",
          "wandering",
          "aggression",
          "self-harm",
          "medication-miss",
          "other"
        ]
      },
      probability: {
        type: Number,
        min: 0,
        max: 1
      },
      suggestedInterventions: [String]
    }
  ],
  caregiverStressLevel: {
    type: Number,
    min: 1,
    max: 10
  },
  stressReductionTips: [String],
  isNotified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Indexes for AI predictions
aiPredictionSchema.index({ patientId: 1, predictionDate: -1 });
aiPredictionSchema.index({ isNotified: 1 });

const AIPrediction = mongoose.model("AIPrediction", aiPredictionSchema);
export default AIPrediction;
