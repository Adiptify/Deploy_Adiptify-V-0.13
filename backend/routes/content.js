import express from "express";
import { auth } from "../middleware/auth.js";
import Content from "../models/Content.js";

const router = express.Router();

// POST /api/content - Create a content record (e.g. PPT slide data for study modules)
router.post("/", auth, async (req, res) => {
    try {
        const { subjectId, type, contentBody, slideData, metadata, syllabusNodeId, learningLevel } = req.body;
        if (!subjectId || !type) {
            return res.status(400).json({ error: "subjectId and type are required" });
        }

        const content = await Content.create({
            subjectId,
            syllabusNodeId: syllabusNodeId || null,
            type,
            learningLevel: learningLevel || 'Beginner',
            contentBody: contentBody || '',
            slideData: slideData || null,
            metadata: metadata || {},
            createdBy: req.user._id,
        });

        return res.status(201).json(content);
    } catch (e) {
        console.error("[content] Create error:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/content/:subjectId - Get all content for a subject
router.get("/:subjectId", auth, async (req, res) => {
    try {
        const contents = await Content.find({ subjectId: req.params.subjectId })
            .sort({ createdAt: -1 })
            .lean();
        return res.json(contents);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/content/:subjectId/pptx - Get PPT slide data specifically for study modules
router.get("/:subjectId/pptx", auth, async (req, res) => {
    try {
        const pptContent = await Content.findOne({
            subjectId: req.params.subjectId,
            type: 'pptx',
            slideData: { $ne: null }
        })
            .sort({ createdAt: -1 })
            .lean();

        if (!pptContent) {
            return res.status(404).json({ error: "No PPT content found for this subject" });
        }

        return res.json(pptContent);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/content/:id - Delete a content record
router.delete("/:id", auth, async (req, res) => {
    try {
        const deleted = await Content.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Content not found" });
        return res.status(204).send();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
