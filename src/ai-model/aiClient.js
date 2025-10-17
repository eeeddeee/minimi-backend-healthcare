import axios from "axios";
import dayjs from "dayjs";

const AI = axios.create({
  baseURL: process.env.AI_BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.AI_API_KEY || "",
  },
});

export async function aiTrain() {
  const { data } = await AI.post("/train", {});
  return data;
}

export async function aiPredictFor(dateISO, patientIds = []) {
  const payload = { target_date: dayjs(dateISO).format("YYYY-MM-DD") };
  if (patientIds?.length) payload.patient_ids = patientIds;
  const { data } = await AI.post("/predict", payload);
  // { predictions:[{ patientId, targetDate, predictedMood, probabilities, adverseProbability, topFeatures }], notifications_created }
  return data;
}
