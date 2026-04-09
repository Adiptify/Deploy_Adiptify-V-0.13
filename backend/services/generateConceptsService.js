import { Ollama } from "ollama";
import { config } from "../config/index.js";
import Concept from "../models/Concept.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import Syllabus from "../models/Syllabus.js";

// ─── Prompt for generating study concepts from a topic ───
const CONCEPT_GENERATOR_SYSTEM = `You are an expert curriculum designer.
Generate EXACTLY 8 study concepts for the provided topic. Each concept must be a granular, distinct learning unit.

The output MUST be a valid JSON object with the following structure:
{
  "concepts": [
    {
      "title": "String",
      "description": "String",
      "difficulty_level": Number (1-5),
      "prerequisites": ["Titles of earlier concepts in this list"],
      "tags": ["topic_name", "category_name"],
      "pipeline": {
        "explanation": "String (Comprehensive explanation, at least 3 paragraphs)",
        "demonstration": "String (Practical example or code snippet)",
        "practiceQuestions": [
          { "question": "String", "options": [String, String, String, String], "correctAnswer": Number (0-3), "explanation": "String", "difficulty": Number(1-5) },
          { "question": "String", "options": [String, String, String, String], "correctAnswer": Number (0-3), "explanation": "String", "difficulty": Number(1-5) },
          { "question": "String", "options": [String, String, String, String], "correctAnswer": Number (0-3), "explanation": "String", "difficulty": Number(1-5) }
        ],
        "applicationTask": "String (Hands-on exercise)",
        "evaluationCriteria": "String (How to know if the task is done correctly)"
      }
    }
  ]
}

Rules:
1. STRICT: Generate EXACTLY 8 concepts.
2. COMPLETENESS: Every concept must have a detailed explanation, a demonstration, exactly 3 practice questions, an application task, and evaluation criteria.
3. GRANULARITY: Each concept should cover roughly 15-20 minutes of study time.
4. FORMAT: JSON only, no additional prose outside the JSON.`;

function conceptGeneratorUser(subjectName, topicTitle, topicDescription, learningOutcomes, moduleName) {
    let prompt = `Generate 8 study concepts for the following:\n\nSubject: "${subjectName}"\n`;
    if (moduleName) prompt += `Module/Unit: "${moduleName}"\n`;
    prompt += `Topic: "${topicTitle}"\nTopic Description: "${topicDescription || "Not provided"}"\n`;
    prompt += `Subject Learning Outcomes: ${JSON.stringify(learningOutcomes || [])}\n\n`;
    prompt += `Generate granular, well-structured concepts that cover this topic comprehensively. You MUST ensure the concepts perfectly align with the content expected in this academic module/syllabus level.`;
    return prompt;
}

/**
 * Parse JSON from AI response, handling markdown fences
 */
function parseJsonSafe(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    // Try to extract JSON from thinking models that include reasoning
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }
    return JSON.parse(cleaned);
}

/**
 * Generate concepts for a single topic using Ollama
 */
async function generateConceptsForTopic(subjectName, topic, learningOutcomes) {
    const ollamaBase = (typeof config.ollamaBaseUrl === "string" && config.ollamaBaseUrl.trim() !== "")
        ? config.ollamaBaseUrl
        : "http://127.0.0.1:11434";

    const ollama = new Ollama({ host: ollamaBase });

    try {
        const response = await ollama.chat({
            model: config.ollamaModel || "llama3",
            messages: [
                { role: "system", content: CONCEPT_GENERATOR_SYSTEM },
                { role: "user", content: conceptGeneratorUser(subjectName, topic.title || topic, topic.description || "", learningOutcomes, topic.moduleName) },
            ],
            stream: false,
            format: "json",
        });

        const raw = response.message?.content || "";
        const parsed = parseJsonSafe(raw);
        return parsed.concepts || [];
    } catch (err) {
        console.error(`[GenerateConcepts] Ollama failed for topic "${topic.title || topic}":`, err.message);
        // Return fallback concepts so the system still works without AI
        return generateFallbackConcepts(subjectName, topic);
    }
}

/**
 * Generate fallback concepts when Ollama is unavailable
 */
function generateFallbackConcepts(subjectName, topic) {
    const topicTitle = topic.title || topic;
    const topicDesc = topic.description || `Study of ${topicTitle}`;
    
    const concepts = [];
    const subtopics = [
        { suffix: "Introduction", diff: 1, desc: `Fundamental introduction to ${topicTitle}` },
        { suffix: "Core Principles", diff: 2, desc: `Core principles and foundations of ${topicTitle}` },
        { suffix: "Key Terminology", diff: 1, desc: `Essential terminology and definitions in ${topicTitle}` },
        { suffix: "Practical Applications", diff: 3, desc: `Real-world applications of ${topicTitle}` },
        { suffix: "Problem Solving", diff: 3, desc: `Problem-solving techniques in ${topicTitle}` },
        { suffix: "Advanced Concepts", diff: 4, desc: `Advanced topics and patterns in ${topicTitle}` },
        { suffix: "Case Studies", diff: 3, desc: `Case studies and examples in ${topicTitle}` },
        { suffix: "Analysis & Evaluation", diff: 4, desc: `Critical analysis and evaluation of ${topicTitle}` },
    ];

    for (const sub of subtopics) {
        const title = `${topicTitle}: ${sub.suffix}`;
        concepts.push({
            conceptId: `id_${Math.random().toString(36).substr(2, 9)}`,
            title,
            description: sub.desc,
            category: subjectName,
            difficulty_level: sub.diff,
            prerequisites: sub.diff > 2 ? [`${topicTitle}: Introduction`] : [],
            tags: [topicTitle.toLowerCase(), sub.suffix.toLowerCase()],
            pipeline: {
                explanation: `${sub.desc}. This concept covers the essential aspects of ${sub.suffix.toLowerCase()} within ${topicTitle}. Understanding this is crucial for mastering ${subjectName}. It involves exploring the theoretical foundations and practical implications within the broader context of the subject. Studients should focus on the key mechanisms that drive this specific sub-topic.`,
                demonstration: `Practical demonstration of ${sub.suffix.toLowerCase()} in a real-world ${subjectName} context. Imagine a scenario where you encounter ${topicTitle} in production; this module shows how to handle it efficiently.`,
                practiceQuestions: [
                    {
                        question: `What is the primary focus of ${sub.suffix.toLowerCase()} in ${topicTitle}?`,
                        options: [`Understanding ${sub.suffix.toLowerCase()} fundamentals`, "Statistical noise", "Hardware constraints", "None of the above"],
                        correctAnswer: 0,
                        explanation: `${sub.suffix} in ${topicTitle} focuses on understanding the fundamental aspects.`,
                        difficulty: sub.diff,
                    },
                    {
                        question: `Which approach is most effective for studying ${topicTitle} ${sub.suffix.toLowerCase()}?`,
                        options: ["Memorization only", "Practice with hands-on examples", "Skipping prerequisites", "Reading summaries only"],
                        correctAnswer: 1,
                        explanation: "Hands-on practice with examples is the most effective learning approach.",
                        difficulty: sub.diff,
                    },
                    {
                        question: `Why is ${sub.suffix.toLowerCase()} important in ${topicTitle}?`,
                        options: ["It is not important", "It provides the structural base", "It is only for experts", "It is a legacy feature"],
                        correctAnswer: 1,
                        explanation: `The ${sub.suffix.toLowerCase()} provides the structural base for understanding the complex interactions in ${topicTitle}.`,
                        difficulty: sub.diff,
                    }
                ],
                applicationTask: `Implement a basic example of ${sub.suffix.toLowerCase()} using the principles discussed in the explanation.`,
                evaluationCriteria: "Correct implementation of the core logic with appropriate error handling."
            }
        });
    }
    return concepts;
}

/**
 * Main function: Generate all concepts for all enrolled subjects at once.
 * Caches in MongoDB — skips subjects that already have concepts.
 * Returns { generated, cached, total }
 */
export async function generateAllConceptsForUser(userId, onProgress = null) {
    // 1. Get user with enrolled subjects
    const user = await User.findById(userId).populate("enrolledSubjects").lean();
    if (!user || !user.enrolledSubjects?.length) {
        throw new Error("No enrolled subjects found. Please enroll in subjects first.");
    }

    const stats = { generated: 0, cached: 0, total: 0, subjects: [] };

    for (const subject of user.enrolledSubjects) {
        const subjectName = subject.name;
        const subjectCategory = subject.name; // Use subject name as category for concepts

        let topicList = [];

        // 2. Try to get topics from Syllabus Builder
        const syllabusObj = await Syllabus.findOne({ subjectId: subject._id }).lean();
        if (syllabusObj && syllabusObj.modules && syllabusObj.modules.length > 0) {
            syllabusObj.modules.forEach(mod => {
                if (mod.topics && mod.topics.length > 0) {
                    mod.topics.forEach(t => {
                        topicList.push({
                            title: t.title,
                            description: t.description || "",
                            moduleName: mod.title
                        });
                    });
                } else {
                     topicList.push({
                         title: mod.title,
                         description: mod.description || "",
                         moduleName: mod.title
                     });
                }
            });
        } else if (subject.topics && subject.topics.length > 0) {
            // Fallback to existing subject topics array
            topicList = subject.topics.map(t => (typeof t === "string" ? { title: t, description: "" } : t));
        } else {
            // Fallback to learning outcomes
            topicList = (subject.learningOutcomes || []).map(lo => ({ title: lo, description: lo }));
        }

        if (topicList.length === 0) {
            console.warn(`[GenerateConcepts] Subject "${subjectName}" has no topics or learning outcomes. Skipping.`);
            continue;
        }

        let subjectGenerated = 0;
        let subjectCached = 0;

        for (let ti = 0; ti < topicList.length; ti++) {
            const topic = topicList[ti];
            const topicTitle = topic.title || topic;

            // 3. Check if concepts already exist for this subject+topic combo
            const existingCount = await Concept.countDocuments({
                category: subjectCategory,
                tags: { $in: [topicTitle.toLowerCase()] },
            });

            if (existingCount >= 8) {
                // Already have enough concepts for this topic — skip
                subjectCached += existingCount;
                stats.cached += existingCount;
                continue;
            }

            // 4. Generate concepts via AI
            if (typeof onProgress === "function") {
                onProgress({
                    subject: subjectName,
                    topic: topicTitle,
                    topicIndex: ti,
                    totalTopics: topicList.length,
                });
            }

            console.log(`[GenerateConcepts] Generating for "${subjectName}" → "${topicTitle}"...`);
            const rawConcepts = await generateConceptsForTopic(subjectName, topic, subject.learningOutcomes);

            // 5. Save to MongoDB (deduplicate by conceptId)
            for (const concept of rawConcepts) {
                const conceptId = `${subjectName}_${concept.title}`
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_|_$/g, "")
                    .substring(0, 80);

                const exists = await Concept.findOne({ conceptId });
                if (exists) {
                    subjectCached++;
                    stats.cached++;
                    continue;
                }

                try {
                    await Concept.create({
                        conceptId,
                        title: concept.title,
                        description: concept.description || "",
                        category: subjectCategory,
                        difficulty_level: Math.min(5, Math.max(1, concept.difficulty_level || 2)),
                        prerequisites: (concept.prerequisites || []).map(p =>
                            `${subjectName}_${p}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 80)
                        ),
                        tags: [
                            ...(concept.tags || []),
                            topicTitle.toLowerCase(),
                            subjectName.toLowerCase(),
                        ],
                        pipeline: concept.pipeline || {},
                    });

                    // 6. Also initialize a Review record for spaced repetition
                    await Review.findOneAndUpdate(
                        { userId, conceptId },
                        {
                            $setOnInsert: {
                                userId,
                                conceptId,
                                easiness_factor: 2.5,
                                interval: 0,
                                repetition: 0,
                                quality_score: 0,
                                next_review: new Date(),
                                history: [],
                            },
                        },
                        { upsert: true, new: true }
                    );

                    subjectGenerated++;
                    stats.generated++;
                } catch (err) {
                    if (err.code === 11000) {
                        // Duplicate — already exists
                        subjectCached++;
                        stats.cached++;
                    } else {
                        console.error(`[GenerateConcepts] Error saving concept "${concept.title}":`, err.message);
                    }
                }
            }
        }

        stats.subjects.push({
            name: subjectName,
            generated: subjectGenerated,
            cached: subjectCached,
            topics: topicList.length,
        });
    }

    stats.total = stats.generated + stats.cached;
    console.log(`[GenerateConcepts] Complete: ${stats.generated} generated, ${stats.cached} cached, ${stats.total} total`);
    return stats;
}

/**
 * Get all concept IDs belonging to user's enrolled subjects
 */
export async function getEnrolledSubjectNames(userId) {
    const user = await User.findById(userId).populate("enrolledSubjects", "name").lean();
    if (!user?.enrolledSubjects?.length) return [];
    return user.enrolledSubjects.map(s => s.name);
}

export default {
    generateAllConceptsForUser,
    getEnrolledSubjectNames,
};
