import express from "express";
import { auth } from "../middleware/auth.js";
import ExperimentResult from "../models/ExperimentResult.js";

const router = express.Router();

// POST /api/experiments/save — Save an experiment run
router.post("/save", auth, async (req, res) => {
    try {
        const { experimentId, experimentType, parameters, parameters_used, results, result_metrics } = req.body;
        
        if (!experimentType) {
            return res.status(400).json({ error: "experimentType is required" });
        }

        const result = new ExperimentResult({
            userId: req.user._id,
            experimentId: experimentId || `exp_${Date.now()}`,
            experimentType,
            parameters_used: parameters || parameters_used || {},
            result_metrics: results || result_metrics || {},
        });

        await result.save();
        console.log(`[Experiments] Saved ${experimentType} result for user ${req.user._id}`);
        res.json({ ok: true, id: result._id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/experiments/history — Get experiment history
router.get("/history", auth, async (req, res) => {
    try {
        const { type } = req.query;
        const filter = { userId: req.user._id };
        if (type) filter.experimentType = type;

        const results = await ExperimentResult.find(filter)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
