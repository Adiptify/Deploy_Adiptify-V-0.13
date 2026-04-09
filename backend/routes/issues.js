import express from "express";
import { auth } from "../middleware/auth.js";
import IssueReport from "../models/IssueReport.js";

const router = express.Router();

// POST /api/report-issue
router.post("/api/report-issue", auth, async (req, res) => {
    try {
        const { panel, section, summary, details } = req.body;
        const report = await IssueReport.create({
            reportedBy: req.user._id,
            userName: req.user.name,
            role: req.user.role,
            panel, section, summary, details,
        });
        return res.json({ ok: true, id: report._id });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/issues - Get all issues (for admin/instructor)
router.get("/api/issues", auth, async (req, res) => {
    try {
        const issues = await IssueReport.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.json(issues);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
