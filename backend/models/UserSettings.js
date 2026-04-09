/**
 * UserSettings Model — Stores per-user configuration for AI tutor, SRS, difficulty.
 * Each user has exactly one settings document. Defaults are applied on first access.
 */
import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },

    // ── Learning Mode (top-level preset) ──
    learningMode: {
        type: String,
        enum: ['relaxed', 'balanced', 'intensive', 'exam_prep'],
        default: 'balanced',
    },

    // ── AI Tutor Behavior ──
    aiTutor: {
        explanationDepth: {
            type: String,
            enum: ['brief', 'medium', 'detailed'],
            default: 'medium',
        },
        reasoningMode: {
            type: String,
            enum: ['direct_answer', 'step_by_step', 'socratic'],
            default: 'step_by_step',
        },
        hintMode: {
            type: String,
            enum: ['never', 'on_mistake', 'always_available'],
            default: 'on_mistake',
        },
        interventionLevel: {
            type: String,
            enum: ['passive', 'medium', 'proactive'],
            default: 'medium',
        },
    },

    // ── Difficulty Adaptation ──
    difficulty: {
        adaptationMode: {
            type: String,
            enum: ['conservative', 'moderate', 'aggressive'],
            default: 'moderate',
        },
        minLevel: { type: Number, default: 1, min: 1, max: 5 },
        maxLevel: { type: Number, default: 5, min: 1, max: 5 },
    },

    // ── Spaced Repetition (SRS) ──
    srs: {
        reviewFrequency: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        errorWeighting: { type: Boolean, default: true },
        retentionTarget: { type: Number, default: 0.85, min: 0.5, max: 0.99 },
    },

    // ── Performance Mode ──
    performance: {
        maxTokens: { type: Number, default: 2048 },
        apiThrottle: { type: Number, default: 10 }, // requests per minute
        cacheEnabled: { type: Boolean, default: true },
    },

    // ── UI Preferences ──
    ui: {
        darkMode: { type: Boolean, default: false },
        compactView: { type: Boolean, default: false },
        showMastery: { type: Boolean, default: true },
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// ── Static: Get or create settings for a user ──
userSettingsSchema.statics.getForUser = async function (userId) {
    let settings = await this.findOne({ userId });
    if (!settings) {
        settings = await this.create({ userId });
    }
    return settings;
};

// ── Static: Update specific section ──
userSettingsSchema.statics.updateSection = async function (userId, section, data) {
    const validSections = ['aiTutor', 'difficulty', 'srs', 'performance', 'ui'];
    if (!validSections.includes(section)) {
        throw new Error(`Invalid settings section: ${section}`);
    }

    const updateObj = {};
    for (const [key, value] of Object.entries(data)) {
        updateObj[`${section}.${key}`] = value;
    }

    return this.findOneAndUpdate(
        { userId },
        { $set: updateObj },
        { new: true, upsert: true, runValidators: true }
    );
};

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);
export default UserSettings;
