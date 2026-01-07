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
