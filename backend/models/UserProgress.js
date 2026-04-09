import mongoose from "mongoose";

const userProgressSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        conceptId: { type: String, required: true, index: true },

        // Mastery components
        mastery_score: { type: Number, default: 0, min: 0, max: 1 },
        concept_accuracy: { type: Number, default: 0 },
        application_score: { type: Number, default: 0 },
        retention_score: { type: Number, default: 0 },

        // Performance signals
        accuracy_rate: { type: Number, default: 0 },
        total_correct: { type: Number, default: 0 },
        total_questions: { type: Number, default: 0 },
        attempt_count: { type: Number, default: 0 },
        hint_usage: { type: Number, default: 0 },
        total_time_spent: { type: Number, default: 0 }, // ms

        // Cognitive load
        cognitive_load: { type: Number, default: 0 },

        // Pipeline progress (0-4: explanation, demo, practice, application, evaluation)
        pipeline_stage: { type: Number, default: 0, min: 0, max: 4 },
        pipeline_completed: { type: Boolean, default: false },

        // Review scheduling
        last_review_date: { type: Date },
        next_review_date: { type: Date },

        // Adaptive difficulty recommendation (1-5)
        recommended_difficulty: { type: Number, default: 2, min: 1, max: 5 },
    },
    { timestamps: true }
);

userProgressSchema.index({ userId: 1, conceptId: 1 }, { unique: true });

export const UserProgress = mongoose.model("UserProgress", userProgressSchema);
export default UserProgress;
