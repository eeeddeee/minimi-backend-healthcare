import express from "express";
import authRoute from "./authRoutes.js";
import userRoute from "./userRoutes.js";
import hospitalRoute from "./hospitalRoutes.js";
import nurseRoute from "./nurseRoutes.js";
import caregiverRoute from "./caregiverRoutes.js";
import patientRoute from "./patientRoutes.js";
import familyMemberRoute from "./familyMemberRoutes.js";
import medicationsRoute from "./medicationRoute.js";
import assignmentsRoute from "./assignmentRoute.js";
import behaviorLogsRoute from "./behaviorRoute.js";
import activityRoute from "./activityRoute.js";
import dailyJournalsRoute from "./dailyJournalRoute.js";
import systemLogsRoute from "./systemLogRoute.js";
import eLearningRoute from "./eLearningRoute.js";
import incidentsRoute from "./incidentRoutes.js";
import messagesRoute from "./messagingRoute.js";
import patStatusHistoryRoute from "./patientStatusHistoryRoute.js";
import paymentRoute from "./paymentRoutes.js";
import notificationRoute from "./notificationRoute.js";

// import systemLogRoute from "./systemLogRoute.js";
// import adminStatsRoute from "./adminStatsRoute.js";

// router.use("/system-logs", systemLogRoute);
// router.use("/admin/stats", adminStatsRoute);

const router = express.Router();

const defaultIRoute = [
  { path: "/auth", route: authRoute },
  { path: "/user", route: userRoute },
  { path: "/hospitals", route: hospitalRoute },
  { path: "/nurses", route: nurseRoute },
  { path: "/caregivers", route: caregiverRoute },
  { path: "/patients", route: patientRoute },
  { path: "/family-members", route: familyMemberRoute },
  { path: "/assignments", route: assignmentsRoute },
  { path: "/medications", route: medicationsRoute },
  { path: "/behavior-logs", route: behaviorLogsRoute },
  { path: "/patients-activity", route: activityRoute },
  { path: "/daily-journals", route: dailyJournalsRoute },
  { path: "/system-logs", route: systemLogsRoute },
  { path: "/e-learning", route: eLearningRoute },
  { path: "/incidents", route: incidentsRoute },
  { path: "/conversations", route: messagesRoute },
  { path: "/", route: patStatusHistoryRoute },
  { path: "/payment", route: paymentRoute },
  { path: "/notifications", route: notificationRoute },
];

defaultIRoute.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
