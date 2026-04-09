import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Specific routes MUST come before wildcard routes like /:id / /:slug
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/subjects — list all subjects
router.get("/", async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const { category } = req.query;
        const filter = {};
        if (category) filter.category = category;
        const subjects = await Subject.find(filter)
            .sort({ isDefault: -1, name: 1 })
            .lean();
        return res.json(subjects);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/subjects/categories — distinct domain categories
router.get("/categories", async (req, res) => {
    try {
        const cats = await Subject.distinct("domainCategory");
        return res.json(cats.filter(Boolean).sort());
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/subjects/enrolled — current user's enrolled subjects
router.get("/enrolled", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("enrolledSubjects")
            .lean();
        return res.json(user?.enrolledSubjects || []);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/subjects — create subject
router.post("/", auth, async (req, res) => {
    try {
        const { name, description, domainCategory, learningOutcomes, type, organizationId, icon, color, topics, category, categoryName } = req.body;

        if (!name) return res.status(400).json({ error: "Name is required" });
        if (!description) return res.status(400).json({ error: "Description is required" });
        if (!domainCategory && !category && !categoryName) return res.status(400).json({ error: "Domain/Category is required" });
        if (!learningOutcomes || !Array.isArray(learningOutcomes) || learningOutcomes.length === 0) {
            return res.status(400).json({ error: "At least one Learning Outcome is required" });
        }

        const finalizedCategory = domainCategory || category || categoryName || "General";

        const subject = await Subject.create({
            name,
            description,
            domainCategory: finalizedCategory,
            learningOutcomes,
            type: type || "general",
            organizationId: organizationId || null,
            icon: icon || "📚",
            color: color || "#1DCD9F",
            topics: topics || [],
            category: finalizedCategory,
            isDefault: false,
            createdBy: req.user._id,
            status: "active",
        });

        return res.status(201).json(subject);
    } catch (e) {
        if (e.code === 11000) {
            return res.status(409).json({ error: "A subject with this name already exists" });
        }
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/subjects/enroll — bulk enroll
router.post("/enroll", auth, async (req, res) => {
    try {
        const { slugs } = req.body;
        if (!Array.isArray(slugs)) return res.status(400).json({ error: "slugs must be an array" });
        const subjects = await Subject.find({ slug: { $in: slugs } }).lean();
        const subjectIds = subjects.map(s => s._id);
        await User.findByIdAndUpdate(req.user._id, { enrolledSubjects: subjectIds });
        return res.json({ ok: true, enrolledCount: subjectIds.length });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/subjects/enroll/toggle — toggle enrollment
router.post("/enroll/toggle", auth, async (req, res) => {
    try {
        const { subjectId } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId required" });
        if (!mongoose.Types.ObjectId.isValid(subjectId)) return res.status(400).json({ error: "Invalid subjectId" });

        const user = await User.findById(req.user._id);
        const isEnrolled = user.enrolledSubjects.map(String).includes(String(subjectId));

        if (isEnrolled) {
            user.enrolledSubjects = user.enrolledSubjects.filter(id => id.toString() !== subjectId);
        } else {
            user.enrolledSubjects.push(subjectId);
        }
        await user.save();

        const populated = await User.findById(req.user._id).populate("enrolledSubjects").lean();
        return res.json(populated.enrolledSubjects);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/subjects/category/:name — delete or reassign a category
// ?reassignTo=OtherCat  → move subjects there (category still removed)
// (no param)            → delete all subjects in this category
router.delete("/category/:name", auth, async (req, res) => {
    try {
        const catName = decodeURIComponent(req.params.name);
        const { reassignTo } = req.query;

        const query = { $or: [{ domainCategory: catName }, { category: catName }] };

        if (reassignTo && reassignTo.trim()) {
            const to = reassignTo.trim();
            await Subject.updateMany(
                query,
                { $set: { domainCategory: to, category: to } }
            );
            return res.json({ ok: true, action: "reassigned", to });
        }

        // Delete all subjects in the category
        const subjects = await Subject.find(query, "_id").lean();
        const ids = subjects.map(s => s._id);
        await Subject.deleteMany(query);
        if (ids.length) {
            await User.updateMany(
                { enrolledSubjects: { $in: ids } },
                { $pull: { enrolledSubjects: { $in: ids } } }
            );
        }
        return res.json({ ok: true, action: "deleted", count: ids.length });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PATCH /api/subjects/category/:name — rename a category
router.patch("/category/:name", auth, async (req, res) => {
    try {
        const catName = decodeURIComponent(req.params.name);
        const { newName } = req.body;
        if (!newName?.trim()) return res.status(400).json({ error: "newName required" });

        const query = { $or: [{ domainCategory: catName }, { category: catName }] };
        const result = await Subject.updateMany(
            query,
            { $set: { domainCategory: newName.trim(), category: newName.trim() } }
        );
        return res.json({ ok: true, modifiedCount: result.modifiedCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// ─── WILDCARD ROUTES BELOW — must come LAST ───────────────────────────────

// PUT /api/subjects/:id — update subject
router.put("/:id", auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid Subject ID" });
        }
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ error: "Subject not found" });

        if (subject.createdBy && subject.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ error: "Not authorized" });
        }

        const { name, description, domainCategory, learningOutcomes, type, status, icon, color, topics, category, categoryName } = req.body;

        if (name) subject.name = name;
        if (description !== undefined) subject.description = description;
        if (learningOutcomes) subject.learningOutcomes = learningOutcomes;
        if (type) subject.type = type;
        if (status) subject.status = status;
        if (icon) subject.icon = icon;
        if (color) subject.color = color;
        if (topics) subject.topics = topics;

        const nextCat = domainCategory || category || categoryName;
        if (nextCat) {
            subject.domainCategory = nextCat;
            subject.category = nextCat;
        }

        await subject.save();
        return res.json(subject);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/subjects/:id — delete single subject
router.delete("/:id", auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid Subject ID" });
        }
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ error: "Subject not found" });

        if (subject.createdBy && subject.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ error: "Not authorized" });
        }

        await Subject.findByIdAndDelete(req.params.id);
        await User.updateMany(
            { enrolledSubjects: req.params.id },
            { $pull: { enrolledSubjects: req.params.id } }
        );

        return res.status(204).send();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/subjects/:slug — get single subject by slug (must be last GET wildcard)
router.get("/:slug", async (req, res) => {
    try {
        const subject = await Subject.findOne({ slug: req.params.slug }).lean();
        if (!subject) return res.status(404).json({ error: "Subject not found" });
        return res.json(subject);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
