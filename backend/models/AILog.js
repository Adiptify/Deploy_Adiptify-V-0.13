import mongoose from "mongoose";

const aiLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userName: { type: String },
    role: { type: String },
    endpoint: { type: String },
    params: { type: Object },
    status: { type: String },
    error: { type: String },
    tokens: { type: Number },
    model: { type: String },
    request: { type: String },
    response: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

aiLogSchema.index({ userId: 1, endpoint: 1, timestamp: -1 });

export const AILog = mongoose.model("AILog", aiLogSchema);
export default AILog;
