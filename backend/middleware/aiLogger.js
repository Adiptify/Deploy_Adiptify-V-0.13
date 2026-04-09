import AILog from "../models/AILog.js";

export async function logAI({ userId, userName, role, endpoint, params, status, error, tokens, model, request, response }) {
    try {
        await AILog.create({
            userId, userName, role, endpoint, params,
            status: status || "success",
            error: error || "",
            tokens: tokens || 0,
            model: model || "",
            request: typeof request === "string" ? request : JSON.stringify(request),
            response: typeof response === "string" ? response : JSON.stringify(response),
        });
    } catch (e) {
        console.error("AI Log save error:", e.message);
    }
}
