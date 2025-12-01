import mongoose from "mongoose";
import { initializeFCM } from "./src/config/fcmConfig.js";
import { sendFCMToUsers } from "./src/services/fcmService.js";

// ------------------------------
// 🔥 Initialize Firebase
// ------------------------------
initializeFCM();

// ------------------------------
// ✅ MongoDB Connection
// ------------------------------
const MONGO_URI =
  "mongodb+srv://minimi:Weimar72!@minimi.cibr4to.mongodb.net/minimi"; // <-- Replace with your actual URI

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

// ------------------------------
// 🔔 Static FCM Test
// ------------------------------
const TEST_USER_ID = "68c99bc7511b6e2cf6b9fdbf"; // caregiver userId

const run = async () => {
  await connectDB();

  console.log("🚀 Sending STATIC TEST FCM...");

  const result = await sendFCMToUsers(
    [TEST_USER_ID],
    {
      title: "🔥 Static Test Notification",
      message: "This is a STATIC TEST from backend (no dynamic data).",
    },
    {
      type: "test",
      deeplink: "/test-page",
      priority: "high",
    }
  );

  console.log("📨 RESULT:", result);
  process.exit(0);
};

run();

// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import fs from "fs";
// import path from "path";
// import admin from "firebase-admin";
// import { sendFCMToUsers } from "./src/services/fcmService.js";
// import { initializeFCM } from "./src/config/fcmConfig.js";

// dotenv.config();

// // ------------------------------
// // 🔥 Initialize Firebase from FILE
// // ------------------------------
// const initFirebase = () => {
//   try {
//     if (!admin.apps.length) {
//       console.log(
//         "⚠ Firebase was not initialized in service, initializing now..."
//       );

//       const serviceAccount = JSON.parse(
//         fs.readFileSync("./google-services.json", "utf8")
//       );

//       if (serviceAccount.private_key.includes("\\n")) {
//         serviceAccount.private_key = serviceAccount.private_key.replace(
//           /\\n/g,
//           "\n"
//         );
//       }

//       admin.initializeApp({
//         credential: admin.credential.cert(serviceAccount),
//       });

//       console.log("🔥 Firebase initialized from FILE");
//     }
//   } catch (error) {
//     console.error("❌ Firebase initialization error:", error.message);
//   }
// };

// initFirebase();

// // ------------------------------
// // ✅ MongoDB Connection
// // ------------------------------
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log("✅ MongoDB Connected");
//   } catch (err) {
//     console.error("❌ MongoDB Connection Error:", err.message);
//     process.exit(1);
//   }
// };

// // Test caregiver user ID
// const TEST_USER_ID = "68c99bc7511b6e2cf6b9fdbf";

// const run = async () => {
//   await connectDB();

//   console.log("🚀 Sending STATIC TEST FCM...");

//   const result = await sendFCMToUsers(
//     [TEST_USER_ID],
//     {
//       title: "🔥 Static Test Notification",
//       message: "This is a STATIC TEST from backend (no dynamic data).",
//     },
//     {
//       type: "test",
//       deeplink: "/test-page",
//       priority: "high",
//     }
//   );

//   console.log("📨 RESULT:", result);
//   process.exit(0);
// };

// run();

// // import mongoose from "mongoose";
// // import dotenv from "dotenv";
// // import admin from "firebase-admin";
// // import { sendFCMToUsers } from "./src/services/fcmService.js";

// // dotenv.config();

// // // ------------------------------
// // // 🔥 Initialize Firebase from ENV
// // // ------------------------------
// // const initFirebase = () => {
// //   try {
// //     if (!admin.apps.length) {
// //       const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// //       console.log("ZZainnnn1", process.env.FIREBASE_SERVICE_ACCOUNT);

// //       // Convert \n back to actual newlines
// //       serviceAccount.private_key = serviceAccount.private_key.replace(
// //         /\\n/g,
// //         "\n"
// //       );

// //       console.log(serviceAccount, "Zainnnnnnnn 2");
// //       admin.initializeApp({
// //         credential: admin.credential.cert(serviceAccount),
// //       });

// //       console.log("🔥 Firebase initialized from ENV");
// //     }
// //   } catch (error) {
// //     console.error("❌ Firebase initialization error:", error.message);
// //   }
// // };

// // // Initialize Firebase BEFORE sending FCM
// // initFirebase();

// // // ------------------------------
// // // ✅ MongoDB Connection
// // // ------------------------------
// // const connectDB = async () => {
// //   try {
// //     await mongoose.connect(process.env.MONGO_URI);
// //     console.log("✅ MongoDB Connected");
// //   } catch (err) {
// //     console.error("❌ MongoDB Connection Error:", err.message);
// //     process.exit(1);
// //   }
// // };

// // // Test caregiver user ID
// // const TEST_USER_ID = "68c99bc7511b6e2cf6b9fdbf";

// // const run = async () => {
// //   await connectDB();

// //   console.log("🚀 Sending STATIC TEST FCM...");

// //   const result = await sendFCMToUsers(
// //     [TEST_USER_ID],
// //     {
// //       title: "🔥 Static Test Notification",
// //       message: "This is a STATIC TEST from backend (no dynamic data).",
// //     },
// //     {
// //       type: "test",
// //       deeplink: "/test-page",
// //       priority: "high",
// //     }
// //   );

// //   console.log("📨 RESULT:", result);
// //   process.exit(0);
// // };

// // run();

// // // import mongoose from "mongoose";
// // // import dotenv from "dotenv";
// // // import { sendFCMToUsers } from "./src/services/fcmService.js";

// // // dotenv.config();

// // // const connectDB = async () => {
// // //   try {
// // //     await mongoose.connect(process.env.MONGO_URI);
// // //     console.log("✅ MongoDB Connected");
// // //   } catch (err) {
// // //     console.error("❌ MongoDB Connection Error:", err.message);
// // //     process.exit(1);
// // //   }
// // // };

// // // const TEST_USER_ID = "68c99bc7511b6e2cf6b9fdbf"; // caregiver userId

// // // const run = async () => {
// // //   await connectDB(); // <<--- IMPORTANT

// // //   console.log("🚀 Sending STATIC TEST FCM...");

// // //   const result = await sendFCMToUsers(
// // //     [TEST_USER_ID],
// // //     {
// // //       title: "🔥 Static Test Notification",
// // //       message: "This is a STATIC TEST from backend (no dynamic data).",
// // //     },
// // //     {
// // //       type: "test",
// // //       deeplink: "/test-page",
// // //       priority: "high",
// // //     }
// // //   );

// // //   console.log("📨 RESULT:", result);
// // //   process.exit(0);
// // // };

// // // run();
