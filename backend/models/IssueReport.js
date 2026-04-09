import mongoose from "mongoose";

const issueReportSchema = new mongoose.Schema({
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userName: { type: String },
    role: { type: String, enum: ["student", "instructor", "admin"] },
    panel: { type: String },
    section: { type: String },
    summary: { type: String },
    details: { type: String },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    adminResponse: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

issueReportSchema.index({ reportedBy: 1, status: 1, createdAt: -1 });

export const IssueReport = mongoose.model("IssueReport", issueReportSchema);
export default IssueReport;
