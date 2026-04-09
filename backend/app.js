import dotenv from "dotenv";
dotenv.config(); // Must be first — before any imports that read process.env

import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { config } from "./config/index.js";

import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import notesRoutes from "./routes/notes.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import issueRoutes from "./routes/issues.js";
import learningRoutes from "./routes/learning.js";
import proctorRoutes from "./routes/proctor.js";
import assessmentRoutes from "./routes/assessment.js";
import questionBankRoutes from "./routes/questionBank.js";
import spacedRepetitionRoutes from "./routes/spacedRepetition.js";
import adaptiveLearningRoutes from "./routes/adaptiveLearning.js";
import analyticsRoutes from "./routes/analytics.js";
import experimentsRoutes from "./routes/experiments.js";
import subjectsRoutes from "./routes/subjects.js";
import graphRoutes from "./routes/graph.js";
import syllabusRoutes from "./routes/syllabus.js";
import contentRoutes from "./routes/content.js";
import tutorRoutes from "./routes/tutor.js";
import settingsRoutes from "./routes/settings.js";
import organizationsRoutes from "./routes/organizations.js";
import leaderboardRoutes from "./routes/leaderboard.js";

const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Health check
app.get("/api/ping", (req, res) => {
    res.json({
        ok: true,
        message: "Adiptify API is running",
        db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/", issueRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/proctor", proctorRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/question-bank", questionBankRoutes);
app.use("/api/sr", spacedRepetitionRoutes);
app.use("/api/adaptive", adaptiveLearningRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/experiments", experimentsRoutes);
app.use("/api/subjects", subjectsRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/organizations", organizationsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

// MongoDB connection — using Atlas URI from .env
mongoose
    .connect(config.mongoUri, {
        dbName: config.mongoDb,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
    })
    .then(() => {
        console.log(`✅ MongoDB Atlas connected → db: ${config.mongoDb}`);

        // Initialize event-driven services after DB is ready
        import('./services/leaderboardService.js').then(({ initLeaderboardListeners }) => {
            initLeaderboardListeners();
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection FAILED:", err.message);
        console.error("   Check MONGO_URI in .env");
        process.exit(1); // Exit so nodemon restarts with a clear error
    });

const PORT = config.port;
app.listen(PORT, () => {
    console.log(`🚀 Adiptify API listening on port ${PORT}`);
});

// Trigger nodemon restart
