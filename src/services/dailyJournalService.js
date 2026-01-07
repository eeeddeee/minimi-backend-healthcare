import { StatusCodes } from "http-status-codes";
import DailyJournal from "../models/dailyJournalModel.js";
import SystemLog from "../models/systemLogModel.js";
import { notifyDailyJournalCreated } from "../utils/notify.js";

// CREATE
export const createJournal = async (data, authorId) => {
  const doc = await DailyJournal.create([
    {
      ...data,
      authorId,
      notes: (data.notes || []).map((n) => ({
        text: n.text,
        addedBy: authorId,
      })),
    },
  ]);
  const saved = doc[0].toObject();

  await SystemLog.create({
    action: "daily_journal_created",
    entityType: "DailyJournal",
    entityId: saved._id,
    performedBy: authorId,
    metadata: { patientId: saved.patientId, date: saved.date },
  });

  // SEND NOTIFICATIONS TO ALL RELEVANT USERS
  try {
    await notifyDailyJournalCreated({
      journalId: saved._id,
      patientId: saved.patientId,
      date: saved.date,
      mood: saved.mood,
      createdByUserId: authorId,
      sendFCM: true,
    });
  } catch (error) {
    console.error(
      "❌ Error sending daily journal creation notifications:",
      error
    );
  }

  return saved;
};

// LIST
export const getJournals = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const query = { isDeleted: false, patientId: filters.patientId };

  if (filters.from || filters.to) {
    query.date = {};
    if (filters.from) query.date.$gte = new Date(filters.from);
    if (filters.to) query.date.$lte = new Date(filters.to);
  }
  if (filters.mood) query.mood = filters.mood;

  const [items, total] = await Promise.all([
    DailyJournal.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .populate({ path: "authorId", select: "firstName lastName role email" })
      .lean(),
    DailyJournal.countDocuments(query),
  ]);

  await SystemLog.create({
    action: "daily_journals_viewed",
    entityType: "DailyJournal",
    metadata: { filters, page, limit, count: items.length },
  });

  return {
    journals: items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// GET BY ID
export const getJournalById = async (id) => {
  const journal = await DailyJournal.findById(id)
    .select("-__v")
    .populate({ path: "authorId", select: "firstName lastName role email" })
    .lean();

  if (!journal || journal.isDeleted) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Daily journal not found",
    };
  }

  await SystemLog.create({
    action: "daily_journal_viewed",
    entityType: "DailyJournal",
    entityId: id,
  });

  return { journal };
};

// UPDATE
export const updateJournal = async (id, updates = {}, performedBy) => {
  const set = { ...updates };
  if (updates.notes) {
    // if caller tries to replace notes array, keep as plain text notes (no addedBy overwrite)
    set.notes = updates.notes.map((n) => ({
      text: n.text,
      addedBy: performedBy,
      addedAt: new Date(),
    }));
  }

  const updated = await DailyJournal.findByIdAndUpdate(
    id,
    { $set: set, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated || updated.isDeleted) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Daily journal not found",
    };
  }

  await SystemLog.create({
    action: "daily_journal_updated",
    entityType: "DailyJournal",
    entityId: id,
    performedBy,
    metadata: { fields: Object.keys(updates) },
  });

  return updated;
};

// SOFT DELETE
export const softDeleteJournal = async (id, performedBy) => {
  const updated = await DailyJournal.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Daily journal not found",
    };
  }

  await SystemLog.create({
    action: "daily_journal_deleted",
    entityType: "DailyJournal",
    entityId: id,
    performedBy,
  });

  return updated;
};

// --- Incremental sub-updates ---

export const addActivityToJournal = async (id, activity, performedBy) => {
  const updated = await DailyJournal.findByIdAndUpdate(
    id,
    { $push: { activities: activity }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated || updated.isDeleted) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Daily journal not found",
    };
  }

  await SystemLog.create({
    action: "daily_journal_activity_added",
    entityType: "DailyJournal",
    entityId: id,
    performedBy,
    metadata: { name: activity.name },
  });

  return updated;
};

export const updateActivityInJournal = async (
  id,
  activityId,
  updates,
  performedBy
) => {
  const set = Object.fromEntries(
    Object.entries(updates).map(([k, v]) => [`activities.$.${k}`, v])
  );
  const updated = await DailyJournal.findOneAndUpdate(
    { _id: id, "activities._id": activityId },
    { $set: set, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated || updated.isDeleted) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Daily journal or activity not found",
    };
  }

  await SystemLog.create({
    action: "daily_journal_activity_updated",
    entityType: "DailyJournal",
    entityId: id,
    performedBy,
    metadata: { activityId },
  });

  return updated;
};

export const addNoteToJournal = async (id, text, performedBy) => {
  const note = { text, addedBy: performedBy, addedAt: new Date() };

  const updated = await DailyJournal.findByIdAndUpdate(
    id,
    { $push: { notes: note }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated || updated.isDeleted) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Daily journal not found",
    };
  }

  await SystemLog.create({
    action: "daily_journal_note_added",
    entityType: "DailyJournal",
    entityId: id,
    performedBy,
  });

  return updated;
};

export const updateNoteInJournal = async (id, noteId, text, performedBy) => {
  const updated = await DailyJournal.findOneAndUpdate(
    { _id: id, "notes._id": noteId },
    { $set: { "notes.$.text": text }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated || updated.isDeleted) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Daily journal or note not found",
    };
  }

  await SystemLog.create({
    action: "daily_journal_note_updated",
    entityType: "DailyJournal",
    entityId: id,
    performedBy,
    metadata: { noteId },
  });

  return updated;
};
