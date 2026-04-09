import UserProgress from "../models/UserProgress.js";
import Review from "../models/Review.js";
import Concept from "../models/Concept.js";
import { getEnrolledSubjectNames } from "./generateConceptsService.js";

/**
 * Get full dashboard analytics for a user — filtered by enrolled subjects
 */
export async function getDashboardMetrics(userId) {
    // Get enrolled subject names to filter concepts
    const subjectNames = await getEnrolledSubjectNames(userId);

    // Build concept filter based on enrolled subjects
    const conceptFilter = subjectNames.length > 0
        ? { category: { $in: subjectNames } }
        : { category: "NON_EXISTENT_CATEGORY_FOR_EMPTY_STATE" }; // Force no results

    const allConcepts = await Concept.find(conceptFilter).lean();
    const conceptIds = allConcepts.map(c => c.conceptId);

    // Filter progress and reviews to only include enrolled subject concepts
    const allProgress = await UserProgress.find({
        userId,
        ...(conceptIds.length > 0 ? { conceptId: { $in: conceptIds } } : {}),
    }).lean();

    const allReviews = await Review.find({
        userId,
        ...(conceptIds.length > 0 ? { conceptId: { $in: conceptIds } } : {}),
    }).lean();

    const totalConcepts = allConcepts.length;
    const studiedConcepts = allProgress.length;

    // Mastery progression — average mastery per category
    const categoryMastery = {};
    for (const p of allProgress) {
        const concept = allConcepts.find((c) => c.conceptId === p.conceptId);
        const cat = concept?.category || "General";
        if (!categoryMastery[cat]) categoryMastery[cat] = { total: 0, count: 0 };
        categoryMastery[cat].total += p.mastery_score || 0;
        categoryMastery[cat].count += 1;
    }
    const masteryByCategory = Object.entries(categoryMastery).map(([category, data]) => ({
        category,
        mastery: data.count > 0 ? Math.round((data.total / data.count) * 100) : 0,
    }));

    // If no progress yet but we have concepts, show 0% for each subject
    if (masteryByCategory.length === 0 && subjectNames.length > 0) {
        for (const name of subjectNames) {
            masteryByCategory.push({ category: name, mastery: 0 });
        }
    }

    // Overall mastery
    const overallMastery = allProgress.length > 0
        ? Math.round((allProgress.reduce((sum, p) => sum + (p.mastery_score || 0), 0) / allProgress.length) * 100)
        : 0;

    // Retention rate — percentage of reviews with quality ≥ 3
    const totalReviewEvents = allReviews.reduce((sum, r) => sum + (r.history?.length || 0), 0);
    const successfulReviews = allReviews.reduce(
        (sum, r) => sum + (r.history || []).filter((h) => h.quality >= 3).length,
        0
    );
    const retentionRate = totalReviewEvents > 0
        ? Math.round((successfulReviews / totalReviewEvents) * 100)
        : 0;

    // Time per topic
    const timePerTopic = allProgress.map((p) => {
        const concept = allConcepts.find((c) => c.conceptId === p.conceptId);
        return {
            conceptId: p.conceptId,
            title: concept?.title || p.conceptId,
            timeSpent: Math.round((p.total_time_spent || 0) / 60000), // minutes
        };
    }).sort((a, b) => b.timeSpent - a.timeSpent);

    // Practice completion rate
    const completedPipelines = allProgress.filter((p) => p.pipeline_completed).length;
    const completionRate = studiedConcepts > 0
        ? Math.round((completedPipelines / studiedConcepts) * 100)
        : 0;

    // Learning velocity — concepts progressing per week (simplified)
    const recentProgress = allProgress.filter((p) => {
        const updated = new Date(p.updatedAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return updated >= weekAgo;
    });
    const learningVelocity = recentProgress.length;

    // Due reviews count
    const now = new Date();
    const dueCount = allReviews.filter((r) => new Date(r.next_review) <= now).length;

    // Skill radar data
    const radarData = masteryByCategory.map((mc) => ({
        axis: mc.category,
        value: mc.mastery / 100,
    }));

    // Mastery history (simplified — from review history dates)
    const masteryHistory = [];
    const allHistoryPoints = [];
    for (const r of allReviews) {
        for (const h of r.history || []) {
            allHistoryPoints.push({
                date: new Date(h.date),
                quality: h.quality,
            });
        }
    }
    allHistoryPoints.sort((a, b) => a.date - b.date);

    // Group by day
    const byDay = {};
    for (const point of allHistoryPoints) {
        const key = point.date.toISOString().split("T")[0];
        if (!byDay[key]) byDay[key] = { total: 0, count: 0 };
        byDay[key].total += point.quality / 5;
        byDay[key].count += 1;
    }
    for (const [date, data] of Object.entries(byDay)) {
        masteryHistory.push({
            date,
            value: Math.round((data.total / data.count) * 100),
        });
    }

    return {
        overallMastery,
        totalConcepts,
        studiedConcepts,
        completionRate,
        retentionRate,
        learningVelocity,
        dueReviewCount: dueCount,
        masteryByCategory,
        timePerTopic: timePerTopic.slice(0, 10),
        radarData,
        masteryHistory,
    };
}

/**
 * Get per-concept analytics
 */
export async function getConceptAnalytics(userId, conceptId) {
    const progress = await UserProgress.findOne({ userId, conceptId }).lean();
    const review = await Review.findOne({ userId, conceptId }).lean();
    const concept = await Concept.findOne({ conceptId }).lean();

    return {
        concept: concept || { conceptId, title: conceptId },
        progress: progress || { mastery_score: 0, attempt_count: 0, pipeline_stage: 0 },
        review: review || { easiness_factor: 2.5, interval: 0, repetition: 0, history: [] },
    };
}

export default { getDashboardMetrics, getConceptAnalytics };
