/**
 * In-process Event Bus for Adiptify.
 * Decouples modules (Tutor, SRS, Difficulty, Leaderboard) via pub/sub events.
 * 
 * Usage:
 *   import { eventBus, EVENTS } from './eventBus.js';
 *   eventBus.on(EVENTS.QUIZ_COMPLETED, handler);
 *   eventBus.emit(EVENTS.QUIZ_COMPLETED, payload);
 */
import { EventEmitter } from 'events';

class AdiptifyEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
        this._eventLog = [];
    }

    /**
     * Emit with structured logging
     */
    emit(event, payload = {}) {
        const entry = {
            event,
            timestamp: Date.now(),
            userId: payload?.userId || null,
        };
        this._eventLog.push(entry);

        // Keep log bounded
        if (this._eventLog.length > 500) {
            this._eventLog = this._eventLog.slice(-250);
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[EventBus] ${event}`, payload?.userId ? `user=${payload.userId}` : '');
        }

        return super.emit(event, payload);
    }

    /**
     * Get recent event history for debugging
     */
    getRecentEvents(limit = 20) {
        return this._eventLog.slice(-limit);
    }
}

// ── Event Constants ──
export const EVENTS = {
    // User Settings
    SETTINGS_UPDATED: 'settings:updated',
    SETTINGS_RESET: 'settings:reset',

    // Quiz & Assessment
    QUIZ_COMPLETED: 'quiz:completed',
    QUIZ_STARTED: 'quiz:started',
    QUESTION_ANSWERED: 'question:answered',

    // Tutor
    TUTOR_MESSAGE: 'tutor:message',
    TUTOR_HINT_USED: 'tutor:hint_used',

    // Learning Progress
    MASTERY_UPDATED: 'mastery:updated',
    TOPIC_COMPLETED: 'topic:completed',
    MODULE_COMPLETED: 'module:completed',
    STREAK_UPDATED: 'streak:updated',

    // SRS
    SRS_REVIEW_DUE: 'srs:review_due',
    SRS_CARD_REVIEWED: 'srs:card_reviewed',

    // Difficulty
    DIFFICULTY_ADJUSTED: 'difficulty:adjusted',

    // Leaderboard
    LEADERBOARD_XP_EARNED: 'leaderboard:xp_earned',
    LEADERBOARD_RANK_CHANGED: 'leaderboard:rank_changed',

    // Syllabus
    SYLLABUS_PARSED: 'syllabus:parsed',
    SUBJECT_CREATED: 'subject:created',

    // Organization
    ORG_MEMBER_ADDED: 'org:member_added',
    ORG_MEMBER_REMOVED: 'org:member_removed',
};

export const eventBus = new AdiptifyEventBus();
export default eventBus;
