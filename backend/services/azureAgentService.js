import { AIProjectClient, ToolSet } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import fs from "fs";

let projectClient = null;

const endpoint = process.env.AZURE_AI_PROJECT_ENDPOINT;
if (endpoint) {
    projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
}

// In-memory mappings (for demo; in production use MongoDB)
const vectorStoreMappings = {};

export async function getOrCreateVectorStore(userId, subject) {
    if (!projectClient) return null;
    const key = `${userId}_${subject}`;
    if (vectorStoreMappings[key]) {
        return vectorStoreMappings[key];
    }
    
    const storeName = `vs_${userId}_${subject}`.replace(/ /g, "_");
    try {
        const vectorStore = await projectClient.agents.createVectorStore({ name: storeName });
        vectorStoreMappings[key] = vectorStore.id;
        return vectorStore.id;
    } catch (e) {
        console.error("Failed to create vector store", e);
        return null;
    }
}

export async function uploadDocumentToContext(userId, subject, filePath) {
    if (!projectClient) return;
    const vsId = await getOrCreateVectorStore(userId, subject);
    if (!vsId) return;

    try {
        console.log(`[Azure AI] Uploading ${filePath} to vector store ${vsId}...`);
        const file = await projectClient.agents.uploadFile(fs.createReadStream(filePath), "agents");
        await projectClient.agents.createVectorStoreFile(vsId, file.id);
        console.log(`[Azure AI] Upload and attachment complete.`);
    } catch (e) {
        console.error("Failed to upload document to Azure AI", e);
    }
}

export async function chatWithRAG(userId, subject, message) {
    if (!projectClient) return "Azure AI Project not configured.";
    const vsId = await getOrCreateVectorStore(userId, subject);
    
    try {
        const toolSet = new ToolSet();
        toolSet.addFileSearchTool([vsId]);

        const agent = await projectClient.agents.createAgent({
            model: process.env.AZURE_AI_MODEL_DEPLOYMENT_NAME || "gpt-4o-mini",
            name: "Subject_RAG_Tutor",
            instructions: "You are an adaptive learning tutor. You have access to specific subject materials via your file search tool. ALWAYS use the provided file search tool to answer questions based on the student's context.",
            tools: toolSet.toolDefinitions
        });

        const thread = await projectClient.agents.createThread({ toolResources: toolSet.toolResources });
        await projectClient.agents.createMessage(thread.id, { role: "user", content: message });
        
        const run = await projectClient.agents.createRun(thread.id, agent.id);
        
        let runStatus = await projectClient.agents.getRun(thread.id, run.id);
        while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && runStatus.status !== 'cancelled') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await projectClient.agents.getRun(thread.id, run.id);
        }

        if (runStatus.status === 'completed') {
            const messages = await projectClient.agents.listMessages(thread.id);
            const assistantMsg = messages.data.find(m => m.role === 'assistant');
            return assistantMsg?.content[0]?.text?.value || "No response generated.";
        } else {
            return `Run ended with status: ${runStatus.status}`;
        }
    } catch (e) {
        console.error("Agent chat failed", e);
        return "Chat failed due to an internal error.";
    }
}
