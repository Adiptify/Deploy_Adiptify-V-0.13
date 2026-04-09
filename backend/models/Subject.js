import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true, index: true },
        description: { type: String, default: "" },
        domainCategory: { type: String, default: "General" },
        learningOutcomes: { type: [String], default: [] },
        type: { type: String, enum: ['general', 'organization'], default: 'general' },
        organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
        status: { type: String, enum: ['pending_validation', 'active'], default: 'active' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        cachedGraph: { type: mongoose.Schema.Types.Mixed, default: null },
        icon: { type: String, default: "📚" },
        color: { type: String, default: "emerald" },
        topics: { type: [String], default: [] },
        category: { type: String, default: "General" },
        isDefault: { type: Boolean, default: false },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

// Auto-generate slug from name if not provided
subjectSchema.pre("validate", function (next) {
    if (!this.slug && this.name) {
        let generatedSlug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Append random string to prevent duplicates
        if (this.isNew) {
            generatedSlug += "-" + Math.random().toString(36).substring(2, 7);
        }

        this.slug = generatedSlug;
    }
    next();
});

export const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;
