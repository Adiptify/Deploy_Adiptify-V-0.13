/**
 * Organization CRUD Routes
 */
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Organization from '../models/Organization.js';
import { eventBus, EVENTS } from '../services/eventBus.js';

const router = Router();

// POST /api/organizations — create organization
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, domain, settings } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const org = await Organization.create({
            name,
            description: description || '',
            domain: domain || '',
            owner: req.user._id,
            admins: [req.user._id],
            members: [req.user._id],
            settings: settings || {},
        });

        res.status(201).json(org);
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: 'Organization slug already exists' });
        res.status(500).json({ error: err.message });
    }
});

// GET /api/organizations — list user's organizations
router.get('/', auth, async (req, res) => {
    try {
        const orgs = await Organization.find({
            $or: [
                { owner: req.user._id },
                { admins: req.user._id },
                { members: req.user._id },
            ]
        }).sort({ createdAt: -1 }).lean();
        res.json(orgs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/organizations/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id)
            .populate('owner', 'name email')
            .populate('admins', 'name email')
            .populate('members', 'name email')
            .lean();
        if (!org) return res.status(404).json({ error: 'Not found' });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/organizations/:id — update
router.put('/:id', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });

        // Only owner or admin can update
        const isAuthorized = org.owner.equals(req.user._id) ||
            org.admins.some(a => a.equals(req.user._id));
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        const { name, description, domain, settings } = req.body;
        if (name) org.name = name;
        if (description !== undefined) org.description = description;
        if (domain !== undefined) org.domain = domain;
        if (settings) Object.assign(org.settings, settings);

        await org.save();
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/organizations/:id/members — add member
router.post('/:id/members', auth, async (req, res) => {
    try {
        const { userId, role = 'member' } = req.body;
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });

        const isAdmin = org.owner.equals(req.user._id) || org.admins.some(a => a.equals(req.user._id));
        if (!isAdmin) return res.status(403).json({ error: 'Only admins can add members' });

        if (!org.members.some(m => m.equals(userId))) {
            org.members.push(userId);
        }
        if (role === 'admin' && !org.admins.some(a => a.equals(userId))) {
            org.admins.push(userId);
        }

        await org.save();
        eventBus.emit(EVENTS.ORG_MEMBER_ADDED, { orgId: org._id, userId, addedBy: req.user._id });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/organizations/:id/members/:userId — remove member
router.delete('/:id/members/:userId', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });

        const isAdmin = org.owner.equals(req.user._id) || org.admins.some(a => a.equals(req.user._id));
        if (!isAdmin) return res.status(403).json({ error: 'Only admins can remove members' });

        org.members = org.members.filter(m => !m.equals(req.params.userId));
        org.admins = org.admins.filter(a => !a.equals(req.params.userId));
        await org.save();

        eventBus.emit(EVENTS.ORG_MEMBER_REMOVED, { orgId: org._id, userId: req.params.userId, removedBy: req.user._id });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/organizations/:id — delete organization
router.delete('/:id', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });
        if (!org.owner.equals(req.user._id)) return res.status(403).json({ error: 'Only owner can delete' });

        await Organization.deleteOne({ _id: org._id });
        res.json({ message: 'Organization deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
