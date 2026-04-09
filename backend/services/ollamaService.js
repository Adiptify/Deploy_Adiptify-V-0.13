import { config } from "../config/index.js";
import { Ollama } from 'ollama';
import { QUESTION_GENERATOR_SYSTEM, questionGeneratorUser, EXPLANATION_SYSTEM, explanationUser, CHATBOT_SYSTEM, TOPIC_SUMMARY_SYSTEM, VALIDATE_SUBJECT_SYSTEM, validateSubjectUser, PARSE_SYLLABUS_SYSTEM, parseSyllabusUser, PARSE_SYLLABUS_CHUNK_SYSTEM, parseSyllabusChunkUser, PERFECT_PARSER_CHUNK_SYSTEM, perfectParserChunkUser } from "../prompts/ollamaPrompts.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";

/**
 * Call Ollama chat API
 */
async function callOllama(systemPrompt, userPrompt, options = {}) {
    try {
        const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
            ? config.ollamaBaseUrl
            : 'http://127.0.0.1:11434';

        const ollama = new Ollama({ host: ollamaBase });

        const response = await ollama.chat({
            model: options.model || config.ollamaModel || 'llama3',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            stream: false,
            format: options.format || undefined,
        });

        return response.message?.content || "";
    } catch (err) {
        console.warn("Ollama is unreachable, returning mock response for testing. Error:", err.message);

        // Return structured mock data based on the prompt type
        if (systemPrompt.includes("Assessment Designer") || systemPrompt.includes("exam questions")) {
            return JSON.stringify({
                items: [
                    {
                        question: "What is a fallback mechanism in software?",
                        options: ["A backup strategy when primary service fails", "A database query type", "A UI component", "A network protocol"],
                        correctIndex: 0,
                        topic: "Software Engineering",
                        difficulty: "easy",
                        bloom: "understand",
                        skills: [],
                        outcomes: [],
                        explanation: "Fallback mechanisms provide alternative behavior when the primary service is unavailable.",
                        hint: "Think about what happens when a service goes offline."
                    },
                    {
                        question: "Which pattern is commonly used for handling AI service outages?",
                        options: ["Observer pattern", "Circuit breaker pattern", "Singleton pattern", "Factory pattern"],
                        correctIndex: 1,
                        topic: "Software Engineering",
                        difficulty: "medium",
                        bloom: "apply",
                        skills: [],
                        outcomes: [],
                        explanation: "The circuit breaker pattern prevents cascading failures when external services are down.",
                        hint: "Think about electrical circuit breakers."
                    }
                ]
            });
        }

        if (systemPrompt.includes("curriculum designer") || systemPrompt.includes("validation engine")) {
            return JSON.stringify({
                isValid: true,
                feedback: ["Mock response: The subject looks well-structured.", "Note: Ollama is offline — using mock validation."],
                suggestedLevel: "Beginner"
            });
        }

        if (systemPrompt.includes("tutor") || systemPrompt.includes("explanations")) {
            return JSON.stringify({
                explanation: "This is a mock explanation since Ollama is offline. Review the basics of this topic and try again when the AI service is running.",
                remediationResources: [{ title: "Review Material", url: "#", type: "article" }]
            });
        }

        if (systemPrompt.includes("curriculum parser") || systemPrompt.includes("syllabus")) {
            return JSON.stringify({
                name: "Mock Subject (Ollama Offline)",
                description: "This is placeholder data. Start Ollama to get real parsing.",
                category: "General",
                learningOutcomes: ["Placeholder outcome"],
                modules: [{
                    title: "Module 1",
                    description: "Placeholder module",
                    topics: [{ title: "Topic 1", description: "Placeholder topic" }]
                }]
            });
        }

        return "This is a fallback mock response because Ollama is offline. Start Ollama with: $env:OLLAMA_ORIGINS='*'; ollama serve";
    }
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseJsonResponse(text) {
    let cleaned = text.trim();
    // Remove markdown code fences
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    return JSON.parse(cleaned);
}

/**
 * Generate questions from a topic using Ollama
 */
export async function generateQuestionsFromTopic(topic, options = {}) {
    const count = options.count || 5;
    const distribution = options.distribution || { easy: 2, medium: 2, hard: 1 };

    const rawResponse = await callOllama(
        QUESTION_GENERATOR_SYSTEM,
        questionGeneratorUser(topic, count, distribution)
    );

    let parsed;
    try {
        parsed = parseJsonResponse(rawResponse);
    } catch (e) {
        throw new Error("Failed to parse AI response as JSON: " + e.message);
    }

    const items = parsed.items || parsed;
    if (!Array.isArray(items)) throw new Error("AI response did not contain an items array");

    const mappedItems = items.map((item, idx) => ({
        type: "mcq",
        question: item.question,
        choices: item.options || [],
        answer: item.correctIndex ?? 0,
        difficulty: difficultyToNumber(item.difficulty),
        bloom: item.bloom || "understand",
        topics: [topic],
        skills: item.skills || [],
        hints: item.hint ? [item.hint] : [],
        explanation: item.explanation || "",
        aiGenerated: true,
        seedId: `seed_${topic.replace(/\s+/g, "_")}_${Date.now()}_${idx}`,
    }));

    return { items: mappedItems, rawResponse, title: `${topic} Assessment` };
}

function difficultyToNumber(d) {
    if (typeof d === "number") return Math.min(5, Math.max(1, d));
    const map = { easy: 2, medium: 3, hard: 4 };
    return map[d?.toLowerCase()] || 3;
}

export async function generateExplanation(question, correctOption, studentAnswer, topic) {
    const raw = await callOllama(
        EXPLANATION_SYSTEM,
        explanationUser(question, correctOption, studentAnswer, topic)
    );
    try {
        return parseJsonResponse(raw);
    } catch {
        return { explanation: raw, remediationResources: [] };
    }
}

export async function chatWithTutor(messages, context = null) {
    let systemPrompt = CHATBOT_SYSTEM;
    if (context) {
        systemPrompt += `\n\nSTUDENT CONTEXT:\n- Mastery: ${context.mastery || "unknown"}%\n- Weak Area: ${context.weakArea || "unknown"}`;
    }

    const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
    ];

    try {
        const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
            ? config.ollamaBaseUrl
            : 'http://127.0.0.1:11434';

        const ollama = new Ollama({ host: ollamaBase });

        const response = await ollama.chat({
            model: config.ollamaModel || 'llama3',
            messages: apiMessages,
            stream: false,
        });

        return response.message?.content || "";
    } catch (err) {
        console.warn("Ollama is unreachable for tutor chat, returning mock response.");
        return "I am a mock AI Tutor. The main Ollama LLM is currently offline. How else can I pretend to help you today?";
    }
}

/**
 * Parse Syllabus JSON from raw text (e.g. PDF extraction) — single-shot
 */
export async function parseSyllabusFromText(text) {
    const rawResponse = await callOllama(
        PARSE_SYLLABUS_SYSTEM,
        parseSyllabusUser(text)
    );

    try {
        return parseJsonResponse(rawResponse);
    } catch (e) {
        throw new Error("Failed to parse PDF content into valid syllabus JSON. AI Raw Response: " + rawResponse.substring(0, 100));
    }
}

/**
 * Parse Syllabus JSON from an array of text chunks — iterative strategy.
 * Returns an array of partial syllabus objects (one per chunk).
 * Failed chunks are skipped with a warning rather than aborting the whole job.
 *
 * @param {string[]} chunks  — Array of cleaned text chunks
 * @param {function} onProgress — Optional callback(chunkIndex, totalChunks)
 * @returns {Promise<object[]>} Array of partial syllabus objects
 */
export async function parseSyllabusChunked(chunks, onProgress = null) {
    const partials = [];

    for (let i = 0; i < chunks.length; i++) {
        if (typeof onProgress === 'function') {
            onProgress(i, chunks.length);
        }

        try {
            const rawResponse = await callOllama(
                PARSE_SYLLABUS_CHUNK_SYSTEM,
                parseSyllabusChunkUser(chunks[i], i, chunks.length)
            );

            const parsed = parseJsonResponse(rawResponse);
            partials.push(parsed);
        } catch (err) {
            console.warn(`[parseSyllabusChunked] Chunk ${i + 1}/${chunks.length} failed:`, err.message);
            // Skip failed chunks — the aggregator will still work with partial data
        }
    }

    return partials;
}

/**
 * Refined production-stable syllabus extraction from iterative chunks.
 * Merges topics into a Map and filters out noise.
 * 
 * @param {AsyncGenerator} chunkGenerator - Generator yielding text chunks
 * @returns {Promise<Array>} Array of merged and filtered topics
 */
export async function parseSyllabusIterative(chunkGenerator) {
    const topicMap = new Map();
    const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
        ? config.ollamaBaseUrl
        : 'http://127.0.0.1:11434';
    const ollama = new Ollama({ host: ollamaBase });

    console.log("[AI] Starting iterative syllabus parsing...");

    for await (const chunk of chunkGenerator) {
        try {
            const response = await ollama.chat({
                model: config.ollamaModel || 'llama3',
                messages: [
                    { role: "system", content: PERFECT_PARSER_CHUNK_SYSTEM },
                    { role: "user", content: perfectParserChunkUser(chunk) },
                ],
                format: 'json',
                stream: false
            });

            const result = response.message?.content || "";
            if (!result) continue;

            let data;
            try {
                data = JSON.parse(result);
            } catch (e) {
                data = parseJsonResponse(result);
            }

            const topics = data.topics || (Array.isArray(data) ? data : []);

            for (const topic of topics) {
                if (!topic.name || !shouldKeepTopic(topic.name)) continue;

                const key = topic.name.toLowerCase().trim();
                
                if (!topicMap.has(key)) {
                    topicMap.set(key, {
                        name: topic.name,
                        keywords: Array.isArray(topic.keywords) 
                            ? [...new Set(topic.keywords.map(k => k.trim()).filter(k => k))] 
                            : []
                    });
                } else {
                    const existing = topicMap.get(key);
                    if (Array.isArray(topic.keywords)) {
                        const mergedKeywords = new Set([
                            ...(existing.keywords || []), 
                            ...topic.keywords.map(k => k.trim()).filter(k => k)
                        ]);
                        existing.keywords = Array.from(mergedKeywords);
                    }
                }
            }

            // Memory management: Manual GC if threshold met
            const memory = process.memoryUsage();
            if (global.gc && memory.heapUsed > 500 * 1024 * 1024) {
                console.log(`[GC] Heap at ${Math.round(memory.heapUsed/1024/1024)}MB. Triggering manual GC.`);
                global.gc();
            }

        } catch (err) {
            console.error("[AI] Error processing chunk:", err.message);
        }
    }

    const finalTopics = Array.from(topicMap.values());
    console.log(`[AI] Iterative parsing complete. Found ${finalTopics.length} unique topics.`);
    return finalTopics;
}

/**
 * Production syllabus pipeline — properly extracts modules/topics structure.
 * Uses concurrent batch processing (3 at a time) with timeout + aggregator.
 * 
 * @param {AsyncGenerator|string[]} chunkSource - Generator or array of text chunks
 * @param {function} onProgress - Optional callback(processed, total)
 * @returns {Promise<object>} Merged syllabus { name, description, category, learningOutcomes, modules }
 */
export async function parseSyllabusPipeline(chunkSource, onProgress = null) {
    const { mergeSyllabusPartials } = await import('../utils/syllabusAggregator.js');
    
    // Collect chunks from generator into array
    const chunks = [];
    if (Symbol.asyncIterator in Object(chunkSource)) {
        for await (const chunk of chunkSource) {
            if (chunk && chunk.trim()) chunks.push(chunk);
        }
    } else if (Array.isArray(chunkSource)) {
        chunks.push(...chunkSource.filter(c => c && c.trim()));
    }

    if (chunks.length === 0) {
        throw new Error("No text content to parse. The document may be empty.");
    }

    console.log(`[AI Pipeline] Starting structured extraction: ${chunks.length} chunks, batch size 3`);
    
    const partials = [];
    const BATCH_SIZE = 3;
    const TIMEOUT_MS = 90000; // 90 seconds per call

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map((chunk, batchIdx) => {
            const chunkIdx = i + batchIdx;
            return callOllamaWithTimeout(
                PARSE_SYLLABUS_CHUNK_SYSTEM,
                parseSyllabusChunkUser(chunk, chunkIdx, chunks.length),
                TIMEOUT_MS
            ).then(raw => {
                try {
                    const parsed = parseJsonResponse(raw);
                    console.log(`[AI Pipeline] Chunk ${chunkIdx + 1}/${chunks.length} ✓ — ${(parsed.modules || []).length} modules`);
                    return parsed;
                } catch (e) {
                    console.warn(`[AI Pipeline] Chunk ${chunkIdx + 1}/${chunks.length} — JSON parse failed:`, e.message);
                    return null;
                }
            }).catch(err => {
                console.warn(`[AI Pipeline] Chunk ${chunkIdx + 1}/${chunks.length} — LLM call failed:`, err.message);
                return null;
            });
        });

        const results = await Promise.all(batchPromises);
        for (const r of results) {
            if (r) partials.push(r);
        }

        if (typeof onProgress === 'function') {
            onProgress(Math.min(i + BATCH_SIZE, chunks.length), chunks.length);
        }

        // Memory management
        const memory = process.memoryUsage();
        if (global.gc && memory.heapUsed > 500 * 1024 * 1024) {
            console.log(`[GC] Heap at ${Math.round(memory.heapUsed / 1024 / 1024)}MB. Triggering manual GC.`);
            global.gc();
        }
    }

    if (partials.length === 0) {
        throw new Error("All chunks failed to parse. The AI model may be offline or the document format is incompatible.");
    }

    // Merge all partials into unified syllabus
    const merged = mergeSyllabusPartials(partials);
    console.log(`[AI Pipeline] Complete: "${merged.name || 'Untitled'}" — ${merged.modules.length} modules, ${merged.modules.reduce((sum, m) => sum + (m.topics?.length || 0), 0)} topics`);
    
    return merged;
}

/**
 * Call Ollama with a timeout wrapper
 */
async function callOllamaWithTimeout(systemPrompt, userPrompt, timeoutMs = 90000) {
    return Promise.race([
        callOllama(systemPrompt, userPrompt, { format: 'json' }),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Ollama call timed out after ${timeoutMs / 1000}s`)), timeoutMs)
        )
    ]);
}

/**
 * Filter to exclude meta-topics like POs, PEOs, Reference Books, etc.
 */
function shouldKeepTopic(name) {
    if (!name || typeof name !== 'string') return false;
    const blacklist = [
        'po', 'peo', 'pso', 'reference', 'assessment', 'marks', 
        'model', 'outcome', 'course description', 'experiment', 
        'lab manual', 'objective', 'prerequisite', 'syllabus', 
        'curriculum', 'university', 'credit', 'hours', 'total'
    ];
    const lowerName = name.toLowerCase();
    
    if (/^(po|peo|pso)\s*\d+/i.test(lowerName)) return false;
    
    return !blacklist.some(term => lowerName.includes(term));
}

export async function generateTopicNotes(topic, mistakes = []) {
    const userPrompt = mistakes.length
        ? `Generate study notes for "${topic}". The student has made these mistakes: ${JSON.stringify(mistakes)}`
        : `Generate comprehensive study notes for "${topic}".`;

    return await callOllama(TOPIC_SUMMARY_SYSTEM, userPrompt);
}

export async function validateSubject(subjectData) {
    const raw = await callOllama(VALIDATE_SUBJECT_SYSTEM, validateSubjectUser(subjectData), { format: "json" });
    try {
        return parseJsonResponse(raw);
    } catch {
        return { isValid: true, feedback: ["Could not parse AI validation correctly. Approving format by default."], suggestedLevel: "Beginner" };
    }
}

export default {
    generateQuestionsFromTopic,
    generateExplanation,
    chatWithTutor,
    generateTopicNotes,
    validateSubject,
    parseSyllabusFromText,
    parseSyllabusChunked,
    parseSyllabusIterative,
    parseSyllabusPipeline,
};
