import express from "express";
import { auth } from "../middleware/auth.js";
import { submitReview, getDueReviews, getReviewStats, initializeReviews } from "../services/spacedRepetitionService.js";
import Concept from "../models/Concept.js";

const router = express.Router();

// GET /api/sr/due — Get concepts due for review
router.get("/due", auth, async (req, res) => {
    try {
        const dueReviews = await getDueReviews(req.user._id);

        // Enrich with concept data
        const conceptIds = dueReviews.map((r) => r.conceptId);
        const concepts = await Concept.find({ conceptId: { $in: conceptIds } }).lean();
        const conceptMap = {};
        for (const c of concepts) conceptMap[c.conceptId] = c;

        const enriched = dueReviews.map((r) => ({
            reviewId: r._id,
            conceptId: r.conceptId,
            concept: conceptMap[r.conceptId] || { title: r.conceptId },
            easiness_factor: r.easiness_factor,
            interval: r.interval,
            repetition: r.repetition,
            last_review: r.last_review,
            next_review: r.next_review,
        }));

        res.json({ due: enriched, count: enriched.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/sr/review — Submit a review quality score
router.post("/review", auth, async (req, res) => {
    try {
        const { conceptId, quality } = req.body;
        if (!conceptId || quality === undefined) {
            return res.status(400).json({ error: "conceptId and quality are required" });
        }
        const review = await submitReview(req.user._id, conceptId, quality);
        res.json({
            ok: true,
            easiness_factor: review.easiness_factor,
            interval: review.interval,
            repetition: review.repetition,
            next_review: review.next_review,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/sr/stats/:conceptId — Review stats for a concept
router.get("/stats/:conceptId", auth, async (req, res) => {
    try {
        const stats = await getReviewStats(req.user._id, req.params.conceptId);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/sr/initialize — Initialize review records for all concepts
router.post("/initialize", auth, async (req, res) => {
    try {
        const concepts = await Concept.find({}).lean();
        const conceptIds = concepts.map((c) => c.conceptId);
        const count = await initializeReviews(req.user._id, conceptIds);
        res.json({ ok: true, initialized: count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
