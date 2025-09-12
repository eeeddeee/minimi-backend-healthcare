import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Generate new compliant keys
const encKey = crypto.randomBytes(32).toString("base64"); // 32-byte encryption key
const sigKey = crypto.randomBytes(64).toString("base64"); // 64-byte signing key

// Update .env file
const envPath = ".env";
let envFile = "";

if (fs.existsSync(envPath)) {
  envFile = fs.readFileSync(envPath, "utf8");

  // Remove existing keys if they exist
  envFile = envFile.replace(/ENCRYPTION_KEY=.*\n/, "");
  envFile = envFile.replace(/SIGNATURE_KEY=.*\n/, "");
}

// Add new keys
envFile += `\nENCRYPTION_KEY=${encKey}`;
envFile += `\nSIGNATURE_KEY=${sigKey}\n`;

fs.writeFileSync(envPath, envFile.trim());

console.log("✅ New keys generated and saved to .env file:");
console.log(`ENCRYPTION_KEY=${encKey}`);
console.log(`SIGNATURE_KEY=${sigKey}`);