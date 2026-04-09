import express from "express";
import { auth } from "../middleware/auth.js";
import { startAssessment, getSessionHistory } from "../services/assessmentService.js";
import { gradeAnswer } from "../services/gradingService.js";
import { updateMastery } from "../services/masteryService.js";
import AssessmentSession from "../models/AssessmentSession.js";
import Attempt from "../models/Attempt.js";
import Item from "../models/Item.js";

const router = express.Router();

// POST /api/assessment/start
router.post("/start", auth, async (req, res) => {
    try {
        const { mode, requestedTopics, limit, proctored } = req.body;
        const session = await startAssessment(req.user._id, {
            mode, requestedTopics, limit: limit || 5, proctored,
        });
        return res.json(session);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/assessment/answer - Submit a single answer
router.post("/answer", auth, async (req, res) => {
    try {
        const { sessionId, itemId, userAnswer, timeTakenMs } = req.body;

        const session = await AssessmentSession.findById(sessionId);
        if (!session || session.status !== "active") {
            return res.status(400).json({ error: "Invalid or completed session" });
        }

        const item = await Item.findById(itemId).lean();
        if (!item) return res.status(404).json({ error: "Item not found" });

        // Grade the answer
        const grading = gradeAnswer(item, userAnswer);

        // Save attempt
        const attempt = await Attempt.create({
            user: req.user._id,
            item: itemId,
            session: sessionId,
            isCorrect: grading.isCorrect,
            userAnswer,
            score: grading.score,
            gradingDetails: grading,
            timeTakenMs: timeTakenMs || 0,
        });

        // Update mastery
        const topic = item.topics?.[0];
        if (topic) {
            await updateMastery(req.user._id, topic, grading.isCorrect, timeTakenMs || 0);
        }

        // Advance session index
        session.currentIndex = (session.currentIndex || 0) + 1;
        await session.save();

        return res.json({
            isCorrect: grading.isCorrect,
            score: grading.score,
            feedback: grading.feedback,
            explanation: item.explanation,
            correctAnswer: item.answer,
            attemptId: attempt._id,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/assessment/finish
router.post("/finish", auth, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await AssessmentSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        // Calculate score from attempts
        const attempts = await Attempt.find({ session: sessionId }).lean();
        const totalCorrect = attempts.filter(a => a.isCorrect).length;
        const totalQuestions = attempts.length;
        const score = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        session.status = "completed";
        session.completedAt = new Date();
        session.score = score;
        await session.save();

        return res.json({
            sessionId: session._id,
            score,
            totalCorrect,
            totalQuestions,
            completedAt: session.completedAt,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/assessment/sessions - Get session history
router.get("/sessions", auth, async (req, res) => {
    try {
        const { status, limit } = req.query;
        const sessions = await getSessionHistory(req.user._id, {
            status, limit: parseInt(limit) || 10,
        });
        return res.json(sessions);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/assessment/session/:id - Get session details with attempts
router.get("/session/:id", auth, async (req, res) => {
    try {
        const session = await AssessmentSession.findById(req.params.id)
            .populate("itemIds")
            .lean();
        if (!session) return res.status(404).json({ error: "Not found" });

        const attempts = await Attempt.find({ session: req.params.id })
            .populate("item")
            .lean();

        return res.json({ ...session, attempts });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/assessment/simple-finish - Support for legacy static quiz frontend
router.post("/simple-finish", auth, async (req, res) => {
    try {
        const { quizId, score, answers } = req.body;

        // Save as a stub AssessmentSession just to record the score
        const session = await AssessmentSession.create({
            user: req.user._id,
            mode: "practice",
            status: "completed",
            score: score,
            completedAt: new Date()
        });

        return res.json(session);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/assessment/leaderboard - Aggregates top scores
router.get("/leaderboard", auth, async (req, res) => {
    try {
        // Aggregate top scores from finished sessions, group by user
        const topScores = await AssessmentSession.aggregate([
            { $match: { status: "completed", score: { $exists: true } } },
            { $group: { _id: "$user", maxScore: { $max: "$score" }, latestDate: { $max: "$completedAt" } } },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
            { $unwind: "$userInfo" },
            { $project: { name: "$userInfo.name", score: "$maxScore", date: "$latestDate" } },
            { $sort: { score: -1 } },
            { $limit: 10 }
        ]);

        return res.json(topScores);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
