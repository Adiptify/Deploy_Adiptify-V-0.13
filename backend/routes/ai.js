import express from "express";
import { auth } from "../middleware/auth.js";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParseRaw = require("pdf-parse");
let pdfParse;
if (typeof pdfParseRaw === 'function') {
    pdfParse = pdfParseRaw;
} else if (pdfParseRaw && typeof pdfParseRaw.default === 'function') {
    pdfParse = pdfParseRaw.default;
} else {
    console.error("[CRITICAL] Failed to derive a function from pdf-parse library. pdfParseRaw:", typeof pdfParseRaw);
    pdfParse = async () => { throw new Error("PDF parser initialization failed on server."); };
}
import { generateQuestionsFromTopic, generateExplanation, validateSubject, parseSyllabusFromText, parseSyllabusChunked, parseSyllabusIterative, parseSyllabusPipeline } from "../services/ollamaService.js";
import { cleanText, chunkText } from "../utils/pdfUtils.js";
import { parsePptxToJson, extractSlideTexts, chunkSlides } from "../utils/pptUtils.js";
import { extractPdfPages, extractSlides, chunkGenerator } from "../utils/parserUtils.js";
import { mergeSyllabusPartials } from "../utils/syllabusAggregator.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";
import Content from "../models/Content.js";
import Subject from "../models/Subject.js";
import Syllabus from "../models/Syllabus.js";
import Item from "../models/Item.js";
import { logAI } from "../middleware/aiLogger.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/ai/parse-pdf - Parse a PDF syllabus using structured pipeline
// Returns extracted syllabus data OR auto-creates Subject + Syllabus if autoCreate=true
router.post("/parse-pdf", auth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No PDF file provided" });
        const autoCreate = req.body?.autoCreate === 'true' || req.body?.autoCreate === true;

        // ── Step 1: Buffer extract & null ──
        const buffer = req.file.buffer;
        const filename = req.file.originalname;
        req.file.buffer = null;

        console.log(`[parse-pdf] Starting structured pipeline for: ${filename}`);

        // ── Step 2: Stream → Chunk → Structured Pipeline ──
        const pageStream = extractPdfPages(buffer);
        const chunks = chunkGenerator(pageStream, 500);

        const syllabus = await parseSyllabusPipeline(chunks, (done, total) => {
            console.log(`[parse-pdf] Progress: ${done}/${total} chunks`);
        });

        // Ensure required fields have fallbacks
        const syllabusData = {
            name: syllabus.name || filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
            description: syllabus.description || `Syllabus extracted from ${filename}`,
            category: syllabus.category || 'General',
            learningOutcomes: Array.isArray(syllabus.learningOutcomes) && syllabus.learningOutcomes.length > 0
                ? syllabus.learningOutcomes
                : [`Understand core concepts from ${syllabus.name || filename}`],
            modules: syllabus.modules || [],
            _meta: {
                filename,
                fileType: 'pdf',
                strategy: 'structured-pipeline',
                chunksProcessed: syllabus.modules?.length || 0,
                moduleCount: syllabus.modules?.length || 0,
                topicCount: (syllabus.modules || []).reduce((sum, m) => sum + (m.topics?.length || 0), 0)
            }
        };

        // ── Step 3: Auto-create Subject + Syllabus if requested ──
        if (autoCreate) {
            const subject = await Subject.create({
                name: syllabusData.name,
                description: syllabusData.description,
                domainCategory: syllabusData.category,
                category: syllabusData.category,
                learningOutcomes: syllabusData.learningOutcomes,
                type: 'general',
                icon: '📄',
                color: '#3b82f6',
                isDefault: false,
                createdBy: req.user._id,
                status: 'active',
            });

            if (syllabusData.modules.length > 0) {
                await Syllabus.create({
                    subjectId: subject._id,
                    modules: syllabusData.modules,
                    createdBy: req.user._id,
                });
            }

            syllabusData._createdSubject = subject;
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/parse-pdf",
            params: { filename, autoCreate },
            status: "success", model: "ollama",
            request: "PDF structured pipeline",
            response: `${syllabusData.modules.length} modules, ${syllabusData._meta.topicCount} topics`,
        });

        if (global.gc) global.gc();
        return res.json(syllabusData);
    } catch (e) {
        console.error("[parse-pdf] Error:", e.message);
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/parse-pdf", status: "error", error: e.message });
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/parse-ppt - Parse a PPTX syllabus using structured pipeline
// Also stores the raw slide JSON in Content for future study module rendering
router.post("/parse-ppt", auth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No PPT file provided" });
        const autoCreate = req.body?.autoCreate === 'true' || req.body?.autoCreate === true;

        const ext = req.file.originalname.toLowerCase();
        if (!ext.endsWith('.pptx') && !ext.endsWith('.ppt')) {
            return res.status(400).json({ error: "Only .pptx files are supported." });
        }

        // ── Step 1: Buffer extract & null ──
        const buffer = req.file.buffer;
        const filename = req.file.originalname;
        req.file.buffer = null;

        console.log(`[parse-ppt] Starting structured pipeline for: ${filename}`);

        // ── Step 2: Parse PPTX to JSON for slide data ──
        let rawSlideData = null;
        try {
            const pptJson = await parsePptxToJson(buffer);
            const slideTexts = extractSlideTexts(pptJson.slides || []);
            rawSlideData = { slides: pptJson.slides, slideTexts };
        } catch (e) {
            console.warn(`[parse-ppt] pptxtojson failed, using stream fallback:`, e.message);
        }

        // ── Step 3: Stream → Chunk → Structured Pipeline ──
        const slideStream = extractSlides(buffer);
        const chunks = chunkGenerator(slideStream, 500);

        const syllabus = await parseSyllabusPipeline(chunks, (done, total) => {
            console.log(`[parse-ppt] Progress: ${done}/${total} chunks`);
        });

        const syllabusData = {
            name: syllabus.name || filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
            description: syllabus.description || `Syllabus extracted from ${filename}`,
            category: syllabus.category || 'General',
            learningOutcomes: Array.isArray(syllabus.learningOutcomes) && syllabus.learningOutcomes.length > 0
                ? syllabus.learningOutcomes
                : [`Understand core concepts from ${syllabus.name || filename}`],
            modules: syllabus.modules || [],
            _meta: {
                filename,
                fileType: 'pptx',
                strategy: 'structured-pipeline',
                totalSlides: rawSlideData?.slideTexts?.length || 0,
                moduleCount: syllabus.modules?.length || 0,
                topicCount: (syllabus.modules || []).reduce((sum, m) => sum + (m.topics?.length || 0), 0)
            },
            _slideData: rawSlideData,
        };

        // ── Step 4: Auto-create Subject + Syllabus + Content if requested ──
        if (autoCreate) {
            const subject = await Subject.create({
                name: syllabusData.name,
                description: syllabusData.description,
                domainCategory: syllabusData.category,
                category: syllabusData.category,
                learningOutcomes: syllabusData.learningOutcomes,
                type: 'general',
                icon: '📊',
                color: '#8b5cf6',
                isDefault: false,
                createdBy: req.user._id,
                status: 'active',
            });

            if (syllabusData.modules.length > 0) {
                await Syllabus.create({
                    subjectId: subject._id,
                    modules: syllabusData.modules,
                    createdBy: req.user._id,
                });
            }

            // Store raw slide data for study modules
            if (rawSlideData) {
                try {
                    await Content.create({
                        subjectId: subject._id,
                        type: 'pptx',
                        contentBody: `PPT upload: ${filename}`,
                        slideData: rawSlideData,
                        metadata: { source: 'ppt-upload', filename },
                        createdBy: req.user._id,
                    });
                } catch (e) {
                    console.warn('[parse-ppt] Failed to store slide data:', e.message);
                }
            }

            syllabusData._createdSubject = subject;
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/parse-ppt",
            params: { filename, autoCreate },
            status: "success", model: "ollama",
            request: "PPTX structured pipeline",
            response: `${syllabusData.modules.length} modules, ${syllabusData._meta.topicCount} topics`,
        });

        if (global.gc) global.gc();
        return res.json(syllabusData);
    } catch (e) {
        console.error("[parse-ppt] Error:", e.message);
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/parse-ppt", status: "error", error: e.message });
        return res.status(500).json({ error: e.message });
    }
});


// POST /api/ai/validate-subject - Validate a subject using Human-in-the-Loop AI
router.post("/validate-subject", auth, async (req, res) => {
    try {
        const { subjectData, bypassValidation } = req.body;

        // Organization admins can bypass validation
        if (req.user.role === 'admin' && bypassValidation) {
            return res.json({
                isValid: true,
                feedback: ["Bypassed by Organization Admin"],
                suggestedLevel: "Intermediate"
            });
        }

        const result = await validateSubject(subjectData);

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/validate-subject", params: { subjectName: subjectData?.name },
            status: "success", model: "ollama",
            request: JSON.stringify(subjectData), response: JSON.stringify(result),
        });

        return res.json(result);
    } catch (e) {
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/validate-subject", status: "error", error: e.message });
        return res.status(500).json({ error: "Validation failed: " + e.message });
    }
});

// POST /api/ai/generate - Generate questions for a topic
router.post("/generate", auth, async (req, res) => {
    try {
        const { topic, count = 5, distribution, saveToBank = true } = req.body;
        if (!topic) return res.status(400).json({ error: "Topic is required" });

        const result = await generateQuestionsFromTopic(topic, {
            count,
            distribution: distribution || { easy: 2, medium: 2, hard: 1 },
        });

        // Save to GeneratedAssessment
        const genRecord = await GeneratedAssessment.create({
            topic,
            title: result.title,
            items: result.items,
            rawResponse: result.rawResponse,
            status: saveToBank ? "published" : "draft",
            createdBy: req.user._id,
            publishedAt: saveToBank ? new Date() : undefined,
            publishedBy: saveToBank ? req.user._id : undefined,
        });

        let linkedItemIds = [];
        if (saveToBank) {
            const saved = await Item.insertMany(
                result.items.map(i => ({ ...i, createdBy: req.user._id }))
            );
            linkedItemIds = saved.map(s => s._id);
            genRecord.linkedItemIds = linkedItemIds;
            await genRecord.save();
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/generate", params: { topic, count },
            status: "success", model: "ollama",
            request: topic, response: JSON.stringify(result.items.length + " items generated"),
        });

        return res.json({
            generatedAssessmentId: genRecord._id,
            linkedItemIds,
            itemCount: result.items.length,
            items: result.items,
        });
    } catch (e) {
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/generate", status: "error", error: e.message });
        return res.status(500).json({ error: "Generation failed: " + e.message });
    }
});

// POST /api/ai/explain - Get explanation for an answer
router.post("/explain", auth, async (req, res) => {
    try {
        const { question, correctAnswer, studentAnswer, topic } = req.body;
        const explanation = await generateExplanation(question, correctAnswer, studentAnswer, topic);
        return res.json(explanation);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/generated - List generated assessments
router.get("/generated", auth, async (req, res) => {
    try {
        const assessments = await GeneratedAssessment.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        return res.json(assessments);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/generated/:id
router.get("/generated/:id", auth, async (req, res) => {
    try {
        const assessment = await GeneratedAssessment.findById(req.params.id).lean();
        if (!assessment) return res.status(404).json({ error: "Not found" });
        return res.json(assessment);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/publish/:id - Publish a draft assessment
router.post("/publish/:id", auth, async (req, res) => {
    try {
        const gen = await GeneratedAssessment.findById(req.params.id);
        if (!gen) return res.status(404).json({ error: "Not found" });
        if (gen.status === "published") return res.json({ message: "Already published", linkedItemIds: gen.linkedItemIds });

        const saved = await Item.insertMany(
            gen.items.map(i => ({ ...i, createdBy: req.user._id }))
        );
        gen.linkedItemIds = saved.map(s => s._id);
        gen.status = "published";
        gen.publishedAt = new Date();
        gen.publishedBy = req.user._id;
        await gen.save();

        return res.json({ message: "Published", linkedItemIds: gen.linkedItemIds });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/generate-module-content — Generate study notes for a module's topics
router.post("/generate-module-content", auth, async (req, res) => {
    try {
        const { subjectId, moduleIndex } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });

        const syllabus = await Syllabus.findOne({ subjectId });
        if (!syllabus) return res.status(404).json({ error: "Syllabus not found for this subject" });

        const mod = syllabus.modules[moduleIndex ?? 0];
        if (!mod) return res.status(404).json({ error: `Module at index ${moduleIndex} not found` });

        const { generateTopicNotes } = await import("../services/ollamaService.js");

        const results = [];
        for (const topic of (mod.topics || [])) {
            try {
                const notes = await generateTopicNotes(topic.title || topic.name);
                results.push({
                    topic: topic.title || topic.name,
                    notes,
                    status: 'success',
                });
            } catch (e) {
                results.push({
                    topic: topic.title || topic.name,
                    notes: `Notes generation failed: ${e.message}`,
                    status: 'failed',
                });
            }
        }

        // Store generated content
        try {
            await Content.create({
                subjectId,
                type: 'study-notes',
                contentBody: JSON.stringify(results),
                metadata: { moduleTitle: mod.title, moduleIndex, generatedAt: new Date() },
                createdBy: req.user._id,
            });
        } catch (e) {
            console.warn('[generate-module-content] Failed to store content:', e.message);
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/generate-module-content",
            params: { subjectId, moduleIndex, topicCount: results.length },
            status: "success", model: "ollama",
            request: `Module: ${mod.title}`,
            response: `${results.filter(r => r.status === 'success').length}/${results.length} topics`,
        });

        return res.json({
            module: mod.title,
            topicResults: results,
            successCount: results.filter(r => r.status === 'success').length,
            totalTopics: results.length,
        });
    } catch (e) {
        console.error("[generate-module-content] Error:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/generate-subject-content — Generate content for ALL modules of a subject
router.post("/generate-subject-content", auth, async (req, res) => {
    try {
        const { subjectId } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });

        const syllabus = await Syllabus.findOne({ subjectId });
        if (!syllabus || !syllabus.modules?.length) {
            return res.status(404).json({ error: "No syllabus/modules found for this subject" });
        }

        const { generateTopicNotes } = await import("../services/ollamaService.js");
        const moduleResults = [];

        for (const [modIdx, mod] of syllabus.modules.entries()) {
            const topicResults = [];
            for (const topic of (mod.topics || [])) {
                try {
                    const notes = await generateTopicNotes(topic.title || topic.name);
                    topicResults.push({ topic: topic.title || topic.name, notes, status: 'success' });
                } catch (e) {
                    topicResults.push({ topic: topic.title || topic.name, notes: '', status: 'failed' });
                }
            }
            moduleResults.push({ module: mod.title, index: modIdx, topics: topicResults });
        }

        // Store all content at once
        try {
            await Content.create({
                subjectId,
                type: 'full-study-notes',
                contentBody: JSON.stringify(moduleResults),
                metadata: {
                    moduleCount: syllabus.modules.length,
                    totalTopics: moduleResults.reduce((s, m) => s + m.topics.length, 0),
                    generatedAt: new Date(),
                },
                createdBy: req.user._id,
            });
        } catch (e) {
            console.warn('[generate-subject-content] Failed to store:', e.message);
        }

        return res.json({
            modules: moduleResults,
            summary: {
                totalModules: moduleResults.length,
                totalTopics: moduleResults.reduce((s, m) => s + m.topics.length, 0),
                successTopics: moduleResults.reduce((s, m) => s + m.topics.filter(t => t.status === 'success').length, 0),
            }
        });
    } catch (e) {
        console.error("[generate-subject-content] Error:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/generate-for-subject — Generate quiz from subject's syllabus topics
router.post("/generate-for-subject", auth, async (req, res) => {
    try {
        const { subjectId, count = 10 } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });

        const syllabus = await Syllabus.findOne({ subjectId });
        if (!syllabus || !syllabus.modules?.length) {
            return res.status(404).json({ error: "No syllabus/modules found" });
        }

        // Collect all topic names
        const allTopics = [];
        syllabus.modules.forEach(m => {
            (m.topics || []).forEach(t => {
                allTopics.push(t.title || t.name);
            });
        });

        if (allTopics.length === 0) {
            return res.status(400).json({ error: "No topics found in syllabus modules" });
        }

        // Pick random topics for variety
        const selectedTopics = allTopics.sort(() => Math.random() - 0.5).slice(0, 3);
        const topicString = selectedTopics.join(', ');

        const result = await generateQuestionsFromTopic(topicString, {
            count: Math.min(count, 20),
            distribution: { easy: Math.ceil(count * 0.3), medium: Math.ceil(count * 0.5), hard: Math.floor(count * 0.2) },
        });

        const subject = await Subject.findById(subjectId).lean();

        const genRecord = await GeneratedAssessment.create({
            topic: topicString,
            title: `${subject?.name || 'Subject'} Assessment`,
            items: result.items,
            rawResponse: result.rawResponse,
            status: "published",
            createdBy: req.user._id,
            publishedAt: new Date(),
            publishedBy: req.user._id,
        });

        const saved = await Item.insertMany(
            result.items.map(i => ({ ...i, createdBy: req.user._id }))
        );
        genRecord.linkedItemIds = saved.map(s => s._id);
        await genRecord.save();

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/generate-for-subject",
            params: { subjectId, count },
            status: "success", model: "ollama",
            request: topicString, response: `${result.items.length} items generated`,
        });

        return res.json({
            generatedAssessmentId: genRecord._id,
            itemCount: result.items.length,
            topics: selectedTopics,
            items: result.items,
        });
    } catch (e) {
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/generate-for-subject", status: "error", error: e.message });
        return res.status(500).json({ error: "Generation failed: " + e.message });
    }
});

export default router;

