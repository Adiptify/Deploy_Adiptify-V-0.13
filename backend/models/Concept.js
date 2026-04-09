import mongoose from "mongoose";

const practiceQuestionSchema = new mongoose.Schema(
    {
        question: { type: String, required: true },
        options: [{ type: String }],
        correctAnswer: { type: Number, default: 0 },
        explanation: { type: String, default: "" },
        difficulty: { type: Number, min: 1, max: 5, default: 2 },
    },
    { _id: false }
);

const conceptPipelineSchema = new mongoose.Schema(
    {
        explanation: { type: String, default: "" },
        demonstration: { type: String, default: "" },
        practiceQuestions: [practiceQuestionSchema],
        applicationTask: { type: String, default: "" },
        evaluationCriteria: { type: String, default: "" },
    },
    { _id: false }
);

const conceptSchema = new mongoose.Schema(
    {
        conceptId: { type: String, required: true, unique: true, index: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        category: { type: String, default: "General" },
        difficulty_level: { type: Number, min: 1, max: 5, default: 2 },
        prerequisites: [{ type: String }],
        tags: [{ type: String }],
        pipeline: { type: conceptPipelineSchema, default: () => ({}) },
    },
    { timestamps: true }
);

export const Concept = mongoose.model("Concept", conceptSchema);
export default Concept;
