import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import Syllabus from "../models/Syllabus.js";
import Subject from "../models/Subject.js";

const router = express.Router();

// GET /api/syllabus/:subjectId - Get the syllabus for a given subject
router.get("/:subjectId", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.subjectId)) {
            return res.status(400).json({ error: "Invalid Subject ID format" });
        }

        const syllabus = await Syllabus.findOne({ subjectId: req.params.subjectId }).lean();
        if (!syllabus) return res.json({ modules: [] });

        return res.json(syllabus);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/syllabus - Create or update a syllabus structure for a subject
router.post("/", auth, async (req, res) => {
    try {
        const { subjectId, modules } = req.body;

        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });
        if (!mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({ error: "Invalid Subject ID format" });
        }

        const subject = await Subject.findById(subjectId);
        if (!subject) return res.status(404).json({ error: "Subject not found, cannot attach syllabus." });

        if (subject.createdBy && subject.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ error: "Not authorized to update syllabus for this subject." });
        }

        const validModules = Array.isArray(modules) ? modules : [];

        let syllabus = await Syllabus.findOne({ subjectId });
        if (syllabus) {
            syllabus.modules = validModules;
            await syllabus.save();
        } else {
            syllabus = await Syllabus.create({
                subjectId,
                modules: validModules,
                createdBy: req.user._id
            });
        }

        return res.json(syllabus);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
