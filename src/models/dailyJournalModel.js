import mongoose from "mongoose";

const journalActivitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    duration: { type: Number }, // minutes
    notes: { type: String }
  },
  { _id: true }
);

const journalNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const dailyJournalSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
    index: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  title: { type: String },
  date: {
    type: Date,
    required: true,
    default: () => new Date()
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
    ],
    default: "calm"
  },
  sleep: {
    duration: { type: Number, min: 0, max: 24 },
    quality: { type: Number, min: 1, max: 5 }
  },
  activities: [journalActivitySchema],
  notes: [journalNoteSchema],
  summary: { type: String }, // optional daily summary
  isDeleted: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
});

dailyJournalSchema.index({ patientId: 1, date: -1 });
dailyJournalSchema.index({ authorId: 1, date: -1 });

dailyJournalSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const DailyJournal = mongoose.model("DailyJournal", dailyJournalSchema);
export default DailyJournal;
