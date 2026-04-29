import { SearchIndexClient, SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { DefaultAzureCredential } from "@azure/identity";

const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
const apiKey = process.env.AZURE_SEARCH_API_KEY;
const indexName = process.env.AZURE_SEARCH_INDEX_NAME || "rag-context-index";

let credential;
if (apiKey) {
    credential = new AzureKeyCredential(apiKey);
} else {
    credential = new DefaultAzureCredential();
}

const indexClient = endpoint ? new SearchIndexClient(endpoint, credential) : null;
const searchClient = endpoint ? new SearchClient(endpoint, indexName, credential) : null;

export async function uploadContext(userId, subjectName, textChunks, getEmbeddingFunc) {
    if (!searchClient) {
        console.log("[Azure Search] Search client not configured, skipping upload.");
        return;
    }
    const documents = [];
    for (const chunk of textChunks) {
        const embedding = await getEmbeddingFunc(chunk);
        documents.push({
            id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            user_id: userId.toString(),
            subject: subjectName,
            content: chunk,
            content_vector: embedding
        });
    }

    console.log(`[Azure Search] Uploading ${documents.length} chunks for User: ${userId}, Subject: ${subjectName}...`);
    try {
        const result = await searchClient.uploadDocuments(documents);
        console.log(`[Azure Search] Upload complete. Processed ${result.results.length} records.`);
    } catch (e) {
        console.error("[Azure Search] Failed to upload documents:", e.message);
    }
}

export async function fetchPerfectContext(userId, subjectName, queryText, queryVector, topK = 5) {
    if (!searchClient) {
        console.log("[Azure Search] Search client not configured, skipping fetch.");
        return [];
    }

    const filter = `user_id eq '${userId}' and subject eq '${subjectName}'`;

    try {
        const searchResults = await searchClient.search(queryText, {
            filter: filter,
            vectorQueries: [{
                kind: "vector",
                vector: queryVector,
                kNearestNeighborsCount: topK,
                fields: ["content_vector"]
            }],
            queryType: "semantic",
            semanticSearchOptions: {
                configurationName: "default-semantic-config"
            },
            select: ["id", "content", "subject"],
            top: topK
        });

        const extractedContexts = [];
        for await (const result of searchResults.results) {
            extractedContexts.push({
                id: result.document.id,
                content: result.document.content,
                score: result.score
            });
        }
        return extractedContexts;
    } catch (e) {
        console.error("[Azure Search] Fetch context error:", e.message);
        return [];
    }
}
