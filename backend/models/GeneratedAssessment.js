import mongoose from "mongoose";

const generatedAssessmentSchema = new mongoose.Schema(
    {
        topic: { type: String, required: true },
        title: { type: String, required: true },
        items: { type: Array, default: [] },
        rawResponse: { type: mongoose.Schema.Types.Mixed },
        validated: { type: Boolean, default: false },
        status: { type: String, enum: ["draft", "published", "failed"], default: "draft" },
        linkedItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        publishedAt: { type: Date },
        publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        proctored: { type: Boolean, default: false },
        proctorConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

generatedAssessmentSchema.index({ topic: 1, status: 1 });
generatedAssessmentSchema.index({ createdBy: 1 });

export const GeneratedAssessment = mongoose.model("GeneratedAssessment", generatedAssessmentSchema);
export default GeneratedAssessment;
