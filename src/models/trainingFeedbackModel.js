// models/trainingFeedbackModel.js
import mongoose from "mongoose";

const trainingFeedbackSchema = new mongoose.Schema({
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ELearningResource",
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now, immutable: true }
});

// one feedback per user per resource (latest could replace using upsert if needed)
trainingFeedbackSchema.index({ resourceId: 1, userId: 1 }, { unique: true });

const TrainingFeedback = mongoose.model(
  "TrainingFeedback",
  trainingFeedbackSchema
);
export default TrainingFeedback;
