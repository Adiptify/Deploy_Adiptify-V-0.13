import mongoose from "mongoose";

const learnerProfileSchema = new mongoose.Schema(
    {
        topics: {
            type: Map,
            of: new mongoose.Schema(
                {
                    mastery: { type: Number, default: 0 },
                    attempts: { type: Number, default: 0 },
                    streak: { type: Number, default: 0 },
                    timeOnTask: { type: Number, default: 0 },
                },
                { _id: false }
            ),
            default: {},
        },
        preferredMode: { type: String, enum: ["mcq", "fill_blank", "short_answer", "match", "reorder", "mixed"], default: "mixed" },
        lastActiveAt: { type: Date, default: () => new Date() }
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, index: true },
        passwordHash: { type: String, required: true },
        studentId: { type: String, index: true, sparse: true },
        role: { type: String, enum: ["student", "instructor", "admin"], default: "student" },
        learnerProfile: { type: learnerProfileSchema, default: () => ({}) },
        proctorConsent: { type: Boolean, default: false },
        lockedSubjects: { type: [String], default: [] },
        themePreference: { type: String, enum: ["light", "dark", "system"], default: "system" },
        enrolledSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: [] }],
        preferences: {
            quizMode: { type: String, enum: ["mcq", "fill_blank", "short_answer", "mixed"], default: "mixed" },
            difficulty: { type: String, enum: ["easy", "medium", "hard", "adaptive"], default: "adaptive" },
            dailyGoal: { type: Number, min: 1, max: 50, default: 5 },
            notifications: { type: Boolean, default: true },
        }
    },
    { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export default User;
