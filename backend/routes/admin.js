import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import User from "../models/User.js";
import Item from "../models/Item.js";
import AssessmentSession from "../models/AssessmentSession.js";
import Attempt from "../models/Attempt.js";
import AILog from "../models/AILog.js";
import IssueReport from "../models/IssueReport.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";

const router = express.Router();

// GET /api/admin/stats - System-wide statistics
router.get("/stats", auth, async (req, res) => {
    try {
        const [totalUsers, totalStudents, totalInstructors, totalItems, totalSessions, totalAttempts, totalAILogs, totalIssues] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "student" }),
            User.countDocuments({ role: "instructor" }),
            Item.countDocuments(),
            AssessmentSession.countDocuments(),
            Attempt.countDocuments(),
            AILog.countDocuments(),
            IssueReport.countDocuments(),
        ]);
        return res.json({
            totalUsers, totalStudents, totalInstructors,
            totalItems, totalSessions, totalAttempts,
            totalAILogs, totalIssues,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/users - List users
router.get("/users", auth, async (req, res) => {
    try {
        const { role, limit = 50 } = req.query;
        const filter = {};
        if (role) filter.role = role;

        const users = await User.find(filter)
            .select("-passwordHash")
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
        return res.json(users);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/admin/users/:id/role - Update user role
router.put("/users/:id/role", auth, async (req, res) => {
    try {
        const { role } = req.body;
        if (!["student", "instructor", "admin"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
            .select("-passwordHash");
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json(user);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", auth, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/ai-logs - Get AI usage logs
router.get("/ai-logs", auth, async (req, res) => {
    try {
        const logs = await AILog.find()
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();
        return res.json(logs);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/issues - Get all issues
router.get("/issues", auth, async (req, res) => {
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

// PUT /api/admin/issues/:id - Update issue status
router.put("/issues/:id", auth, async (req, res) => {
    try {
        const { status, adminResponse } = req.body;
        const issue = await IssueReport.findByIdAndUpdate(
            req.params.id,
            { status, adminResponse },
            { new: true }
        );
        if (!issue) return res.status(404).json({ error: "Not found" });
        return res.json(issue);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/cohort - Get cohort performance data
router.get("/cohort", auth, async (req, res) => {
    try {
        const students = await User.find({ role: "student" })
            .select("name email studentId learnerProfile createdAt")
            .lean();

        const cohortData = students.map(s => {
            const topics = s.learnerProfile?.topics || {};
            const topicEntries = Object.entries(topics);
            const avgMastery = topicEntries.length > 0
                ? Math.round(topicEntries.reduce((sum, [, v]) => sum + (v.mastery || 0), 0) / topicEntries.length)
                : 0;
            const totalAttempts = topicEntries.reduce((sum, [, v]) => sum + (v.attempts || 0), 0);

            return {
                _id: s._id,
                name: s.name,
                email: s.email,
                studentId: s.studentId,
                avgMastery,
                totalAttempts,
                topicCount: topicEntries.length,
                joinedAt: s.createdAt,
            };
        });

        return res.json(cohortData);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
