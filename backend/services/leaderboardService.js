/**
 * Leaderboard Service — Updates scores on events and queries rankings.
 */
import LeaderboardEntry from '../models/LeaderboardEntry.js';
import { eventBus, EVENTS } from './eventBus.js';

// ── XP Constants ──
const XP_REWARDS = {
    CORRECT_ANSWER: 10,
    QUIZ_COMPLETED: 50,
    STREAK_BONUS: 5, // per day
    DIFFICULTY_MULTIPLIER: [0, 0.8, 1.0, 1.2, 1.5, 2.0], // index = difficulty level
};

/**
 * Get or create a leaderboard entry for a user in a context
 */
async function getEntry(userId, { subjectId = null, orgId = null, period = 'alltime' } = {}) {
    let entry = await LeaderboardEntry.findOne({ userId, subjectId, orgId, period });
    if (!entry) {
        entry = new LeaderboardEntry({ userId, subjectId, orgId, period });
    }
    return entry;
}

/**
 * Award XP and update stats after a quiz is completed
 */
export async function onQuizCompleted({ userId, subjectId, orgId, accuracy, difficulty, questionsAnswered }) {
    const contexts = [
        { subjectId: null, orgId: null, period: 'alltime' }, // global
    ];
    if (subjectId) contexts.push({ subjectId, orgId: null, period: 'alltime' });
    if (orgId) contexts.push({ subjectId: null, orgId, period: 'alltime' });

    const diffMultiplier = XP_REWARDS.DIFFICULTY_MULTIPLIER[Math.round(difficulty)] || 1.0;
    const earnedXp = Math.round(
        (questionsAnswered * XP_REWARDS.CORRECT_ANSWER * (accuracy / 100) * diffMultiplier) +
        XP_REWARDS.QUIZ_COMPLETED
    );

    for (const ctx of contexts) {
        const entry = await getEntry(userId, ctx);
        entry.xp += earnedXp;
        entry.quizzesCompleted += 1;
        entry.questionsAnswered += questionsAnswered;

        // Rolling accuracy: weighted average
        const totalQ = entry.questionsAnswered;
        const prevQ = totalQ - questionsAnswered;
        entry.accuracy = prevQ > 0
            ? Math.round(((entry.accuracy * prevQ) + (accuracy * questionsAnswered)) / totalQ)
            : Math.round(accuracy);

        // Difficulty average
        entry.difficultyAvg = prevQ > 0
            ? ((entry.difficultyAvg * prevQ) + (difficulty * questionsAnswered)) / totalQ
            : difficulty;

        entry.lastActivityAt = new Date();
        await entry.save();
    }

    eventBus.emit(EVENTS.LEADERBOARD_XP_EARNED, { userId, earnedXp, subjectId, orgId });
    return earnedXp;
}

/**
 * Update streak
 */
export async function updateStreak(userId, currentStreak) {
    await LeaderboardEntry.updateMany(
        { userId, period: 'alltime' },
        { $set: { streak: currentStreak, lastActivityAt: new Date() } }
    );
}

/**
 * Get ranked leaderboard
 */
export async function getLeaderboard({ subjectId = null, orgId = null, period = 'alltime', limit = 50, skip = 0 } = {}) {
    const filter = { period };
    if (subjectId) filter.subjectId = subjectId;
    else filter.subjectId = null;
    if (orgId) filter.orgId = orgId;
    else filter.orgId = null;

    const entries = await LeaderboardEntry.find(filter)
        .sort({ compositeScore: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email avatar')
        .lean();

    return entries.map((e, idx) => ({
        rank: skip + idx + 1,
        userId: e.userId,
        xp: e.xp,
        accuracy: e.accuracy,
        streak: e.streak,
        compositeScore: e.compositeScore,
        questionsAnswered: e.questionsAnswered,
        quizzesCompleted: e.quizzesCompleted,
    }));
}

/**
 * Get a user's rank in context
 */
export async function getUserRank(userId, { subjectId = null, orgId = null, period = 'alltime' } = {}) {
    const entry = await LeaderboardEntry.findOne({ userId, subjectId, orgId, period }).lean();
    if (!entry) return { rank: null, score: 0 };

    const higherCount = await LeaderboardEntry.countDocuments({
        subjectId, orgId, period,
        compositeScore: { $gt: entry.compositeScore }
    });

    return { rank: higherCount + 1, ...entry };
}

// ── Wire up event listeners ──
export function initLeaderboardListeners() {
    eventBus.on(EVENTS.QUIZ_COMPLETED, async (payload) => {
        try {
            await onQuizCompleted(payload);
        } catch (err) {
            console.error('[Leaderboard] Quiz event handler error:', err.message);
        }
    });

    eventBus.on(EVENTS.STREAK_UPDATED, async ({ userId, streak }) => {
        try {
            await updateStreak(userId, streak);
        } catch (err) {
            console.error('[Leaderboard] Streak event handler error:', err.message);
        }
    });

    console.log('[Leaderboard] Event listeners initialized');
}

export default {
    onQuizCompleted,
    updateStreak,
    getLeaderboard,
    getUserRank,
    initLeaderboardListeners,
};
