import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    topics: [{
        title: { type: String, required: true },
        description: { type: String }
    }]
});

const syllabusSchema = new mongoose.Schema(
    {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
        modules: [moduleSchema],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

export const Syllabus = mongoose.model("Syllabus", syllabusSchema);
export default Syllabus;
