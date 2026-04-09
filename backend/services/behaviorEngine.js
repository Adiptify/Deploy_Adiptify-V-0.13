/**
 * Behavior Engine — Decision layer that converts settings into runtime parameters.
 * Modules call this to get concrete values for their logic.
 */
import { resolveSettings, getTutorSettings, getDifficultySettings, getSrsSettings } from './settingsEngine.js';

// ── Difficulty Thresholds ──
const DIFFICULTY_THRESHOLDS = {
    conservative: { upThreshold: 0.85, downThreshold: 0.45, windowSize: 10 },
    moderate:     { upThreshold: 0.75, downThreshold: 0.40, windowSize: 7 },
    aggressive:   { upThreshold: 0.65, downThreshold: 0.35, windowSize: 5 },
};

// ── SRS Intervals ──
const SRS_FREQUENCY_MULTIPLIERS = {
    low: 1.5,    // Longer intervals → fewer reviews
    medium: 1.0, // Default SM-2
    high: 0.7,   // Shorter intervals → more reviews
};

// ── Tutor Token Budgets ──
const DEPTH_TOKEN_LIMITS = {
    brief: 150,
    medium: 300,
    detailed: 600,
};

/**
 * Get difficulty adaptation parameters for a user
 */
export async function getDifficultyParams(userId) {
    const settings = await getDifficultySettings(userId);
    const thresholds = DIFFICULTY_THRESHOLDS[settings.adaptationMode] || DIFFICULTY_THRESHOLDS.moderate;

    return {
        ...thresholds,
        minLevel: settings.minLevel,
        maxLevel: settings.maxLevel,
        adaptationMode: settings.adaptationMode,
    };
}

/**
 * Get SRS parameters for a user
 */
export async function getSrsParams(userId) {
    const settings = await getSrsSettings(userId);

    return {
        intervalMultiplier: SRS_FREQUENCY_MULTIPLIERS[settings.reviewFrequency] || 1.0,
        errorWeighting: settings.errorWeighting,
        retentionTarget: settings.retentionTarget,
        reviewFrequency: settings.reviewFrequency,
    };
}

/**
 * Get tutor behavior parameters for a user
 */
export async function getTutorParams(userId) {
    const settings = await getTutorSettings(userId);

    return {
        ...settings,
        maxTokens: DEPTH_TOKEN_LIMITS[settings.explanationDepth] || 300,
        shouldGiveHint: (isCorrect) => {
            if (settings.hintMode === 'never') return false;
            if (settings.hintMode === 'always_available') return true;
            return !isCorrect; // on_mistake
        },
        shouldIntervene: (mastery, streak) => {
            if (settings.interventionLevel === 'passive') return false;
            if (settings.interventionLevel === 'proactive') return mastery < 60 || streak < 0;
            return mastery < 40; // medium
        },
    };
}

/**
 * Build system prompt suffix from tutor settings
 */
export async function buildTutorPromptSuffix(userId) {
    const params = await getTutorParams(userId);
    const lines = [];

    if (params.reasoningMode === 'step_by_step') {
        lines.push('Break down your explanation into numbered steps.');
    } else if (params.reasoningMode === 'socratic') {
        lines.push('Guide the student with questions. Do NOT give the answer directly.');
    }

    if (params.explanationDepth === 'brief') {
        lines.push('Keep your response under 100 words.');
    } else if (params.explanationDepth === 'detailed') {
        lines.push('Provide comprehensive explanations with examples, analogies, and edge cases.');
    }

    return lines.length > 0 ? '\n\nBEHAVIOR RULES:\n' + lines.map(l => `- ${l}`).join('\n') : '';
}

export default {
    getDifficultyParams,
    getSrsParams,
    getTutorParams,
    buildTutorPromptSuffix,
};
