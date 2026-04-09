import express from "express";
import { auth } from "../middleware/auth.js";
import { generateTopicNotes } from "../services/ollamaService.js";

const router = express.Router();

// POST /api/notes/generate - Generate study notes for a topic
router.post("/generate", auth, async (req, res) => {
    try {
        const { topic, mistakes = [] } = req.body;
        if (!topic) return res.status(400).json({ error: "Topic is required" });

        const notes = await generateTopicNotes(topic, mistakes);
        return res.json({ topic, content: notes });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
