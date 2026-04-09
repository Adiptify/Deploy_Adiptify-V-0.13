/**
 * Settings Engine — O(1) resolver + in-memory cache for user settings.
 * Provides a unified config object to all modules (Tutor, SRS, Difficulty).
 * 
 * Architecture:
 *   UserSettings (DB) → SettingsEngine (cached resolver) → BehaviorEngine → Modules
 */
import UserSettings from '../models/UserSettings.js';
import { eventBus, EVENTS } from './eventBus.js';

// ── In-memory LRU cache (bounded) ──
const CACHE_MAX = 500;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

function cacheGet(userId) {
    const entry = cache.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(userId);
        return null;
    }
    return entry.data;
}

function cacheSet(userId, data) {
    // Evict oldest if at capacity
    if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(userId, { data, ts: Date.now() });
}

function cacheInvalidate(userId) {
    cache.delete(userId);
}

// ── Learning Mode Presets ──
const LEARNING_MODE_PRESETS = {
    relaxed: {
        aiTutor: { explanationDepth: 'detailed', reasoningMode: 'step_by_step', hintMode: 'always_available', interventionLevel: 'proactive' },
        difficulty: { adaptationMode: 'conservative', minLevel: 1, maxLevel: 3 },
        srs: { reviewFrequency: 'low', retentionTarget: 0.75 },
    },
    balanced: {
        aiTutor: { explanationDepth: 'medium', reasoningMode: 'step_by_step', hintMode: 'on_mistake', interventionLevel: 'medium' },
        difficulty: { adaptationMode: 'moderate', minLevel: 1, maxLevel: 5 },
        srs: { reviewFrequency: 'medium', retentionTarget: 0.85 },
    },
    intensive: {
        aiTutor: { explanationDepth: 'brief', reasoningMode: 'direct_answer', hintMode: 'on_mistake', interventionLevel: 'passive' },
        difficulty: { adaptationMode: 'aggressive', minLevel: 2, maxLevel: 5 },
        srs: { reviewFrequency: 'high', retentionTarget: 0.90 },
    },
    exam_prep: {
        aiTutor: { explanationDepth: 'medium', reasoningMode: 'direct_answer', hintMode: 'never', interventionLevel: 'passive' },
        difficulty: { adaptationMode: 'aggressive', minLevel: 3, maxLevel: 5 },
        srs: { reviewFrequency: 'high', retentionTarget: 0.95 },
    },
};

// ── Core Resolver ──
export async function resolveSettings(userId) {
    // 1. Check cache
    const cached = cacheGet(userId);
    if (cached) return cached;

    // 2. Get from DB (lazy init)
    const settings = await UserSettings.getForUser(userId);
    const resolved = settings.toObject();

    // 3. Cache and return
    cacheSet(userId, resolved);
    return resolved;
}

// ── Update Settings ──
export async function updateSettings(userId, updates) {
    const settings = await UserSettings.getForUser(userId);

    // If learningMode changed, apply preset
    if (updates.learningMode && updates.learningMode !== settings.learningMode) {
        const preset = LEARNING_MODE_PRESETS[updates.learningMode];
        if (preset) {
            Object.assign(settings.aiTutor, preset.aiTutor);
            Object.assign(settings.difficulty, preset.difficulty);
            Object.assign(settings.srs, preset.srs);
        }
        settings.learningMode = updates.learningMode;
    }

    // Apply section-level overrides
    for (const section of ['aiTutor', 'difficulty', 'srs', 'performance', 'ui']) {
        if (updates[section] && typeof updates[section] === 'object') {
            Object.assign(settings[section], updates[section]);
        }
    }

    await settings.save();
    cacheInvalidate(userId);

    // Emit event for other modules
    eventBus.emit(EVENTS.SETTINGS_UPDATED, {
        userId,
        learningMode: settings.learningMode,
        sections: Object.keys(updates),
    });

    return settings;
}

// ── Update specific section ──
export async function updateSection(userId, section, data) {
    const updated = await UserSettings.updateSection(userId, section, data);
    cacheInvalidate(userId);

    eventBus.emit(EVENTS.SETTINGS_UPDATED, {
        userId,
        section,
        changes: Object.keys(data),
    });

    return updated;
}

// ── Reset to mode preset ──
export async function resetToPreset(userId, mode = 'balanced') {
    const preset = LEARNING_MODE_PRESETS[mode];
    if (!preset) throw new Error(`Unknown learning mode: ${mode}`);

    const settings = await UserSettings.getForUser(userId);
    settings.learningMode = mode;
    Object.assign(settings.aiTutor, preset.aiTutor);
    Object.assign(settings.difficulty, preset.difficulty);
    Object.assign(settings.srs, preset.srs);

    await settings.save();
    cacheInvalidate(userId);

    eventBus.emit(EVENTS.SETTINGS_RESET, { userId, mode });
    return settings;
}

// ── Quick accessors for modules ──
export async function getTutorSettings(userId) {
    const s = await resolveSettings(userId);
    return s.aiTutor;
}

export async function getDifficultySettings(userId) {
    const s = await resolveSettings(userId);
    return s.difficulty;
}

export async function getSrsSettings(userId) {
    const s = await resolveSettings(userId);
    return s.srs;
}

export async function getPerformanceSettings(userId) {
    const s = await resolveSettings(userId);
    return s.performance;
}

// ── Available presets for frontend ──
export function getPresets() {
    return Object.keys(LEARNING_MODE_PRESETS);
}

export function getPresetConfig(mode) {
    return LEARNING_MODE_PRESETS[mode] || null;
}

export default {
    resolveSettings,
    updateSettings,
    updateSection,
    resetToPreset,
    getTutorSettings,
    getDifficultySettings,
    getSrsSettings,
    getPerformanceSettings,
    getPresets,
    getPresetConfig,
};
