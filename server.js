import dotenv from "dotenv";
import express from "express";
import connectDB from "./src/config/db.js";
import routes from "./src/routes/v1/index.js";
import bodyParser from "body-parser";
import cors from "cors";
import responseHandler from "./src/middleware/responseHandler.js";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initSocket } from "./src/sockets/sockets.js";
// import { createSuperAdmin } from "./src/seeders/createSuperAdmin.js";
import stripeWebhook from "./src/utils/stripeWebhook.js";
import { scheduleExpirySweep } from "./src/cron-jobs/subscriptionNotifier.js";
import { scheduleDailyAIPrediction } from "./src/ai-model/aiJobs.js";

import http from "http";

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
// const server = http.createServer(app);

// Configure Socket.IO with the same path as client
// const io = new Server(server, {
//   path: '/api/v1/socket.io',
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"]
//   }
// });

app.use(helmet());

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: 'Too many requests from this IP, please try again after 15 minutes'
// });

// app.use(limiter);

// ADD CORS
const allowedOrigins = [
  "*",
  "http://localhost:5173",
  "https://minimi-healthcare.onrender.com",
  "https://minimi-healthcare.onrender.com/login",
  "ws://localhost:*",
  "wss://*",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
};

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());
app.use(responseHandler);
app.use("/api/v1", routes);

app.get("/", (req, res) => {
  res.send("Hello From Server!");
});
// createSuperAdmin()
scheduleExpirySweep();
const PORT = Number(process.env.PORT) || 8080;
const LOCAL_HOST = process.env.LOCAL_HOST;

// socket.io
initSocket(server);
scheduleDailyAIPrediction();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
// const server = http.createServer(app);
// initSocket(server);

// server.listen(PORT, LOCAL_HOST, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`Server listening on http://0.0.0.0:${PORT}`);
// });

// app.listen(PORT, LOCAL_HOST, () => {
//   console.log(`Server running at http://${LOCAL_HOST}:${PORT}`);
// });
