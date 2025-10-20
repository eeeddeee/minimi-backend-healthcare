import cron from "node-cron";
import dayjs from "dayjs";
import { aiPredictFor, aiHealth, aiTrain } from "./aiClient.js";
import {
  getPatientScopedRecipients,
  getPatientDisplayName,
} from "../utils/recipients.js";
import { notifyUsers } from "../utils/notify.js";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isNum = (v) => Number.isFinite(v);

// 0–1 -> %, 0–5 -> %, auto-detect
const appetitePct = (v) => {
  if (!isNum(v)) return null;
  if (v <= 1.2) return Math.round(v * 100); // already 0..1
  if (v <= 5) return Math.round((v / 5) * 100); // 0..5 scale
  return Math.round(v); // fallback
};
const pct = (v) => (isNum(v) ? `${Math.round(v * 100)}%` : null);
const h1 = (v) => (isNum(v) ? `${v.toFixed(1)}h` : null);
const outText = (v) => {
  if (!isNum(v)) return null;
  // 0=poor,1=fair,2=good,3=excellent (as per training)
  const map = ["poor", "fair", "good", "excellent"];
  const idx = Math.max(0, Math.min(3, Math.round(v)));
  return `${map[idx]} (${v.toFixed(1)})`;
};

// pretty name + value per feature
const FMT = {
  dow: (v) =>
    `Day of week${isNum(v) ? ` (${WEEK[Math.max(0, Math.min(6, Math.round(v)))] || v})` : ""}`,
  is_weekend: (v) => `Weekend${isNum(v) ? (v ? " (Yes)" : " (No)") : ""}`,

  // sleep
  sleep_duration_mean: (v) => `Sleep (avg)${h1(v) ? ` (${h1(v)})` : ""}`,
  sleep_duration_std: (v) => `Sleep variability${h1(v) ? ` (${h1(v)})` : ""}`,
  sleep_quality_mean: (v) =>
    `Sleep quality${outText(v) ? ` (${outText(v)})` : ""}`,

  // intake (0..5 scale → %)
  meal_intake_mean: (v) =>
    `Overall intake${appetitePct(v) != null ? ` (${appetitePct(v)}%)` : ""}`,
  intake_breakfast_mean: (v) =>
    `Breakfast intake${appetitePct(v) != null ? ` (${appetitePct(v)}%)` : ""}`,
  intake_lunch_mean: (v) =>
    `Lunch intake${appetitePct(v) != null ? ` (${appetitePct(v)}%)` : ""}`,
  intake_dinner_mean: (v) =>
    `Dinner intake${appetitePct(v) != null ? ` (${appetitePct(v)}%)` : ""}`,
  intake_snack_mean: (v) =>
    `Snack intake${appetitePct(v) != null ? ` (${appetitePct(v)}%)` : ""}`,

  // incidents
  incident_count: (v) => `Incidents${isNum(v) ? ` (${v})` : ""}`,
  incident_severity_mean: (v) =>
    `Incident severity${isNum(v) ? ` (${v.toFixed(1)})` : ""}`,
  incident_fall_count: (v) => `Falls${isNum(v) ? ` (${v})` : ""}`,
  incident_wandering_count: (v) => `Wandering${isNum(v) ? ` (${v})` : ""}`,
  incident_aggression_count: (v) => `Aggression${isNum(v) ? ` (${v})` : ""}`,
  "incident_self-harm_count": (v) => `Self-harm${isNum(v) ? ` (${v})` : ""}`,
  incident_other_count: (v) => `Other incidents${isNum(v) ? ` (${v})` : ""}`,

  // activities
  act_count: (v) => `Activities${isNum(v) ? ` (${v})` : ""}`,
  act_completed: (v) => `Activities completed${isNum(v) ? ` (${v})` : ""}`,
  act_outcome_mean: (v) =>
    `Activity outcome${outText(v) ? ` (${outText(v)})` : ""}`,

  // medication
  med_active: (v) => `Active meds${isNum(v) ? ` (${v})` : ""}`,
  dose_taken_ratio: (v) =>
    `Adherence${v == null ? " (no logs)" : ` (${pct(v)})`}`,
  dose_missed_ratio: (v) =>
    `Missed dose rate${v == null ? " (no logs)" : ` (${pct(v)})`}`,
  dose_skipped_ratio: (v) =>
    `Skipped dose rate${v == null ? " (no logs)" : ` (${pct(v)})`}`,
  dose_partial_ratio: (v) =>
    `Partial dose rate${v == null ? " (no logs)" : ` (${pct(v)})`}`,
};

// optionally hide non-actionable features (e.g., dow) from the list
const ACTIONABLE = new Set([
  "dose_taken_ratio",
  "dose_missed_ratio",
  "dose_skipped_ratio",
  "dose_partial_ratio",
  "sleep_duration_mean",
  "sleep_duration_std",
  "sleep_quality_mean",
  "meal_intake_mean",
  "intake_breakfast_mean",
  "intake_lunch_mean",
  "intake_dinner_mean",
  "intake_snack_mean",
  "incident_count",
  "incident_severity_mean",
  "incident_fall_count",
  "incident_wandering_count",
  "incident_aggression_count",
  "incident_self-harm_count",
  "incident_other_count",
  "act_count",
  "act_completed",
  "act_outcome_mean",
  "med_active",
]);

function buildRiskMessage(pred, patientName = "Patient") {
  const adv = Math.round((pred.adverseProbability || 0) * 100);

  const drivers =
    (pred.topFeatures || [])
      .slice(0, 3)
      // comment out next line if you still want to show dow/is_weekend
      // .filter(f => ACTIONABLE.has(f.name))
      .map((f) => {
        const pretty = FMT[f.name] ? FMT[f.name](f.value) : f.name;
        const dir =
          f.direction === "down" ? "↓ " : f.direction === "up" ? "↑ " : "";
        return dir + pretty;
      })
      .join(", ") || "—";

  return {
    title: `AI Risk: ${patientName} — ${pred.predictedMood} likely on ${pred.targetDate}`,
    message: `${patientName}:Adverse mood risk ${adv}%. Top drivers: ${drivers}`,
  };
}

// // Make a neat message/title for risk
// function buildRiskMessage(pred, patientName = "Patient") {
//   const adv = Math.round((pred.adverseProbability || 0) * 100);
//   const drivers =
//     (pred.topFeatures || [])
//       .slice(0, 3)
//       .map((f) => f.name)
//       .join(", ") || "—";
//   return {
//     title: `AI Risk: ${patientName} — ${pred.predictedMood} likely on ${pred.targetDate}`,
//     message: `${patientName}: Adverse mood risk ${adv}%. Top drivers: ${drivers}`,
//   };
// }

// run once
export async function runPredictionsFor(dateISO, limitToPatientIds = []) {
  const { predictions = [] } = await aiPredictFor(dateISO, limitToPatientIds);

  for (const pr of predictions) {
    // ❶ only notify high/critical risk
    const risk = Number(pr.adverseProbability || 0);
    const RISK_THRESHOLD = Number(process.env.RISK_THRESHOLD || 0.6);
    const CRITICAL_THRESHOLD = Number(process.env.CRITICAL_THRESHOLD || 0.8);
    if (isNaN(risk) || risk < RISK_THRESHOLD) continue;
    const { all: recipients } = await getPatientScopedRecipients(pr.patientId);
    if (!recipients.length) continue;
    const patientName = await getPatientDisplayName(pr.patientId);
    const { title, message } = buildRiskMessage(pr, patientName);

    // fire-and-forget insert + socket emit for each recipient
    await notifyUsers({
      userIds: recipients,
      type: "ai_risk",
      title,
      message,
      data: {
        patientId: pr.patientId,
        patientName,
        targetDate: pr.targetDate,
        predictedMood: pr.predictedMood,
        probabilities: pr.probabilities,
        topFeatures: pr.topFeatures || [],
        riskThreshold: RISK_THRESHOLD,
      },
      priority: risk >= CRITICAL_THRESHOLD ? "critical" : "high",
    });
  }

  return { total: predictions.length };
}

export function scheduleDailyAIPrediction() {
  cron.schedule("*/60 * * * *", async () => {
    try {
      const ok = await aiHealth();
      if (!ok) {
        console.error("[AI] health check failed; skipping run");
        return;
      }
      const train = await aiTrain();
      if (!train) {
        console.error("[AI] train check failed; skipping run");
        return;
      }
      const target = dayjs().add(1, "day").format("YYYY-MM-DD");
      const res = await runPredictionsFor(target);
      console.log(
        `[AI] ${target} => created ${res.total} patient-scoped predictions`
      );
    } catch (e) {
      console.error("[AI] scheduleDailyAIPrediction failed:", e?.message);
    }
  });
}

// // CRON – roz 00:05 pe "kal" ki date ke liye predict
// export function scheduleDailyAIPrediction() {
//   cron.schedule("*/2 * * * *", async () => {
//     // cron.schedule("5 0 * * *", async () => {
//     try {
//       const target = dayjs().add(1, "day").format("YYYY-MM-DD");
//       const res = await runPredictionsFor(target);
//       console.log(
//         `[AI] ${target} => created ${res.total} patient-scoped predictions`
//       );
//     } catch (e) {
//       console.error(
//         "[AI] scheduleDailyAIPrediction failed:",
//         e?.response?.data || e
//       );
//     }
//   });
// }
