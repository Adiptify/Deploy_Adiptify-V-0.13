import express from "express";
import { auth } from "../middleware/auth.js";
import Subject from "../models/Subject.js";
import Syllabus from "../models/Syllabus.js";

const router = express.Router();

router.post("/generate", auth, async (req, res) => {
    try {
        const { goal } = req.body;
        // In a real implementation, you'd use LLM to dynamically generate a daily study plan.
        // For demo/Azure deployment stability, we provide a structured mock based on user subjects.

        const subjects = await Subject.find({ students: req.user._id });
        if (subjects.length === 0) {
            return res.json({
                daily_plan: {
                    topics_to_study: [],
                    revision_topics: [],
                    quiz_topics: [],
                    status: "not_started"
                },
                message: "No subjects enrolled. Add a subject to get a plan.",
                status: "neutral"
            });
        }

        // Just fetch random topics from their syllabus
        let topicsToStudy = [];
        let revisionTopics = [];
        let quizTopics = [];

        for (const subject of subjects) {
            const syllabus = await Syllabus.findOne({ subjectId: subject._id });
            if (syllabus && syllabus.modules.length > 0) {
                const firstModule = syllabus.modules[0];
                if (firstModule.topics && firstModule.topics.length > 0) {
                    topicsToStudy.push(`${firstModule.topics[0].title} (${subject.name})`);
                    if (firstModule.topics.length > 1) {
                        revisionTopics.push(`${firstModule.topics[1].title} (${subject.name})`);
                    }
                    if (firstModule.topics.length > 2) {
                        quizTopics.push(`${firstModule.topics[2].title} (${subject.name})`);
                    }
                }
            }
        }

        return res.json({
            daily_plan: {
                topics_to_study: topicsToStudy.slice(0, 3),
                revision_topics: revisionTopics.slice(0, 2),
                quiz_topics: quizTopics.slice(0, 2),
                status: "in_progress"
            },
            message: "Stay focused! You're on track.",
            status: "on_track"
        });
    } catch (err) {
        console.error("Plan generate error:", err);
        return res.status(500).json({ error: "Failed to generate plan" });
    }
});

export default router;
