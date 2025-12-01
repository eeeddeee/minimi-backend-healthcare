// src/config/fcmConfig.js
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

let isInitialized = false;

/**
 * Initialize Firebase Admin SDK from JSON file
 */
export const initializeFCM = () => {
  if (isInitialized) return;

  try {
    const SERVICE_ACCOUNT_PATH = path.resolve("./google-services.json");

    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      throw new Error(
        "Firebase service account file not found: " + SERVICE_ACCOUNT_PATH
      );
    }

    const serviceAccount = JSON.parse(
      fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
    );

    // Fix newline issues in private_key
    if (serviceAccount.private_key.includes("\\n")) {
      serviceAccount.private_key = serviceAccount.private_key.replace(
        /\\n/g,
        "\n"
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    isInitialized = true;
    console.log("✅ Firebase initialized using FILE:", SERVICE_ACCOUNT_PATH);
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error.message);
  }
};

/**
 * Get initialized Firebase Admin instance
 */
export const getFirebaseAdmin = () => {
  if (!isInitialized) throw new Error("FCM not initialized");
  return admin;
};

/**
 * Check if Firebase is initialized
 */
export const isFCMAvailable = () => isInitialized;

export default admin;

// import admin from "firebase-admin";
// import dotenv from "dotenv";

// dotenv.config();

// let isInitialized = false;

// export const initializeFCM = () => {
//   if (isInitialized) return;

//   try {
//     admin.initializeApp({
//       credential: admin.credential.cert({
//         projectId: process.env.FIREBASE_PROJECT_ID,
//         clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//         privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//       }),
//     });

//     isInitialized = true;
//     console.log("✅ Firebase initialized using ENV");
//   } catch (error) {
//     console.error("❌ Firebase initialization failed:", error.message);
//   }
// };

// export const getFirebaseAdmin = () => {
//   if (!isInitialized) throw new Error("FCM not initialized");
//   return admin;
// };

// export const isFCMAvailable = () => isInitialized;

// export default admin;

// // import admin from "firebase-admin";
// // import dotenv from "dotenv";

// // const FIREBASE_SERVICE_ACCOUNT_PATH = "./google-services.json";

// // dotenv.config();

// // let isInitialized = false;

// // /**
// //  * Initialize Firebase Admin SDK
// //  * Call this once during app startup
// //  */
// // export const initializeFCM = () => {
// //   if (isInitialized) {
// //     console.log("FCM already initialized");
// //     return;
// //   }

// //   try {
// //     // Option 1: Using service account JSON file path
// //     if (FIREBASE_SERVICE_ACCOUNT_PATH) {
// //       admin.initializeApp({
// //         credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT_PATH),
// //       });
// //     }
// //     // // Option 1: Using service account JSON file path
// //     // if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
// //     //   admin.initializeApp({
// //     //     credential: admin.credential.cert(
// //     //       process.env.FIREBASE_SERVICE_ACCOUNT_PATH
// //     //     ),
// //     //   });
// //     // }
// //     // Option 2: Using environment variables (recommended for production)
// //     else if (process.env.FIREBASE_PROJECT_ID) {
// //       admin.initializeApp({
// //         credential: admin.credential.cert({
// //           projectId: process.env.FIREBASE_PROJECT_ID,
// //           clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
// //           privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
// //         }),
// //       });
// //     } else {
// //       throw new Error("Firebase credentials not configured");
// //     }

// //     isInitialized = true;
// //     console.log("✅ Firebase Admin SDK initialized successfully");
// //   } catch (error) {
// //     console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
// //     // Don't throw - allow app to run without FCM in development
// //     if (process.env.NODE_ENV === "production") {
// //       throw error;
// //     }
// //   }
// // };

// // /**
// //  * Get Firebase Admin instance
// //  */
// // export const getFirebaseAdmin = () => {
// //   if (!isInitialized) {
// //     throw new Error(
// //       "Firebase Admin SDK not initialized. Call initializeFCM() first"
// //     );
// //   }
// //   return admin;
// // };

// // /**
// //  * Check if FCM is available
// //  */
// // export const isFCMAvailable = () => isInitialized;

// // export default admin;
