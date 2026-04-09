import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
    {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
        syllabusNodeId: { type: mongoose.Schema.Types.ObjectId }, // Can point to a module or topic inside Syllabus
        type: { type: String, enum: ['pdf', 'pptx', 'video', 'structured_text', 'url', 'ai_generated', 'study-notes', 'full-study-notes'], required: true },
        learningLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Proficient'], default: 'Beginner' },
        dataUrl: { type: String },
        contentBody: { type: String },
        // Stores raw PPT slide JSON from pptxtojson for future study module rendering
        slideData: { type: mongoose.Schema.Types.Mixed, default: null },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

export const Content = mongoose.model("Content", contentSchema);
export default Content;

