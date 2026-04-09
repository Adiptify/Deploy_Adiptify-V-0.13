/**
 * Leaderboard API Routes
 */
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getLeaderboard, getUserRank } from '../services/leaderboardService.js';

const router = Router();

// GET /api/leaderboard — contextual leaderboard
router.get('/', auth, async (req, res) => {
    try {
        const { subjectId, orgId, period = 'alltime', limit = 50, skip = 0 } = req.query;
        const entries = await getLeaderboard({
            subjectId: subjectId || null,
            orgId: orgId || null,
            period,
            limit: parseInt(limit),
            skip: parseInt(skip),
        });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leaderboard/me — current user's rank
router.get('/me', auth, async (req, res) => {
    try {
        const { subjectId, orgId, period = 'alltime' } = req.query;
        const rank = await getUserRank(req.user._id, {
            subjectId: subjectId || null,
            orgId: orgId || null,
            period,
        });
        res.json(rank);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
