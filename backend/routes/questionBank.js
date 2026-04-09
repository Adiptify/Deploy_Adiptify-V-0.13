import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import Item from "../models/Item.js";

const router = express.Router();

// GET /api/question-bank - List items with filtering
router.get("/", auth, async (req, res) => {
    try {
        const { topic, difficulty, type, limit = 50, skip = 0 } = req.query;
        const filter = {};
        if (topic) filter.topics = { $in: [topic] };
        if (difficulty) filter.difficulty = parseInt(difficulty);
        if (type) filter.type = type;

        const items = await Item.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .lean();

        const total = await Item.countDocuments(filter);
        return res.json({ items, total });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/question-bank/:id
router.get("/:id", auth, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ error: "Not found" });
        return res.json(item);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/question-bank - Create a new question
router.post("/", auth, async (req, res) => {
    try {
        const item = await Item.create({ ...req.body, createdBy: req.user._id });
        return res.json(item);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/question-bank/:id
router.put("/:id", auth, async (req, res) => {
    try {
        const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!item) return res.status(404).json({ error: "Not found" });
        return res.json(item);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/question-bank/:id
router.delete("/:id", auth, async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/question-bank/bulk - Bulk import questions
router.post("/bulk", auth, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Items array is required" });
        }
        const saved = await Item.insertMany(
            items.map(i => ({ ...i, createdBy: req.user._id }))
        );
        return res.json({ imported: saved.length, items: saved });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
