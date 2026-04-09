/**
 * Settings API Routes
 * GET  /api/settings          — Get current user settings
 * PUT  /api/settings          — Update settings (full or partial)
 * PUT  /api/settings/:section — Update specific section (aiTutor, difficulty, srs, etc.)
 * POST /api/settings/reset    — Reset to a learning mode preset
 * GET  /api/settings/presets  — List available presets with configs
 */
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
    resolveSettings,
    updateSettings,
    updateSection,
    resetToPreset,
    getPresets,
    getPresetConfig,
} from '../services/settingsEngine.js';

const router = Router();

// GET /api/settings — current user settings
router.get('/', auth, async (req, res) => {
    try {
        const settings = await resolveSettings(req.user._id);
        res.json(settings);
    } catch (err) {
        console.error('[Settings] GET error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/settings — update settings (can include learningMode, sections, etc.)
router.put('/', auth, async (req, res) => {
    try {
        const updated = await updateSettings(req.user._id, req.body);
        res.json(updated);
    } catch (err) {
        console.error('[Settings] PUT error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/settings/:section — update a single section
router.put('/:section', auth, async (req, res) => {
    try {
        const updated = await updateSection(req.user._id, req.params.section, req.body);
        res.json(updated);
    } catch (err) {
        console.error('[Settings] PUT section error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/settings/reset — reset to preset
router.post('/reset', auth, async (req, res) => {
    try {
        const { mode } = req.body;
        const settings = await resetToPreset(req.user._id, mode || 'balanced');
        res.json(settings);
    } catch (err) {
        console.error('[Settings] Reset error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// GET /api/settings/presets — available presets
router.get('/presets', auth, (req, res) => {
    const presetNames = getPresets();
    const presets = presetNames.map(name => ({
        name,
        config: getPresetConfig(name),
    }));
    res.json(presets);
});

export default router;
