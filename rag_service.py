import os
import json
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import FileSearchTool, ToolResources, FileSearchToolResource

class RagService:
    def __init__(self):
        """
        Initialize the AIProjectClient. 
        Requires AZURE_AI_PROJECT_ENDPOINT and AZURE_AI_MODEL_DEPLOYMENT_NAME in environment.
        """
        endpoint = os.environ.get("AZURE_AI_PROJECT_ENDPOINT")
        if not endpoint:
            raise ValueError("AZURE_AI_PROJECT_ENDPOINT environment variable is required.")
        
        self.model_deployment = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")
        
        self.client = AIProjectClient(
            endpoint=endpoint,
            credential=DefaultAzureCredential(),
        )
        
        # In a real application, you would store this mapping in a database.
        # Format: { "user_id": { "subject": "vector_store_id" } }
        self.vector_store_mapping_file = "vector_stores.json"
        self._load_mappings()

        # Shared base agent for our RAG context.
        # We can either create a new agent per context or use one agent and attach the vector store to the thread.
        # Attaching to the thread is generally more efficient for user-specific sessions.
        self.agent = self._get_or_create_base_agent()

    def _load_mappings(self):
        if os.path.exists(self.vector_store_mapping_file):
            with open(self.vector_store_mapping_file, "r") as f:
                self.mappings = json.load(f)
        else:
            self.mappings = {}

    def _save_mappings(self):
        with open(self.vector_store_mapping_file, "w") as f:
            json.dump(self.mappings, f, indent=4)

    def _get_or_create_base_agent(self):
        # We create a generic agent with the FileSearchTool enabled.
        # We will pass the specific vector store per thread later.
        file_search_tool = FileSearchTool()
        
        return self.client.agents.create_agent(
            model=self.model_deployment,
            name="Subject_RAG_Tutor",
            instructions="You are an adaptive learning tutor. You have access to specific subject materials via your file search tool. ALWAYS use the provided file search tool to answer questions based on the student's context.",
            tools=[file_search_tool.definitions[0]]
        )

    def get_or_create_vector_store(self, user_id: str, subject: str) -> str:
        """
        Get existing or create a new vector store for a specific user and subject.
        """
        if user_id not in self.mappings:
            self.mappings[user_id] = {}
            
        if subject in self.mappings[user_id]:
            return self.mappings[user_id][subject]
            
        # Create a new vector store
        store_name = f"vs_{user_id}_{subject}".replace(" ", "_")
        
        # NOTE: azure.ai.projects vector store creation is accessed via agents.vector_stores
        vector_store = self.client.agents.vector_stores.create(name=store_name)
        
        self.mappings[user_id][subject] = vector_store.id
        self._save_mappings()
        
        return vector_store.id

    def upload_document_to_context(self, user_id: str, subject: str, file_path: str):
        """
        Uploads a document to the specific user+subject RAG context.
        """
        vs_id = self.get_or_create_vector_store(user_id, subject)
        
        print(f"Uploading {file_path} to vector store {vs_id} for User: {user_id}, Subject: {subject}...")
        
        # Upload the file to the project
        uploaded_file = self.client.agents.files.upload(
            file=file_path,
            purpose="agents"
        )
        
        # Attach the file to the vector store
        self.client.agents.vector_stores.files.create(
            vector_store_id=vs_id,
            file_id=uploaded_file.id
        )
        
        print("Upload and attachment complete.")

    def create_chat_session(self, user_id: str, subject: str):
        """
        Create a thread that is bound to the user's specific subject vector store.
        """
        vs_id = self.get_or_create_vector_store(user_id, subject)
        
        # Create ToolResources for the thread tying it to the vector store
        file_search_resource = FileSearchToolResource(vector_store_ids=[vs_id])
        tool_resources = ToolResources(file_search=file_search_resource)
        
        thread = self.client.agents.threads.create(
            tool_resources=tool_resources
        )
        return thread.id

    def chat(self, thread_id: str, message: str):
        """
        Send a message in the session and wait for the response.
        """
        # Add the user message
        self.client.agents.messages.create(
            thread_id=thread_id,
            role="user",
            content=message
        )
        
        # Process the run
        run = self.client.agents.runs.create_and_process(
            thread_id=thread_id,
            agent_id=self.agent.id
        )
        
        if run.status == "completed":
            messages = self.client.agents.messages.list(thread_id=thread_id)
            # The latest assistant message is usually the first in the reversed list or index 0 depending on the SDK list ordering
            for msg in messages:
                if msg.role == "assistant":
                    return msg.content[0].text.value
        elif run.status == "failed":
            return f"Run failed: {run.last_error}"
        else:
            return f"Run ended with status: {run.status}"

if __name__ == "__main__":
    # Example usage:
    # os.environ["AZURE_AI_PROJECT_ENDPOINT"] = "https://<your-project>.services.ai.azure.com/api/projects/<your-project-name>"
    # os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"] = "gpt-4o-mini"
    
    # service = RagService()
    # service.upload_document_to_context("user_123", "Physics", "physics_chapter1.pdf")
    # session_id = service.create_chat_session("user_123", "Physics")
    # response = service.chat(session_id, "What are the key concepts in Chapter 1?")
    # print(response)
    pass
