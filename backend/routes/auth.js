import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../config/index.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, studentId, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ error: "Email already in use" });

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            name, email, passwordHash,
            role: role || "student",
            studentId: studentId || undefined,
        });
        return res.json({ id: user._id, message: "Registration successful" });
    } catch (e) {
        return res.status(500).json({ error: "Registration failed: " + e.message });
    }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { _id: user._id, role: user.role, email: user.email, name: user.name },
            config.jwtSecret,
            { expiresIn: "7d" }
        );
        return res.json({ token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (e) {
        return res.status(500).json({ error: "Login failed: " + e.message });
    }
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-passwordHash").populate("enrolledSubjects").lean();
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json(user);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/proctor-consent
router.post("/proctor-consent", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });
        user.proctorConsent = true;
        await user.save();
        return res.json({ ok: true, message: "Consent saved" });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PATCH /api/auth/preferences — update user preferences
router.patch("/preferences", auth, async (req, res) => {
    try {
        const { quizMode, difficulty, dailyGoal, notifications, themePreference } = req.body;
        const update = {};

        if (quizMode) update["preferences.quizMode"] = quizMode;
        if (difficulty) update["preferences.difficulty"] = difficulty;
        if (dailyGoal !== undefined) update["preferences.dailyGoal"] = dailyGoal;
        if (notifications !== undefined) update["preferences.notifications"] = notifications;
        if (themePreference) update.themePreference = themePreference;

        const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
            .select("-passwordHash")
            .populate("enrolledSubjects")
            .lean();

        return res.json(user);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
