import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount = null;

// 1. Environment Variable Support: Raw JSON or Base64 (P2-14)
const envCredentials =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (envCredentials) {
  try {
    const trimmed = envCredentials.trim();
    if (trimmed.startsWith("{")) {
      serviceAccount = JSON.parse(trimmed);
    } else {
      const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
      serviceAccount = JSON.parse(decoded);
    }
  } catch (err) {
    console.error("Failed to parse Firebase credentials from environment:", err.message);
  }
}

// 2. Fallback to local serviceAccountKey.json file if present on disk
if (!serviceAccount) {
  const localKeyPath = path.resolve(__dirname, "../serviceAccountKey.json");
  if (fs.existsSync(localKeyPath)) {
    try {
      const fileContent = fs.readFileSync(localKeyPath, "utf-8");
      serviceAccount = JSON.parse(fileContent);
    } catch (err) {
      console.warn("Failed to read local serviceAccountKey.json:", err.message);
    }
  }
}

// 3. Initialize Firebase Admin App
let appInstance = null;
if (getApps().length > 0) {
  appInstance = getApps()[0];
} else if (serviceAccount) {
  appInstance = initializeApp({
    credential: cert(serviceAccount),
  });
} else {
  console.warn(
    "Firebase service account credentials not found in env or local file. Initializing default app."
  );
  appInstance = initializeApp();
}

export const app = appInstance;
