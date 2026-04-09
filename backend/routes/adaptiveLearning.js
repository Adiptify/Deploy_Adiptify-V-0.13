import express from "express";
import { auth } from "../middleware/auth.js";
import { getAdaptivePath, submitPerformance, getMasteryBreakdown } from "../services/adaptiveLearningService.js";
import { generateAllConceptsForUser, getEnrolledSubjectNames } from "../services/generateConceptsService.js";
import Concept from "../models/Concept.js";
import UserProgress from "../models/UserProgress.js";

const router = express.Router();

// GET /api/adaptive/path — Get recommended learning path
router.get("/path", auth, async (req, res) => {
    try {
        const path = await getAdaptivePath(req.user._id);
        res.json({ path });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/adaptive/concepts — Get concepts (optionally filtered by enrolled subjects)
router.get("/concepts", auth, async (req, res) => {
    try {
        const { enrolled } = req.query;

        let filter = {};

        if (enrolled === "true") {
            // Get user's enrolled subject names and filter concepts by matching category
            const subjectNames = await getEnrolledSubjectNames(req.user._id);
            if (subjectNames.length > 0) {
                filter.category = { $in: subjectNames };
            }
        }

        const concepts = await Concept.find(filter).sort({ category: 1, difficulty_level: 1 }).lean();

        // Also fetch user progress for these concepts
        const conceptIds = concepts.map(c => c.conceptId);
        const progressList = await UserProgress.find({
            userId: req.user._id,
            conceptId: { $in: conceptIds },
        }).lean();

        const progressMap = {};
        for (const p of progressList) {
            progressMap[p.conceptId] = p;
        }

        res.json({ concepts, progress: progressMap });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/adaptive/concept/:conceptId — Get a single concept with pipeline
router.get("/concept/:conceptId", async (req, res) => {
    try {
        const concept = await Concept.findOne({ conceptId: req.params.conceptId }).lean();
        if (!concept) return res.status(404).json({ error: "Concept not found" });
        res.json({ concept });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/adaptive/generate — Generate concepts for ALL enrolled subjects
router.post("/generate", auth, async (req, res) => {
    try {
        const stats = await generateAllConceptsForUser(req.user._id);
        res.json({ ok: true, ...stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/adaptive/submit — Submit performance data
router.post("/submit", auth, async (req, res) => {
    try {
        const { conceptId, correct, total, timeTakenMs, hintUsage, applicationScore, pipelineStage } = req.body;
        if (!conceptId) return res.status(400).json({ error: "conceptId is required" });

        const result = await submitPerformance(req.user._id, conceptId, {
            correct: correct || 0,
            total: total || 1,
            timeTakenMs: timeTakenMs || 0,
            hintUsage: hintUsage || 0,
            applicationScore: applicationScore || 0,
            pipelineStage: pipelineStage || 0,
        });

        res.json({ ok: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/adaptive/mastery/:conceptId — Get mastery breakdown
router.get("/mastery/:conceptId", auth, async (req, res) => {
    try {
        const data = await getMasteryBreakdown(req.user._id, req.params.conceptId);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
