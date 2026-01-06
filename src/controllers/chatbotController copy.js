import OpenAI from 'openai';
import mongoose from 'mongoose';
import Activity from '../models/activityModel.js';
import BehaviorLog from '../models/behaviorLogModel.js';
import MedicationReminder from '../models/medicationReminderModel.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Get all patient data
const getPatientData = async (patientId) => {
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
                .sort({ status: 1, createdAt: -1 })
                .lean()
        ]);

        return {
            success: true,
            data: {
                activities,
                behaviorLogs,
                medications
            }
        };

    } catch (error) {
        console.error('Error in getPatientData:', error);
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

// Create natural, human-like conversation context
const createHumanLikeContext = (data, patientId, question) => {
    const now = new Date();

    // Find specific medication if mentioned
    const medKeywords = ['panadol', 'strepcils', 'metformin', 'amoxicillin'];
    const mentionedMed = medKeywords.find(med =>
        question.toLowerCase().includes(med.toLowerCase())
    );

    let specificMedication = null;
    if (mentionedMed) {
        specificMedication = data.medications.find(med =>
            med.medicationName.toLowerCase().includes(mentionedMed.toLowerCase())
        );
    }

    // Check for question types
    const q = question.toLowerCase();
    const isCancelledQuestion = q.includes('cancelled') || q.includes('cancel') || q.includes('हुई') || q.includes('है');
    const isTodayQuestion = q.includes('today') || q.includes('आज') || q.includes('now');
    const isStatusQuestion = q.includes('status') || q.includes('क्या हाल') || q.includes('कैसा');
    const isMedicationQuestion = q.includes('medicine') || q.includes('medication') || q.includes('दवा') || q.includes('दवाई');
    const isActivityQuestion = q.includes('activity') || q.includes('एक्टिविटी') || q.includes('काम');
    const isMoodQuestion = q.includes('mood') || q.includes('मूड') || q.includes('मन') || q.includes('भावना');

    // Get relevant data
    const relevantMeds = data.medications.filter(med => {
        if (isCancelledQuestion) return med.status === 'cancelled';
        if (isTodayQuestion) {
            if (med.status !== 'active') return false;
            const startDate = new Date(med.startDate);
            const endDate = med.endDate ? new Date(med.endDate) : null;
            const isCurrentlyActive = now >= startDate && (!endDate || now <= endDate);
            return isCurrentlyActive;
        }
        return true;
    });

    // Prepare context for AI
    const context = {
        patientId,
        currentDate: now.toLocaleDateString(),
        currentTime: now.toLocaleTimeString(),

        // Medications information
        medications: {
            total: data.medications.length,
            active: data.medications.filter(m => m.status === 'active').length,
            cancelled: data.medications.filter(m => m.status === 'cancelled').length,
            completed: data.medications.filter(m => m.status === 'completed').length,
            all: data.medications.map(med => ({
                name: med.medicationName,
                dosage: med.dosage,
                status: med.status,
                times: med.specificTimes || [],
                period: med.startDate ?
                    `${new Date(med.startDate).toLocaleDateString()}${med.endDate ? ` to ${new Date(med.endDate).toLocaleDateString()}` : ''}` : '',
                notes: med.notes || ''
            })),
            specific: specificMedication ? {
                name: specificMedication.medicationName,
                dosage: specificMedication.dosage,
                status: specificMedication.status,
                times: specificMedication.specificTimes || [],
                period: specificMedication.startDate ?
                    `${new Date(specificMedication.startDate).toLocaleDateString()}${specificMedication.endDate ? ` to ${new Date(specificMedication.endDate).toLocaleDateString()}` : ''}` : '',
                notes: specificMedication.notes || ''
            } : null
        },

        // Activities information
        activities: {
            total: data.activities.length,
            today: data.activities.filter(act => {
                const activityDate = new Date(act.schedule.start);
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
                return activityDay.getTime() === today.getTime();
            }).length,
            recent: data.activities.slice(0, 3).map(act => ({
                name: act.name,
                date: new Date(act.schedule.start).toLocaleDateString(),
                status: act.status,
                outcome: act.outcome || ''
            }))
        },

        // Behavior information
        behavior: {
            recent: data.behaviorLogs.slice(0, 3).map(log => ({
                date: new Date(log.date).toLocaleDateString(),
                mood: log.mood || 'Not recorded',
                sleep: log.sleep ? `${log.sleep.duration || 0}h, Quality ${log.sleep.quality || 0}/5` : 'Not recorded'
            }))
        },

        // Question context
        questionContext: {
            mentionedMedication: mentionedMed,
            isMedicationQuestion,
            isActivityQuestion,
            isMoodQuestion,
            isCancelledQuestion,
            isTodayQuestion,
            isStatusQuestion
        }
    };

    return context;
};

// Main chatbot handler
export const handleChat = async (req, res) => {
    try {
        const { patientId, message } = req.body;

        console.log('=== HUMAN-LIKE CHAT ===');
        console.log('Patient:', patientId);
        console.log('Question:', message);

        // Validation
        if (!patientId || !message) {
            return res.status(400).json({
                success: false,
                error: 'Patient ID and message are required'
            });
        }

        // Get patient data
        const dataResult = await getPatientData(patientId);

        if (!dataResult.success) {
            return res.status(500).json({
                success: false,
                error: dataResult.error
            });
        }

        // Create human-like context
        const context = createHumanLikeContext(dataResult.data, patientId, message);

        console.log('Context created for:', context.questionContext);

        // Create natural conversation prompt
        const systemPrompt = createConversationPrompt(context, message);

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.7, // Higher temperature for more natural responses
            max_tokens: 300,
            presence_penalty: 0.6,
            frequency_penalty: 0.3
        });

        let response = completion.choices[0].message.content;

        // Make response more natural if needed
        response = enhanceNaturalness(response, context);

        // Return response
        res.status(200).json({
            success: true,
            data: {
                response: response,
                patientId: patientId,
                timestamp: new Date().toISOString(),
                metadata: {
                    mentionedMedication: context.questionContext.mentionedMedication,
                    questionType: Object.keys(context.questionContext)
                        .filter(key => context.questionContext[key] === true)
                        .join(', ')
                }
            }
        });

    } catch (error) {
        console.error('Chat error:', error);

        // Natural fallback response
        const fallbackResponse = "I apologize, but I'm having trouble accessing your medical records right now. Could you please try again in a moment?";

        res.status(200).json({
            success: true,
            data: {
                response: fallbackResponse,
                patientId: req.body.patientId,
                timestamp: new Date().toISOString()
            }
        });
    }
};

// Create natural conversation prompt
const createConversationPrompt = (context, question) => {
    const now = new Date();

    let prompt = `You are MINIMI, a friendly and empathetic healthcare assistant. You're having a natural conversation with a patient.`;

    prompt += `\n\nPATIENT INFORMATION:`;
    prompt += `\n- Patient ID: ${context.patientId}`;
    prompt += `\n- Current Date: ${context.currentDate}`;
    prompt += `\n- Current Time: ${context.currentTime}`;

    // Add relevant data naturally
    prompt += `\n\nMEDICAL RECORDS (Use this information naturally in conversation):`;

    // Medications information
    if (context.questionContext.isMedicationQuestion || context.questionContext.mentionedMedication) {
        prompt += `\n\nMedications in patient's records:`;
        if (context.medications.all.length > 0) {
            context.medications.all.forEach((med, index) => {
                prompt += `\n${index + 1}. ${med.name} ${med.dosage} - Status: ${med.status}`;
                if (med.period) {
                    prompt += ` (${med.period})`;
                }
                if (med.notes) {
                    prompt += ` - Note: ${med.notes}`;
                }
            });
        } else {
            prompt += `\nNo medication records found.`;
        }

        // Specific medication if mentioned
        if (context.medications.specific) {
            prompt += `\n\nSpecifically about ${context.medications.specific.name}:`;
            prompt += `\n- Dosage: ${context.medications.specific.dosage}`;
            prompt += `\n- Status: ${context.medications.specific.status}`;
            prompt += `\n- Prescription period: ${context.medications.specific.period}`;
            prompt += `\n- Times: ${context.medications.specific.times.join(', ') || 'No specific times'}`;
            prompt += `\n- Notes: ${context.medications.specific.notes}`;
        }
    }

    // Activities information
    if (context.questionContext.isActivityQuestion) {
        prompt += `\n\nRecent Activities:`;
        if (context.activities.recent.length > 0) {
            context.activities.recent.forEach((act, index) => {
                prompt += `\n${index + 1}. ${act.name} on ${act.date} - Status: ${act.status}`;
                if (act.outcome) {
                    prompt += `, Outcome: ${act.outcome}`;
                }
            });
        } else {
            prompt += `\nNo recent activities recorded.`;
        }
    }

    // Behavior information
    if (context.questionContext.isMoodQuestion) {
        prompt += `\n\nRecent Mood & Behavior:`;
        if (context.behavior.recent.length > 0) {
            context.behavior.recent.forEach((log, index) => {
                prompt += `\n${index + 1}. ${log.date}: Mood - ${log.mood}, Sleep - ${log.sleep}`;
            });
        } else {
            prompt += `\nNo recent behavior logs.`;
        }
    }

    // Add statistics naturally
    prompt += `\n\nSUMMARY (Use naturally if relevant):`;
    prompt += `\n- Total medications: ${context.medications.total}`;
    prompt += `\n- Active medications: ${context.medications.active}`;
    prompt += `\n- Cancelled medications: ${context.medications.cancelled}`;
    prompt += `\n- Total activities: ${context.activities.total}`;
    prompt += `\n- Activities today: ${context.activities.today}`;

    // Add conversation guidelines
    prompt += `\n\nCONVERSATION GUIDELINES:`;
    prompt += `\n1. Be friendly, empathetic, and conversational - like talking to a friend`;
    prompt += `\n2. Answer naturally, NOT like reading from a database`;
    prompt += `\n3. Use simple, clear language`;
    prompt += `\n4. Show empathy and understanding`;
    prompt += `\n5. If asking about a specific medication, give specific details about that medication`;
    prompt += `\n6. If medication is cancelled, explain gently and clearly`;
    prompt += `\n7. If no information is available, say so kindly`;
    prompt += `\n8. Use phrases like "I see", "Let me check", "Based on your records"`;
    prompt += `\n9. Add brief explanations when helpful`;
    prompt += `\n10. Keep responses concise but warm`;
    prompt += `\n11. Respond in the SAME LANGUAGE as the question`;

    // Add examples of natural responses
    prompt += `\n\nEXAMPLES OF NATURAL RESPONSES:`;
    prompt += `\n\nQuestion: "Panadol medicine cancelled hui hai ya nhi"`;
    prompt += `\nResponse: "Yes, I can see that Panadol was prescribed earlier but it's been cancelled now. It was supposed to be taken from September 5th to September 10th, 2025."`;

    prompt += `\n\nQuestion: "What medicines do I take today?"`;
    prompt += `\nResponse: "Let me check your current medications... Based on your records, you don't have any active medications scheduled for today."`;

    prompt += `\n\nQuestion: "How am I feeling recently?"`;
    prompt += `\nResponse: "Looking at your recent records, your last mood was noted as 'anxious' on September 16th. How have you been feeling lately?"`;

    prompt += `\n\nQuestion: "What activities do I have?"`;
    prompt += `\nResponse: "I can see a few activities in your schedule. You have a Physical Therapy Session that's currently in progress. Would you like more details about your activities?"`;

    prompt += `\n\nNow, respond naturally to this question: "${question}"`;

    return prompt;
};

// Enhance naturalness of response
const enhanceNaturalness = (response, context) => {
    // Add natural phrases based on context
    let enhancedResponse = response;

    // If talking about cancelled medication, add empathetic tone
    if (context.questionContext.isCancelledQuestion && context.medications.specific?.status === 'cancelled') {
        if (!response.includes('cancelled') && !response.includes('stopped') && !response.includes('discontinued')) {
            enhancedResponse = `I see that ${context.medications.specific.name} was indeed cancelled. ` + response;
        }
    }

    // If no data found, make it more empathetic
    if (response.toLowerCase().includes('no data') || response.toLowerCase().includes('not found')) {
        enhancedResponse = `I don't see that information in your current records. Would you like me to check something else for you?`;
    }

    return enhancedResponse;
};

// Test different question types
export const testConversation = async (req, res) => {
    try {
        const { patientId } = req.params;

        const testQuestions = [
            "Panadol medicine cancelled hui hai ya nhi",
            "What medications should I take today?",
            "मेरी दवाएं क्या हैं?",
            "How am I feeling?",
            "What activities do I have?",
            "Tell me about my health status"
        ];

        const dataResult = await getPatientData(patientId);

        if (!dataResult.success) {
            return res.status(500).json(dataResult);
        }

        const sampleResponse = {
            patientId,
            totalRecords: {
                medications: dataResult.data.medications.length,
                activities: dataResult.data.activities.length,
                behaviorLogs: dataResult.data.behaviorLogs.length
            },
            testQuestions: testQuestions.map(q => ({
                question: q,
                language: q.match(/[\u0900-\u097F]/) ? 'Hindi' : 'English'
            }))
        };

        res.status(200).json({
            success: true,
            data: sampleResponse
        });

    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};