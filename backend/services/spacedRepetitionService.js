import Review from "../models/Review.js";
import UserProgress from "../models/UserProgress.js";

/**
 * Pure SM-2 algorithm calculation
 * @param {number} ef   - current easiness factor (≥ 1.3)
 * @param {number} rep  - current repetition count
 * @param {number} prevInterval - previous interval in days
 * @param {number} quality - recall quality 0-5
 * @returns {{ ef: number, rep: number, interval: number, nextReview: Date }}
 */
export function calculateSM2(ef, rep, prevInterval, quality) {
    // Update easiness factor
    let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < 1.3) newEF = 1.3;

    let newRep, newInterval;

    if (quality >= 3) {
        newRep = rep + 1;
        if (newRep === 1) {
            newInterval = 1;
        } else if (newRep === 2) {
            newInterval = 6;
        } else {
            newInterval = Math.round(prevInterval * newEF);
        }
    } else {
        // Failed recall — reset
        newRep = 0;
        newInterval = 1;
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);

    return {
        ef: Math.round(newEF * 100) / 100,
        rep: newRep,
        interval: newInterval,
        nextReview,
    };
}

/**
 * Apply user-specific interval scaling from settings engine
 */
async function applyUserIntervalMultiplier(userId, interval) {
    try {
        const { getSrsParams } = await import('./behaviorEngine.js');
        const params = await getSrsParams(userId);
        return Math.max(1, Math.round(interval * params.intervalMultiplier));
    } catch {
        return interval; // fallback: no adjustment
    }
}

/**
 * Submit a review for a user-concept pair
 */
export async function submitReview(userId, conceptId, quality) {
    quality = Math.max(0, Math.min(5, Math.round(quality)));

    let review = await Review.findOne({ userId, conceptId });

    if (!review) {
        review = new Review({ userId, conceptId });
    }

    const result = calculateSM2(
        review.easiness_factor,
        review.repetition,
        review.interval,
        quality
    );

    review.easiness_factor = result.ef;
    review.repetition = result.rep;

    // Apply user settings multiplier (low/medium/high review frequency)
    const adjustedInterval = await applyUserIntervalMultiplier(userId, result.interval);
    review.interval = adjustedInterval;

    review.quality_score = quality;
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + adjustedInterval);
    review.next_review = nextReview;
    review.last_review = new Date();
    review.history.push({
        quality,
        date: new Date(),
        interval: result.interval,
    });

    await review.save();

    // Update user progress next_review_date
    await UserProgress.findOneAndUpdate(
        { userId, conceptId },
        {
            next_review_date: result.nextReview,
            last_review_date: new Date(),
            retention_score: quality >= 3 ? Math.min(1, (review.repetition / 10) + 0.5) : Math.max(0, (review.repetition / 10)),
        },
        { upsert: true, new: true }
    );

    return review;
}

/**
 * Get all concepts due for review for a user
 */
export async function getDueReviews(userId) {
    const now = new Date();
    const dueReviews = await Review.find({
        userId,
        next_review: { $lte: now },
    }).sort({ next_review: 1 });

    return dueReviews;
}

/**
 * Get review stats for a specific concept
 */
export async function getReviewStats(userId, conceptId) {
    const review = await Review.findOne({ userId, conceptId });
    if (!review) {
        return {
            easiness_factor: 2.5,
            interval: 0,
            repetition: 0,
            quality_score: 0,
            next_review: null,
            history: [],
        };
    }
    return review;
}

/**
 * Initialize review records for all concepts a user hasn't started
 */
export async function initializeReviews(userId, conceptIds) {
    const existing = await Review.find({ userId, conceptId: { $in: conceptIds } });
    const existingIds = new Set(existing.map((r) => r.conceptId));

    const newReviews = conceptIds
        .filter((id) => !existingIds.has(id))
        .map((conceptId) => ({
            userId,
            conceptId,
            easiness_factor: 2.5,
            interval: 0,
            repetition: 0,
            quality_score: 0,
            next_review: new Date(),
        }));

    if (newReviews.length > 0) {
        await Review.insertMany(newReviews);
    }

    return newReviews.length;
}

export default { calculateSM2, submitReview, getDueReviews, getReviewStats, initializeReviews };
