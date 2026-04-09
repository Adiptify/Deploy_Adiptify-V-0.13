import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatSession", required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    content: { type: String, required: true },
    graphData: { type: Object, default: null }
}, { timestamps: true });

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
export default ChatMessage;
