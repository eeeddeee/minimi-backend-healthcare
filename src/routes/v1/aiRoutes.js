import express from "express";
import dayjs from "dayjs";
import { runPredictionsFor } from "../../ai/aiJobs.js";
const router = express.Router();

router.post("/predict-now", async (req, res) => {
  try {
    const date =
      req.body?.target_date || dayjs().add(1, "day").format("YYYY-MM-DD");
    const ids = Array.isArray(req.body?.patient_ids)
      ? req.body.patient_ids
      : [];
    const out = await runPredictionsFor(date, ids);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
