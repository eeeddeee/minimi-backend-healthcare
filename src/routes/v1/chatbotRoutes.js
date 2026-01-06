import express from 'express';
import { handleChat, debugRecurrence } from '../../controllers/chatbotController.js';

const router = express.Router();

// Main endpoint
router.post('/chat', handleChat);

// Debug recurrence
router.get('/debug-recurrence/:patientId', debugRecurrence);

export default router;