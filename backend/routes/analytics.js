import express from "express";
import { auth } from "../middleware/auth.js";
import { getDashboardMetrics, getConceptAnalytics } from "../services/analyticsService.js";

const router = express.Router();

// GET /api/analytics/dashboard — Full dashboard metrics
router.get("/dashboard", auth, async (req, res) => {
    try {
        const metrics = await getDashboardMetrics(req.user._id);
        res.json(metrics);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/analytics/concept/:conceptId — Per-concept analytics
router.get("/concept/:conceptId", auth, async (req, res) => {
    try {
        const data = await getConceptAnalytics(req.user._id, req.params.conceptId);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
