import express from "express";
import { auth } from "../middleware/auth.js";
import { generateTopicNotes } from "../services/ollamaService.js";
import User from "../models/User.js";

const router = express.Router();

// GET /api/learning/subjects - Get all available subjects
router.get("/subjects", auth, async (req, res) => {
    try {
        const defaultSubjects = [
            "Arithmetic", "Algebra", "Geometry", "Statistics", "Probability",
            "Calculus", "Linear Algebra", "Data Structures", "Algorithms",
            "Machine Learning", "Physics", "Chemistry", "Biology",
        ];
        return res.json(defaultSubjects);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/learning/subject - Add a subject to user's learner profile
router.post("/subject", auth, async (req, res) => {
    try {
        const { subject } = req.body;
        if (!subject) return res.status(400).json({ error: "Subject is required" });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const topics = user.learnerProfile?.topics || new Map();
        if (topics.has(subject)) return res.status(409).json({ error: "Subject already exists" });

        topics.set(subject, { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 });
        user.learnerProfile = { ...user.learnerProfile, topics };
        await user.save();

        return res.json({ ok: true, subject });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/learning/module/:topic - Get learning module content
router.get("/module/:topic", auth, async (req, res) => {
    try {
        const topic = decodeURIComponent(req.params.topic);
        const notes = await generateTopicNotes(topic);
        return res.json({
            content: notes,
            resources: [
                { title: `${topic} - Wikipedia`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}` },
                { title: `${topic} - Khan Academy`, url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(topic)}` },
            ],
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
