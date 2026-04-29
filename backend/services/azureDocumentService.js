import DocumentIntelligence, { isUnexpected, getLongRunningPoller } from "@azure-rest/ai-document-intelligence";
import { DefaultAzureCredential } from "@azure/identity";

/**
 * Initializes the Azure Document Intelligence client.
 * Uses API key if DOCUMENT_INTELLIGENCE_API_KEY is present,
 * otherwise falls back to DefaultAzureCredential.
 */
function getClient() {
    const endpoint = process.env.DOCUMENT_INTELLIGENCE_ENDPOINT;
    if (!endpoint) {
        throw new Error("DOCUMENT_INTELLIGENCE_ENDPOINT environment variable is missing.");
    }

    const key = process.env.DOCUMENT_INTELLIGENCE_API_KEY;
    if (key) {
        return DocumentIntelligence(endpoint, { key });
    } else {
        return DocumentIntelligence(endpoint, new DefaultAzureCredential());
    }
}

/**
 * Parses a document buffer using Azure Document Intelligence (prebuilt-layout).
 * Returns the extracted plain text, concatenated from all pages and tables.
 * 
 * @param {Buffer} buffer The file buffer (PDF, DOCX, PPTX, JPG, PNG, etc.)
 * @param {string} modelId The model to use (default: 'prebuilt-layout')
 * @returns {Promise<string>} The extracted text.
 */
export async function parseDocumentFromBuffer(buffer, modelId = "prebuilt-layout") {
    const client = getClient();
    
    const base64Source = buffer.toString("base64");

    const initialResponse = await client
        .path("/documentModels/{modelId}:analyze", modelId)
        .post({
            contentType: "application/json",
            body: { base64Source },
            queryParameters: { locale: "en-US" }
        });

    if (isUnexpected(initialResponse)) {
        throw new Error(`Azure Document Intelligence error: ${initialResponse.body?.error?.message || 'Unknown error'}`);
    }

    const poller = getLongRunningPoller(client, initialResponse);
    const result = (await poller.pollUntilDone()).body;

    return extractTextFromResult(result);
}

/**
 * Helper to extract concatenated plain text from the AnalyzeOperationOutput.
 */
function extractTextFromResult(result) {
    let extractedText = "";

    const pages = result.analyzeResult?.pages || [];
    for (const page of pages) {
        for (const line of (page.lines || [])) {
            extractedText += `${line.content}\n`;
        }
        extractedText += "\n";
    }

    // Optional: process tables specifically if you want them formatted.
    // For now, the prebuilt-layout's lines usually capture the table text linearly,
    // but we could also append table cells explicitly if needed.
    
    return extractedText.trim();
}

/**
 * Splits the extracted text into chunks of specified word length.
 */
export function chunkAzureText(text, targetWords = 500, overlapWords = 50) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    
    for (let i = 0; i < words.length; i += (targetWords - overlapWords)) {
        const chunk = words.slice(i, i + targetWords).join(" ");
        if (chunk.trim()) {
            chunks.push(chunk);
        }
    }
    return chunks;
}
