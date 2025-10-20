import axios from "axios";
import dayjs from "dayjs";

const AI = axios.create({
  baseURL: process.env.AI_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.AI_API_KEY || "",
  },
});

function rethrowAxios(e) {
  const status = e.response?.status;
  const data = e.response?.data;
  const msg = e.message;
  console.error("[AI] call failed", { status, data, msg });
  throw new Error(
    `AI request failed${status ? ` (HTTP ${status})` : ""}: ${
      typeof data === "string" ? data : JSON.stringify(data || {})
    }`
  );
}

export async function aiHealth() {
  try {
    const { data } = await AI.get("/health");
    return data;
  } catch (e) {
    const status = e.response?.status;
    console.error("[AI] /health failed", status, e.response?.data || e.message);
    return null;
  }
}

export async function aiTrain() {
  try {
    const { data } = await AI.post("/train", {});
    return data;
  } catch (e) {
    rethrowAxios(e);
  }
}

export async function aiPredictFor(dateISO, patientIds = []) {
  try {
    const payload = { target_date: dayjs(dateISO).format("YYYY-MM-DD") };
    if (patientIds?.length) payload.patient_ids = patientIds;
    const { data } = await AI.post("/predict", payload);
    return data;
  } catch (e) {
    rethrowAxios(e);
  }
}

// export async function aiTrain() {
//   const { data } = await AI.post("/train", {});
//   return data;
// }

// export async function aiPredictFor(dateISO, patientIds = []) {
//   const payload = { target_date: dayjs(dateISO).format("YYYY-MM-DD") };
//   if (patientIds?.length) payload.patient_ids = patientIds;
//   const { data } = await AI.post("/predict", payload);
//   // { predictions:[{ patientId, targetDate, predictedMood, probabilities, adverseProbability, topFeatures }], notifications_created }
//   return data;
// }
