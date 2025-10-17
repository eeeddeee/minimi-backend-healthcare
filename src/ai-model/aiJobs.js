import cron from "node-cron";
import dayjs from "dayjs";
import { aiPredictFor } from "./aiClient.js";
import { getPatientScopedRecipients } from "../utils/recipients.js";
import { notifyUsers } from "../utils/notify.js";

// Make a neat message/title for risk
function buildRiskMessage(pred) {
  const adv = Math.round((pred.adverseProbability || 0) * 100);
  const drivers =
    (pred.topFeatures || [])
      .slice(0, 3)
      .map((f) => f.name)
      .join(", ") || "—";
  return {
    title: `AI Risk: ${pred.predictedMood} likely on ${pred.targetDate}`,
    message: `Adverse mood risk ${adv}%. Top drivers: ${drivers}`,
  };
}

// run once
export async function runPredictionsFor(dateISO, limitToPatientIds = []) {
  const { predictions = [] } = await aiPredictFor(dateISO, limitToPatientIds);

  for (const pr of predictions) {
    const { all: recipients } = await getPatientScopedRecipients(pr.patientId);
    if (!recipients.length) continue;

    const { title, message } = buildRiskMessage(pr);

    // fire-and-forget insert + socket emit for each recipient
    await notifyUsers({
      userIds: recipients,
      type: "ai_risk",
      title,
      message,
      data: {
        patientId: pr.patientId,
        targetDate: pr.targetDate,
        predictedMood: pr.predictedMood,
        probabilities: pr.probabilities,
        topFeatures: pr.topFeatures || [],
        riskThreshold: Number(process.env.RISK_THRESHOLD || 0.6),
      },
      priority:
        (pr.adverseProbability || 0) >=
        Number(process.env.CRITICAL_THRESHOLD || 0.8)
          ? "critical"
          : "high",
      emitEvent: "notification:new",
      emitCount: true,
    });
  }

  return { total: predictions.length };
}

// CRON – roz 00:05 pe "kal" ki date ke liye predict
export function scheduleDailyAIPrediction() {
  cron.schedule("5 0 * * *", async () => {
    try {
      const target = dayjs().add(1, "day").format("YYYY-MM-DD");
      const res = await runPredictionsFor(target);
      console.log(
        `[AI] ${target} => created ${res.total} patient-scoped predictions`
      );
    } catch (e) {
      console.error(
        "[AI] scheduleDailyAIPrediction failed:",
        e?.response?.data || e
      );
    }
  });
}
