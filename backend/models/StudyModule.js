import mongoose from "mongoose";

const studyModuleSchema = new mongoose.Schema(
    {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
        syllabusNodeId: { type: mongoose.Schema.Types.ObjectId }, // Associated syllabus topic
        learningLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Proficient'], default: 'Beginner' },
        conceptContent: { type: String, required: true },
        application: { type: String },
        systemExplanation: { type: String },
        visualizationRef: { type: mongoose.Schema.Types.ObjectId, ref: "Graph" }, // Optional specific graph if not using Subject's cachedGraph
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

export const StudyModule = mongoose.model("StudyModule", studyModuleSchema);
export default StudyModule;
