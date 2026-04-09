import express from "express";
import { auth } from "../middleware/auth.js";
import ProctorLog from "../models/ProctorLog.js";
import AssessmentSession from "../models/AssessmentSession.js";

const router = express.Router();

// POST /api/proctor/log - Log a proctoring violation
router.post("/log", auth, async (req, res) => {
    try {
        const { sessionId, violationType, severity, details } = req.body;

        const session = await AssessmentSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const log = await ProctorLog.create({
            session: sessionId,
            user: req.user._id,
            violationType,
            severity: severity || "minor",
            details: details || "",
        });

        // Update session proctor summary
        const field = severity === "major" ? "majorViolations" : "minorViolations";
        if (!session.proctorSummary) session.proctorSummary = {};
        session.proctorSummary[field] = (session.proctorSummary[field] || 0) + 1;
        session.proctorSummary.totalViolations = (session.proctorSummary.totalViolations || 0) + 1;
        if (violationType === "tab_switch") {
            session.proctorSummary.tabSwitchCount = (session.proctorSummary.tabSwitchCount || 0) + 1;
        }
        session.proctorLogs = [...(session.proctorLogs || []), log._id];
        await session.save();

        return res.json({ ok: true, logId: log._id });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/proctor/logs/:sessionId - Get proctor logs for a session
router.get("/logs/:sessionId", auth, async (req, res) => {
    try {
        const logs = await ProctorLog.find({ session: req.params.sessionId })
            .sort({ timestamp: -1 })
            .lean();
        return res.json(logs);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/proctor/sessions - Get all proctored sessions (for instructors)
router.get("/sessions", auth, async (req, res) => {
    try {
        const sessions = await AssessmentSession.find({ proctored: true })
            .populate("user", "name email studentId")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.json(sessions);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
