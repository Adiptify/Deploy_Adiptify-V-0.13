import User from "../models/User.js";

/**
 * Update mastery for a user on a topic using Exponential Moving Average (EMA)
 * alpha = 0.2 by default
 */
export async function updateMastery(userId, topic, isCorrect, timeTakenMs = 0, alpha = 0.2) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const profile = user.learnerProfile || {};
    const topics = profile.topics || new Map();

    let current = topics.get(topic) || { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 };

    const score = isCorrect ? 100 : 0;
    current.mastery = alpha * score + (1 - alpha) * (current.mastery || 0);
    current.mastery = Math.round(current.mastery * 100) / 100;
    current.attempts = (current.attempts || 0) + 1;
    current.streak = isCorrect ? (current.streak || 0) + 1 : 0;
    current.timeOnTask = (current.timeOnTask || 0) + timeTakenMs;

    topics.set(topic, current);

    user.learnerProfile = { ...profile, topics, lastActiveAt: new Date() };
    await user.save();

    return current;
}

/**
 * Get mastery data for a user
 */
export async function getMastery(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    const topics = user.learnerProfile?.topics || {};
    return topics;
}

/**
 * Check if remediation is needed (2 wrong in last 5 attempts for same topic)
 */
export function checkRemediation(attemptHistory, topic) {
    const topicAttempts = attemptHistory
        .filter(a => a.topics?.includes(topic) || a.topic === topic)
        .slice(-5);

    const wrongCount = topicAttempts.filter(a => !a.isCorrect).length;
    return wrongCount >= 2;
}

export default { updateMastery, getMastery, checkRemediation };
