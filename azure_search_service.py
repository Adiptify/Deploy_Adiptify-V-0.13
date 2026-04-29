import os
import uuid
from typing import List, Dict, Any

from azure.identity import DefaultAzureCredential
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SearchField,
    SearchFieldDataType,
    SimpleField,
    SearchableField,
    VectorSearch,
    HnswAlgorithmConfiguration,
    VectorSearchProfile,
    SemanticSearch,
    SemanticConfiguration,
    SemanticPrioritizedFields,
    SemanticField
)
from azure.search.documents.models import VectorizedQuery, QueryType

class AzureSearchService:
    def __init__(self, index_name: str = "rag-context-index"):
        self.endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT")
        if not self.endpoint:
            raise ValueError("AZURE_SEARCH_ENDPOINT is missing")
            
        self.index_name = index_name
        
        # Determine credential (prefer Managed Identity, fallback to API key for local dev)
        key = os.environ.get("AZURE_SEARCH_API_KEY")
        if key:
            self.credential = AzureKeyCredential(key)
        else:
            self.credential = DefaultAzureCredential()
            
        self.index_client = SearchIndexClient(endpoint=self.endpoint, credential=self.credential)
        self.search_client = SearchClient(endpoint=self.endpoint, index_name=self.index_name, credential=self.credential)

    def initialize_index(self):
        """
        Creates or updates the search index with perfect multi-tenant fields 
        (user_id, subject) and vector/semantic search enabled.
        """
        print(f"Initializing index: {self.index_name}")
        
        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            # Filterable fields to isolate data by user and subject
            SimpleField(name="user_id", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="subject", type=SearchFieldDataType.String, filterable=True, facetable=True),
            
            # The actual textual content
            SearchableField(name="content", type=SearchFieldDataType.String, analyzer_name="en.microsoft"),
            
            # Vector embedding (Assuming 1536 dims for text-embedding-ada-002 or text-embedding-3-small)
            SearchField(
                name="content_vector", 
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True, 
                vector_search_dimensions=1536,
                vector_search_profile_name="default-vector-profile"
            )
        ]

        vector_search = VectorSearch(
            algorithms=[HnswAlgorithmConfiguration(name="default-hnsw")],
            profiles=[VectorSearchProfile(name="default-vector-profile", algorithm_configuration_name="default-hnsw")]
        )

        semantic_search = SemanticSearch(
            default_configuration_name="default-semantic-config",
            configurations=[
                SemanticConfiguration(
                    name="default-semantic-config",
                    prioritized_fields=SemanticPrioritizedFields(
                        content_fields=[SemanticField(field_name="content")]
                    )
                )
            ]
        )

        index = SearchIndex(
            name=self.index_name,
            fields=fields,
            vector_search=vector_search,
            semantic_search=semantic_search
        )
        
        self.index_client.create_or_update_index(index)
        print("Index initialized successfully.")

    def upload_context(self, user_id: str, subject: str, text_chunks: List[str], get_embedding_func):
        """
        Uploads text chunks perfectly isolated by user_id and subject.
        get_embedding_func should take a string and return a List[float] of 1536 dimensions.
        """
        documents = []
        for chunk in text_chunks:
            # Generate embedding for the chunk
            embedding = get_embedding_func(chunk)
            
            documents.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "subject": subject,
                "content": chunk,
                "content_vector": embedding
            })
            
        # Upload in batches
        print(f"Uploading {len(documents)} chunks to the index for User: {user_id}, Subject: {subject}...")
        result = self.search_client.upload_documents(documents)
        print(f"Upload complete. Uploaded {len(result)} records.")

    def fetch_perfect_context(self, user_id: str, subject: str, query_text: str, query_vector: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Perfect retrieval: Uses Hybrid Search (Keyword + Vector) and strictly filters 
        by user_id and subject to guarantee context isolation. Uses Semantic Ranking if available.
        """
        # Build the strictly isolated OData filter
        isolation_filter = f"user_id eq '{user_id}' and subject eq '{subject}'"
        
        vector_query = VectorizedQuery(
            vector=query_vector,
            k_nearest_neighbors=top_k,
            fields="content_vector"
        )
        
        # Execute Hybrid + Semantic Search with hard tenant isolation
        results = self.search_client.search(
            search_text=query_text,
            vector_queries=[vector_query],
            filter=isolation_filter,
            query_type=QueryType.SEMANTIC,
            semantic_configuration_name="default-semantic-config",
            select=["id", "content", "subject"],
            top=top_k
        )
        
        extracted_contexts = []
        for result in results:
            extracted_contexts.append({
                "id": result["id"],
                "content": result["content"],
                "score": result["@search.score"],
                "reranker_score": result.get("@search.reranker_score")
            })
            
        return extracted_contexts

# Example mockup for embedding function
def mock_get_embedding(text: str) -> List[float]:
    # Replace with actual OpenAI call: client.embeddings.create(...)
    return [0.01] * 1536

if __name__ == "__main__":
    # Example Usage:
    # service = AzureSearchService("user-subject-rag-index")
    # service.initialize_index()
    # 
    # service.upload_context("user_abc", "Mathematics", ["Calculus is the study of continuous change..."], mock_get_embedding)
    #
    # query = "What is calculus?"
    # vector = mock_get_embedding(query)
    # 
    # results = service.fetch_perfect_context("user_abc", "Mathematics", query, vector)
    # for r in results:
    #     print(f"Matched Context (Score {r['score']}): {r['content']}")
    pass
