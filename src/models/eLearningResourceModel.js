import mongoose from "mongoose";

const eLearningResourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  content: String, // Could be HTML content or a URL
  language: {
    type: String,
    enum: ["en", "es", "hi", "bn", "ta", "zh"],
    default: "en",
  },
  categories: [
    {
      type: String,
      // enum: [
      //   "dementia-care",
      //   "first-aid",
      //   "medication-management",
      //   "nutrition",
      //   "behavior-management",
      //   "stress-relief",
      //   "legal-issues"
      // ]
    },
  ],
  difficulty: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    default: "beginner",
  },
  duration: Number, // in minutes
  isActive: {
    type: Boolean,
    default: true,
  },
  viewedBy: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      date: {
        type: Date,
        default: Date.now,
      },
      completionPercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for e-learning resources
eLearningResourceSchema.index({ categories: 1, language: 1 });
eLearningResourceSchema.index({ isActive: 1 });

const ELearningResource = mongoose.model(
  "ELearningResource",
  eLearningResourceSchema
);
export default ELearningResource;
