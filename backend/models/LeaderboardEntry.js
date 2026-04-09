/**
 * LeaderboardEntry — Composite scoring leaderboard in MongoDB.
 * Score = (XP * 0.4) + (accuracy * 0.25) + (streak * 0.2) + (difficultyMultiplier * 0.15)
 */
import mongoose from 'mongoose';

const leaderboardEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Context dimensions
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    period: { type: String, enum: ['daily', 'weekly', 'monthly', 'alltime'], default: 'alltime' },
    periodStart: { type: Date, default: null },

    // Raw metrics
    xp: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0, min: 0, max: 100 },
    streak: { type: Number, default: 0 },
    difficultyAvg: { type: Number, default: 1, min: 1, max: 5 },
    questionsAnswered: { type: Number, default: 0 },
    quizzesCompleted: { type: Number, default: 0 },

    // Composite score (pre-calculated for fast sorting)
    compositeScore: { type: Number, default: 0 },

    // Anti-abuse
    lastActivityAt: { type: Date, default: Date.now },
    flags: { type: Number, default: 0 },

}, { timestamps: true });

// Compound index for fast contextual leaderboard queries
leaderboardEntrySchema.index({ period: 1, subjectId: 1, orgId: 1, compositeScore: -1 });
leaderboardEntrySchema.index({ userId: 1, period: 1, subjectId: 1, orgId: 1 }, { unique: true });

// Pre-save: compute composite score
leaderboardEntrySchema.pre('save', function () {
    const normalizedXp = Math.min(this.xp / 1000, 100); // Cap at 100k XP
    const normalizedStreak = Math.min(this.streak * 5, 100); // Cap at 20-day streak
    const normalizedDifficulty = (this.difficultyAvg / 5) * 100;

    this.compositeScore = Math.round(
        (normalizedXp * 0.4) +
        (this.accuracy * 0.25) +
        (normalizedStreak * 0.2) +
        (normalizedDifficulty * 0.15)
    );
});

const LeaderboardEntry = mongoose.model('LeaderboardEntry', leaderboardEntrySchema);
export default LeaderboardEntry;
