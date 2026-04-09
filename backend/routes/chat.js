import express from "express";
import { auth } from "../middleware/auth.js";
import { chatWithTutor } from "../services/ollamaService.js";
import { logAI } from "../middleware/aiLogger.js";
import ChatSession from "../models/ChatSession.js";
import ChatMessage from "../models/ChatMessage.js";
import Subject from "../models/Subject.js";
import { Ollama } from 'ollama';
import { config } from "../config/index.js";

const router = express.Router();

const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
    ? config.ollamaBaseUrl
    : 'http://127.0.0.1:11434';

const ollama = new Ollama({ host: ollamaBase });

// POST /api/chat - Context-aware AI chat (non-streaming)
router.post("/", auth, async (req, res) => {
    try {
        const { message, context, history = [] } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        const messages = [
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: message },
        ];

        const reply = await chatWithTutor(messages, context);

        await logAI({
            userId: req.user._id, userName: req.user.name || "Student", role: req.user.role || "student",
            endpoint: "/api/chat", params: { message: message.substring(0, 100) },
            status: "success", model: "ollama",
            request: message, response: reply.substring(0, 500),
        });

        return res.json({ reply, role: "assistant" });
    } catch (e) {
        return res.status(500).json({ error: "Chat failed: " + e.message });
    }
});

// POST /api/chat/stream - Standalone streaming chat (SSE) with thinking/content support
router.post("/stream", auth, async (req, res) => {
    try {
        const { message, context, history = [] } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        let systemPrompt = "You are Adiptify, an adaptive AI tutor. Provide concise, helpful answers. Use markdown formatting for structure.";
        if (context) {
            systemPrompt += `\n\nSTUDENT CONTEXT:\n- Mastery: ${context.mastery || "unknown"}%\n- Weak Area: ${context.weakArea || "unknown"}`;
        }

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: message },
        ];

        const stream = await ollama.chat({
            model: config.ollamaModel || 'qwen3',
            messages: apiMessages,
            stream: true,
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        for await (const chunk of stream) {
            // Send thinking and content as separate event types
            const event = {
                thinking: chunk.message?.thinking || null,
                content: chunk.message?.content || null,
                done: chunk.done || false,
            };
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (e) {
        if (!res.headersSent) {
            return res.status(500).json({ error: e.message });
        }
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
    }
});

// GET /api/chat/sessions - List user chat sessions
router.get("/sessions", auth, async (req, res) => {
    try {
        const query = { userId: req.user._id, status: "active" };
        if (req.query.subjectId) query.subjectId = req.query.subjectId;

        const sessions = await ChatSession.find(query)
            .populate("subjectId", "name")
            .sort({ updatedAt: -1 })
            .lean();
        return res.json(sessions);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/chat/sessions - Create new session
router.post("/sessions", auth, async (req, res) => {
    try {
        const { subjectId, title } = req.body;
        const session = await ChatSession.create({
            userId: req.user._id,
            subjectId: subjectId || null,
            title: title || "New Conversation"
        });
        return res.json(session);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/chat/sessions/:id/messages - Get messages for a session
router.get("/sessions/:id/messages", auth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id });
        if (!session) return res.status(404).json({ error: "Session not found" });

        const messages = await ChatMessage.find({ sessionId: req.params.id })
            .sort({ createdAt: 1 })
            .lean();
        return res.json(messages);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/chat/sessions/:id/message - Send message to session (non-streaming)
router.post("/sessions/:id/message", auth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id }).populate("subjectId");
        if (!session) return res.status(404).json({ error: "Session not found" });

        const { message, context = {} } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        // Save user message
        const userMsg = await ChatMessage.create({
            sessionId: session._id,
            sender: "user",
            content: message
        });

        // Get recent history
        const historyRaw = await ChatMessage.find({ sessionId: session._id })
            .sort({ createdAt: 1 })
            .limit(20)
            .lean();

        const history = historyRaw.filter(m => m._id.toString() !== userMsg._id.toString()).map(m => ({
            role: m.sender === "ai" ? "assistant" : "user",
            content: m.content
        }));

        // Build context
        let enhancedContext = { ...context };
        if (session.subjectId) {
            enhancedContext.subjectName = session.subjectId.name;
        } else {
            try {
                const userEnrolledSubjects = await Subject.find({});
                for (const sub of userEnrolledSubjects) {
                    if (message.toLowerCase().includes(sub.name.toLowerCase())) {
                        session.subjectId = sub._id;
                        await session.save();
                        enhancedContext.subjectName = sub.name;
                        break;
                    }
                }
            } catch (err) { /* ignore */ }
        }

        const messages = [
            ...history,
            { role: "user", content: message }
        ];

        // Auto-title
        if (session.title === "New Conversation" || session.title === "New Chat") {
            session.title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
            await session.save();
        }

        const replyText = await chatWithTutor(messages, enhancedContext);

        // Save AI message
        const aiMsg = await ChatMessage.create({
            sessionId: session._id,
            sender: "ai",
            content: replyText
        });

        await logAI({
            userId: req.user._id, userName: req.user.name || "Student", role: req.user.role || "student",
            endpoint: "/api/chat/sessions/message", params: { sessionId: session._id },
            status: "success", model: "ollama",
            request: message, response: replyText.substring(0, 500)
        });

        return res.json({ reply: aiMsg });
    } catch (e) {
        console.error("Chat session error:", e);
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/chat/sessions/:id/stream — STREAMING session chat with thinking/content SSE
router.post("/sessions/:id/stream", auth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id }).populate("subjectId");
        if (!session) return res.status(404).json({ error: "Session not found" });

        const { message, context = {} } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        // Save user message
        await ChatMessage.create({
            sessionId: session._id,
            sender: "user",
            content: message
        });

        // Get recent history
        const historyRaw = await ChatMessage.find({ sessionId: session._id })
            .sort({ createdAt: 1 })
            .limit(20)
            .lean();

        const history = historyRaw.slice(0, -1).map(m => ({
            role: m.sender === "ai" ? "assistant" : "user",
            content: m.content
        }));

        // Build system prompt
        let systemPrompt = "You are Adiptify, an adaptive AI tutor. Provide clear, structured answers using markdown. Include code examples where relevant.";
        if (session.subjectId) {
            systemPrompt += `\n\nSubject context: ${session.subjectId.name}`;
        }
        if (context.mastery) {
            systemPrompt += `\nStudent mastery: ${context.mastery}%`;
        }

        // Inject behavior engine settings
        try {
            const userId = req.user?._id;
            if (userId) {
                const { buildTutorPromptSuffix } = await import('../services/behaviorEngine.js');
                const suffix = await buildTutorPromptSuffix(userId);
                if (suffix) systemPrompt += suffix;
            }
        } catch { /* settings engine may not be ready */ }

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message },
        ];

        // Auto-title for first message
        if (session.title === "New Conversation" || session.title === "New Chat") {
            session.title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
            await session.save();
        }

        // Subject auto-detect
        if (!session.subjectId) {
            try {
                const subjects = await Subject.find({}).lean();
                for (const sub of subjects) {
                    if (message.toLowerCase().includes(sub.name.toLowerCase())) {
                        session.subjectId = sub._id;
                        await session.save();
                        break;
                    }
                }
            } catch { /* ignore */ }
        }

        // Stream from Ollama
        const stream = await ollama.chat({
            model: config.ollamaModel || 'qwen3',
            messages: apiMessages,
            stream: true,
            options: { temperature: 0.3, top_p: 0.9 },
            keep_alive: "5m"
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        let fullContent = '';
        let fullThinking = '';

        for await (const chunk of stream) {
            const thinking = chunk.message?.thinking || null;
            const content = chunk.message?.content || null;

            if (thinking) fullThinking += thinking;
            if (content) fullContent += content;

            const event = {
                thinking,
                content,
                done: chunk.done || false,
            };
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Persist the complete AI response
        await ChatMessage.create({
            sessionId: session._id,
            sender: "ai",
            content: fullContent,
            metadata: fullThinking ? { thinking: fullThinking } : undefined,
        });

        await logAI({
            userId: req.user._id, userName: req.user.name || "Student", role: req.user.role || "student",
            endpoint: "/api/chat/sessions/stream", params: { sessionId: session._id },
            status: "success", model: config.ollamaModel || "qwen3",
            request: message, response: fullContent.substring(0, 500)
        });

        res.write("data: [DONE]\n\n");
        res.end();
    } catch (e) {
        console.error("Stream session error:", e);
        if (!res.headersSent) {
            return res.status(500).json({ error: e.message });
        }
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
    }
});

export default router;
