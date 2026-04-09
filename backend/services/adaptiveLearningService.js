import UserProgress from "../models/UserProgress.js";
import Concept from "../models/Concept.js";
import Review from "../models/Review.js";

/**
 * Calculate cognitive load from performance signals
 * CL = (time_taken × error_rate) + hint_usage
 */
export function calculateCognitiveLoad(timeTakenMs, errorRate, hintUsage) {
    const timeFactor = timeTakenMs / 60000; // normalize to minutes
    const cl = (timeFactor * errorRate) + (hintUsage * 0.1);
    return Math.round(cl * 1000) / 1000;
}

/**
 * Calculate composite mastery score (0-1)
 * Mastery = cbrt(concept_accuracy × application_score × retention_score)
 * Using geometric mean (cube root of product) for balanced scoring
 */
export function calculateMasteryScore(conceptAccuracy, applicationScore, retentionScore) {
    const ca = Math.max(0, Math.min(1, conceptAccuracy));
    const as = Math.max(0, Math.min(1, applicationScore));
    const rs = Math.max(0, Math.min(1, retentionScore));
    const mastery = Math.cbrt(ca * as * rs);
    return Math.round(mastery * 1000) / 1000;
}

/**
 * Get the adaptive learning path for a user — ordered concept recommendations
 */
export async function getAdaptivePath(userId) {
    const concepts = await Concept.find({}).lean();
    const progressRecords = await UserProgress.find({ userId }).lean();
    const reviews = await Review.find({ userId }).lean();

    const progressMap = {};
    for (const p of progressRecords) {
        progressMap[p.conceptId] = p;
    }

    const reviewMap = {};
    for (const r of reviews) {
        reviewMap[r.conceptId] = r;
    }

    // Score each concept for priority
    const scored = concepts.map((concept) => {
        const progress = progressMap[concept.conceptId] || {};
        const review = reviewMap[concept.conceptId] || {};
        const mastery = progress.mastery_score || 0;
        const isDue = review.next_review ? new Date(review.next_review) <= new Date() : true;
        const pipelineComplete = progress.pipeline_completed || false;

        // Priority scoring: lower mastery = higher priority, due reviews boosted
        let priority = (1 - mastery) * 50;
        if (isDue) priority += 30;
        if (!pipelineComplete) priority += 20;

        // Check if prerequisites are met
        const prereqsMet = (concept.prerequisites || []).every((prereqId) => {
            const prereqProgress = progressMap[prereqId];
            return prereqProgress && prereqProgress.mastery_score >= 0.5;
        });

        return {
            ...concept,
            mastery_score: mastery,
            pipeline_stage: progress.pipeline_stage || 0,
            pipeline_completed: pipelineComplete,
            recommended_difficulty: progress.recommended_difficulty || concept.difficulty_level,
            cognitive_load: progress.cognitive_load || 0,
            isDue,
            prereqsMet,
            priority: prereqsMet ? priority : priority * 0.3, // deprioritize if prereqs not met
            next_review: review.next_review || null,
        };
    });

    scored.sort((a, b) => b.priority - a.priority);

    return scored;
}

/**
 * Submit performance data and adjust difficulty
 */
export async function submitPerformance(userId, conceptId, performanceData) {
    const {
        correct = 0,
        total = 1,
        timeTakenMs = 0,
        hintUsage = 0,
        applicationScore = 0,
        pipelineStage = 0,
    } = performanceData;

    const errorRate = total > 0 ? (total - correct) / total : 0;
    const accuracyRate = total > 0 ? correct / total : 0;
    const cl = calculateCognitiveLoad(timeTakenMs, errorRate, hintUsage);

    let progress = await UserProgress.findOne({ userId, conceptId });
    if (!progress) {
        progress = new UserProgress({ userId, conceptId });
    }

    // Update cumulative stats
    progress.total_correct += correct;
    progress.total_questions += total;
    progress.attempt_count += 1;
    progress.hint_usage += hintUsage;
    progress.total_time_spent += timeTakenMs;
    progress.accuracy_rate = progress.total_questions > 0
        ? progress.total_correct / progress.total_questions
        : 0;
    progress.concept_accuracy = progress.accuracy_rate;
    progress.application_score = Math.max(progress.application_score, applicationScore);
    progress.cognitive_load = cl;
    progress.pipeline_stage = Math.max(progress.pipeline_stage, pipelineStage);
    progress.pipeline_completed = progress.pipeline_stage >= 4;

    // Calculate composite mastery
    progress.mastery_score = calculateMasteryScore(
        progress.concept_accuracy,
        progress.application_score,
        progress.retention_score || 0.1
    );

    // Adaptive difficulty adjustment — uses behavior engine if available
    let downThreshold = 0.4;
    let upThreshold = 0.8;
    let minLevel = 1;
    let maxLevel = 5;
    try {
        const { getDifficultyParams } = await import('./behaviorEngine.js');
        const params = await getDifficultyParams(userId);
        downThreshold = params.downThreshold;
        upThreshold = params.upThreshold;
        minLevel = params.minLevel;
        maxLevel = params.maxLevel;
    } catch { /* fallback to defaults */ }

    if (progress.mastery_score < downThreshold) {
        progress.recommended_difficulty = Math.max(minLevel, (progress.recommended_difficulty || 2) - 1);
    } else if (progress.mastery_score > upThreshold) {
        progress.recommended_difficulty = Math.min(maxLevel, (progress.recommended_difficulty || 2) + 1);
    }

    // Cognitive load threshold — suggest remediation
    const needsRemediation = cl > 2.0;

    await progress.save();

    return {
        mastery_score: progress.mastery_score,
        concept_accuracy: progress.concept_accuracy,
        application_score: progress.application_score,
        retention_score: progress.retention_score,
        cognitive_load: cl,
        recommended_difficulty: progress.recommended_difficulty,
        pipeline_stage: progress.pipeline_stage,
        pipeline_completed: progress.pipeline_completed,
        needsRemediation,
    };
}

/**
 * Get the mastery breakdown for a specific concept
 */
export async function getMasteryBreakdown(userId, conceptId) {
    const progress = await UserProgress.findOne({ userId, conceptId }).lean();
    if (!progress) {
        return {
            mastery_score: 0,
            concept_accuracy: 0,
            application_score: 0,
            retention_score: 0,
            cognitive_load: 0,
            pipeline_stage: 0,
            recommended_difficulty: 2,
            attempt_count: 0,
        };
    }
    return progress;
}

export default {
    calculateCognitiveLoad,
    calculateMasteryScore,
    getAdaptivePath,
    submitPerformance,
    getMasteryBreakdown,
};
