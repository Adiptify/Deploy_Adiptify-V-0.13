import mongoose from "mongoose";

const chatSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null },
    title: { type: String, default: "New Conversation" },
    status: { type: String, enum: ["active", "archived"], default: "active" }
}, { timestamps: true });

export const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
export default ChatSession;
