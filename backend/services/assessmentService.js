import Item from "../models/Item.js";
import AssessmentSession from "../models/AssessmentSession.js";
import { generateQuestionsFromTopic } from "./ollamaService.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";

/**
 * Start an assessment session for a user
 * - Finds or generates items for the requested topics
 * - Creates an AssessmentSession
 */
export async function startAssessment(userId, { mode = "formative", requestedTopics = [], limit = 5, proctored = false }) {
    let items = [];

    // Try to find existing items for requested topics
    if (requestedTopics.length > 0) {
        items = await Item.find({
            topics: { $in: requestedTopics },
        })
            .limit(limit)
            .lean();
    }

    // If not enough items, generate with AI
    if (items.length < limit && requestedTopics.length > 0) {
        const topic = requestedTopics[0];
        try {
            const generated = await generateQuestionsFromTopic(topic, {
                count: limit - items.length,
                distribution: { easy: 2, medium: 2, hard: 1 },
            });

            // Save generated assessment record
            const genRecord = await GeneratedAssessment.create({
                topic,
                title: generated.title,
                items: generated.items,
                rawResponse: generated.rawResponse,
                status: "published",
                createdBy: userId,
                publishedAt: new Date(),
                publishedBy: userId,
                proctored,
            });

            // Save items to Item collection
            const savedItems = await Item.insertMany(
                generated.items.map(i => ({ ...i, createdBy: userId }))
            );

            genRecord.linkedItemIds = savedItems.map(i => i._id);
            await genRecord.save();

            items = [...items, ...savedItems.map(i => i.toObject())];
        } catch (e) {
            console.error("AI generation failed:", e.message);
            // Continue with whatever items we have
        }
    }

    if (items.length === 0) {
        throw new Error("No questions available for the requested topics. Please try again.");
    }

    // Limit items
    items = items.slice(0, limit);

    // Create session
    const session = await AssessmentSession.create({
        user: userId,
        mode,
        itemIds: items.map(i => i._id),
        status: "active",
        metadata: { requestedTopics },
        proctored,
        proctorConfig: proctored ? {
            blockTabSwitch: true,
            blockCopyPaste: true,
            blockRightClick: true,
            allowTabSwitchCount: 2,
        } : {},
    });

    // Return session with populated items
    return {
        _id: session._id,
        mode: session.mode,
        status: session.status,
        proctored: session.proctored,
        proctorConfig: session.proctorConfig,
        items: items.map(i => ({
            _id: i._id,
            type: i.type,
            question: i.question,
            choices: i.choices,
            difficulty: i.difficulty,
            bloom: i.bloom,
            topics: i.topics,
            hints: i.hints,
        })),
        totalQuestions: items.length,
        currentIndex: 0,
    };
}

/**
 * Get user's assessment session history
 */
export async function getSessionHistory(userId, { status, limit = 10 } = {}) {
    const query = { user: userId };
    if (status) query.status = status;

    return await AssessmentSession.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}

export default { startAssessment, getSessionHistory };
