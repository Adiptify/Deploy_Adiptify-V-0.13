import express from 'express';
import { Ollama } from 'ollama';
import Subject from '../models/Subject.js';
import Syllabus from '../models/Syllabus.js';
import { config } from '../config/index.js';

const router = express.Router();

const ollamaUrl = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
    ? config.ollamaBaseUrl
    : 'http://127.0.0.1:11434';

const ollama = new Ollama({
    host: ollamaUrl
});

function isValidQuestion(question, topic) {
    // Build keywords from topic title/desc or subject name
    const textContext = `${topic.name || topic.title} ${topic.description || ''}`;
    const keywords = textContext.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    if (keywords.length === 0) return true; // Fallback

    return keywords.some(k => question.toLowerCase().includes(k));
}

function buildMessages({ subject, topic, syllabus, question }) {
    return [
        {
            role: "system",
            content: `You are a subject-restricted AI tutor.

Rules:
- Only answer within subject and topic
- Use only given syllabus
- If outside → say "Out of syllabus"
- No hallucination
- Structured answers only`
        },
        {
            role: "user",
            content: `Subject: ${subject}
Topic: ${topic}

Syllabus:
${syllabus}

Question:
${question}`
        }
    ];
}

router.post('/chat', async (req, res) => {
    try {
        const { subject_id, topic_id, question } = req.body;

        if (!subject_id || !question) return res.status(400).json({ error: "Missing subject_id or question" });

        // STEP 1: fetch subject + topic
        const subjectObj = await Subject.findById(subject_id).lean();
        if (!subjectObj) return res.status(404).json({ error: "Subject not found" });

        let topicObj = null;
        let fullSyllabusText = "";

        const syllabusObj = await Syllabus.findOne({ subjectId: subject_id }).lean();
        if (syllabusObj && syllabusObj.modules) {
            for (const m of syllabusObj.modules) {
                fullSyllabusText += `Module: ${m.title}\n`;
                if (Array.isArray(m.topics)) {
                    for (const t of m.topics) {
                        fullSyllabusText += `- ${t.title}: ${t.description || ''}\n`;
                        if (topic_id && (t._id?.toString() === topic_id || t.title === topic_id)) {
                            topicObj = t;
                        }
                    }
                }
            }
        }

        // Fallback if topic wasn't specifically found inside Syllabus
        if (!topicObj) {
            topicObj = subjectObj;
        }

        // STEP 2: applicability check
        if (!isValidQuestion(question, topicObj)) {
            return res.json({ error: "Out of syllabus" });
        }

        // STEP 3: build messages with behavior engine tuning
        const messages = buildMessages({
            subject: subjectObj.name,
            topic: topicObj.title || topicObj.name || String(topic_id || "General"),
            syllabus: fullSyllabusText || "Not provided.",
            question
        });

        // Inject user-specific behavior rules from settings engine
        try {
            const userId = req.user?._id || req.body.userId;
            if (userId) {
                const { buildTutorPromptSuffix } = await import('../services/behaviorEngine.js');
                const suffix = await buildTutorPromptSuffix(userId);
                if (suffix) {
                    messages[0].content += suffix;
                }
            }
        } catch { /* settings engine not ready — use defaults */ }

        // STEP 4: call Ollama
        const stream = await ollama.chat({
            model: config.ollamaModel || 'llama3',
            messages,
            stream: true,
            options: {
                temperature: 0.2,
                top_p: 0.9
            },
            keep_alive: "5m"
        });

        // The user strictly asked for this streaming loop behavior.
        res.setHeader("Content-Type", "text/plain");

        // STEP 5: stream response
        for await (const chunk of stream) {
            if (chunk.message && typeof chunk.message.content === 'string') {
                res.write(chunk.message.content);
            }
        }

        res.end();

    } catch (e) {
        if (!res.headersSent) {
            return res.status(500).json({ error: e.message });
        } else {
            res.write(`Error: ${e.message}`);
            res.end();
        }
    }
});

export default router;
