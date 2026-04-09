import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        conceptId: { type: String, required: true, index: true },

        // SM-2 state
        easiness_factor: { type: Number, default: 2.5 },
        interval: { type: Number, default: 0 },     // days
        repetition: { type: Number, default: 0 },

        // Last recall quality (0-5)
        quality_score: { type: Number, default: 0, min: 0, max: 5 },

        // Scheduling
        next_review: { type: Date, default: () => new Date() },
        last_review: { type: Date },

        // History of quality scores
        history: [
            {
                quality: { type: Number, min: 0, max: 5 },
                date: { type: Date, default: () => new Date() },
                interval: { type: Number },
            },
        ],
    },
    { timestamps: true }
);

reviewSchema.index({ userId: 1, conceptId: 1 }, { unique: true });
reviewSchema.index({ userId: 1, next_review: 1 });

export const Review = mongoose.model("Review", reviewSchema);
export default Review;
