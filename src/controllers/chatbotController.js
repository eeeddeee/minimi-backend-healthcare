import OpenAI from 'openai';
import mongoose from 'mongoose';
import Activity from '../models/activityModel.js';
import BehaviorLog from '../models/behaviorLogModel.js';
import MedicationReminder from '../models/medicationReminderModel.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Get all patient data
const getAllPatientData = async (patientId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            throw new Error('Invalid patient ID format');
        }

        const objectId = new mongoose.Types.ObjectId(patientId);

        const [activities, behaviorLogs, medications] = await Promise.all([
            Activity.find({ patientId: objectId })
                .sort({ 'schedule.start': -1 })
                .lean(),

            BehaviorLog.find({ patientId: objectId })
                .sort({ date: -1 })
                .lean(),

            MedicationReminder.find({ patientId: objectId })
                .lean()
        ]);

        return {
            success: true,
            data: {
                activities,
                behaviorLogs,
                medications
            },
            counts: {
                activities: activities.length,
                behaviorLogs: behaviorLogs.length,
                medications: medications.length
            }
        };

    } catch (error) {
        console.error('Error in getAllPatientData:', error);
        return {
            success: false,
            error: error.message,
            data: {
                activities: [],
                behaviorLogs: [],
                medications: []
            }
        };
    }
};

// Check if activity should occur today based on recurrence
const shouldActivityOccurToday = (activity) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startDate = new Date(activity.schedule.start);
    const endDate = activity.schedule.end ? new Date(activity.schedule.end) : null;

    // Check if today is within activity period
    if (today < startDate || (endDate && today > endDate)) {
        return false;
    }

    const recurrence = activity.schedule.recurrence || 'none';

    switch (recurrence) {
        case 'none':
            // Non-recurring activity - check if start date is today
            const activityStartDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            return activityStartDay.getTime() === today.getTime();

        case 'daily':
            // Daily activity - occurs every day
            return true;

        case 'weekly':
            // Weekly activity - occurs on same day of week
            const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
            return daysSinceStart % 7 === 0;

        case 'bi-weekly':
            // Bi-weekly activity - every 2 weeks
            const biWeeklyDaysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
            return biWeeklyDaysSinceStart % 14 === 0;

        case 'monthly':
            // Monthly activity - same date each month
            return today.getDate() === startDate.getDate();

        default:
            return false;
    }
};

// Get upcoming activities (next 7 days)
const getUpcomingActivities = (activities, days = 7) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    const upcoming = [];

    activities.forEach(activity => {
        const startDate = new Date(activity.schedule.start);
        const endDate = activity.schedule.end ? new Date(activity.schedule.end) : null;
        const recurrence = activity.schedule.recurrence || 'none';

        // Check each day from today to futureDate
        const checkDate = new Date(today);

        while (checkDate <= futureDate) {
            // Skip if before start date or after end date
            if (checkDate < startDate || (endDate && checkDate > endDate)) {
                checkDate.setDate(checkDate.getDate() + 1);
                continue;
            }

            let shouldOccur = false;

            switch (recurrence) {
                case 'none':
                    // Single occurrence
                    const activityDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                    shouldOccur = activityDay.getTime() === checkDate.getTime();
                    break;

                case 'daily':
                    shouldOccur = true;
                    break;

                case 'weekly':
                    const daysDiff = Math.floor((checkDate - startDate) / (1000 * 60 * 60 * 24));
                    shouldOccur = daysDiff % 7 === 0;
                    break;

                case 'bi-weekly':
                    const biWeeklyDaysDiff = Math.floor((checkDate - startDate) / (1000 * 60 * 60 * 24));
                    shouldOccur = biWeeklyDaysDiff % 14 === 0;
                    break;

                case 'monthly':
                    shouldOccur = checkDate.getDate() === startDate.getDate();
                    break;
            }

            if (shouldOccur) {
                upcoming.push({
                    ...activity,
                    occurrenceDate: new Date(checkDate),
                    isToday: checkDate.getTime() === today.getTime()
                });
            }

            checkDate.setDate(checkDate.getDate() + 1);
        }
    });

    // Sort by date
    return upcoming.sort((a, b) => a.occurrenceDate - b.occurrenceDate);
};

// Check if question is about today
const isTodayQuestion = (question) => {
    const q = question.toLowerCase();
    return q.includes('today') || q.includes('now') || q.includes('currently');
};

// Get question type
const getQuestionType = (question) => {
    const q = question.toLowerCase();

    if (q.includes('medic') || q.includes('medicine')) {
        return 'medication';
    } else if (q.includes('activity') || q.includes('schedule')) {
        return 'activity';
    } else if (q.includes('mood') || q.includes('behavior')) {
        return 'behavior';
    } else if (q.includes('sleep')) {
        return 'sleep';
    } else if (q.includes('summary') || q.includes('overall')) {
        return 'summary';
    } else {
        return 'general';
    }
};

// Filter medications
const filterMedications = (medications, question) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (isTodayQuestion(question)) {
        return medications.filter(med => {
            if (med.status !== 'active') return false;

            const startDate = new Date(med.startDate);
            const endDate = med.endDate ? new Date(med.endDate) : null;

            const isTodayInRange = today >= startDate && (!endDate || today <= endDate);
            if (!isTodayInRange) return false;

            if (med.frequency === 'daily') return true;

            const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

            switch (med.frequency) {
                case 'weekly':
                    return daysSinceStart % 7 === 0;
                case 'bi-weekly':
                    return daysSinceStart % 14 === 0;
                case 'monthly':
                    return daysSinceStart % 30 === 0;
                default:
                    return false;
            }
        });
    } else {
        return medications.filter(med => {
            if (med.status !== 'active') return false;

            const startDate = new Date(med.startDate);
            const endDate = med.endDate ? new Date(med.endDate) : null;

            return now >= startDate && (!endDate || now <= endDate);
        });
    }
};

// Filter activities based on question
const filterActivities = (activities, question) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (isTodayQuestion(question)) {
        // For "today" questions - check recurrence
        return activities.filter(activity => shouldActivityOccurToday(activity));
    } else if (question.toLowerCase().includes('upcoming') || question.toLowerCase().includes('next')) {
        // For upcoming questions
        return getUpcomingActivities(activities, 7);
    } else {
        // For general activity questions
        return activities.slice(0, 10); // Last 10 activities
    }
};

// Get behavior data
const getBehaviorData = (behaviorLogs, question) => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (isTodayQuestion(question)) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return behaviorLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= today && logDate < tomorrow;
        });
    } else {
        return behaviorLogs.filter(log => new Date(log.date) >= weekAgo);
    }
};

// Format data for AI
const formatDataForAI = (data, question) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0];

    const questionType = getQuestionType(question);
    const isToday = isTodayQuestion(question);

    let dataText = `=== PATIENT DATA ANALYSIS ===\n`;
    dataText += `Current Date: ${now.toLocaleDateString()}\n`;
    dataText += `Today's Date: ${todayStr}\n`;
    dataText += `Question Type: ${questionType}\n`;
    dataText += `Is Today Question: ${isToday}\n\n`;

    // Format medications
    const filteredMeds = filterMedications(data.medications, question);
    dataText += `=== MEDICATIONS ===\n`;
    if (filteredMeds.length > 0) {
        filteredMeds.forEach((med, index) => {
            dataText += `${index + 1}. ${med.medicationName} ${med.dosage}\n`;
            dataText += `   Status: ${med.status}\n`;
            dataText += `   Frequency: ${med.frequency}\n`;
            if (med.specificTimes?.length > 0) {
                dataText += `   Times: ${med.specificTimes.join(', ')}\n`;
            }
            dataText += `   Period: ${new Date(med.startDate).toLocaleDateString()} to ${med.endDate ? new Date(med.endDate).toLocaleDateString() : 'ongoing'}\n`;
            if (med.notes) {
                dataText += `   Notes: ${med.notes}\n`;
            }
            dataText += `\n`;
        });
    } else {
        dataText += `No medications found.\n\n`;
    }

    // Format activities
    const filteredActivities = filterActivities(data.activities, question);
    dataText += `=== ACTIVITIES ===\n`;

    if (filteredActivities.length > 0) {
        filteredActivities.forEach((activity, index) => {
            const isRecurring = activity.schedule.recurrence !== 'none';
            const occurrenceDate = activity.occurrenceDate ? new Date(activity.occurrenceDate) : new Date(activity.schedule.start);

            dataText += `${index + 1}. ${activity.name}\n`;
            dataText += `   Description: ${activity.description || 'No description'}\n`;

            if (isToday) {
                dataText += `   Scheduled for: Today (${occurrenceDate.toLocaleDateString()})\n`;
            } else {
                dataText += `   Date: ${occurrenceDate.toLocaleDateString()}\n`;
            }

            dataText += `   Time: ${new Date(activity.schedule.start).toLocaleTimeString()}\n`;

            if (isRecurring) {
                dataText += `   Recurrence: ${activity.schedule.recurrence}\n`;
                dataText += `   Period: ${new Date(activity.schedule.start).toLocaleDateString()} to ${activity.schedule.end ? new Date(activity.schedule.end).toLocaleDateString() : 'ongoing'}\n`;
            }

            dataText += `   Status: ${activity.status}\n`;

            if (activity.outcome) {
                dataText += `   Outcome: ${activity.outcome}\n`;
            }

            if (activity.notes) {
                dataText += `   Notes: ${activity.notes}\n`;
            }

            dataText += `\n`;
        });
    } else {
        dataText += `No activities found.\n\n`;

        // Show why no activities
        if (isToday) {
            const todayActivities = data.activities.filter(act => shouldActivityOccurToday(act));
            dataText += `Note: There are ${todayActivities.length} activities in records, but none are scheduled for today based on their recurrence patterns.\n\n`;
        }
    }

    // Format behavior logs
    const behaviorData = getBehaviorData(data.behaviorLogs, question);
    dataText += `=== BEHAVIOR LOGS ===\n`;
    if (behaviorData.length > 0) {
        behaviorData.forEach((log, index) => {
            dataText += `${index + 1}. Date: ${new Date(log.date).toLocaleDateString()}\n`;
            if (log.mood) {
                dataText += `   Mood: ${log.mood}\n`;
            }
            if (log.sleep) {
                dataText += `   Sleep: ${log.sleep.duration || 0} hours, Quality: ${log.sleep.quality || 0}/5\n`;
            }
            if (log.incidents?.length > 0) {
                dataText += `   Incidents: ${log.incidents.length}\n`;
            }
            if (log.notes) {
                dataText += `   Notes: ${log.notes}\n`;
            }
            dataText += `\n`;
        });
    } else {
        dataText += `No behavior logs found.\n\n`;
    }

    // Statistics
    dataText += `=== STATISTICS ===\n`;
    dataText += `Total Medications: ${data.medications.length}\n`;
    dataText += `Total Activities: ${data.activities.length}\n`;
    dataText += `Total Behavior Logs: ${data.behaviorLogs.length}\n`;

    // Recurrence breakdown
    const recurrenceCounts = data.activities.reduce((acc, act) => {
        const recurrence = act.schedule.recurrence || 'none';
        acc[recurrence] = (acc[recurrence] || 0) + 1;
        return acc;
    }, {});

    dataText += `Activity Recurrence: ${Object.entries(recurrenceCounts).map(([type, count]) => `${type}: ${count}`).join(', ')}\n`;

    return dataText;
};

// Main chatbot handler
export const handleChat = async (req, res) => {
    try {
        const { patientId, message } = req.body;

        console.log('=== ENHANCED CHATBOT ===');
        console.log('Patient:', patientId);
        console.log('Question:', message);
        console.log('Current Date:', new Date().toISOString());

        if (!patientId || !message) {
            return res.status(400).json({
                success: false,
                error: 'patientId and message are required'
            });
        }

        const dataResult = await getAllPatientData(patientId);

        if (!dataResult.success) {
            return res.status(500).json({
                success: false,
                error: dataResult.error
            });
        }

        console.log('Data counts:', dataResult.counts);

        // Check if data exists
        if (dataResult.counts.activities === 0 &&
            dataResult.counts.behaviorLogs === 0 &&
            dataResult.counts.medications === 0) {

            return res.status(200).json({
                success: true,
                data: {
                    response: "I don't have any medical records for this patient.",
                    patientId: patientId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Format data
        const dataText = formatDataForAI(dataResult.data, message);

        console.log('Question type:', getQuestionType(message));
        console.log('Is today question:', isTodayQuestion(message));

        // Create user message
        const userMessage = `${message}\n\nPatient Medical Data:\n${dataText}\n\nPlease answer based on this data.`;

        console.log('Sending to OpenAI...');

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.3,
            max_tokens: 500
        });

        const response = completion.choices[0].message.content;

        res.status(200).json({
            success: true,
            data: {
                response: response,
                patientId: patientId,
                timestamp: new Date().toISOString(),
                metadata: {
                    questionType: getQuestionType(message),
                    isTodayQuestion: isTodayQuestion(message),
                    dataCounts: dataResult.counts
                }
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Debug endpoint for recurrence testing
export const debugRecurrence = async (req, res) => {
    try {
        const { patientId } = req.params;

        const result = await getAllPatientData(patientId);

        if (!result.success) {
            return res.status(500).json(result);
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const recurrenceAnalysis = result.data.activities.map(activity => {
            const shouldOccurToday = shouldActivityOccurToday(activity);
            const upcomingOccurrences = getUpcomingActivities([activity], 14)
                .map(occ => occ.occurrenceDate.toISOString().split('T')[0]);

            return {
                name: activity.name,
                startDate: activity.schedule.start,
                endDate: activity.schedule.end,
                recurrence: activity.schedule.recurrence || 'none',
                status: activity.status,
                shouldOccurToday,
                todayDate: today.toISOString().split('T')[0],
                upcomingOccurrences: upcomingOccurrences.slice(0, 5) // Next 5 occurrences
            };
        });

        res.status(200).json({
            success: true,
            data: {
                patientId,
                currentDate: now.toISOString(),
                todayDate: today.toISOString().split('T')[0],
                recurrenceAnalysis,
                summary: {
                    totalActivities: result.data.activities.length,
                    activitiesToday: result.data.activities.filter(act => shouldActivityOccurToday(act)).length,
                    recurrenceBreakdown: result.data.activities.reduce((acc, act) => {
                        const recurrence = act.schedule.recurrence || 'none';
                        acc[recurrence] = (acc[recurrence] || 0) + 1;
                        return acc;
                    }, {})
                }
            }
        });

    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};