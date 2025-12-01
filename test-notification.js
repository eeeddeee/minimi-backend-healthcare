// import admin from "firebase-admin";
// import dotenv from "dotenv";

// dotenv.config(); // Load .env

// // ==================== CONFIGURATION ====================

// // Mobile app FCM device token (for testing)
// const DEVICE_TOKEN =
//   "ed1cne-6QuGgX8l63YaJHh:APA91bEnDpgDEvmZ8zHY5VWOMXnBkxOKjP7uXzNzyHMmHbWSwZ_lV_lTIzQL3l_tISmEeHSjXLj5frynkf-aeOB98rHvYWujV_gPQHac-1yENVzhKmP3r9A";

// // Notification message
// const notificationMessage = {
//   notification: {
//     title: "🔔 Test Notification",
//     body: "This is a test notification sent using ENV credentials!",
//   },
//   token: DEVICE_TOKEN,
// };

// // ==================== FIREBASE INITIALIZATION ====================

// console.log("🔧 Initializing Firebase using ENV...\n");

// try {
//   admin.initializeApp({
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//     }),
//   });

//   console.log("📤 Sending test notification...\n");

//   const response = await admin.messaging().send(notificationMessage);

//   console.log("✅ Notification Sent Successfully!");
//   console.log("📥 Message ID:", response);

//   process.exit(0);
// } catch (error) {
//   console.error("❌ Error:", error.message);
//   console.error(error);
//   process.exit(1);
// }

import admin from "firebase-admin";
import { readFileSync } from "fs";

// ==================== CONFIGURATION ====================
// Service account key file path (google-services.json nahi, service account key chahiye)
const SERVICE_ACCOUNT_PATH = "./google-services.json";

// Mobile app se device token yahan daalo
const DEVICE_TOKEN =
  "ed1cne-6QuGgX8l63YaJHh:APA91bEnDpgDEvmZ8zHY5VWOMXnBkxOKjP7uXzNzyHMmHbWSwZ_lV_lTIzQL3l_tISmEeHSjXLj5frynkf-aeOB98rHvYWujV_gPQHac-1yENVzhKmP3r9A";

// Notification message
const notificationMessage = {
  notification: {
    title: "🔔 Test Notification",
    body: "Yeh aapka test notification hai! Backend se bheja gaya hai.",
  },
  token: DEVICE_TOKEN,
};

console.log("🔧 Firebase Admin SDK initialize kar raha hoon...\n");

try {
  // Service account key load karo
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

  // Firebase Admin initialize
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("📤 Notification bhej raha hoon...\n");

  // Notification send karo
  const response = await admin.messaging().send(notificationMessage);

  console.log("✅ Response Status: SUCCESS");
  console.log("📥 Message ID:", response);
  console.log("\n🎉 Notification successfully bhej diya gaya!");
} catch (error) {
  console.error("❌ Error:", error.message);

  if (error.code === "ENOENT") {
    console.log("\n⚠️  serviceAccountKey.json file nahi mili!");
    console.log("Firebase Console se download karo:");
    console.log("1. https://console.firebase.google.com/");
    console.log("2. Project Settings → Service Accounts");
    console.log('3. "Generate New Private Key" button click karo');
    console.log(
      "4. Downloaded file ko serviceAccountKey.json naam se save karo\n"
    );
  } else if (error.code === "messaging/invalid-registration-token") {
    console.log("\n⚠️  Device token invalid hai!");
    console.log("Mobile app se sahi FCM token daalo\n");
  } else if (error.code === "messaging/registration-token-not-registered") {
    console.log("\n⚠️  Device token registered nahi hai!");
    console.log("Mobile app mein FCM properly setup karo\n");
  }

  process.exit(1);
}

process.exit(0);

// // import https from "https";

// // // ==================== CONFIGURATION ====================
// // // Yahan apni API key daalo (google-services.json se)
// // const FCM_API_KEY = "AIzaSyAcOz6iDJ_omJ8SVv6LwK6mzmHtLTrm8Cc";

// // // Mobile app se device token yahan daalo
// // // Mobile app mein FCM token generate karke yahan paste karna hoga
// // const DEVICE_TOKEN =
// //   "ed1cne-6QuGgX8l63YaJHh:APA91bEnDpgDEvmZ8zHY5VWOMXnBkxOKjP7uXzNzyHMmHbWSwZ_lV_lTIzQL3l_tISmEeHSjXLj5frynkf-aeOB98rHvYWujV_gPQHac-1yENVzhKmP3r9A";

// // // Notification ka message
// // const notification = {
// //   to: DEVICE_TOKEN,
// //   notification: {
// //     title: "🔔 Test Notification",
// //     body: "Yeh aapka test notification hai! Backend se bheja gaya hai.",
// //     sound: "default",
// //     priority: "high",
// //   },
// //   priority: "high",
// // };
// // // =======================================================

// // const postData = JSON.stringify(notification);

// // const options = {
// //   hostname: "fcm.googleapis.com",
// //   port: 443,
// //   path: "/fcm/send",
// //   method: "POST",
// //   headers: {
// //     "Content-Type": "application/json",
// //     Authorization: `key=${FCM_API_KEY}`,
// //     "Content-Length": Buffer.byteLength(postData),
// //   },
// // };

// // console.log("📤 Notification bhej raha hoon...\n");

// // const req = https.request(options, (res) => {
// //   let data = "";

// //   res.on("data", (chunk) => {
// //     data += chunk;
// //   });

// //   res.on("end", () => {
// //     console.log("✅ Response Status:", res.statusCode);
// //     console.log("📥 Response:", data);

// //     if (res.statusCode === 200) {
// //       console.log("\n🎉 Notification successfully bhej diya gaya!");
// //     } else {
// //       console.log("\n❌ Notification send nahi hua. Error check karein.");
// //     }
// //   });
// // });

// // req.on("error", (error) => {
// //   console.error("❌ Error:", error.message);
// // });

// // req.write(postData);
// // req.end();

// // // const https from "https";

// // // // ==================== CONFIGURATION ====================
// // // // Yahan apni API key daalo (google-services.json se)
// // // const FCM_API_KEY = "AIzaSyAcOz6iDJ_omJ8SVv6LwK6mzmHtLTrm8Cc";

// // // // Mobile app se device token yahan daalo
// // // // Mobile app mein FCM token generate karke yahan paste karna hoga
// // // const DEVICE_TOKEN =
// // //   "ed1cne-6QuGgX8l63YaJHh:APA91bEnDpgDEvmZ8zHY5VWOMXnBkxOKjP7uXzNzyHMmHbWSwZ_lV_lTIzQL3l_tISmEeHSjXLj5frynkf-aeOB98rHvYWujV_gPQHac-1yENVzhKmP3r9A";

// // // // Notification ka message
// // // const notification = {
// // //   to: DEVICE_TOKEN,
// // //   notification: {
// // //     title: "🔔 Test Notification",
// // //     body: "Yeh aapka test notification hai! Backend se bheja gaya hai.",
// // //     sound: "default",
// // //     priority: "high",
// // //   },
// // //   priority: "high",
// // // };
// // // // =======================================================

// // // const postData = JSON.stringify(notification);

// // // const options = {
// // //   hostname: "fcm.googleapis.com",
// // //   port: 443,
// // //   path: "/fcm/send",
// // //   method: "POST",
// // //   headers: {
// // //     "Content-Type": "application/json",
// // //     Authorization: `key=${FCM_API_KEY}`,
// // //     "Content-Length": Buffer.byteLength(postData),
// // //   },
// // // };

// // // console.log("📤 Notification bhej raha hoon...\n");

// // // const req = https.request(options, (res) => {
// // //   let data = "";

// // //   res.on("data", (chunk) => {
// // //     data += chunk;
// // //   });

// // //   res.on("end", () => {
// // //     console.log("✅ Response Status:", res.statusCode);
// // //     console.log("📥 Response:", data);

// // //     if (res.statusCode === 200) {
// // //       console.log("\n🎉 Notification successfully bhej diya gaya!");
// // //     } else {
// // //       console.log("\n❌ Notification send nahi hua. Error check karein.");
// // //     }
// // //   });
// // // });

// // // req.on("error", (error) => {
// // //   console.error("❌ Error:", error.message);
// // // });

// // // req.write(postData);
// // // req.end();
