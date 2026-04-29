# Project Full Context and Source Code

## File: `.gitignore`

```
node_modules
.env
dist
```

## File: `azure_search_service.py`

```py
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
```

## File: `generate_context.py`

```py
import os

root_dir = r"c:\Users\kradi\Projects\GEN_AI\Project_2"
output_file = r"c:\Users\kradi\Projects\GEN_AI\Project_2\Project_Full_Context.md"

exclude_dirs = {'.git', '.github', 'node_modules', 'dist', 'build', '.vscode', 'coverage', '__pycache__', '.venv', 'venv', 'env'}
exclude_files = {'.DS_Store', 'package-lock.json', 'yarn.lock', 'Adiptify_Copyright_Registration.md', 'Project_Full_Context.md'}

allowed_extensions = {
    '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss', 
    '.md', '.py', '.java', '.yml', '.yaml', '.sh', '.xml', '.env.example', '.env'
}

with open(output_file, 'w', encoding='utf-8') as outfile:
    outfile.write("# Project Full Context and Source Code\n\n")
    
    for subdir, dirs, files in os.walk(root_dir):
        # Modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file in exclude_files:
                continue
                
            ext = os.path.splitext(file)[1].lower()
            if ext not in allowed_extensions and file != '.env' and file != '.gitignore' and file != 'Dockerfile':
                continue
                
            filepath = os.path.join(subdir, file)
            rel_path = os.path.relpath(filepath, root_dir)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as infile:
                    content = infile.read()
                    
                    outfile.write(f"## File: `{rel_path}`\n\n")
                    # Use standard markdown code block, try to guess language from extension
                    lang = ext.replace('.', '')
                    if not lang and file == '.env':
                        lang = 'bash'
                    elif not lang and file == 'Dockerfile':
                        lang = 'dockerfile'
                    
                    outfile.write(f"```{lang}\n")
                    outfile.write(content)
                    if not content.endswith('\n'):
                        outfile.write('\n')
                    outfile.write("```\n\n")
            except Exception as e:
                outfile.write(f"## File: `{rel_path}`\n\n")
                outfile.write(f"*Could not read file contents: {e}*\n\n")

print("Context generation complete.")
```

## File: `rag_service.py`

```py
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
```

## File: `Readme.md`

```md
# Adiptify

An AI-driven Adaptive Learning Platform that leverages large language models (via Ollama) and knowledge graphs to create dynamic, personalized learning pathways.

## 🚀 Features

- **Adaptive Learning Paths:** Generates personalized study modules based on individual progress and syllabus content.
- **Mastery Dashboard:** Track knowledge acquisition and conceptual mastery.
- **AI Graph System:** Visualizes learning concepts and their relationships using React Flow and Dagre.
- **Intelligent Content Processing:** Extracts and structure learning materials from PDFs, PPTs, and text.
- **Leaderboards & Analytics:** Gamified learning experience with real-time analytics.

## 🏗 System Architecture

Adiptify is broken into three main subsystems:

### 1. Frontend
A modern, responsive user interface built using **React** and **Vite**.
- **UI Frameworks:** Tailwind CSS, Material-UI (MUI), Emotion.
- **Icons & Visualization:** Lucide React, Framer Motion, React Flow for dynamic UI components.
- **Routing & State:** React Router DOM.

### 2. Backend
A robust Node.js backend to manage API requests, database interactions, and AI processing.
- **Framework:** Express.js.
- **Database:** MongoDB (via Mongoose).
- **Authentication:** JWT, Bcrypt.
- **AI Integration:** Ollama (for generating insights, graphs, and adaptive learning flows).
- **File Processing:** Multer, pdf-parse, pptxtojson, jszip.

### 3. AI Graph System
A dedicated visualization environment that interacts with AI models to present complex learning interactions as a graph system.
- **Tech Stack:** React, Vite, React Flow, Dagre.
- **AI Interface:** Directly integrated with Ollama for node/edge generation.

## ⚙️ Setup & Installation

Before you begin, ensure you have **Node.js** and **MongoDB** installed on your system. You will also need [Ollama](https://ollama.ai/) installed and running locally for the generative AI features.

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```

### AI Graph System Setup
```bash
cd ai-graph-system
npm install
npm run dev
```

## 👨‍💻 Developer Information

- **Developer:** Kumar Aditya
- **Project Name:** Adiptify
- **Version:** 0.13

---
*Empowering education through AI and adaptive architectures.*
```

## File: `startup.sh`

```sh
#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Adiptify — Azure App Service Startup Script
# This runs after the deployment completes on Azure App Service
# ═══════════════════════════════════════════════════════════

set -e

echo "=== Adiptify Azure Startup ==="
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 1. Install backend dependencies
echo "=== Installing backend dependencies ==="
cd /home/site/wwwroot/backend
npm install --production

# 2. Build frontend (if dist/ doesn't exist yet)
if [ ! -f "/home/site/wwwroot/Frontend/dist/index.html" ]; then
    echo "=== Building frontend ==="
    cd /home/site/wwwroot/Frontend
    npm install
    npm run build
else
    echo "=== Frontend already built, skipping ==="
fi

# 3. Start the backend server (which also serves the frontend)
echo "=== Starting Adiptify server ==="
cd /home/site/wwwroot/backend
node app.js
```

## File: `ai-graph-system\.gitignore`

```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

## File: `ai-graph-system\eslint.config.js`

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
```

## File: `ai-graph-system\index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ai-graph-system</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

## File: `ai-graph-system\package.json`

```json
{
  "name": "ai-graph-system",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "dagre": "^0.8.5",
    "lucide-react": "^0.575.0",
    "ollama": "^0.6.3",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "reactflow": "^11.11.4"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "vite": "^7.3.1"
  }
}
```

## File: `ai-graph-system\README.md`

```md
<p align="center">
  <img src="assets/hero-preview.png" alt="AI Mind Map Generator" width="800"/>
</p>

<h1 align="center">🧠 AI Mind Map Generator</h1>

<p align="center">
  <strong>An interactive, AI-powered knowledge graph explorer built with React Flow + Ollama</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/React_Flow-11-FF0072?logo=reactflow&logoColor=white" />
  <img src="https://img.shields.io/badge/Dagre-Layout-orange" />
  <img src="https://img.shields.io/badge/Ollama-LLM-green?logo=ollama" />
</p>

---

## ✨ Overview

**AI Mind Map Generator** transforms any topic into a beautiful, interactive hierarchical knowledge map. Type in a subject — *Physics*, *Machine Learning*, *Web Architecture* — and the AI instantly generates a structured, multi-level mind map that you can explore, expand, collapse, and organize.

The system uses a **local LLM** (via Ollama) to recursively generate structured knowledge, and renders it as an infinite-canvas graph with smooth animations, focus modes, and context menus.

---

## 🎯 Key Features

| Feature | Description |
|---|---|
| **🤖 AI-Powered Generation** | Instantly generates multi-level knowledge trees from any topic using Ollama LLM |
| **🌳 Hierarchical Layout** | Clean Left-to-Right tree layout powered by Dagre with automatic parent centering |
| **🔄 Expand & Collapse** | Click to reveal or hide branches with smooth CSS-animated transitions |
| **📷 Smart Camera** | Auto-frames parent + children when expanding; zooms to fit the active branch |
| **🔍 Focus Mode** | Click any node to highlight its ancestry path while dimming unrelated branches |
| **📋 Context Menu** | Right-click nodes to expand, edit labels, explain, or delete entire branches |
| **💾 Persistent Memory** | Graph state auto-saves to localStorage and cleanly restores on refresh |
| **🎨 Glassmorphism UI** | Premium dark theme with animated edges, glow effects, and hover tooltips |
| **🫥 Auto-Hide Header** | Search bar slides away during graph interaction; reappears on top-edge hover |

---

## 🏗️ Architecture

```
ai-graph-system/
├── src/
│   ├── App.jsx              # Main application — state management, graph logic, UI
│   ├── App.css              # Complete design system — glassmorphism, animations, focus mode
│   ├── layoutEngine.js      # Dagre-powered horizontal tree layout with visibility-aware positioning
│   ├── llmService.js        # Ollama LLM integration — structured JSON prompts for knowledge generation
│   ├── components/
│   │   └── CustomNode.jsx   # Custom React Flow node — handles, labels, toggle/expand buttons
│   ├── main.jsx             # React entry point with ReactFlowProvider
│   └── index.css            # Base styles
├── assets/
│   └── hero-preview.png     # Project preview image
├── package.json
└── vite.config.js
```

### Core Modules

| Module | Responsibility |
|---|---|
| `App.jsx` | Orchestrates the graph state, collapse/expand logic, context menus, focus mode, camera framing, and localStorage persistence |
| `layoutEngine.js` | Wraps Dagre's hierarchical layout algorithm. Filters visible nodes, computes positions, and snaps hidden nodes to their nearest visible ancestor for smooth animations |
| `llmService.js` | Sends structured prompts to Ollama's local API. Generates Root → Level 1 → Level 2 knowledge hierarchies in a single request, with recursive expansion support |
| `CustomNode.jsx` | Renders interactive node cards with expand (➕) / collapse (▶/▼) buttons, hover descriptions, and left/right connection handles |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Ollama** running locally with a model installed

```bash
# Install and start Ollama (if not already)
# https://ollama.com/download
ollama pull llama3.2
ollama serve
```

### Installation

```bash
# Clone the repository
git clone https://github.com/Adiptify/AI_Mind_Map_Generator.git
cd AI_Mind_Map_Generator

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at **http://localhost:5173**

---

## 🎮 Usage

1. **Search** — Type any topic (e.g., *"Quantum Computing"*) in the top search bar and press Enter
2. **Explore** — Click the **▶** chevron on any node to reveal/hide its children
3. **Expand** — Click the **➕** button on leaf nodes to generate deeper sub-topics via AI
4. **Focus** — Click any node to highlight its full ancestry path
5. **Organize** — Drag nodes freely; click **Auto Layout** to re-arrange
6. **Context Menu** — Right-click any node for options: Expand, Edit, Explain, Delete
7. **Clear** — Use the trash icon to reset the entire graph

---

## ⚙️ Configuration

### LLM Model

Edit `src/llmService.js` to change the Ollama model:

```javascript
// Default model
const response = await ollama.chat({
  model: 'llama3.2', // Change to any installed Ollama model
  ...
});
```

### Layout Tuning

Edit `src/layoutEngine.js` to adjust spacing:

```javascript
dagreGraph.setGraph({
  rankdir: 'LR',     // 'LR' = Left-to-Right, 'TB' = Top-to-Bottom
  ranksep: 200,       // Horizontal gap between parent and child
  nodesep: 120,       // Vertical gap between sibling nodes
});
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| [React 19](https://react.dev) | UI framework |
| [React Flow 11](https://reactflow.dev) | Infinite canvas graph rendering |
| [Dagre](https://github.com/dagrejs/dagre) | Hierarchical graph layout algorithm |
| [Ollama](https://ollama.com) | Local LLM inference |
| [Lucide React](https://lucide.dev) | Icon system |
| [Vite 7](https://vite.dev) | Build tool & dev server |

---

## 📄 License

This project is part of the **Adiptify** platform ecosystem.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Adiptify">Adiptify</a>
</p>
```

## File: `ai-graph-system\vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

## File: `ai-graph-system\src\App.css`

```css
:root {
  --bg: #000000;
  --card: #222222;
  --accent: #1DCD9F;
  --accent-glow: rgba(29, 205, 159, 0.5);
  --accent-dark: #169976;
  --text-dim: rgba(255, 255, 255, 0.55);
  --text-light: #ffffff;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text-light);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.glass-header {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: 90%;
  max-width: 900px;
  background: rgba(34, 34, 34, 0.85);
  backdrop-filter: blur(16px);
  padding: 10px 25px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.6);
  transition: opacity 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.4s ease, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.header-hover-zone {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  z-index: 1001;
}

.glass-header.graph-active {
  transform: translate(-50%, -150%);
  opacity: 0;
  pointer-events: none;
}

.header-hover-zone:hover+.glass-header.graph-active,
.glass-header.graph-active:hover,
.glass-header.graph-active:focus-within {
  transform: translate(-50%, 0);
  opacity: 1;
  pointer-events: all;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-family: 'Inter', sans-serif;
  letter-spacing: -0.5px;
  color: #fff;
}

.icon-glow {
  filter: drop-shadow(0 0 8px var(--accent));
  color: var(--accent);
}

.search-box {
  display: flex;
  gap: 12px;
  flex: 1;
  margin: 0 30px;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(29, 205, 159, 0.2);
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-light);
  outline: none;
  font-size: 15px;
}

.search-box button {
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}

.search-box button:hover {
  transform: scale(1.1);
}

/* Custom Node Styles */
.custom-node-wrapper {
  background: var(--card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 14px;
  min-width: 180px;
  max-width: 280px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Level Based Styling */
.node-level-0 {
  min-width: 260px;
  max-width: 350px;
  padding: 18px 22px;
  border-color: var(--accent);
  background: rgba(29, 205, 159, 0.12);
  resize: horizontal;
  overflow: auto;
}

.node-level-0 .node-label {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
}

.node-level-1 {
  min-width: 220px;
  max-width: 300px;
  padding: 14px 18px;
  border-color: rgba(29, 205, 159, 0.4);
  resize: horizontal;
  overflow: auto;
}

.node-level-1 .node-label {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
}

.node-level-2 {
  min-width: 190px;
  max-width: 260px;
  resize: horizontal;
  overflow: auto;
}

.node-level-2 .node-label {
  font-size: 0.95rem;
  font-weight: 500;
}

.node-level-3,
.node-level-4,
.node-level-5,
.node-level-6,
.node-level-7,
.node-level-8,
.node-level-9 {
  min-width: 160px;
  max-width: 220px;
  opacity: 0.9;
  resize: horizontal;
  overflow: auto;
}

.node-level-3 .node-label,
.node-level-4 .node-label,
.node-level-5 .node-label,
.node-level-6 .node-label,
.node-level-7 .node-label,
.node-level-8 .node-label,
.node-level-9 .node-label {
  font-size: 0.85rem;
}

.custom-node-content {
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.root-node {
  border: 2px solid var(--accent);
  box-shadow: 0 0 20px var(--accent-glow);
  background: rgba(34, 34, 34, 0.95);
}

.custom-node-wrapper:hover {
  border-color: var(--accent);
  box-shadow: 0 0 25px rgba(29, 205, 159, 0.3);
  z-index: 5000 !important;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.node-label {
  font-weight: 700;
  font-size: 14px;
  color: #fff;
  flex: 1;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  line-height: 1.3;
}

.node-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.expand-btn {
  color: var(--accent) !important;
  background: rgba(29, 205, 159, 0.1) !important;
  border-color: rgba(29, 205, 159, 0.3) !important;
}

.expand-btn:hover {
  background: var(--accent) !important;
  color: #000 !important;
}

.toggle-btn {
  background: rgba(29, 205, 159, 0.1);
  border: 1px solid rgba(29, 205, 159, 0.3);
  border-radius: 6px;
  color: var(--accent);
  cursor: pointer;
  padding: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
  transform: scale(1.1);
}

/* Pin Button */
.pin-btn {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

.pin-btn:hover {
  background: rgba(29, 205, 159, 0.15) !important;
  color: var(--accent) !important;
}

.pin-btn.pin-active {
  background: var(--accent-dark) !important;
  color: #fff !important;
  border-color: var(--accent-dark) !important;
  box-shadow: 0 0 8px rgba(22, 153, 118, 0.5);
}

.custom-node-wrapper.pinned {
  border-color: rgba(22, 153, 118, 0.5);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4), 0 0 12px rgba(22, 153, 118, 0.2);
}

.hover-info {
  margin-top: 0;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}

.custom-node-wrapper:hover .hover-info {
  margin-top: 10px;
  max-height: 150px;
  opacity: 1;
  overflow-y: auto;
}

/* Pinned state — stays open regardless of hover/cursor */
.hover-info.info-pinned {
  margin-top: 10px !important;
  max-height: 150px !important;
  opacity: 1 !important;
  overflow-y: auto !important;
}

.info-icon {
  color: var(--accent);
  margin-top: 2px;
  flex-shrink: 0;
}

.tooltip-desc {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-dim);
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  cursor: pointer;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.spinning {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.loader-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 40px;
  z-index: 2000;
}

.loader-overlay {
  background: var(--accent-dark);
  color: #fff;
  padding: 12px 24px;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 14px;
  animation: slideUp 0.3s ease-out;
  box-shadow: 0 10px 25px -5px rgba(22, 153, 118, 0.5);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* ReactFlow overrides and animations */
.react-flow__node {
  transition: all 0.3s ease-in-out;
}

.react-flow__node.dragging {
  transition: none !important;
}

.react-flow__handle {
  width: 8px;
  height: 8px;
  background: var(--accent);
  border: 2px solid #000000;
  transition: transform 0.2s;
}

.react-flow__handle:hover {
  transform: scale(1.5);
  background: var(--accent-dark);
}

.react-flow__edge-path {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
  stroke-width: 2.5;
  transition: opacity 0.3s;
}

@keyframes dashdraw {
  from {
    stroke-dashoffset: 10;
  }

  to {
    stroke-dashoffset: 0;
  }
}

.react-flow__controls {
  background: rgba(34, 34, 34, 0.9) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 8px !important;
  overflow: hidden;
}

.react-flow__controls button {
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  fill: #fff !important;
  color: #fff !important;
}

.react-flow__controls button:hover {
  background: rgba(29, 205, 159, 0.1) !important;
}

.react-flow__minimap {
  background: #222222 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px !important;
}

/* Context Menu styling */
.context-menu {
  position: absolute;
  background: var(--card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  padding: 8px;
  z-index: 9999;
  min-width: 160px;
  backdrop-filter: blur(12px);
}

.context-menu button {
  background: transparent;
  border: none;
  color: #fff;
  padding: 10px 14px;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
  font-weight: 500;
}

.context-menu button:hover {
  background: rgba(29, 205, 159, 0.15);
  color: var(--accent);
}

.context-menu .delete-action {
  color: #ef4444;
  margin-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0 0 6px 6px;
}

.context-menu .delete-action:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Focus Mode */
.react-flow__node.active-node .custom-node-wrapper {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(29, 205, 159, 0.7) !important;
  border-color: var(--accent) !important;
}

.react-flow__node.connected-node {
  opacity: 0.7;
}

.react-flow__node.dimmed {
  opacity: 0.1;
  filter: grayscale(100%) blur(1px);
  pointer-events: none;
  z-index: -1 !important;
}

.dimmed-edge {
  opacity: 0.05 !important;
}

/* Entry Animation */
@keyframes fadeInScale {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.entry-animation {
  animation: fadeInScale 0.5s ease-out forwards;
}
```

## File: `ai-graph-system\src\App.jsx`

```jsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  useNodesState, useEdgesState, Background, Controls, MiniMap, MarkerType, useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getAIResponse } from './llmService';
import { getLayoutedElements } from './layoutEngine';
import { Send, Trash2, Zap, Cpu, RefreshCcw, Layout } from 'lucide-react';
import CustomNode from './components/CustomNode';
import './App.css';

const nodeTypes = {
  custom: CustomNode,
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const { fitView, setCenter } = useReactFlow();

  // Focus and Context Menu State
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Load from Memory — collapse everything to root on refresh for a clean view
  useEffect(() => {
    const saved = localStorage.getItem('ai_graph_memory');
    if (saved) {
      try {
        const { nodes: n, edges: e } = JSON.parse(saved);
        if (Array.isArray(n) && Array.isArray(e) && n.length > 0) {
          // Find all nodes that have children (i.e. are a source of at least one edge)
          const parentIds = new Set(e.map(edge => edge.source));
          // Collapse every parent node so only the root is visible
          const initialCollapsed = new Set();
          parentIds.forEach(id => initialCollapsed.add(id));

          const hiddenOnLoad = getHiddenIds(initialCollapsed, e);
          const { nodes: layoutedNodes } = getLayoutedElements(n, e, hiddenOnLoad);

          setNodes(layoutedNodes);
          setEdges(e);
          setCollapsedNodes(initialCollapsed);

          // Center on root after a tick
          setTimeout(() => {
            fitView({ duration: 600, padding: 0.3, maxZoom: 1, minZoom: 0.15 });
          }, 100);
        }
      } catch (err) {
        console.error("Failed to load memory:", err);
        localStorage.removeItem('ai_graph_memory');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getHiddenIds = useCallback((collapsedSet, currentEdges) => {
    const ids = new Set();
    const checkHidden = (parentId) => {
      currentEdges.forEach(edge => {
        if (edge.source === parentId) {
          ids.add(edge.target);
          checkHidden(edge.target);
        }
      });
    };
    collapsedSet.forEach(id => checkHidden(id));
    return ids;
  }, []);

  // Track the last toggled node for camera framing
  const [lastToggledNode, setLastToggledNode] = useState(null);

  const toggleChildren = useCallback((nodeId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId); // expanding
        setLastToggledNode({ id: nodeId, action: 'expand' });
      } else {
        next.add(nodeId); // collapsing
        setLastToggledNode({ id: nodeId, action: 'collapse' });
      }
      return next;
    });
  }, []);

  // Re-layout whenever collapsedNodes changes — uses LATEST nodes and edges from state
  useEffect(() => {
    if (nodes.length === 0) return;
    const currentHiddenIds = getHiddenIds(collapsedNodes, edges);
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, currentHiddenIds);

    // Only update if positions actually changed to avoid infinite loop
    const positionsChanged = layoutedNodes.some((ln, i) => {
      const orig = nodes[i];
      return !orig || ln.position.x !== orig.position.x || ln.position.y !== orig.position.y;
    });

    if (positionsChanged) {
      setNodes(layoutedNodes);
    }

    // Camera framing for the last toggled node
    if (lastToggledNode) {
      setTimeout(() => {
        if (lastToggledNode.action === 'expand') {
          const childrenIds = edges
            .filter(e => e.source === lastToggledNode.id && !currentHiddenIds.has(e.target))
            .map(e => ({ id: e.target }));
          const nodesToFrame = [{ id: lastToggledNode.id }, ...childrenIds];
          fitView({ nodes: nodesToFrame, duration: 800, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        } else {
          fitView({ nodes: [{ id: lastToggledNode.id }], duration: 600, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        }
        setLastToggledNode(null);
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedNodes]);

  // Derived state for hidden nodes/edges
  const hiddenIds = useMemo(() => getHiddenIds(collapsedNodes, edges), [collapsedNodes, edges, getHiddenIds]);

  const onExpand = useCallback(async (topic, parentId = null) => {
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const data = await getAIResponse(topic, parentId);
      let nodesToAdd = [];
      let edgesToAdd = [];

      if (!parentId && data?.root) {
        // Initial deep load
        const rootId = `root-${Date.now()}`;
        const initialCollapsed = new Set();

        // COLLAPSE BY DEFAULT: Root and Level-1
        initialCollapsed.add(rootId);

        const rootNode = {
          id: rootId,
          type: 'custom',
          data: {
            label: data.root.label || topic,
            desc: data.root.desc || '',
            isRoot: true,
            level: 0,
            onToggleChildren: toggleChildren,
            childCount: data.children?.length || 0
          },
          position: { x: 0, y: 0 },
        };
        nodesToAdd.push(rootNode);

        if (Array.isArray(data.children)) {
          data.children.forEach((l1, i) => {
            const l1Id = `l1-${i}-${Date.now()}`;
            initialCollapsed.add(l1Id);

            nodesToAdd.push({
              id: l1Id,
              type: 'custom',
              data: {
                label: l1.label || 'Category',
                desc: l1.desc || '',
                level: 1,
                childCount: l1.children?.length || 0,
                onToggleChildren: toggleChildren
              },
              position: { x: 0, y: 0 }
            });
            edgesToAdd.push({
              id: `e-${rootId}-${l1Id}`,
              source: rootId,
              target: l1Id,
              type: 'smoothstep',
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
            });

            if (Array.isArray(l1.children)) {
              l1.children.forEach((l2, j) => {
                const l2Id = `l2-${i}-${j}-${Date.now()}`;
                nodesToAdd.push({
                  id: l2Id,
                  type: 'custom',
                  data: {
                    label: l2.label || 'Sub-category',
                    desc: l2.desc || '',
                    level: 2,
                    onToggleChildren: toggleChildren
                  },
                  position: { x: 0, y: 0 }
                });
                edgesToAdd.push({
                  id: `e-${l1Id}-${l2Id}`,
                  source: l1Id,
                  target: l2Id,
                  type: 'smoothstep',
                  animated: true,
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
                });
              });
            }
          });
        }
        setCollapsedNodes(prev => new Set([...prev, ...initialCollapsed]));
      } else if (data?.nodes) {
        // Recursive expansion (2 levels deep)
        const parentNode = nodes.find(n => n.id === parentId);
        const parentLevel = parentNode?.data?.level || 0;
        const parentPos = parentNode?.position || { x: 0, y: 0 };

        data.nodes.forEach(n => {
          const l1Id = `${n.id}-${Math.random().toString(36).substr(2, 9)}`;

          nodesToAdd.push({
            id: l1Id,
            type: 'custom',
            data: {
              label: n.label || 'Topic',
              desc: n.desc || '',
              level: parentLevel + 1,
              onToggleChildren: toggleChildren,
              childCount: n.children?.length || 0
            },
            position: { x: parentPos.x, y: parentPos.y }, // Spawn exactly at parent for outward expansion
          });

          edgesToAdd.push({
            id: `e-${parentId}-${l1Id}`,
            source: parentId,
            target: l1Id,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
          });

          // Handle Level 2 Children if they exist
          if (Array.isArray(n.children)) {
            n.children.forEach(c => {
              const l2Id = `${c.id}-${Math.random().toString(36).substr(2, 9)}`;
              nodesToAdd.push({
                id: l2Id,
                type: 'custom',
                data: {
                  label: c.label || 'Detail',
                  desc: c.desc || '',
                  level: parentLevel + 2,
                  onToggleChildren: toggleChildren
                },
                position: { x: parentPos.x, y: parentPos.y }, // Nested offset spawns exactly at parent
              });
              edgesToAdd.push({
                id: `e-${l1Id}-${l2Id}`,
                source: l1Id,
                target: l2Id,
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
              });
            });
          }
        });

        // Ensure the expanded parent is not collapsed
        setCollapsedNodes(prev => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }

      const allNodes = [...nodes, ...nodesToAdd];
      const allEdges = [...edges, ...edgesToAdd];

      const tempCollapsed = new Set(collapsedNodes);
      if (!parentId && data?.root) {
        const rootId = nodesToAdd[0]?.id;
        if (rootId) tempCollapsed.add(rootId);
        nodesToAdd.filter(n => n.id.startsWith('l1')).forEach(n => tempCollapsed.add(n.id));
      } else if (parentId) {
        tempCollapsed.delete(parentId);
      }

      const nextHiddenIds = getHiddenIds(tempCollapsed, allEdges);
      const { nodes: layoutedNodes } = getLayoutedElements(allNodes, allEdges, nextHiddenIds);

      // UPDATE childCount on parent and set final positions
      const finalNodes = layoutedNodes.map(n => {
        if (parentId && n.id === parentId) {
          return {
            ...n,
            data: {
              ...n.data,
              childCount: (n.data.childCount || 0) + data.nodes.length
            }
          };
        }
        return n;
      });

      setCollapsedNodes(tempCollapsed);
      setNodes(finalNodes);
      setEdges(allEdges);
      localStorage.setItem('ai_graph_memory', JSON.stringify({ nodes: finalNodes, edges: allEdges }));

      // Smooth camera shift to frame the parent and newly expanded children
      setTimeout(() => {
        if (parentId) {
          const nodesToFrame = [{ id: parentId }, ...nodesToAdd.map(n => ({ id: n.id }))];
          fitView({ nodes: nodesToFrame, duration: 800, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        } else {
          // Frame main cluster on root generation
          const nodesToFrame = nodesToAdd.map(n => ({ id: n.id }));
          fitView({ nodes: nodesToFrame, duration: 800, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        }
      }, 150); // slight delay to ensure React Flow has mounted the new coordinates

    } catch (error) {
      console.error("Expansion error:", error);
    } finally {
      setLoading(false);
      if (!parentId) setInput('');
    }
  }, [nodes, edges, setNodes, setEdges, toggleChildren, collapsedNodes]);

  const visibleNodes = useMemo(() => {
    // If there's a focused node, calculate its ancestors and descendants
    const connectedIds = new Set();
    if (focusedNodeId) {
      connectedIds.add(focusedNodeId);
      // Find descendants
      const getDescendants = (id) => {
        edges.forEach(e => {
          if (e.source === id && !connectedIds.has(e.target)) {
            connectedIds.add(e.target);
            getDescendants(e.target);
          }
        });
      };
      // Find ancestors
      const getAncestors = (id) => {
        edges.forEach(e => {
          if (e.target === id && !connectedIds.has(e.source)) {
            connectedIds.add(e.source);
            getAncestors(e.source);
          }
        });
      };
      getDescendants(focusedNodeId);
      getAncestors(focusedNodeId);
    }

    return nodes.map(node => {
      const isHidden = hiddenIds.has(node.id);
      const isDimmed = focusedNodeId && !connectedIds.has(node.id);
      const isActive = node.id === focusedNodeId;
      const isConnected = focusedNodeId && connectedIds.has(node.id) && !isActive;

      let zIndex = 1;
      if (isActive) zIndex = 1000;
      else if (isConnected) zIndex = 500;

      let cls = node.className || '';
      if (isDimmed) cls += ' dimmed';
      if (isActive) cls += ' active-node';
      if (isConnected) cls += ' connected-node';

      return {
        ...node,
        hidden: isHidden,
        zIndex: zIndex,
        className: cls.trim(),
        data: {
          ...node.data,
          isCollapsed: collapsedNodes.has(node.id),
          onToggleChildren: toggleChildren,
          onExpand: onExpand
        }
      };
    });
  }, [nodes, hiddenIds, collapsedNodes, toggleChildren, onExpand, focusedNodeId, edges]);

  const visibleEdges = useMemo(() => {
    // Same connection logic for edges
    const connectedIds = new Set();
    if (focusedNodeId) {
      connectedIds.add(focusedNodeId);
      const getDescendants = (id) => {
        edges.forEach(e => {
          if (e.source === id && !connectedIds.has(e.target)) {
            connectedIds.add(e.target);
            getDescendants(e.target);
          }
        });
      };
      const getAncestors = (id) => {
        edges.forEach(e => {
          if (e.target === id && !connectedIds.has(e.source)) {
            connectedIds.add(e.source);
            getAncestors(e.source);
          }
        });
      };
      getDescendants(focusedNodeId);
      getAncestors(focusedNodeId);
    }

    return edges.map(edge => {
      const isHidden = hiddenIds.has(edge.target) || hiddenIds.has(edge.source);
      const isDimmed = focusedNodeId && (!connectedIds.has(edge.source) || !connectedIds.has(edge.target));

      return {
        ...edge,
        hidden: isHidden,
        className: isDimmed ? 'dimmed-edge' : ''
      };
    });
  }, [edges, hiddenIds, focusedNodeId]);

  const clearGraph = useCallback(() => {
    if (window.confirm("Clear all nodes?")) {
      setNodes([]);
      setEdges([]);
      localStorage.removeItem('ai_graph_memory');
      setCollapsedNodes(new Set());
    }
  }, [setNodes, setEdges]);

  const triggerLayout = useCallback(() => {
    const { nodes: lNodes } = getLayoutedElements(nodes, edges, hiddenIds);
    setNodes(lNodes);
  }, [nodes, edges, hiddenIds, setNodes]);

  const clearMemory = useCallback(() => {
    if (window.confirm("This will clear the saved memory and reload. Continue?")) {
      localStorage.removeItem('ai_graph_memory');
      setNodes([]);
      setEdges([]);
      setCollapsedNodes(new Set());
    }
  }, [setNodes, setEdges, setCollapsedNodes]);

  // Context Menu Handlers
  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
        node: node,
      });
    },
    [setContextMenu]
  );

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setFocusedNodeId(null);
  }, [setContextMenu, setFocusedNodeId]);

  const onNodeClick = useCallback((event, node) => {
    setFocusedNodeId(node.id);
    setCenter(node.position.x, node.position.y, { duration: 400, zoom: 1 });
  }, [setCenter]);

  const handleContextMenuAction = useCallback((action) => {
    if (!contextMenu) return;
    const { id, node } = contextMenu;

    if (action === 'expand') {
      onExpand(node.data.label, id);
    } else if (action === 'explain') {
      alert(`Explanation for: ${node.data.label}\n\n${node.data.desc}\n\n(Future: Opens in dedicated side-chat)`);
    } else if (action === 'edit') {
      const newLabel = prompt("Edit node label:", node.data.label);
      if (newLabel && newLabel.trim() !== '') {
        setNodes(nds => nds.map(n => {
          if (n.id === id) {
            n.data = { ...n.data, label: newLabel };
          }
          return n;
        }));
      }
    } else if (action === 'link') {
      alert("Attach external links logic will go here.");
    } else if (action === 'delete') {
      // Recursive delete
      const idsToDelete = new Set([id]);
      const checkChildren = (parentId) => {
        edges.forEach(e => {
          if (e.source === parentId) {
            idsToDelete.add(e.target);
            checkChildren(e.target);
          }
        });
      };
      checkChildren(id);

      setNodes(nds => nds.filter(n => !idsToDelete.has(n.id)));
      setEdges(eds => eds.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)));
      setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 100);
    }
    setContextMenu(null);
  }, [contextMenu, edges, onExpand, setNodes, setEdges, fitView]);

  return (
    <div className="app-container">
      {nodes.length > 0 && <div className="header-hover-zone" />}
      <header className={`glass-header ${nodes.length > 0 ? 'graph-active' : ''}`}>
        <div className="logo">
          <Cpu size={24} className="icon-glow" />
          <span>GEN-AI Graph Explorer</span>
        </div>

        <div className="search-box">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Explore a topic (e.g. LLM Architecture)..."
            onKeyDown={(e) => e.key === 'Enter' && onExpand(input)}
          />
          <button onClick={() => onExpand(input)} disabled={loading}>
            {loading ? <RefreshCcw className="spinning" /> : <Send size={18} />}
          </button>
        </div>

        <div className="actions">
          <button className="btn-icon" onClick={triggerLayout} title="Rearrange Layout">
            <Layout size={18} />
          </button>
          <button className="btn-icon" onClick={clearMemory} title="Reset App Memory">
            <RefreshCcw size={18} />
          </button>
          <button className="btn-icon btn-danger" onClick={clearGraph} title="Clear Current Graph">
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodesDraggable={true}
        nodesConnectable={false}
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.25, duration: 800, minZoom: 0.15, maxZoom: 0.9 }}
        onNodeDragStop={() => {
          localStorage.setItem('ai_graph_memory', JSON.stringify({ nodes, edges }));
        }}
      >
        <Background color="#222222" variant="dots" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => n.hidden ? 'transparent' : '#1DCD9F'}
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.top, left: contextMenu.left }}
        >
          <button onClick={() => handleContextMenuAction('expand')}>Expand Nodes</button>
          <button onClick={() => handleContextMenuAction('explain')}>Explain in Detail</button>
          <button onClick={() => handleContextMenuAction('edit')}>Edit Label</button>
          <button onClick={() => handleContextMenuAction('link')}>Link Resource</button>
          <button onClick={() => handleContextMenuAction('delete')} className="delete-action">Delete Branch</button>
        </div>
      )}

      {loading && (
        <div className="loader-container">
          <div className="loader-overlay">
            <Zap className="spinning" size={16} />
            <span>Generating 2-Level Deep Graph...</span>
          </div>
        </div>
      )}
    </div>
  );
}

```

## File: `ai-graph-system\src\index.css`

```css
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
}

body {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
```

## File: `ai-graph-system\src\layoutEngine.js`

```js
import dagre from 'dagre';

export const getLayoutedElements = (nodes, edges, hiddenIds = new Set(), direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 200, // Horizontal gap between parent and child
        nodesep: 150, // Vertical gap between sibling nodes (increased to prevent overlap)
        marginx: 100,
        marginy: 100,
    });

    const visibleNodes = nodes.filter(n => !hiddenIds.has(n.id));
    const visibleEdges = edges.filter(e => !hiddenIds.has(e.source) && !hiddenIds.has(e.target));

    visibleNodes.forEach((node) => {
        const level = node.data?.level || 0;
        const label = node.data?.label || '';

        // Estimate how many lines the label wraps to, based on approximate chars-per-line at each level's width
        const charsPerLine = level === 0 ? 22 : level === 1 ? 18 : level === 2 ? 16 : 14;
        const labelLines = Math.max(1, Math.ceil(label.length / charsPerLine));
        const lineHeight = 20; // approximate rendered line-height in px
        const labelHeight = labelLines * lineHeight;

        // Match dagre dimensions to CSS max-widths and dynamically compute height
        let width, height;

        if (level === 0) {
            width = 350;   // CSS max-width for .node-level-0
            height = Math.max(140, 60 + labelHeight);
        } else if (level === 1) {
            width = 300;   // CSS max-width for .node-level-1
            height = Math.max(130, 55 + labelHeight);
        } else if (level === 2) {
            width = 260;   // CSS max-width for .node-level-2
            height = Math.max(120, 50 + labelHeight);
        } else {
            width = 220;   // CSS max-width for .node-level-3+
            height = Math.max(100, 45 + labelHeight);
        }

        dagreGraph.setNode(node.id, { width, height });
    });

    visibleEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    // Map to find parents quickly for hidden nodes
    const parentMap = {};
    edges.forEach(e => { parentMap[e.target] = e.source; });

    const layoutedNodes = nodes.map((node) => {
        if (!hiddenIds.has(node.id)) {
            // Visible node -> Get absolute center position from Dagre
            const nodeWithPosition = dagreGraph.node(node.id);

            return {
                ...node,
                targetPosition: 'left',
                sourcePosition: 'right',
                position: {
                    x: nodeWithPosition.x - (nodeWithPosition.width / 2),
                    y: nodeWithPosition.y - (nodeWithPosition.height / 2),
                },
            };
        } else {
            // Hidden node -> Snap to nearest visible ancestor's center position
            let ancestorId = parentMap[node.id];
            let ancestorPos = { x: 0, y: 0 };

            // Traverse up until we find a visible node or run out
            while (ancestorId) {
                if (!hiddenIds.has(ancestorId)) {
                    const nodeWithPosition = dagreGraph.node(ancestorId);
                    if (nodeWithPosition) {
                        ancestorPos = {
                            x: nodeWithPosition.x - (nodeWithPosition.width / 2),
                            y: nodeWithPosition.y - (nodeWithPosition.height / 2)
                        };
                    }
                    break;
                }
                ancestorId = parentMap[ancestorId];
            }

            return {
                ...node,
                position: ancestorPos
            };
        }
    });

    return { nodes: layoutedNodes, edges };
};
```

## File: `ai-graph-system\src\llmService.js`

```js
export const getAIResponse = async (topic, pathContext = "") => {
  const isInitial = !pathContext;

  const initialPrompt = `
    You are an expert systems architect. Generate a DEEP structured knowledge map for the topic: "${topic}".
    
    OUTPUT ONLY VALID JSON. 
    Format:
    {
      "root": {
        "id": "root",
        "label": "${topic}",
        "desc": "Detailed overview of ${topic}, explaining its core significance and main applications."
      },
      "children": [
        {
          "id": "l1_1",
          "label": "Level 1 Category",
          "desc": "Provide a detailed 2-3 sentence explanation of this category, its role within the system, and why it is essential.",
          "children": [
            {
              "id": "l2_1",
              "label": "Level 2 Sub-category",
              "desc": "A specific 2-3 sentence deep-dive into this sub-category, detailing its functions or characteristics."
            }
          ]
        }
      ]
    }
    
    Requirements:
    1. Generate 4-5 Level 1 categories.
    2. For EACH Level 1 category, generate 2-3 Level 2 sub-categories.
    3. Ensure all descriptions are DETAILED (at least 2-3 substantial sentences per node).
    `;

  const expansionPrompt = `
    You are an expert systems architect. Expand the knowledge map for the node: "${topic}".
    User is exploring "${pathContext}".
    
    OUTPUT ONLY VALID JSON. 
    Format:
    {
      "nodes": [
        {
          "id": "new_l1_1",
          "label": "Title",
          "desc": "Detailed 2-3 sentence description.",
          "children": [
            {
              "id": "new_l2_1",
              "label": "Deep Sub-detail",
              "desc": "Specific 2-3 sentence description."
            }
          ]
        }
      ]
    }
    Generate 3-5 detailed sub-categories for "${topic}".
    For EACH sub-category, generate 1-2 deeper sub-details (2 levels deep in total).
    Each description MUST be at least 2-3 sentences long.
    `;

  let systemPrompt = isInitial ? initialPrompt : expansionPrompt;
  let userPrompt = isInitial ? `Generate a complete 2-level deep graph for ${topic}` : `Expand on ${topic}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-oss:120b-cloud',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          format: 'json'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.message || !data.message.content) {
        throw new Error("Invalid response format from Ollama API");
      }

      let content = data.message.content.trim();
      let parsed = null;
      
      try {
        parsed = JSON.parse(content);
      } catch (e) {}

      if (!parsed && content.startsWith("```")) {
        let noMd = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        try { parsed = JSON.parse(noMd); } catch (e) {}
      }

      if (!parsed) {
        const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (mdMatch && mdMatch[1]) {
          try { parsed = JSON.parse(mdMatch[1].trim()); } catch (e) {}
        }
      }

      if (!parsed) {
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try { parsed = JSON.parse(objMatch[0]); } catch (e) {}
        }
      }

      if (parsed) {
        return parsed;
      }
      
      throw new Error("Could not extract valid JSON from response.");
    } catch (error) {
      console.warn(`[LLM Service] Attempt ${attempt} failed:`, error.message);
      userPrompt += `\n\nCRITICAL FEEDBACK ON PREVIOUS ATTEMPT:\nYour previous response failed to parse as valid JSON. Error: ${error.message}. Please strictly output ONLY valid JSON without any markdown formatting or preamble.`;
    }
  }

  console.error("LLM Service Error: Failed after 3 attempts");
  return isInitial ? { root: { id: 'root', label: topic, desc: 'Error generating graph' }, children: [] } : { nodes: [] };
};
```

## File: `ai-graph-system\src\main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactFlowProvider } from 'reactflow'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
)
```

## File: `ai-graph-system\src\components\CustomNode.jsx`

```jsx
import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { ChevronRight, ChevronDown, Info, PlusCircle, Pin, PinOff } from 'lucide-react';

const CustomNode = ({ id, data }) => {
    const hasChildren = data.childCount > 0;
    const level = data.level || 0;
    const [pinned, setPinned] = useState(false);

    return (
        <div className={`custom-node-wrapper ${data.isRoot ? 'root-node' : ''} node-level-${level} ${pinned ? 'pinned' : ''}`}>
            <Handle type="target" position={Position.Left} />
            <div className="custom-node-content">
                <div className="node-header">
                    <span className="node-label">{data.label}</span>
                    <div className="node-actions">
                        {!hasChildren && (
                            <button
                                className="toggle-btn expand-btn"
                                title="Explore more"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    data.onExpand?.(data.label, id);
                                }}
                            >
                                <PlusCircle size={14} />
                            </button>
                        )}
                        {hasChildren && (
                            <button
                                className="toggle-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    data.onToggleChildren?.(id);
                                }}
                            >
                                {data.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                        <button
                            className={`toggle-btn pin-btn ${pinned ? 'pin-active' : ''}`}
                            title={pinned ? 'Unpin info' : 'Pin info'}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPinned(prev => !prev);
                            }}
                        >
                            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                    </div>
                </div>
                <div className={`hover-info ${pinned ? 'info-pinned' : ''}`}>
                    <Info size={12} className="info-icon" />
                    <div className="tooltip-desc">{data.desc}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
};

export default memo(CustomNode);

```

## File: `backend\.env`

```bash
PORT=4000
NODE_ENV=development
MONGO_URI=mongodb+srv://23bai70412_db_user:Sarthak%402004@adiptify.f0dtrik.mongodb.net/adiptify?retryWrites=true&w=majority&appName=Adiptify
JWT_SECRET=adiptify-casestudy1-secret-key-2026
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=deepseek-r1
REDIS_URL=redis://127.0.0.1:6379
DOCUMENT_INTELLIGENCE_ENDPOINT=
DOCUMENT_INTELLIGENCE_API_KEY=
AZURE_SEARCH_ENDPOINT=
AZURE_SEARCH_INDEX_NAME=adiptify-rag-index
AZURE_SEARCH_API_KEY=
AZURE_AI_PROJECT_ENDPOINT=
AZURE_AI_MODEL_DEPLOYMENT_NAME=gpt-4o-mini
```

## File: `backend\app.js`

```js
import dotenv from "dotenv";
dotenv.config(); // Must be first — before any imports that read process.env

import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import notesRoutes from "./routes/notes.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import issueRoutes from "./routes/issues.js";
import learningRoutes from "./routes/learning.js";
import proctorRoutes from "./routes/proctor.js";
import assessmentRoutes from "./routes/assessment.js";
import questionBankRoutes from "./routes/questionBank.js";
import spacedRepetitionRoutes from "./routes/spacedRepetition.js";
import adaptiveLearningRoutes from "./routes/adaptiveLearning.js";
import analyticsRoutes from "./routes/analytics.js";
import experimentsRoutes from "./routes/experiments.js";
import subjectsRoutes from "./routes/subjects.js";
import graphRoutes from "./routes/graph.js";
import syllabusRoutes from "./routes/syllabus.js";
import contentRoutes from "./routes/content.js";
import tutorRoutes from "./routes/tutor.js";
import settingsRoutes from "./routes/settings.js";
import organizationsRoutes from "./routes/organizations.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import planRoutes from "./routes/plan.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Health check
app.get("/api/ping", (req, res) => {
    res.json({
        ok: true,
        message: "Adiptify API is running",
        db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/", issueRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/proctor", proctorRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/question-bank", questionBankRoutes);
app.use("/api/sr", spacedRepetitionRoutes);
app.use("/api/adaptive", adaptiveLearningRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/experiments", experimentsRoutes);
app.use("/api/subjects", subjectsRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/organizations", organizationsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/plan", planRoutes);

// ═══════════════════════════════════════════════════════════
// Serve Frontend Static Files in Production (Azure App Service)
// The React app is pre-built and placed in ../Frontend/dist
// ═══════════════════════════════════════════════════════════
const frontendDist = path.join(__dirname, "..", "Frontend", "dist");
app.use(express.static(frontendDist));

// SPA fallback — any non-API route serves index.html for React Router
app.get(/^(?!\/api).*/, (req, res) => {
    const indexPath = path.join(frontendDist, "index.html");
    res.sendFile(indexPath, (err) => {
        if (err) {
            // If frontend is not built yet, just return a helpful message
            res.status(200).json({
                message: "Adiptify API is running. Frontend not built yet.",
                hint: "Run 'npm run build' in the Frontend directory first."
            });
        }
    });
});

// MongoDB connection — using Atlas URI from .env
mongoose
    .connect(config.mongoUri, {
        dbName: config.mongoDb,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
    })
    .then(() => {
        console.log(`✅ MongoDB Atlas connected → db: ${config.mongoDb}`);

        const PORT = config.port;
        app.listen(PORT, () => {
            console.log(`🚀 Adiptify API listening on port ${PORT}`);
        });

        // Initialize event-driven services after DB is ready
        import('./services/leaderboardService.js').then(({ initLeaderboardListeners }) => {
            initLeaderboardListeners();
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection FAILED:", err.message);
        console.error("   Check MONGO_URI in .env");
        process.exit(1); // Exit so nodemon restarts with a clear error
    });

// Trigger nodemon restart
```

## File: `backend\package.json`

```json
{
  "name": "adiptify-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "app.js",
  "scripts": {
    "start": "node --max-old-space-size=4096 --expose-gc app.js",
    "dev": "nodemon --exec \"node --max-old-space-size=4096 --expose-gc\" app.js",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "@azure-rest/ai-document-intelligence": "^1.1.0",
    "@azure/ai-projects": "^2.1.0",
    "@azure/identity": "^4.13.1",
    "@azure/search-documents": "^12.2.0",
    "axios": "^1.7.7",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "jszip": "^3.10.1",
    "marked": "^12.0.2",
    "mongoose": "^7.8.0",
    "morgan": "^1.10.0",
    "multer": "^2.1.1",
    "node-fetch": "^3.3.2",
    "ollama": "^0.6.2",
    "pdf-parse": "^1.1.1",
    "pptxtojson": "^1.12.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

## File: `backend\config\index.js`

```js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

export const config = {
    port: process.env.PORT || 4000,
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/adiptify",
    mongoDb: process.env.MONGO_DB || "adiptify",
    jwtSecret: process.env.JWT_SECRET || "adiptify-casestudy1-secret-key-2026",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "deepseek-v3.1:671b-cloud",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
};

export default config;
```

## File: `backend\middleware\aiLogger.js`

```js
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
```

## File: `backend\middleware\auth.js`

```js
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export function auth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    };
}
```

## File: `backend\models\AILog.js`

```js
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
```

## File: `backend\models\AssessmentSession.js`

```js
import mongoose from "mongoose";

const assessmentSessionSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
        mode: { type: String, enum: ["diagnostic", "formative", "summative", "proctored"], default: "formative" },
        itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
        currentIndex: { type: Number, default: 0 },
        startedAt: { type: Date, default: () => new Date() },
        completedAt: { type: Date },
        score: { type: Number, default: 0 },
        metadata: { type: mongoose.Schema.Types.Mixed },
        timeLimit: { type: Number },
        status: { type: String, enum: ["active", "completed", "cancelled", "invalidated"], default: "active" },
        proctored: { type: Boolean, default: false },
        proctorConfig: {
            blockTabSwitch: { type: Boolean, default: true },
            blockCopyPaste: { type: Boolean, default: true },
            blockRightClick: { type: Boolean, default: true },
            allowTabSwitchCount: { type: Number, default: 2 },
            requireSnapshots: { type: Boolean, default: false },
            snapshotIntervalSec: { type: Number, default: 0 }
        },
        proctorSummary: {
            minorViolations: { type: Number, default: 0 },
            majorViolations: { type: Number, default: 0 },
            totalViolations: { type: Number, default: 0 },
            riskScore: { type: Number, default: 0 },
            tabSwitchCount: { type: Number, default: 0 }
        },
        proctorLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProctorLog" }],
        invalidated: { type: Boolean, default: false }
    },
    { timestamps: true }
);

assessmentSessionSchema.index({ user: 1, status: 1 });
assessmentSessionSchema.index({ createdAt: -1 });

export const AssessmentSession = mongoose.model("AssessmentSession", assessmentSessionSchema);
export default AssessmentSession;
```

## File: `backend\models\Attempt.js`

```js
import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
        item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", index: true },
        session: { type: mongoose.Schema.Types.ObjectId, ref: "AssessmentSession", index: true },
        isCorrect: { type: Boolean, required: true },
        userAnswer: { type: mongoose.Schema.Types.Mixed },
        score: { type: Number, default: 0 },
        gradingDetails: { type: mongoose.Schema.Types.Mixed, default: null },
        timeTakenMs: { type: Number, default: 0 },
        explanation: { type: String, default: "" },
        proctorLogRefs: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProctorLog" }],
    },
    { timestamps: true }
);

attemptSchema.index({ user: 1, item: 1 });

export const Attempt = mongoose.model("Attempt", attemptSchema);
export default Attempt;
```

## File: `backend\models\ChatMessage.js`

```js
import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatSession", required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    content: { type: String, required: true },
    graphData: { type: Object, default: null }
}, { timestamps: true });

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
export default ChatMessage;
```

## File: `backend\models\ChatSession.js`

```js
import mongoose from "mongoose";

const chatSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null },
    title: { type: String, default: "New Conversation" },
    status: { type: String, enum: ["active", "archived"], default: "active" }
}, { timestamps: true });

export const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
export default ChatSession;
```

## File: `backend\models\Concept.js`

```js
import mongoose from "mongoose";

const practiceQuestionSchema = new mongoose.Schema(
    {
        question: { type: String, required: true },
        options: [{ type: String }],
        correctAnswer: { type: Number, default: 0 },
        explanation: { type: String, default: "" },
        difficulty: { type: Number, min: 1, max: 5, default: 2 },
    },
    { _id: false }
);

const conceptPipelineSchema = new mongoose.Schema(
    {
        explanation: { type: String, default: "" },
        demonstration: { type: String, default: "" },
        practiceQuestions: [practiceQuestionSchema],
        applicationTask: { type: String, default: "" },
        evaluationCriteria: { type: String, default: "" },
    },
    { _id: false }
);

const conceptSchema = new mongoose.Schema(
    {
        conceptId: { type: String, required: true, unique: true, index: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        category: { type: String, default: "General" },
        difficulty_level: { type: Number, min: 1, max: 5, default: 2 },
        prerequisites: [{ type: String }],
        tags: [{ type: String }],
        pipeline: { type: conceptPipelineSchema, default: () => ({}) },
    },
    { timestamps: true }
);

export const Concept = mongoose.model("Concept", conceptSchema);
export default Concept;
```

## File: `backend\models\Content.js`

```js
import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
    {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
        syllabusNodeId: { type: mongoose.Schema.Types.ObjectId }, // Can point to a module or topic inside Syllabus
        type: { type: String, enum: ['pdf', 'pptx', 'video', 'structured_text', 'url', 'ai_generated', 'study-notes', 'full-study-notes'], required: true },
        learningLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Proficient'], default: 'Beginner' },
        dataUrl: { type: String },
        contentBody: { type: String },
        // Stores raw PPT slide JSON from pptxtojson for future study module rendering
        slideData: { type: mongoose.Schema.Types.Mixed, default: null },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

export const Content = mongoose.model("Content", contentSchema);
export default Content;

```

## File: `backend\models\ExperimentResult.js`

```js
import mongoose from "mongoose";

const experimentResultSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        experimentId: { type: String, required: true },
        experimentType: {
            type: String,
            enum: ["gradient_descent", "neural_network", "classification"],
            required: true,
        },
        parameters_used: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
        result_metrics: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

experimentResultSchema.index({ userId: 1, experimentType: 1 });

export const ExperimentResult = mongoose.model("ExperimentResult", experimentResultSchema);
export default ExperimentResult;
```

## File: `backend\models\GeneratedAssessment.js`

```js
import mongoose from "mongoose";

const generatedAssessmentSchema = new mongoose.Schema(
    {
        topic: { type: String, required: true },
        title: { type: String, required: true },
        items: { type: Array, default: [] },
        rawResponse: { type: mongoose.Schema.Types.Mixed },
        validated: { type: Boolean, default: false },
        status: { type: String, enum: ["draft", "published", "failed"], default: "draft" },
        linkedItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        publishedAt: { type: Date },
        publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        proctored: { type: Boolean, default: false },
        proctorConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

generatedAssessmentSchema.index({ topic: 1, status: 1 });
generatedAssessmentSchema.index({ createdBy: 1 });

export const GeneratedAssessment = mongoose.model("GeneratedAssessment", generatedAssessmentSchema);
export default GeneratedAssessment;
```

## File: `backend\models\IssueReport.js`

```js
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
```

## File: `backend\models\Item.js`

```js
import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ["mcq", "fill_blank", "short_answer", "match", "reorder"], required: true },
        questionType: { type: String },
        question: { type: String, required: true },
        choices: { type: [String], default: [] },
        answer: { type: mongoose.Schema.Types.Mixed, required: true },
        gradingMethod: {
            type: String,
            enum: ["exact", "levenshtein", "semantic", "pair_match", "sequence_check"],
            default: "exact",
        },
        difficulty: { type: Number, min: 1, max: 5, required: true },
        bloom: { type: String, enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"], required: true },
        cognitiveLevel: { type: String },
        topics: { type: [String], index: true, default: [] },
        skills: { type: [String], default: [] },
        tags: { type: [String], default: [] },
        hints: { type: [String], default: [] },
        explanation: { type: String, default: "" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        seedId: { type: String },
        aiGenerated: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: true, updatedAt: true } }
);

itemSchema.index({ topics: 1 });
itemSchema.index({ difficulty: 1 });

export const Item = mongoose.model("Item", itemSchema);
export default Item;
```

## File: `backend\models\LeaderboardEntry.js`

```js
/**
 * LeaderboardEntry — Composite scoring leaderboard in MongoDB.
 * Score = (XP * 0.4) + (accuracy * 0.25) + (streak * 0.2) + (difficultyMultiplier * 0.15)
 */
import mongoose from 'mongoose';

const leaderboardEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Context dimensions
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    period: { type: String, enum: ['daily', 'weekly', 'monthly', 'alltime'], default: 'alltime' },
    periodStart: { type: Date, default: null },

    // Raw metrics
    xp: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0, min: 0, max: 100 },
    streak: { type: Number, default: 0 },
    difficultyAvg: { type: Number, default: 1, min: 1, max: 5 },
    questionsAnswered: { type: Number, default: 0 },
    quizzesCompleted: { type: Number, default: 0 },

    // Composite score (pre-calculated for fast sorting)
    compositeScore: { type: Number, default: 0 },

    // Anti-abuse
    lastActivityAt: { type: Date, default: Date.now },
    flags: { type: Number, default: 0 },

}, { timestamps: true });

// Compound index for fast contextual leaderboard queries
leaderboardEntrySchema.index({ period: 1, subjectId: 1, orgId: 1, compositeScore: -1 });
leaderboardEntrySchema.index({ userId: 1, period: 1, subjectId: 1, orgId: 1 }, { unique: true });

// Pre-save: compute composite score
leaderboardEntrySchema.pre('save', function () {
    const normalizedXp = Math.min(this.xp / 1000, 100); // Cap at 100k XP
    const normalizedStreak = Math.min(this.streak * 5, 100); // Cap at 20-day streak
    const normalizedDifficulty = (this.difficultyAvg / 5) * 100;

    this.compositeScore = Math.round(
        (normalizedXp * 0.4) +
        (this.accuracy * 0.25) +
        (normalizedStreak * 0.2) +
        (normalizedDifficulty * 0.15)
    );
});

const LeaderboardEntry = mongoose.model('LeaderboardEntry', leaderboardEntrySchema);
export default LeaderboardEntry;
```

## File: `backend\models\Organization.js`

```js
/**
 * Organization Model — Multi-tenant org support.
 */
import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    domain: { type: String, default: '' },
    
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    settings: {
        allowSelfJoin: { type: Boolean, default: false },
        defaultLearningMode: { type: String, default: 'balanced' },
        maxMembers: { type: Number, default: 100 },
    },

    status: { type: String, enum: ['active', 'suspended', 'archived'], default: 'active' },
}, { timestamps: true });

// Auto-generate slug from name
organizationSchema.pre('validate', function () {
    if (!this.slug && this.name) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
});

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ owner: 1 });
organizationSchema.index({ members: 1 });

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
```

## File: `backend\models\ProctorLog.js`

```js
import mongoose from "mongoose";

const proctorLogSchema = new mongoose.Schema({
    session: { type: mongoose.Schema.Types.ObjectId, ref: "AssessmentSession", index: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    violationType: {
        type: String,
        enum: [
            "tab_switch",
            "window_blur",
            "copy_attempt",
            "paste_attempt",
            "right_click_attempt",
            "devtools_opened",
            "screenshot_key_pressed",
            "page_exit_attempt"
        ],
        required: true,
    },
    severity: { type: String, enum: ["minor", "major"], default: "minor" },
    details: { type: String, default: "" },
    timestamp: { type: Date, default: () => new Date(), index: true },
}, { _id: true, timestamps: true });

proctorLogSchema.index({ session: 1, user: 1, timestamp: -1 });

export const ProctorLog = mongoose.model("ProctorLog", proctorLogSchema);
export default ProctorLog;
```

## File: `backend\models\Review.js`

```js
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        conceptId: { type: String, required: true, index: true },

        // SM-2 state
        easiness_factor: { type: Number, default: 2.5 },
        interval: { type: Number, default: 0 },     // days
        repetition: { type: Number, default: 0 },

        // Last recall quality (0-5)
        quality_score: { type: Number, default: 0, min: 0, max: 5 },

        // Scheduling
        next_review: { type: Date, default: () => new Date() },
        last_review: { type: Date },

        // History of quality scores
        history: [
            {
                quality: { type: Number, min: 0, max: 5 },
                date: { type: Date, default: () => new Date() },
                interval: { type: Number },
            },
        ],
    },
    { timestamps: true }
);

reviewSchema.index({ userId: 1, conceptId: 1 }, { unique: true });
reviewSchema.index({ userId: 1, next_review: 1 });

export const Review = mongoose.model("Review", reviewSchema);
export default Review;
```

## File: `backend\models\StudyModule.js`

```js
import mongoose from "mongoose";

const studyModuleSchema = new mongoose.Schema(
    {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
        syllabusNodeId: { type: mongoose.Schema.Types.ObjectId }, // Associated syllabus topic
        learningLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Proficient'], default: 'Beginner' },
        conceptContent: { type: String, required: true },
        application: { type: String },
        systemExplanation: { type: String },
        visualizationRef: { type: mongoose.Schema.Types.ObjectId, ref: "Graph" }, // Optional specific graph if not using Subject's cachedGraph
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

export const StudyModule = mongoose.model("StudyModule", studyModuleSchema);
export default StudyModule;
```

## File: `backend\models\Subject.js`

```js
import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true, index: true },
        description: { type: String, default: "" },
        domainCategory: { type: String, default: "General" },
        learningOutcomes: { type: [String], default: [] },
        type: { type: String, enum: ['general', 'organization'], default: 'general' },
        organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
        status: { type: String, enum: ['pending_validation', 'active'], default: 'active' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        cachedGraph: { type: mongoose.Schema.Types.Mixed, default: null },
        icon: { type: String, default: "📚" },
        color: { type: String, default: "emerald" },
        topics: { type: [String], default: [] },
        category: { type: String, default: "General" },
        isDefault: { type: Boolean, default: false },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

// Auto-generate slug from name if not provided
subjectSchema.pre("validate", function (next) {
    if (!this.slug && this.name) {
        let generatedSlug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Append random string to prevent duplicates
        if (this.isNew) {
            generatedSlug += "-" + Math.random().toString(36).substring(2, 7);
        }

        this.slug = generatedSlug;
    }
    next();
});

export const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;
```

## File: `backend\models\Syllabus.js`

```js
import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    topics: [{
        title: { type: String, required: true },
        description: { type: String }
    }]
});

const syllabusSchema = new mongoose.Schema(
    {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
        modules: [moduleSchema],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

export const Syllabus = mongoose.model("Syllabus", syllabusSchema);
export default Syllabus;
```

## File: `backend\models\User.js`

```js
import mongoose from "mongoose";

const learnerProfileSchema = new mongoose.Schema(
    {
        topics: {
            type: Map,
            of: new mongoose.Schema(
                {
                    mastery: { type: Number, default: 0 },
                    attempts: { type: Number, default: 0 },
                    streak: { type: Number, default: 0 },
                    timeOnTask: { type: Number, default: 0 },
                },
                { _id: false }
            ),
            default: {},
        },
        preferredMode: { type: String, enum: ["mcq", "fill_blank", "short_answer", "match", "reorder", "mixed"], default: "mixed" },
        lastActiveAt: { type: Date, default: () => new Date() }
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, index: true },
        passwordHash: { type: String, required: true },
        studentId: { type: String, index: true, sparse: true },
        role: { type: String, enum: ["student", "instructor", "admin"], default: "student" },
        learnerProfile: { type: learnerProfileSchema, default: () => ({}) },
        proctorConsent: { type: Boolean, default: false },
        lockedSubjects: { type: [String], default: [] },
        themePreference: { type: String, enum: ["light", "dark", "system"], default: "system" },
        enrolledSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: [] }],
        preferences: {
            quizMode: { type: String, enum: ["mcq", "fill_blank", "short_answer", "mixed"], default: "mixed" },
            difficulty: { type: String, enum: ["easy", "medium", "hard", "adaptive"], default: "adaptive" },
            dailyGoal: { type: Number, min: 1, max: 50, default: 5 },
            notifications: { type: Boolean, default: true },
        }
    },
    { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export default User;
```

## File: `backend\models\UserProgress.js`

```js
import mongoose from "mongoose";

const userProgressSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        conceptId: { type: String, required: true, index: true },

        // Mastery components
        mastery_score: { type: Number, default: 0, min: 0, max: 1 },
        concept_accuracy: { type: Number, default: 0 },
        application_score: { type: Number, default: 0 },
        retention_score: { type: Number, default: 0 },

        // Performance signals
        accuracy_rate: { type: Number, default: 0 },
        total_correct: { type: Number, default: 0 },
        total_questions: { type: Number, default: 0 },
        attempt_count: { type: Number, default: 0 },
        hint_usage: { type: Number, default: 0 },
        total_time_spent: { type: Number, default: 0 }, // ms

        // Cognitive load
        cognitive_load: { type: Number, default: 0 },

        // Pipeline progress (0-4: explanation, demo, practice, application, evaluation)
        pipeline_stage: { type: Number, default: 0, min: 0, max: 4 },
        pipeline_completed: { type: Boolean, default: false },

        // Review scheduling
        last_review_date: { type: Date },
        next_review_date: { type: Date },

        // Adaptive difficulty recommendation (1-5)
        recommended_difficulty: { type: Number, default: 2, min: 1, max: 5 },
    },
    { timestamps: true }
);

userProgressSchema.index({ userId: 1, conceptId: 1 }, { unique: true });

export const UserProgress = mongoose.model("UserProgress", userProgressSchema);
export default UserProgress;
```

## File: `backend\models\UserSettings.js`

```js
/**
 * UserSettings Model — Stores per-user configuration for AI tutor, SRS, difficulty.
 * Each user has exactly one settings document. Defaults are applied on first access.
 */
import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },

    // ── Learning Mode (top-level preset) ──
    learningMode: {
        type: String,
        enum: ['relaxed', 'balanced', 'intensive', 'exam_prep'],
        default: 'balanced',
    },

    // ── AI Tutor Behavior ──
    aiTutor: {
        explanationDepth: {
            type: String,
            enum: ['brief', 'medium', 'detailed'],
            default: 'medium',
        },
        reasoningMode: {
            type: String,
            enum: ['direct_answer', 'step_by_step', 'socratic'],
            default: 'step_by_step',
        },
        hintMode: {
            type: String,
            enum: ['never', 'on_mistake', 'always_available'],
            default: 'on_mistake',
        },
        interventionLevel: {
            type: String,
            enum: ['passive', 'medium', 'proactive'],
            default: 'medium',
        },
    },

    // ── Difficulty Adaptation ──
    difficulty: {
        adaptationMode: {
            type: String,
            enum: ['conservative', 'moderate', 'aggressive'],
            default: 'moderate',
        },
        minLevel: { type: Number, default: 1, min: 1, max: 5 },
        maxLevel: { type: Number, default: 5, min: 1, max: 5 },
    },

    // ── Spaced Repetition (SRS) ──
    srs: {
        reviewFrequency: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        errorWeighting: { type: Boolean, default: true },
        retentionTarget: { type: Number, default: 0.85, min: 0.5, max: 0.99 },
    },

    // ── Performance Mode ──
    performance: {
        maxTokens: { type: Number, default: 2048 },
        apiThrottle: { type: Number, default: 10 }, // requests per minute
        cacheEnabled: { type: Boolean, default: true },
    },

    // ── UI Preferences ──
    ui: {
        darkMode: { type: Boolean, default: false },
        compactView: { type: Boolean, default: false },
        showMastery: { type: Boolean, default: true },
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// ── Static: Get or create settings for a user ──
userSettingsSchema.statics.getForUser = async function (userId) {
    let settings = await this.findOne({ userId });
    if (!settings) {
        settings = await this.create({ userId });
    }
    return settings;
};

// ── Static: Update specific section ──
userSettingsSchema.statics.updateSection = async function (userId, section, data) {
    const validSections = ['aiTutor', 'difficulty', 'srs', 'performance', 'ui'];
    if (!validSections.includes(section)) {
        throw new Error(`Invalid settings section: ${section}`);
    }

    const updateObj = {};
    for (const [key, value] of Object.entries(data)) {
        updateObj[`${section}.${key}`] = value;
    }

    return this.findOneAndUpdate(
        { userId },
        { $set: updateObj },
        { new: true, upsert: true, runValidators: true }
    );
};

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);
export default UserSettings;
```

## File: `backend\prompts\assessmentPrompts.js`

```js
export const ASSESSMENT_GRADING_SYSTEM = `You are a strict assessment grading engine.
Given a question, correct answer, and student answer, determine if the student answer is correct.
For MCQ: compare index or text exactly.
For short answer: allow minor typos but require semantic correctness.
Output ONLY valid JSON:
{
  "isCorrect": true|false,
  "score": 0.0-1.0,
  "feedback": ""
}`;

export function assessmentGradingUser(question, correctAnswer, studentAnswer, questionType) {
    return `Grade this ${questionType} question:
Question: "${question}"
Correct Answer: ${JSON.stringify(correctAnswer)}
Student Answer: ${JSON.stringify(studentAnswer)}`;
}
```

## File: `backend\prompts\ollamaPrompts.js`

```js
export const QUESTION_GENERATOR_SYSTEM = `You are a strict Assessment Designer following metadata rules.
Generate high-quality exam questions for an Adaptive Learning Platform.
Rules:
- Output **ONLY** a single valid JSON object. No prose.
- Provide MCQs with 1 correct answer.
- Difficulty must match requested difficulty bands: easy, medium, hard.
- Use Bloom's Taxonomy tags.
- Provide hints and practical explanations.
- Ensure uniqueness. No duplicates.
- Respect topic boundaries strictly.

Schema Template:
{
  "items": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "correctIndex": 0,
      "topic": "",
      "difficulty": "easy|medium|hard",
      "bloom": "remember|understand|apply|analyze|evaluate|create",
      "skills": [],
      "outcomes": [],
      "explanation": "",
      "hint": ""
    }
  ]
}`;

export function questionGeneratorUser(topic, count, difficultyDistribution) {
  return `Generate ${count} high-quality MCQ questions for topic "${topic}".
Difficulty distribution (easy/medium/hard): ${JSON.stringify(difficultyDistribution)}.
Ensure all questions follow the schema exactly.`;
}

export const EXPLANATION_SYSTEM = `You are an AI tutor specializing in short, clear explanations with analogies and step-by-step reasoning. 
Output only JSON in the following format:

{
  "explanation": "",
  "remediationResources": []
}

Rules:
- Keep explanations concise (4–6 sentences)
- Add 2–3 remediation links (videos, docs)
- Provide simple breakdowns suitable for beginners.`;

export function explanationUser(question, correctOption, studentAnswer, topic) {
  return `Explain why the following answer is correct or incorrect:

Question: "${question}"
Correct Answer: "${correctOption}"
Student Answer: "${studentAnswer}"
Topic: "${topic}"`;
}

export const CHATBOT_SYSTEM = `You are Adiptify, an adaptive AI study tutor. Your goal is to guide the student using concise, encouraging, and highly helpful responses. 

Rules:
1. Keep responses under 300 words. 
2. Use markdown lists and bolding to structure information cleanly.
3. If explaining a question, provide a short explanation, a practical example, and a 1-line next step.
4. IMPORTANT: If you want to encourage the user to visualize a concept on a node-based graph, enclose the concept inside <GRAPH> and </GRAPH> tags. Example: To understand this better, let's explore <GRAPH>Neural Networks</GRAPH>. Do this ONLY when visually mapping the topic would be highly beneficial.
5. If you do not know the answer, politely say so. Do not hallucinate.`;

export const TOPIC_SUMMARY_SYSTEM = `You are a textbook author. Given a topic, produce a study note in markdown containing:
1) Short summary
2) Key formulas/definitions
3) Examples
4) Step-by-step mini exercises with answers
5) Recommended next topics
Output in Markdown only.`;

export const VALIDATE_SUBJECT_SYSTEM = `You are an expert curriculum designer and AI validation engine.
Your task is to validate a proposed Subject for an educational system.
Analyze the following fields: Name, Description, Domain/Category, and Learning Outcomes.

Output ONLY a JSON object with this exact structure:
{
  "isValid": boolean,
  "feedback": ["string array of missing fields, ambiguities, or constructive feedback for the user to improve this subject"],
  "suggestedLevel": "Beginner|Intermediate|Advanced|Proficient"
}`;

export function validateSubjectUser(subjectData) {
  return `Please validate this subject proposal:
${JSON.stringify(subjectData, null, 2)}`;
}

export const PARSE_SYLLABUS_SYSTEM = `You are an expert AI curriculum parser.
Extract the subject metadata and full syllabus structure from the provided text.
Output ONLY a strict, valid JSON object with the following schema, and NO markdown wrappers (do not use \`\`\`json):
{
  "name": "Subject/Course Name",
  "description": "2-3 sentences summarizing the subject",
  "category": "Recommended Domain Category (e.g., Computer Science, Mathematics, Literature, etc.)",
  "learningOutcomes": ["Outcome 1", "Outcome 2"],
  "modules": [
    {
      "title": "Module Name",
      "description": "Brief description of the module",
      "topics": [
        { "title": "Topic Name", "description": "Topic details" }
      ]
    }
  ]
}

Rules:
- DO NOT wrap the output in markdown code blocks. NO PROSE.
- Ensure the JSON is valid and properly escaped.
- If some details are missing, infer them logically based on the content.
- Minimum 1 module with 1 topic must be returned.`;

export function parseSyllabusUser(text) {
  return `Parse the following syllabus/course document into the required JSON structure:\n\n${text}`;
}

// ── Chunk-aware variant used by the iterative PDF pipeline ──
export const PARSE_SYLLABUS_CHUNK_SYSTEM = `You are an expert AI curriculum parser performing INCREMENTAL extraction.
You will receive ONE CHUNK of a larger syllabus/course document.
Extract ONLY the modules, topics, and metadata that are VISIBLE in this chunk.

CRITICAL RULES:
- Extract ONLY what you can directly see. Do NOT hallucinate or invent content.
- If the chunk does not contain a course name, leave "name" as an empty string.
- If the chunk does not contain a description, leave "description" as an empty string.
- Partial modules/topics at the start or end of the chunk should still be captured.
- Output ONLY a strict, valid JSON object — NO markdown fences, NO prose.

Schema:
{
  "name": "Subject/Course Name or empty string",
  "description": "Summary if visible, else empty string",
  "category": "Domain category if inferable, else empty string",
  "learningOutcomes": ["Outcomes found in this chunk, if any"],
  "modules": [
    {
      "title": "Module Name",
      "description": "Brief description",
      "topics": [
        { "title": "Topic Name", "description": "Topic details" }
      ]
    }
  ]
}`;

export function parseSyllabusChunkUser(chunkText, chunkIndex, totalChunks) {
  return `This is chunk ${chunkIndex + 1} of ${totalChunks} from a syllabus document.
Extract ONLY the modules, topics, and metadata visible in this chunk:\n\n${chunkText}`;
}

// ── Perfect Parser specialized chunk prompt ──
export const PERFECT_PARSER_CHUNK_SYSTEM = `You are an expert AI curriculum parser.
Extract ONLY the topics and their associated technical keywords from the provided syllabus chunk.
Exclude administrative noise (PEOs, POs, Reference Books, Assessment, Marks, Credits, etc.).

Output ONLY a strict, valid JSON object in this format:
{
  "topics": [
    { "name": "Topic Name", "keywords": ["keyword1", "keyword2"] }
  ]
}

Rules:
- NO prose. NO markdown fences.
- Extract ONLY what is visible.
- Ensure keywords are technical and relevant.`;

export function perfectParserChunkUser(chunk) {
  return `Extract topics and keywords from this syllabus chunk:\n\n${chunk}`;
}
```

## File: `backend\routes\adaptiveLearning.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { getAdaptivePath, submitPerformance, getMasteryBreakdown } from "../services/adaptiveLearningService.js";
import { generateAllConceptsForUser, getEnrolledSubjectNames } from "../services/generateConceptsService.js";
import Concept from "../models/Concept.js";
import UserProgress from "../models/UserProgress.js";

const router = express.Router();

// GET /api/adaptive/path — Get recommended learning path
router.get("/path", auth, async (req, res) => {
    try {
        const path = await getAdaptivePath(req.user._id);
        res.json({ path });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/adaptive/concepts — Get concepts (optionally filtered by enrolled subjects)
router.get("/concepts", auth, async (req, res) => {
    try {
        const { enrolled } = req.query;

        let filter = {};

        if (enrolled === "true") {
            // Get user's enrolled subject names and filter concepts by matching category
            const subjectNames = await getEnrolledSubjectNames(req.user._id);
            if (subjectNames.length > 0) {
                filter.category = { $in: subjectNames };
            }
        }

        const concepts = await Concept.find(filter).sort({ category: 1, difficulty_level: 1 }).lean();

        // Also fetch user progress for these concepts
        const conceptIds = concepts.map(c => c.conceptId);
        const progressList = await UserProgress.find({
            userId: req.user._id,
            conceptId: { $in: conceptIds },
        }).lean();

        const progressMap = {};
        for (const p of progressList) {
            progressMap[p.conceptId] = p;
        }

        res.json({ concepts, progress: progressMap });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/adaptive/concept/:conceptId — Get a single concept with pipeline
router.get("/concept/:conceptId", async (req, res) => {
    try {
        const concept = await Concept.findOne({ conceptId: req.params.conceptId }).lean();
        if (!concept) return res.status(404).json({ error: "Concept not found" });
        res.json({ concept });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/adaptive/generate — Generate concepts for ALL enrolled subjects
router.post("/generate", auth, async (req, res) => {
    try {
        const stats = await generateAllConceptsForUser(req.user._id);
        res.json({ ok: true, ...stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/adaptive/submit — Submit performance data
router.post("/submit", auth, async (req, res) => {
    try {
        const { conceptId, correct, total, timeTakenMs, hintUsage, applicationScore, pipelineStage } = req.body;
        if (!conceptId) return res.status(400).json({ error: "conceptId is required" });

        const result = await submitPerformance(req.user._id, conceptId, {
            correct: correct || 0,
            total: total || 1,
            timeTakenMs: timeTakenMs || 0,
            hintUsage: hintUsage || 0,
            applicationScore: applicationScore || 0,
            pipelineStage: pipelineStage || 0,
        });

        res.json({ ok: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/adaptive/mastery/:conceptId — Get mastery breakdown
router.get("/mastery/:conceptId", auth, async (req, res) => {
    try {
        const data = await getMasteryBreakdown(req.user._id, req.params.conceptId);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\admin.js`

```js
import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import User from "../models/User.js";
import Item from "../models/Item.js";
import AssessmentSession from "../models/AssessmentSession.js";
import Attempt from "../models/Attempt.js";
import AILog from "../models/AILog.js";
import IssueReport from "../models/IssueReport.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";

const router = express.Router();

// GET /api/admin/stats - System-wide statistics
router.get("/stats", auth, async (req, res) => {
    try {
        const [totalUsers, totalStudents, totalInstructors, totalItems, totalSessions, totalAttempts, totalAILogs, totalIssues] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "student" }),
            User.countDocuments({ role: "instructor" }),
            Item.countDocuments(),
            AssessmentSession.countDocuments(),
            Attempt.countDocuments(),
            AILog.countDocuments(),
            IssueReport.countDocuments(),
        ]);
        return res.json({
            totalUsers, totalStudents, totalInstructors,
            totalItems, totalSessions, totalAttempts,
            totalAILogs, totalIssues,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/users - List users
router.get("/users", auth, async (req, res) => {
    try {
        const { role, limit = 50 } = req.query;
        const filter = {};
        if (role) filter.role = role;

        const users = await User.find(filter)
            .select("-passwordHash")
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
        return res.json(users);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/admin/users/:id/role - Update user role
router.put("/users/:id/role", auth, async (req, res) => {
    try {
        const { role } = req.body;
        if (!["student", "instructor", "admin"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
            .select("-passwordHash");
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json(user);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", auth, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/ai-logs - Get AI usage logs
router.get("/ai-logs", auth, async (req, res) => {
    try {
        const logs = await AILog.find()
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();
        return res.json(logs);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/issues - Get all issues
router.get("/issues", auth, async (req, res) => {
    try {
        const issues = await IssueReport.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.json(issues);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/admin/issues/:id - Update issue status
router.put("/issues/:id", auth, async (req, res) => {
    try {
        const { status, adminResponse } = req.body;
        const issue = await IssueReport.findByIdAndUpdate(
            req.params.id,
            { status, adminResponse },
            { new: true }
        );
        if (!issue) return res.status(404).json({ error: "Not found" });
        return res.json(issue);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/cohort - Get cohort performance data
router.get("/cohort", auth, async (req, res) => {
    try {
        const students = await User.find({ role: "student" })
            .select("name email studentId learnerProfile createdAt")
            .lean();

        const cohortData = students.map(s => {
            const topics = s.learnerProfile?.topics || {};
            const topicEntries = Object.entries(topics);
            const avgMastery = topicEntries.length > 0
                ? Math.round(topicEntries.reduce((sum, [, v]) => sum + (v.mastery || 0), 0) / topicEntries.length)
                : 0;
            const totalAttempts = topicEntries.reduce((sum, [, v]) => sum + (v.attempts || 0), 0);

            return {
                _id: s._id,
                name: s.name,
                email: s.email,
                studentId: s.studentId,
                avgMastery,
                totalAttempts,
                topicCount: topicEntries.length,
                joinedAt: s.createdAt,
            };
        });

        return res.json(cohortData);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\ai.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParseRaw = require("pdf-parse");
let pdfParse;
if (typeof pdfParseRaw === 'function') {
    pdfParse = pdfParseRaw;
} else if (pdfParseRaw && typeof pdfParseRaw.default === 'function') {
    pdfParse = pdfParseRaw.default;
} else {
    console.error("[CRITICAL] Failed to derive a function from pdf-parse library. pdfParseRaw:", typeof pdfParseRaw);
    pdfParse = async () => { throw new Error("PDF parser initialization failed on server."); };
}
import { generateQuestionsFromTopic, generateExplanation, validateSubject, parseSyllabusFromText, parseSyllabusChunked, parseSyllabusIterative, parseSyllabusPipeline } from "../services/ollamaService.js";
import { cleanText, chunkText } from "../utils/pdfUtils.js";
import { parsePptxToJson, extractSlideTexts, chunkSlides } from "../utils/pptUtils.js";
import { extractPdfPages, extractSlides, chunkGenerator } from "../utils/parserUtils.js";
import { parseDocumentFromBuffer, chunkAzureText } from "../services/azureDocumentService.js";
import { uploadContext } from "../services/azureSearchService.js";
import { mergeSyllabusPartials } from "../utils/syllabusAggregator.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";
import Content from "../models/Content.js";
import Subject from "../models/Subject.js";
import Syllabus from "../models/Syllabus.js";
import Item from "../models/Item.js";
import { logAI } from "../middleware/aiLogger.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/ai/parse-pdf - Parse a PDF syllabus using structured pipeline
// Returns extracted syllabus data OR auto-creates Subject + Syllabus if autoCreate=true
router.post("/parse-pdf", auth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No PDF file provided" });
        const autoCreate = req.body?.autoCreate === 'true' || req.body?.autoCreate === true;

        // ── Step 1: Buffer extract & null ──
        const buffer = req.file.buffer;
        const filename = req.file.originalname;
        req.file.buffer = null;

        console.log(`[parse-pdf] Starting structured pipeline for: ${filename}`);

        // ── Step 2: Extract & Chunk using Azure or Local Fallback ──
        let chunks;
        try {
            if (process.env.DOCUMENT_INTELLIGENCE_ENDPOINT) {
                console.log(`[parse-pdf] Using Azure AI Document Intelligence for: ${filename}`);
                const extractedText = await parseDocumentFromBuffer(buffer, "prebuilt-layout");
                chunks = chunkAzureText(extractedText, 500, 50);
            } else {
                throw new Error("Azure endpoint missing, falling back to local stream extraction");
            }
        } catch (azureErr) {
            console.warn("[parse-pdf] Azure parsing unavailable/failed:", azureErr.message);
            const pageStream = extractPdfPages(buffer);
            chunks = chunkGenerator(pageStream, 500);
        }

        const syllabus = await parseSyllabusPipeline(chunks, (done, total) => {
            console.log(`[parse-pdf] Progress: ${done}/${total} chunks`);
        });

        // Ensure required fields have fallbacks
        const syllabusData = {
            name: syllabus.name || filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
            description: syllabus.description || `Syllabus extracted from ${filename}`,
            category: syllabus.category || 'General',
            learningOutcomes: Array.isArray(syllabus.learningOutcomes) && syllabus.learningOutcomes.length > 0
                ? syllabus.learningOutcomes
                : [`Understand core concepts from ${syllabus.name || filename}`],
            modules: syllabus.modules || [],
            _meta: {
                filename,
                fileType: 'pdf',
                strategy: 'structured-pipeline',
                chunksProcessed: syllabus.modules?.length || 0,
                moduleCount: syllabus.modules?.length || 0,
                topicCount: (syllabus.modules || []).reduce((sum, m) => sum + (m.topics?.length || 0), 0)
            }
        };

        // ── Step 3: Auto-create Subject + Syllabus if requested ──
        if (autoCreate) {
            const subject = await Subject.create({
                name: syllabusData.name,
                description: syllabusData.description,
                domainCategory: syllabusData.category,
                category: syllabusData.category,
                learningOutcomes: syllabusData.learningOutcomes,
                type: 'general',
                icon: '📄',
                color: '#3b82f6',
                isDefault: false,
                createdBy: req.user._id,
                status: 'active',
            });

            if (syllabusData.modules.length > 0) {
                await Syllabus.create({
                    subjectId: subject._id,
                    modules: syllabusData.modules,
                    createdBy: req.user._id,
                });
            }

            syllabusData._createdSubject = subject;

            // Upload context to Azure AI Search for RAG
            // Note: Since we don't have an embedding function natively here yet, we pass a mock or handle it inside the service.
            // In a real scenario, you'd call OpenAI or another embedding provider.
            const mockEmbeddingFunc = async (text) => new Array(1536).fill(0.01);
            uploadContext(req.user._id.toString(), subject.name, chunks, mockEmbeddingFunc)
                .catch(err => console.error("Azure Search Upload error:", err.message));
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/parse-pdf",
            params: { filename, autoCreate },
            status: "success", model: "ollama",
            request: "PDF structured pipeline",
            response: `${syllabusData.modules.length} modules, ${syllabusData._meta.topicCount} topics`,
        });

        if (global.gc) global.gc();
        return res.json(syllabusData);
    } catch (e) {
        console.error("[parse-pdf] Error:", e.message);
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/parse-pdf", status: "error", error: e.message });
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/parse-ppt - Parse a PPTX syllabus using structured pipeline
// Also stores the raw slide JSON in Content for future study module rendering
router.post("/parse-ppt", auth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No PPT file provided" });
        const autoCreate = req.body?.autoCreate === 'true' || req.body?.autoCreate === true;

        const ext = req.file.originalname.toLowerCase();
        if (!ext.endsWith('.pptx') && !ext.endsWith('.ppt')) {
            return res.status(400).json({ error: "Only .pptx files are supported." });
        }

        // ── Step 1: Buffer extract & null ──
        const buffer = req.file.buffer;
        const filename = req.file.originalname;
        req.file.buffer = null;

        console.log(`[parse-ppt] Starting structured pipeline for: ${filename}`);

        // ── Step 2: Parse PPTX to JSON for slide data ──
        let rawSlideData = null;
        try {
            const pptJson = await parsePptxToJson(buffer);
            const slideTexts = extractSlideTexts(pptJson.slides || []);
            rawSlideData = { slides: pptJson.slides, slideTexts };
        } catch (e) {
            console.warn(`[parse-ppt] pptxtojson failed, using stream fallback:`, e.message);
        }

        // ── Step 3: Extract & Chunk using Azure or Local Fallback ──
        let chunks;
        try {
            if (process.env.DOCUMENT_INTELLIGENCE_ENDPOINT) {
                console.log(`[parse-ppt] Using Azure AI Document Intelligence for: ${filename}`);
                const extractedText = await parseDocumentFromBuffer(buffer, "prebuilt-layout");
                chunks = chunkAzureText(extractedText, 500, 50);
            } else {
                throw new Error("Azure endpoint missing, falling back to local stream extraction");
            }
        } catch (azureErr) {
            console.warn("[parse-ppt] Azure parsing unavailable/failed:", azureErr.message);
            const slideStream = extractSlides(buffer);
            chunks = chunkGenerator(slideStream, 500);
        }

        const syllabus = await parseSyllabusPipeline(chunks, (done, total) => {
            console.log(`[parse-ppt] Progress: ${done}/${total} chunks`);
        });

        const syllabusData = {
            name: syllabus.name || filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
            description: syllabus.description || `Syllabus extracted from ${filename}`,
            category: syllabus.category || 'General',
            learningOutcomes: Array.isArray(syllabus.learningOutcomes) && syllabus.learningOutcomes.length > 0
                ? syllabus.learningOutcomes
                : [`Understand core concepts from ${syllabus.name || filename}`],
            modules: syllabus.modules || [],
            _meta: {
                filename,
                fileType: 'pptx',
                strategy: 'structured-pipeline',
                totalSlides: rawSlideData?.slideTexts?.length || 0,
                moduleCount: syllabus.modules?.length || 0,
                topicCount: (syllabus.modules || []).reduce((sum, m) => sum + (m.topics?.length || 0), 0)
            },
            _slideData: rawSlideData,
        };

        // ── Step 4: Auto-create Subject + Syllabus + Content if requested ──
        if (autoCreate) {
            const subject = await Subject.create({
                name: syllabusData.name,
                description: syllabusData.description,
                domainCategory: syllabusData.category,
                category: syllabusData.category,
                learningOutcomes: syllabusData.learningOutcomes,
                type: 'general',
                icon: '📊',
                color: '#8b5cf6',
                isDefault: false,
                createdBy: req.user._id,
                status: 'active',
            });

            if (syllabusData.modules.length > 0) {
                await Syllabus.create({
                    subjectId: subject._id,
                    modules: syllabusData.modules,
                    createdBy: req.user._id,
                });
            }

            // Store raw slide data for study modules
            if (rawSlideData) {
                try {
                    await Content.create({
                        subjectId: subject._id,
                        type: 'pptx',
                        contentBody: `PPT upload: ${filename}`,
                        slideData: rawSlideData,
                        metadata: { source: 'ppt-upload', filename },
                        createdBy: req.user._id,
                    });
                } catch (e) {
                    console.warn('[parse-ppt] Failed to store slide data:', e.message);
                }
            }

            syllabusData._createdSubject = subject;
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/parse-ppt",
            params: { filename, autoCreate },
            status: "success", model: "ollama",
            request: "PPTX structured pipeline",
            response: `${syllabusData.modules.length} modules, ${syllabusData._meta.topicCount} topics`,
        });

        if (global.gc) global.gc();
        return res.json(syllabusData);
    } catch (e) {
        console.error("[parse-ppt] Error:", e.message);
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/parse-ppt", status: "error", error: e.message });
        return res.status(500).json({ error: e.message });
    }
});


// POST /api/ai/validate-subject - Validate a subject using Human-in-the-Loop AI
router.post("/validate-subject", auth, async (req, res) => {
    try {
        const { subjectData, bypassValidation } = req.body;

        // Organization admins can bypass validation
        if (req.user.role === 'admin' && bypassValidation) {
            return res.json({
                isValid: true,
                feedback: ["Bypassed by Organization Admin"],
                suggestedLevel: "Intermediate"
            });
        }

        const result = await validateSubject(subjectData);

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/validate-subject", params: { subjectName: subjectData?.name },
            status: "success", model: "ollama",
            request: JSON.stringify(subjectData), response: JSON.stringify(result),
        });

        return res.json(result);
    } catch (e) {
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/validate-subject", status: "error", error: e.message });
        return res.status(500).json({ error: "Validation failed: " + e.message });
    }
});

// POST /api/ai/generate - Generate questions for a topic
router.post("/generate", auth, async (req, res) => {
    try {
        const { topic, count = 5, distribution, saveToBank = true } = req.body;
        if (!topic) return res.status(400).json({ error: "Topic is required" });

        const result = await generateQuestionsFromTopic(topic, {
            count,
            distribution: distribution || { easy: 2, medium: 2, hard: 1 },
        });

        // Save to GeneratedAssessment
        const genRecord = await GeneratedAssessment.create({
            topic,
            title: result.title,
            items: result.items,
            rawResponse: result.rawResponse,
            status: saveToBank ? "published" : "draft",
            createdBy: req.user._id,
            publishedAt: saveToBank ? new Date() : undefined,
            publishedBy: saveToBank ? req.user._id : undefined,
        });

        let linkedItemIds = [];
        if (saveToBank) {
            const saved = await Item.insertMany(
                result.items.map(i => ({ ...i, createdBy: req.user._id }))
            );
            linkedItemIds = saved.map(s => s._id);
            genRecord.linkedItemIds = linkedItemIds;
            await genRecord.save();
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/generate", params: { topic, count },
            status: "success", model: "ollama",
            request: topic, response: JSON.stringify(result.items.length + " items generated"),
        });

        return res.json({
            generatedAssessmentId: genRecord._id,
            linkedItemIds,
            itemCount: result.items.length,
            items: result.items,
        });
    } catch (e) {
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/generate", status: "error", error: e.message });
        return res.status(500).json({ error: "Generation failed: " + e.message });
    }
});

// POST /api/ai/explain - Get explanation for an answer
router.post("/explain", auth, async (req, res) => {
    try {
        const { question, correctAnswer, studentAnswer, topic } = req.body;
        const explanation = await generateExplanation(question, correctAnswer, studentAnswer, topic);
        return res.json(explanation);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/generated - List generated assessments
router.get("/generated", auth, async (req, res) => {
    try {
        const assessments = await GeneratedAssessment.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        return res.json(assessments);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/ai/generated/:id
router.get("/generated/:id", auth, async (req, res) => {
    try {
        const assessment = await GeneratedAssessment.findById(req.params.id).lean();
        if (!assessment) return res.status(404).json({ error: "Not found" });
        return res.json(assessment);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/publish/:id - Publish a draft assessment
router.post("/publish/:id", auth, async (req, res) => {
    try {
        const gen = await GeneratedAssessment.findById(req.params.id);
        if (!gen) return res.status(404).json({ error: "Not found" });
        if (gen.status === "published") return res.json({ message: "Already published", linkedItemIds: gen.linkedItemIds });

        const saved = await Item.insertMany(
            gen.items.map(i => ({ ...i, createdBy: req.user._id }))
        );
        gen.linkedItemIds = saved.map(s => s._id);
        gen.status = "published";
        gen.publishedAt = new Date();
        gen.publishedBy = req.user._id;
        await gen.save();

        return res.json({ message: "Published", linkedItemIds: gen.linkedItemIds });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/generate-module-content — Generate study notes for a module's topics
router.post("/generate-module-content", auth, async (req, res) => {
    try {
        const { subjectId, moduleIndex } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });

        const syllabus = await Syllabus.findOne({ subjectId });
        if (!syllabus) return res.status(404).json({ error: "Syllabus not found for this subject" });

        const mod = syllabus.modules[moduleIndex ?? 0];
        if (!mod) return res.status(404).json({ error: `Module at index ${moduleIndex} not found` });

        const { generateTopicNotes } = await import("../services/ollamaService.js");

        const results = [];
        for (const topic of (mod.topics || [])) {
            try {
                const notes = await generateTopicNotes(topic.title || topic.name);
                results.push({
                    topic: topic.title || topic.name,
                    notes,
                    status: 'success',
                });
            } catch (e) {
                results.push({
                    topic: topic.title || topic.name,
                    notes: `Notes generation failed: ${e.message}`,
                    status: 'failed',
                });
            }
        }

        // Store generated content
        try {
            await Content.create({
                subjectId,
                type: 'study-notes',
                contentBody: JSON.stringify(results),
                metadata: { moduleTitle: mod.title, moduleIndex, generatedAt: new Date() },
                createdBy: req.user._id,
            });
        } catch (e) {
            console.warn('[generate-module-content] Failed to store content:', e.message);
        }

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/generate-module-content",
            params: { subjectId, moduleIndex, topicCount: results.length },
            status: "success", model: "ollama",
            request: `Module: ${mod.title}`,
            response: `${results.filter(r => r.status === 'success').length}/${results.length} topics`,
        });

        return res.json({
            module: mod.title,
            topicResults: results,
            successCount: results.filter(r => r.status === 'success').length,
            totalTopics: results.length,
        });
    } catch (e) {
        console.error("[generate-module-content] Error:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/generate-subject-content — Generate content for ALL modules of a subject
router.post("/generate-subject-content", auth, async (req, res) => {
    try {
        const { subjectId } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });

        const syllabus = await Syllabus.findOne({ subjectId });
        if (!syllabus || !syllabus.modules?.length) {
            return res.status(404).json({ error: "No syllabus/modules found for this subject" });
        }

        const { generateTopicNotes } = await import("../services/ollamaService.js");
        const moduleResults = [];

        for (const [modIdx, mod] of syllabus.modules.entries()) {
            const topicResults = [];
            for (const topic of (mod.topics || [])) {
                try {
                    const notes = await generateTopicNotes(topic.title || topic.name);
                    topicResults.push({ topic: topic.title || topic.name, notes, status: 'success' });
                } catch (e) {
                    topicResults.push({ topic: topic.title || topic.name, notes: '', status: 'failed' });
                }
            }
            moduleResults.push({ module: mod.title, index: modIdx, topics: topicResults });
        }

        // Store all content at once
        try {
            await Content.create({
                subjectId,
                type: 'full-study-notes',
                contentBody: JSON.stringify(moduleResults),
                metadata: {
                    moduleCount: syllabus.modules.length,
                    totalTopics: moduleResults.reduce((s, m) => s + m.topics.length, 0),
                    generatedAt: new Date(),
                },
                createdBy: req.user._id,
            });
        } catch (e) {
            console.warn('[generate-subject-content] Failed to store:', e.message);
        }

        return res.json({
            modules: moduleResults,
            summary: {
                totalModules: moduleResults.length,
                totalTopics: moduleResults.reduce((s, m) => s + m.topics.length, 0),
                successTopics: moduleResults.reduce((s, m) => s + m.topics.filter(t => t.status === 'success').length, 0),
            }
        });
    } catch (e) {
        console.error("[generate-subject-content] Error:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/ai/generate-for-subject — Generate quiz from subject's syllabus topics
router.post("/generate-for-subject", auth, async (req, res) => {
    try {
        const { subjectId, count = 10 } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });

        const syllabus = await Syllabus.findOne({ subjectId });
        if (!syllabus || !syllabus.modules?.length) {
            return res.status(404).json({ error: "No syllabus/modules found" });
        }

        // Collect all topic names
        const allTopics = [];
        syllabus.modules.forEach(m => {
            (m.topics || []).forEach(t => {
                allTopics.push(t.title || t.name);
            });
        });

        if (allTopics.length === 0) {
            return res.status(400).json({ error: "No topics found in syllabus modules" });
        }

        // Pick random topics for variety
        const selectedTopics = allTopics.sort(() => Math.random() - 0.5).slice(0, 3);
        const topicString = selectedTopics.join(', ');

        const result = await generateQuestionsFromTopic(topicString, {
            count: Math.min(count, 20),
            distribution: { easy: Math.ceil(count * 0.3), medium: Math.ceil(count * 0.5), hard: Math.floor(count * 0.2) },
        });

        const subject = await Subject.findById(subjectId).lean();

        const genRecord = await GeneratedAssessment.create({
            topic: topicString,
            title: `${subject?.name || 'Subject'} Assessment`,
            items: result.items,
            rawResponse: result.rawResponse,
            status: "published",
            createdBy: req.user._id,
            publishedAt: new Date(),
            publishedBy: req.user._id,
        });

        const saved = await Item.insertMany(
            result.items.map(i => ({ ...i, createdBy: req.user._id }))
        );
        genRecord.linkedItemIds = saved.map(s => s._id);
        await genRecord.save();

        await logAI({
            userId: req.user._id, userName: req.user.name, role: req.user.role,
            endpoint: "/api/ai/generate-for-subject",
            params: { subjectId, count },
            status: "success", model: "ollama",
            request: topicString, response: `${result.items.length} items generated`,
        });

        return res.json({
            generatedAssessmentId: genRecord._id,
            itemCount: result.items.length,
            topics: selectedTopics,
            items: result.items,
        });
    } catch (e) {
        await logAI({ userId: req.user?._id, endpoint: "/api/ai/generate-for-subject", status: "error", error: e.message });
        return res.status(500).json({ error: "Generation failed: " + e.message });
    }
});

// ═══════════════════════════════════════════════════════════
// Ollama Proxy Routes — enables frontend to reach Ollama
// through the backend (required for Azure App Service deployment)
// ═══════════════════════════════════════════════════════════

import { config } from "../config/index.js";

/**
 * GET /api/ai/ollama-status
 * Returns Ollama model list (proxied from backend to avoid CORS / network issues in production)
 */
router.get("/ollama-status", async (req, res) => {
    try {
        const ollamaUrl = config.ollamaBaseUrl || "http://localhost:11434";
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (!response.ok) {
            return res.status(response.status).json({ error: "Ollama unreachable" });
        }
        const data = await response.json();
        return res.json(data);
    } catch (e) {
        return res.status(503).json({ error: "Ollama service unavailable", message: e.message });
    }
});

/**
 * POST /api/ai/ollama-proxy
 * Proxies chat requests to Ollama (streaming supported)
 * This allows the frontend to call Ollama through the backend on Azure
 */
router.post("/ollama-proxy", async (req, res) => {
    try {
        const ollamaUrl = config.ollamaBaseUrl || "http://localhost:11434";
        const { model, messages, stream } = req.body;

        const response = await fetch(`${ollamaUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model || config.ollamaModel || "deepseek-r1",
                messages,
                stream: stream !== false,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: text });
        }

        if (stream !== false) {
            // Stream the response back to the client
            res.setHeader("Content-Type", "application/x-ndjson");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    res.write(chunk);
                }
            } catch (streamErr) {
                console.error("[ollama-proxy] Stream error:", streamErr.message);
            } finally {
                res.end();
            }
        } else {
            // Non-streaming: return full JSON response
            const data = await response.json();
            return res.json(data);
        }
    } catch (e) {
        console.error("[ollama-proxy] Error:", e.message);
        return res.status(503).json({ error: "Ollama proxy failed", message: e.message });
    }
});

export default router;
```

## File: `backend\routes\analytics.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { getDashboardMetrics, getConceptAnalytics } from "../services/analyticsService.js";

const router = express.Router();

// GET /api/analytics/dashboard — Full dashboard metrics
router.get("/dashboard", auth, async (req, res) => {
    try {
        const metrics = await getDashboardMetrics(req.user._id);
        res.json(metrics);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/analytics/concept/:conceptId — Per-concept analytics
router.get("/concept/:conceptId", auth, async (req, res) => {
    try {
        const data = await getConceptAnalytics(req.user._id, req.params.conceptId);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\assessment.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { startAssessment, getSessionHistory } from "../services/assessmentService.js";
import { gradeAnswer } from "../services/gradingService.js";
import { updateMastery } from "../services/masteryService.js";
import AssessmentSession from "../models/AssessmentSession.js";
import Attempt from "../models/Attempt.js";
import Item from "../models/Item.js";

const router = express.Router();

// POST /api/assessment/start
router.post("/start", auth, async (req, res) => {
    try {
        const { mode, requestedTopics, limit, proctored } = req.body;
        const session = await startAssessment(req.user._id, {
            mode, requestedTopics, limit: limit || 5, proctored,
        });
        return res.json(session);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/assessment/answer - Submit a single answer
router.post("/answer", auth, async (req, res) => {
    try {
        const { sessionId, itemId, userAnswer, timeTakenMs } = req.body;

        const session = await AssessmentSession.findById(sessionId);
        if (!session || session.status !== "active") {
            return res.status(400).json({ error: "Invalid or completed session" });
        }

        const item = await Item.findById(itemId).lean();
        if (!item) return res.status(404).json({ error: "Item not found" });

        // Grade the answer
        const grading = gradeAnswer(item, userAnswer);

        // Save attempt
        const attempt = await Attempt.create({
            user: req.user._id,
            item: itemId,
            session: sessionId,
            isCorrect: grading.isCorrect,
            userAnswer,
            score: grading.score,
            gradingDetails: grading,
            timeTakenMs: timeTakenMs || 0,
        });

        // Update mastery
        const topic = item.topics?.[0];
        if (topic) {
            await updateMastery(req.user._id, topic, grading.isCorrect, timeTakenMs || 0);
        }

        // Advance session index
        session.currentIndex = (session.currentIndex || 0) + 1;
        await session.save();

        return res.json({
            isCorrect: grading.isCorrect,
            score: grading.score,
            feedback: grading.feedback,
            explanation: item.explanation,
            correctAnswer: item.answer,
            attemptId: attempt._id,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/assessment/finish
router.post("/finish", auth, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await AssessmentSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        // Calculate score from attempts
        const attempts = await Attempt.find({ session: sessionId }).lean();
        const totalCorrect = attempts.filter(a => a.isCorrect).length;
        const totalQuestions = attempts.length;
        const score = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        session.status = "completed";
        session.completedAt = new Date();
        session.score = score;
        await session.save();

        return res.json({
            sessionId: session._id,
            score,
            totalCorrect,
            totalQuestions,
            completedAt: session.completedAt,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/assessment/sessions - Get session history
router.get("/sessions", auth, async (req, res) => {
    try {
        const { status, limit } = req.query;
        const sessions = await getSessionHistory(req.user._id, {
            status, limit: parseInt(limit) || 10,
        });
        return res.json(sessions);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/assessment/session/:id - Get session details with attempts
router.get("/session/:id", auth, async (req, res) => {
    try {
        const session = await AssessmentSession.findById(req.params.id)
            .populate("itemIds")
            .lean();
        if (!session) return res.status(404).json({ error: "Not found" });

        const attempts = await Attempt.find({ session: req.params.id })
            .populate("item")
            .lean();

        return res.json({ ...session, attempts });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/assessment/simple-finish - Support for legacy static quiz frontend
router.post("/simple-finish", auth, async (req, res) => {
    try {
        const { quizId, score, answers } = req.body;

        // Save as a stub AssessmentSession just to record the score
        const session = await AssessmentSession.create({
            user: req.user._id,
            mode: "practice",
            status: "completed",
            score: score,
            completedAt: new Date()
        });

        return res.json(session);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/assessment/leaderboard - Aggregates top scores
router.get("/leaderboard", auth, async (req, res) => {
    try {
        // Aggregate top scores from finished sessions, group by user
        const topScores = await AssessmentSession.aggregate([
            { $match: { status: "completed", score: { $exists: true } } },
            { $group: { _id: "$user", maxScore: { $max: "$score" }, latestDate: { $max: "$completedAt" } } },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
            { $unwind: "$userInfo" },
            { $project: { name: "$userInfo.name", score: "$maxScore", date: "$latestDate" } },
            { $sort: { score: -1 } },
            { $limit: 10 }
        ]);

        return res.json(topScores);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\auth.js`

```js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../config/index.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, studentId, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ error: "Email already in use" });

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            name, email, passwordHash,
            role: role || "student",
            studentId: studentId || undefined,
        });
        return res.json({ id: user._id, message: "Registration successful" });
    } catch (e) {
        return res.status(500).json({ error: "Registration failed: " + e.message });
    }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { _id: user._id, role: user.role, email: user.email, name: user.name },
            config.jwtSecret,
            { expiresIn: "7d" }
        );
        return res.json({ token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (e) {
        return res.status(500).json({ error: "Login failed: " + e.message });
    }
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-passwordHash").populate("enrolledSubjects").lean();
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json(user);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/proctor-consent
router.post("/proctor-consent", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });
        user.proctorConsent = true;
        await user.save();
        return res.json({ ok: true, message: "Consent saved" });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PATCH /api/auth/preferences — update user preferences
router.patch("/preferences", auth, async (req, res) => {
    try {
        const { quizMode, difficulty, dailyGoal, notifications, themePreference } = req.body;
        const update = {};

        if (quizMode) update["preferences.quizMode"] = quizMode;
        if (difficulty) update["preferences.difficulty"] = difficulty;
        if (dailyGoal !== undefined) update["preferences.dailyGoal"] = dailyGoal;
        if (notifications !== undefined) update["preferences.notifications"] = notifications;
        if (themePreference) update.themePreference = themePreference;

        const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
            .select("-passwordHash")
            .populate("enrolledSubjects")
            .lean();

        return res.json(user);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\chat.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { chatWithTutor } from "../services/ollamaService.js";
import { logAI } from "../middleware/aiLogger.js";
import ChatSession from "../models/ChatSession.js";
import ChatMessage from "../models/ChatMessage.js";
import Subject from "../models/Subject.js";
import { Ollama } from 'ollama';
import { config } from "../config/index.js";
import { fetchPerfectContext } from "../services/azureSearchService.js";

const router = express.Router();

const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
    ? config.ollamaBaseUrl
    : 'http://127.0.0.1:11434';

const ollama = new Ollama({ host: ollamaBase });

// POST /api/chat - Context-aware AI chat (non-streaming)
router.post("/", auth, async (req, res) => {
    try {
        const { message, context, history = [] } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        const messages = [
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: message },
        ];

        const reply = await chatWithTutor(messages, context);

        await logAI({
            userId: req.user._id, userName: req.user.name || "Student", role: req.user.role || "student",
            endpoint: "/api/chat", params: { message: message.substring(0, 100) },
            status: "success", model: "ollama",
            request: message, response: reply.substring(0, 500),
        });

        return res.json({ reply, role: "assistant" });
    } catch (e) {
        return res.status(500).json({ error: "Chat failed: " + e.message });
    }
});

// POST /api/chat/stream - Standalone streaming chat (SSE) with thinking/content support
router.post("/stream", auth, async (req, res) => {
    try {
        const { message, context, history = [] } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        let systemPrompt = "You are Adiptify, an adaptive AI tutor. Provide concise, helpful answers. Use markdown formatting for structure.";
        if (context) {
            systemPrompt += `\n\nSTUDENT CONTEXT:\n- Mastery: ${context.mastery || "unknown"}%\n- Weak Area: ${context.weakArea || "unknown"}`;
        }

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: message },
        ];

        const stream = await ollama.chat({
            model: config.ollamaModel || 'qwen3',
            messages: apiMessages,
            stream: true,
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        for await (const chunk of stream) {
            // Send thinking and content as separate event types
            const event = {
                thinking: chunk.message?.thinking || null,
                content: chunk.message?.content || null,
                done: chunk.done || false,
            };
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (e) {
        if (!res.headersSent) {
            return res.status(500).json({ error: e.message });
        }
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
    }
});

// GET /api/chat/sessions - List user chat sessions
router.get("/sessions", auth, async (req, res) => {
    try {
        const query = { userId: req.user._id, status: "active" };
        if (req.query.subjectId) query.subjectId = req.query.subjectId;

        const sessions = await ChatSession.find(query)
            .populate("subjectId", "name")
            .sort({ updatedAt: -1 })
            .lean();
        return res.json(sessions);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/chat/sessions - Create new session
router.post("/sessions", auth, async (req, res) => {
    try {
        const { subjectId, title } = req.body;
        const session = await ChatSession.create({
            userId: req.user._id,
            subjectId: subjectId || null,
            title: title || "New Conversation"
        });
        return res.json(session);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/chat/sessions/:id/messages - Get messages for a session
router.get("/sessions/:id/messages", auth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id });
        if (!session) return res.status(404).json({ error: "Session not found" });

        const messages = await ChatMessage.find({ sessionId: req.params.id })
            .sort({ createdAt: 1 })
            .lean();
        return res.json(messages);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/chat/sessions/:id/message - Send message to session (non-streaming)
router.post("/sessions/:id/message", auth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id }).populate("subjectId");
        if (!session) return res.status(404).json({ error: "Session not found" });

        const { message, context = {} } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        // Save user message
        const userMsg = await ChatMessage.create({
            sessionId: session._id,
            sender: "user",
            content: message
        });

        // Get recent history
        const historyRaw = await ChatMessage.find({ sessionId: session._id })
            .sort({ createdAt: 1 })
            .limit(20)
            .lean();

        const history = historyRaw.filter(m => m._id.toString() !== userMsg._id.toString()).map(m => ({
            role: m.sender === "ai" ? "assistant" : "user",
            content: m.content
        }));

        // Build context
        let enhancedContext = { ...context };
        if (session.subjectId) {
            enhancedContext.subjectName = session.subjectId.name;
        } else {
            try {
                const userEnrolledSubjects = await Subject.find({});
                for (const sub of userEnrolledSubjects) {
                    if (message.toLowerCase().includes(sub.name.toLowerCase())) {
                        session.subjectId = sub._id;
                        await session.save();
                        enhancedContext.subjectName = sub.name;
                        break;
                    }
                }
            } catch (err) { /* ignore */ }
        }

        const messages = [
            ...history,
            { role: "user", content: message }
        ];

        // Auto-title
        if (session.title === "New Conversation" || session.title === "New Chat") {
            session.title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
            await session.save();
        }

        const replyText = await chatWithTutor(messages, enhancedContext);

        // Save AI message
        const aiMsg = await ChatMessage.create({
            sessionId: session._id,
            sender: "ai",
            content: replyText
        });

        await logAI({
            userId: req.user._id, userName: req.user.name || "Student", role: req.user.role || "student",
            endpoint: "/api/chat/sessions/message", params: { sessionId: session._id },
            status: "success", model: "ollama",
            request: message, response: replyText.substring(0, 500)
        });

        return res.json({ reply: aiMsg });
    } catch (e) {
        console.error("Chat session error:", e);
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/chat/sessions/:id/stream — STREAMING session chat with thinking/content SSE
router.post("/sessions/:id/stream", auth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id }).populate("subjectId");
        if (!session) return res.status(404).json({ error: "Session not found" });

        const { message, context = {} } = req.body;
        if (!message) return res.status(400).json({ error: "Message required" });

        // Save user message
        await ChatMessage.create({
            sessionId: session._id,
            sender: "user",
            content: message
        });

        // Get recent history
        const historyRaw = await ChatMessage.find({ sessionId: session._id })
            .sort({ createdAt: 1 })
            .limit(20)
            .lean();

        const history = historyRaw.slice(0, -1).map(m => ({
            role: m.sender === "ai" ? "assistant" : "user",
            content: m.content
        }));

        // Build system prompt
        let systemPrompt = "You are Adiptify, an adaptive AI tutor. Provide clear, structured answers using markdown. Include code examples where relevant.";
        if (session.subjectId) {
            systemPrompt += `\n\nSubject context: ${session.subjectId.name}`;
            
            // Perform RAG fetch
            try {
                const mockVector = new Array(1536).fill(0.01);
                const contexts = await fetchPerfectContext(req.user._id.toString(), session.subjectId.name, message, mockVector, 3);
                if (contexts && contexts.length > 0) {
                    systemPrompt += `\n\nRelevant Subject Material:\n`;
                    contexts.forEach(c => systemPrompt += `\n- ${c.content}`);
                }
            } catch (e) {
                console.warn("[Chat] Failed to fetch RAG context:", e.message);
            }
        }
        if (context.mastery) {
            systemPrompt += `\nStudent mastery: ${context.mastery}%`;
        }

        // Inject behavior engine settings
        try {
            const userId = req.user?._id;
            if (userId) {
                const { buildTutorPromptSuffix } = await import('../services/behaviorEngine.js');
                const suffix = await buildTutorPromptSuffix(userId);
                if (suffix) systemPrompt += suffix;
            }
        } catch { /* settings engine may not be ready */ }

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message },
        ];

        // Auto-title for first message
        if (session.title === "New Conversation" || session.title === "New Chat") {
            session.title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
            await session.save();
        }

        // Subject auto-detect
        if (!session.subjectId) {
            try {
                const subjects = await Subject.find({}).lean();
                for (const sub of subjects) {
                    if (message.toLowerCase().includes(sub.name.toLowerCase())) {
                        session.subjectId = sub._id;
                        await session.save();
                        break;
                    }
                }
            } catch { /* ignore */ }
        }

        // Stream from Ollama
        const stream = await ollama.chat({
            model: config.ollamaModel || 'qwen3',
            messages: apiMessages,
            stream: true,
            options: { temperature: 0.3, top_p: 0.9 },
            keep_alive: "5m"
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        let fullContent = '';
        let fullThinking = '';

        for await (const chunk of stream) {
            const thinking = chunk.message?.thinking || null;
            const content = chunk.message?.content || null;

            if (thinking) fullThinking += thinking;
            if (content) fullContent += content;

            const event = {
                thinking,
                content,
                done: chunk.done || false,
            };
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Persist the complete AI response
        await ChatMessage.create({
            sessionId: session._id,
            sender: "ai",
            content: fullContent,
            metadata: fullThinking ? { thinking: fullThinking } : undefined,
        });

        await logAI({
            userId: req.user._id, userName: req.user.name || "Student", role: req.user.role || "student",
            endpoint: "/api/chat/sessions/stream", params: { sessionId: session._id },
            status: "success", model: config.ollamaModel || "qwen3",
            request: message, response: fullContent.substring(0, 500)
        });

        res.write("data: [DONE]\n\n");
        res.end();
    } catch (e) {
        console.error("Stream session error:", e);
        if (!res.headersSent) {
            return res.status(500).json({ error: e.message });
        }
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
    }
});

export default router;
```

## File: `backend\routes\content.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import Content from "../models/Content.js";

const router = express.Router();

// POST /api/content - Create a content record (e.g. PPT slide data for study modules)
router.post("/", auth, async (req, res) => {
    try {
        const { subjectId, type, contentBody, slideData, metadata, syllabusNodeId, learningLevel } = req.body;
        if (!subjectId || !type) {
            return res.status(400).json({ error: "subjectId and type are required" });
        }

        const content = await Content.create({
            subjectId,
            syllabusNodeId: syllabusNodeId || null,
            type,
            learningLevel: learningLevel || 'Beginner',
            contentBody: contentBody || '',
            slideData: slideData || null,
            metadata: metadata || {},
            createdBy: req.user._id,
        });

        return res.status(201).json(content);
    } catch (e) {
        console.error("[content] Create error:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/content/:subjectId - Get all content for a subject
router.get("/:subjectId", auth, async (req, res) => {
    try {
        const contents = await Content.find({ subjectId: req.params.subjectId })
            .sort({ createdAt: -1 })
            .lean();
        return res.json(contents);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/content/:subjectId/pptx - Get PPT slide data specifically for study modules
router.get("/:subjectId/pptx", auth, async (req, res) => {
    try {
        const pptContent = await Content.findOne({
            subjectId: req.params.subjectId,
            type: 'pptx',
            slideData: { $ne: null }
        })
            .sort({ createdAt: -1 })
            .lean();

        if (!pptContent) {
            return res.status(404).json({ error: "No PPT content found for this subject" });
        }

        return res.json(pptContent);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/content/:id - Delete a content record
router.delete("/:id", auth, async (req, res) => {
    try {
        const deleted = await Content.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Content not found" });
        return res.status(204).send();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\experiments.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import ExperimentResult from "../models/ExperimentResult.js";

const router = express.Router();

// POST /api/experiments/save — Save an experiment run
router.post("/save", auth, async (req, res) => {
    try {
        const { experimentId, experimentType, parameters, parameters_used, results, result_metrics } = req.body;
        
        if (!experimentType) {
            return res.status(400).json({ error: "experimentType is required" });
        }

        const result = new ExperimentResult({
            userId: req.user._id,
            experimentId: experimentId || `exp_${Date.now()}`,
            experimentType,
            parameters_used: parameters || parameters_used || {},
            result_metrics: results || result_metrics || {},
        });

        await result.save();
        console.log(`[Experiments] Saved ${experimentType} result for user ${req.user._id}`);
        res.json({ ok: true, id: result._id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/experiments/history — Get experiment history
router.get("/history", auth, async (req, res) => {
    try {
        const { type } = req.query;
        const filter = { userId: req.user._id };
        if (type) filter.experimentType = type;

        const results = await ExperimentResult.find(filter)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\graph.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { logAI } from "../middleware/aiLogger.js";
import Subject from "../models/Subject.js";
import { Ollama } from 'ollama';

const router = express.Router();

router.get("/subject/:subjectId", auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    // 1. Return cached graph if available
    if (subject.cachedGraph && Object.keys(subject.cachedGraph).length > 0) {
      return res.json(subject.cachedGraph);
    }

    // 2. Generate if cache is missing
    const topic = subject.name;
    const initialPrompt = `
        You are an expert systems architect. Generate a DEEP structured knowledge map for the topic: "${topic}".
        
        OUTPUT ONLY VALID JSON. 
        Format:
        {
          "root": {
            "id": "root",
            "label": "${topic}",
            "desc": "Detailed overview of ${topic}, explaining its core significance and main applications."
          },
          "children": [
            {
              "id": "l1_1",
              "label": "Level 1 Category",
              "desc": "Provide a detailed 2-3 sentence explanation of this category, its role within the system, and why it is essential.",
              "children": [
                {
                  "id": "l2_1",
                  "label": "Level 2 Sub-category",
                  "desc": "A specific 2-3 sentence deep-dive into this sub-category, detailing its functions or characteristics."
                }
              ]
            }
          ]
        }
        
        Requirements:
        1. Generate 4-5 Level 1 categories.
        2. For EACH Level 1 category, generate 2-3 Level 2 sub-categories.
        3. Ensure all descriptions are DETAILED (at least 2-3 substantial sentences per node).
        `;

    const { config } = await import("../config/index.js");

    const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
      ? config.ollamaBaseUrl
      : 'http://127.0.0.1:11434';

    const ollama = new Ollama({ host: ollamaBase });

    const response = await ollama.chat({
      model: config.ollamaModel || 'deepseek-v3.1:671b-cloud',
      messages: [
        { role: 'system', content: initialPrompt },
        { role: 'user', content: `Generate a complete 2-level deep graph for ${topic}` }
      ],
      stream: false,
      format: 'json'
    });

    let resultJson;
    try {
      resultJson = JSON.parse(response.message.content.trim());
    } catch (e) {
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultJson = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON");
      }
    }

    // 3. Cache the generated graph
    subject.cachedGraph = resultJson;
    await subject.save();

    await logAI({
      userId: req.user._id, userName: req.user.name, role: req.user.role,
      endpoint: "/api/graph/subject/:subjectId", params: { topic },
      status: "success", model: "ollama",
      request: `Graph Cache Gen: ${topic}`, response: "Cached Graph Generated",
    });

    return res.json(resultJson);

  } catch (e) {
    console.warn("Graph Gen Error for cache:", e.message);
    return res.json({
      root: {
        id: "root",
        label: "Mock " + req.params.subjectId,
        desc: "Mock generated due to AI offline. Start Ollama server for real graphs."
      },
      children: []
    });
  }
});

router.post("/generate", auth, async (req, res) => {
  try {
    const { topic, pathContext = "" } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const isInitial = !pathContext;

    const initialPrompt = `
        You are an expert systems architect. Generate a DEEP structured knowledge map for the topic: "${topic}".
        
        OUTPUT ONLY VALID JSON. 
        Format:
        {
          "root": {
            "id": "root",
            "label": "${topic}",
            "desc": "Detailed overview of ${topic}, explaining its core significance and main applications."
          },
          "children": [
            {
              "id": "l1_1",
              "label": "Level 1 Category",
              "desc": "Provide a detailed 2-3 sentence explanation of this category, its role within the system, and why it is essential.",
              "children": [
                {
                  "id": "l2_1",
                  "label": "Level 2 Sub-category",
                  "desc": "A specific 2-3 sentence deep-dive into this sub-category, detailing its functions or characteristics."
                }
              ]
            }
          ]
        }
        
        Requirements:
        1. Generate 4-5 Level 1 categories.
        2. For EACH Level 1 category, generate 2-3 Level 2 sub-categories.
        3. Ensure all descriptions are DETAILED (at least 2-3 substantial sentences per node).
        `;

    const expansionPrompt = `
        You are an expert systems architect. Expand the knowledge map for the node: "${topic}".
        User is exploring "${pathContext}".
        
        OUTPUT ONLY VALID JSON. 
        Format:
        {
          "nodes": [
            {
              "id": "new_l1_1",
              "label": "Title",
              "desc": "Detailed 2-3 sentence description.",
              "children": [
                {
                  "id": "new_l2_1",
                  "label": "Deep Sub-detail",
                  "desc": "Specific 2-3 sentence description."
                }
              ]
            }
          ]
        }
        Generate 3-5 detailed sub-categories for "${topic}".
        For EACH sub-category, generate 1-2 deeper sub-details (2 levels deep in total).
        Each description MUST be at least 2-3 sentences long.
        `;

    const systemPrompt = isInitial ? initialPrompt : expansionPrompt;

    const { config } = await import("../config/index.js");

    const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
      ? config.ollamaBaseUrl
      : 'http://127.0.0.1:11434';

    const ollama = new Ollama({ host: ollamaBase });

    const response = await ollama.chat({
      model: config.ollamaModel || 'deepseek-v3.1:671b-cloud',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isInitial ? `Generate a complete 2-level deep graph for ${topic}` : `Expand on ${topic}` }
      ],
      stream: false,
      format: 'json'
    });

    if (!response.message || !response.message.content) {
      throw new Error("Invalid response format from Ollama API");
    }

    const content = response.message.content.trim();
    let resultJson;
    try {
      resultJson = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Content:", content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultJson = JSON.parse(jsonMatch[0]);
      } else {
        throw parseError;
      }
    }

    await logAI({
      userId: req.user._id, userName: req.user.name, role: req.user.role,
      endpoint: "/api/graph/generate", params: { topic, isInitial },
      status: "success", model: "ollama",
      request: `Graph Gen: ${topic}`, response: "Graph JSON Response",
    });

    return res.json(resultJson);
  } catch (e) {
    console.warn("Graph Gen Error (Ollama offline?), providing mock response:", e.message);

    if (isInitial) {
      return res.json({
        root: {
          id: "root",
          label: topic || "Mock Topic",
          desc: "This is a mock overview of the topic since the AI is currently offline. Start the Ollama server for real generated graphs."
        },
        children: [
          {
            id: "l1_1",
            label: "Mock Subtopic 1",
            desc: "This is a mock subtopic generated by the fallback system.",
            children: [
              {
                id: "l2_1",
                label: "Mock Detail A",
                desc: "A specific detail about this mock subtopic."
              }
            ]
          },
          {
            id: "l1_2",
            label: "Mock Subtopic 2",
            desc: "Another mock section for layout testing.",
            children: []
          }
        ]
      });
    } else {
      return res.json({
        nodes: [
          {
            id: `exp_1_${Date.now()}`,
            label: `Expanded: ${topic}`,
            desc: "This is a mocked deep expansion node. The AI server is offline.",
            children: []
          }
        ]
      });
    }
  }
});

export default router;
```

## File: `backend\routes\issues.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import IssueReport from "../models/IssueReport.js";

const router = express.Router();

// POST /api/report-issue
router.post("/api/report-issue", auth, async (req, res) => {
    try {
        const { panel, section, summary, details } = req.body;
        const report = await IssueReport.create({
            reportedBy: req.user._id,
            userName: req.user.name,
            role: req.user.role,
            panel, section, summary, details,
        });
        return res.json({ ok: true, id: report._id });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/issues - Get all issues (for admin/instructor)
router.get("/api/issues", auth, async (req, res) => {
    try {
        const issues = await IssueReport.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.json(issues);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\leaderboard.js`

```js
/**
 * Leaderboard API Routes
 */
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getLeaderboard, getUserRank } from '../services/leaderboardService.js';

const router = Router();

// GET /api/leaderboard — contextual leaderboard
router.get('/', auth, async (req, res) => {
    try {
        const { subjectId, orgId, period = 'alltime', limit = 50, skip = 0 } = req.query;
        const entries = await getLeaderboard({
            subjectId: subjectId || null,
            orgId: orgId || null,
            period,
            limit: parseInt(limit),
            skip: parseInt(skip),
        });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leaderboard/me — current user's rank
router.get('/me', auth, async (req, res) => {
    try {
        const { subjectId, orgId, period = 'alltime' } = req.query;
        const rank = await getUserRank(req.user._id, {
            subjectId: subjectId || null,
            orgId: orgId || null,
            period,
        });
        res.json(rank);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
```

## File: `backend\routes\learning.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { generateTopicNotes } from "../services/ollamaService.js";
import User from "../models/User.js";

const router = express.Router();

// GET /api/learning/subjects - Get all available subjects
router.get("/subjects", auth, async (req, res) => {
    try {
        const defaultSubjects = [
            "Arithmetic", "Algebra", "Geometry", "Statistics", "Probability",
            "Calculus", "Linear Algebra", "Data Structures", "Algorithms",
            "Machine Learning", "Physics", "Chemistry", "Biology",
        ];
        return res.json(defaultSubjects);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/learning/subject - Add a subject to user's learner profile
router.post("/subject", auth, async (req, res) => {
    try {
        const { subject } = req.body;
        if (!subject) return res.status(400).json({ error: "Subject is required" });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const topics = user.learnerProfile?.topics || new Map();
        if (topics.has(subject)) return res.status(409).json({ error: "Subject already exists" });

        topics.set(subject, { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 });
        user.learnerProfile = { ...user.learnerProfile, topics };
        await user.save();

        return res.json({ ok: true, subject });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/learning/module/:topic - Get learning module content
router.get("/module/:topic", auth, async (req, res) => {
    try {
        const topic = decodeURIComponent(req.params.topic);
        const notes = await generateTopicNotes(topic);
        return res.json({
            content: notes,
            resources: [
                { title: `${topic} - Wikipedia`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}` },
                { title: `${topic} - Khan Academy`, url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(topic)}` },
            ],
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\notes.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { generateTopicNotes } from "../services/ollamaService.js";

const router = express.Router();

// POST /api/notes/generate - Generate study notes for a topic
router.post("/generate", auth, async (req, res) => {
    try {
        const { topic, mistakes = [] } = req.body;
        if (!topic) return res.status(400).json({ error: "Topic is required" });

        const notes = await generateTopicNotes(topic, mistakes);
        return res.json({ topic, content: notes });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\organizations.js`

```js
/**
 * Organization CRUD Routes
 */
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Organization from '../models/Organization.js';
import { eventBus, EVENTS } from '../services/eventBus.js';

const router = Router();

// POST /api/organizations — create organization
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, domain, settings } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const org = await Organization.create({
            name,
            description: description || '',
            domain: domain || '',
            owner: req.user._id,
            admins: [req.user._id],
            members: [req.user._id],
            settings: settings || {},
        });

        res.status(201).json(org);
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: 'Organization slug already exists' });
        res.status(500).json({ error: err.message });
    }
});

// GET /api/organizations — list user's organizations
router.get('/', auth, async (req, res) => {
    try {
        const orgs = await Organization.find({
            $or: [
                { owner: req.user._id },
                { admins: req.user._id },
                { members: req.user._id },
            ]
        }).sort({ createdAt: -1 }).lean();
        res.json(orgs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/organizations/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id)
            .populate('owner', 'name email')
            .populate('admins', 'name email')
            .populate('members', 'name email')
            .lean();
        if (!org) return res.status(404).json({ error: 'Not found' });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/organizations/:id — update
router.put('/:id', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });

        // Only owner or admin can update
        const isAuthorized = org.owner.equals(req.user._id) ||
            org.admins.some(a => a.equals(req.user._id));
        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });

        const { name, description, domain, settings } = req.body;
        if (name) org.name = name;
        if (description !== undefined) org.description = description;
        if (domain !== undefined) org.domain = domain;
        if (settings) Object.assign(org.settings, settings);

        await org.save();
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/organizations/:id/members — add member
router.post('/:id/members', auth, async (req, res) => {
    try {
        const { userId, role = 'member' } = req.body;
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });

        const isAdmin = org.owner.equals(req.user._id) || org.admins.some(a => a.equals(req.user._id));
        if (!isAdmin) return res.status(403).json({ error: 'Only admins can add members' });

        if (!org.members.some(m => m.equals(userId))) {
            org.members.push(userId);
        }
        if (role === 'admin' && !org.admins.some(a => a.equals(userId))) {
            org.admins.push(userId);
        }

        await org.save();
        eventBus.emit(EVENTS.ORG_MEMBER_ADDED, { orgId: org._id, userId, addedBy: req.user._id });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/organizations/:id/members/:userId — remove member
router.delete('/:id/members/:userId', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });

        const isAdmin = org.owner.equals(req.user._id) || org.admins.some(a => a.equals(req.user._id));
        if (!isAdmin) return res.status(403).json({ error: 'Only admins can remove members' });

        org.members = org.members.filter(m => !m.equals(req.params.userId));
        org.admins = org.admins.filter(a => !a.equals(req.params.userId));
        await org.save();

        eventBus.emit(EVENTS.ORG_MEMBER_REMOVED, { orgId: org._id, userId: req.params.userId, removedBy: req.user._id });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/organizations/:id — delete organization
router.delete('/:id', auth, async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return res.status(404).json({ error: 'Not found' });
        if (!org.owner.equals(req.user._id)) return res.status(403).json({ error: 'Only owner can delete' });

        await Organization.deleteOne({ _id: org._id });
        res.json({ message: 'Organization deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
```

## File: `backend\routes\plan.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import Subject from "../models/Subject.js";
import Syllabus from "../models/Syllabus.js";

const router = express.Router();

router.post("/generate", auth, async (req, res) => {
    try {
        const { goal } = req.body;
        // In a real implementation, you'd use LLM to dynamically generate a daily study plan.
        // For demo/Azure deployment stability, we provide a structured mock based on user subjects.

        const subjects = await Subject.find({ students: req.user._id });
        if (subjects.length === 0) {
            return res.json({
                daily_plan: {
                    topics_to_study: [],
                    revision_topics: [],
                    quiz_topics: [],
                    status: "not_started"
                },
                message: "No subjects enrolled. Add a subject to get a plan.",
                status: "neutral"
            });
        }

        // Just fetch random topics from their syllabus
        let topicsToStudy = [];
        let revisionTopics = [];
        let quizTopics = [];

        for (const subject of subjects) {
            const syllabus = await Syllabus.findOne({ subjectId: subject._id });
            if (syllabus && syllabus.modules.length > 0) {
                const firstModule = syllabus.modules[0];
                if (firstModule.topics && firstModule.topics.length > 0) {
                    topicsToStudy.push(`${firstModule.topics[0].title} (${subject.name})`);
                    if (firstModule.topics.length > 1) {
                        revisionTopics.push(`${firstModule.topics[1].title} (${subject.name})`);
                    }
                    if (firstModule.topics.length > 2) {
                        quizTopics.push(`${firstModule.topics[2].title} (${subject.name})`);
                    }
                }
            }
        }

        return res.json({
            daily_plan: {
                topics_to_study: topicsToStudy.slice(0, 3),
                revision_topics: revisionTopics.slice(0, 2),
                quiz_topics: quizTopics.slice(0, 2),
                status: "in_progress"
            },
            message: "Stay focused! You're on track.",
            status: "on_track"
        });
    } catch (err) {
        console.error("Plan generate error:", err);
        return res.status(500).json({ error: "Failed to generate plan" });
    }
});

export default router;
```

## File: `backend\routes\proctor.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import ProctorLog from "../models/ProctorLog.js";
import AssessmentSession from "../models/AssessmentSession.js";

const router = express.Router();

// POST /api/proctor/log - Log a proctoring violation
router.post("/log", auth, async (req, res) => {
    try {
        const { sessionId, violationType, severity, details } = req.body;

        const session = await AssessmentSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const log = await ProctorLog.create({
            session: sessionId,
            user: req.user._id,
            violationType,
            severity: severity || "minor",
            details: details || "",
        });

        // Update session proctor summary
        const field = severity === "major" ? "majorViolations" : "minorViolations";
        if (!session.proctorSummary) session.proctorSummary = {};
        session.proctorSummary[field] = (session.proctorSummary[field] || 0) + 1;
        session.proctorSummary.totalViolations = (session.proctorSummary.totalViolations || 0) + 1;
        if (violationType === "tab_switch") {
            session.proctorSummary.tabSwitchCount = (session.proctorSummary.tabSwitchCount || 0) + 1;
        }
        session.proctorLogs = [...(session.proctorLogs || []), log._id];
        await session.save();

        return res.json({ ok: true, logId: log._id });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/proctor/logs/:sessionId - Get proctor logs for a session
router.get("/logs/:sessionId", auth, async (req, res) => {
    try {
        const logs = await ProctorLog.find({ session: req.params.sessionId })
            .sort({ timestamp: -1 })
            .lean();
        return res.json(logs);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/proctor/sessions - Get all proctored sessions (for instructors)
router.get("/sessions", auth, async (req, res) => {
    try {
        const sessions = await AssessmentSession.find({ proctored: true })
            .populate("user", "name email studentId")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.json(sessions);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\questionBank.js`

```js
import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import Item from "../models/Item.js";

const router = express.Router();

// GET /api/question-bank - List items with filtering
router.get("/", auth, async (req, res) => {
    try {
        const { topic, difficulty, type, limit = 50, skip = 0 } = req.query;
        const filter = {};
        if (topic) filter.topics = { $in: [topic] };
        if (difficulty) filter.difficulty = parseInt(difficulty);
        if (type) filter.type = type;

        const items = await Item.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .lean();

        const total = await Item.countDocuments(filter);
        return res.json({ items, total });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/question-bank/:id
router.get("/:id", auth, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ error: "Not found" });
        return res.json(item);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/question-bank - Create a new question
router.post("/", auth, async (req, res) => {
    try {
        const item = await Item.create({ ...req.body, createdBy: req.user._id });
        return res.json(item);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PUT /api/question-bank/:id
router.put("/:id", auth, async (req, res) => {
    try {
        const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!item) return res.status(404).json({ error: "Not found" });
        return res.json(item);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/question-bank/:id
router.delete("/:id", auth, async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/question-bank/bulk - Bulk import questions
router.post("/bulk", auth, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Items array is required" });
        }
        const saved = await Item.insertMany(
            items.map(i => ({ ...i, createdBy: req.user._id }))
        );
        return res.json({ imported: saved.length, items: saved });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\settings.js`

```js
/**
 * Settings API Routes
 * GET  /api/settings          — Get current user settings
 * PUT  /api/settings          — Update settings (full or partial)
 * PUT  /api/settings/:section — Update specific section (aiTutor, difficulty, srs, etc.)
 * POST /api/settings/reset    — Reset to a learning mode preset
 * GET  /api/settings/presets  — List available presets with configs
 */
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
    resolveSettings,
    updateSettings,
    updateSection,
    resetToPreset,
    getPresets,
    getPresetConfig,
} from '../services/settingsEngine.js';

const router = Router();

// GET /api/settings — current user settings
router.get('/', auth, async (req, res) => {
    try {
        const settings = await resolveSettings(req.user._id);
        res.json(settings);
    } catch (err) {
        console.error('[Settings] GET error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/settings — update settings (can include learningMode, sections, etc.)
router.put('/', auth, async (req, res) => {
    try {
        const updated = await updateSettings(req.user._id, req.body);
        res.json(updated);
    } catch (err) {
        console.error('[Settings] PUT error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/settings/:section — update a single section
router.put('/:section', auth, async (req, res) => {
    try {
        const updated = await updateSection(req.user._id, req.params.section, req.body);
        res.json(updated);
    } catch (err) {
        console.error('[Settings] PUT section error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/settings/reset — reset to preset
router.post('/reset', auth, async (req, res) => {
    try {
        const { mode } = req.body;
        const settings = await resetToPreset(req.user._id, mode || 'balanced');
        res.json(settings);
    } catch (err) {
        console.error('[Settings] Reset error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// GET /api/settings/presets — available presets
router.get('/presets', auth, (req, res) => {
    const presetNames = getPresets();
    const presets = presetNames.map(name => ({
        name,
        config: getPresetConfig(name),
    }));
    res.json(presets);
});

export default router;
```

## File: `backend\routes\spacedRepetition.js`

```js
import express from "express";
import { auth } from "../middleware/auth.js";
import { submitReview, getDueReviews, getReviewStats, initializeReviews } from "../services/spacedRepetitionService.js";
import Concept from "../models/Concept.js";

const router = express.Router();

// GET /api/sr/due — Get concepts due for review
router.get("/due", auth, async (req, res) => {
    try {
        const dueReviews = await getDueReviews(req.user._id);

        // Enrich with concept data
        const conceptIds = dueReviews.map((r) => r.conceptId);
        const concepts = await Concept.find({ conceptId: { $in: conceptIds } }).lean();
        const conceptMap = {};
        for (const c of concepts) conceptMap[c.conceptId] = c;

        const enriched = dueReviews.map((r) => ({
            reviewId: r._id,
            conceptId: r.conceptId,
            concept: conceptMap[r.conceptId] || { title: r.conceptId },
            easiness_factor: r.easiness_factor,
            interval: r.interval,
            repetition: r.repetition,
            last_review: r.last_review,
            next_review: r.next_review,
        }));

        res.json({ due: enriched, count: enriched.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/sr/review — Submit a review quality score
router.post("/review", auth, async (req, res) => {
    try {
        const { conceptId, quality } = req.body;
        if (!conceptId || quality === undefined) {
            return res.status(400).json({ error: "conceptId and quality are required" });
        }
        const review = await submitReview(req.user._id, conceptId, quality);
        res.json({
            ok: true,
            easiness_factor: review.easiness_factor,
            interval: review.interval,
            repetition: review.repetition,
            next_review: review.next_review,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/sr/stats/:conceptId — Review stats for a concept
router.get("/stats/:conceptId", auth, async (req, res) => {
    try {
        const stats = await getReviewStats(req.user._id, req.params.conceptId);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/sr/initialize — Initialize review records for all concepts
router.post("/initialize", auth, async (req, res) => {
    try {
        const concepts = await Concept.find({}).lean();
        const conceptIds = concepts.map((c) => c.conceptId);
        const count = await initializeReviews(req.user._id, conceptIds);
        res.json({ ok: true, initialized: count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\subjects.js`

```js
import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Specific routes MUST come before wildcard routes like /:id / /:slug
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/subjects — list all subjects
router.get("/", async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const { category } = req.query;
        const filter = {};
        if (category) filter.category = category;
        const subjects = await Subject.find(filter)
            .sort({ isDefault: -1, name: 1 })
            .lean();
        return res.json(subjects);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/subjects/categories — distinct domain categories
router.get("/categories", async (req, res) => {
    try {
        const cats = await Subject.distinct("domainCategory");
        return res.json(cats.filter(Boolean).sort());
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/subjects/enrolled — current user's enrolled subjects
router.get("/enrolled", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("enrolledSubjects")
            .lean();
        return res.json(user?.enrolledSubjects || []);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/subjects — create subject
router.post("/", auth, async (req, res) => {
    try {
        const { name, description, domainCategory, learningOutcomes, type, organizationId, icon, color, topics, category, categoryName } = req.body;

        if (!name) return res.status(400).json({ error: "Name is required" });
        if (!description) return res.status(400).json({ error: "Description is required" });
        if (!domainCategory && !category && !categoryName) return res.status(400).json({ error: "Domain/Category is required" });
        if (!learningOutcomes || !Array.isArray(learningOutcomes) || learningOutcomes.length === 0) {
            return res.status(400).json({ error: "At least one Learning Outcome is required" });
        }

        const finalizedCategory = domainCategory || category || categoryName || "General";

        const subject = await Subject.create({
            name,
            description,
            domainCategory: finalizedCategory,
            learningOutcomes,
            type: type || "general",
            organizationId: organizationId || null,
            icon: icon || "📚",
            color: color || "#1DCD9F",
            topics: topics || [],
            category: finalizedCategory,
            isDefault: false,
            createdBy: req.user._id,
            status: "active",
        });

        return res.status(201).json(subject);
    } catch (e) {
        if (e.code === 11000) {
            return res.status(409).json({ error: "A subject with this name already exists" });
        }
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/subjects/enroll — bulk enroll
router.post("/enroll", auth, async (req, res) => {
    try {
        const { slugs } = req.body;
        if (!Array.isArray(slugs)) return res.status(400).json({ error: "slugs must be an array" });
        const subjects = await Subject.find({ slug: { $in: slugs } }).lean();
        const subjectIds = subjects.map(s => s._id);
        await User.findByIdAndUpdate(req.user._id, { enrolledSubjects: subjectIds });
        return res.json({ ok: true, enrolledCount: subjectIds.length });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/subjects/enroll/toggle — toggle enrollment
router.post("/enroll/toggle", auth, async (req, res) => {
    try {
        const { subjectId } = req.body;
        if (!subjectId) return res.status(400).json({ error: "subjectId required" });
        if (!mongoose.Types.ObjectId.isValid(subjectId)) return res.status(400).json({ error: "Invalid subjectId" });

        const user = await User.findById(req.user._id);
        const isEnrolled = user.enrolledSubjects.map(String).includes(String(subjectId));

        if (isEnrolled) {
            user.enrolledSubjects = user.enrolledSubjects.filter(id => id.toString() !== subjectId);
        } else {
            user.enrolledSubjects.push(subjectId);
        }
        await user.save();

        const populated = await User.findById(req.user._id).populate("enrolledSubjects").lean();
        return res.json(populated.enrolledSubjects);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/subjects/category/:name — delete or reassign a category
// ?reassignTo=OtherCat  → move subjects there (category still removed)
// (no param)            → delete all subjects in this category
router.delete("/category/:name", auth, async (req, res) => {
    try {
        const catName = decodeURIComponent(req.params.name);
        const { reassignTo } = req.query;

        const query = { $or: [{ domainCategory: catName }, { category: catName }] };

        if (reassignTo && reassignTo.trim()) {
            const to = reassignTo.trim();
            await Subject.updateMany(
                query,
                { $set: { domainCategory: to, category: to } }
            );
            return res.json({ ok: true, action: "reassigned", to });
        }

        // Delete all subjects in the category
        const subjects = await Subject.find(query, "_id").lean();
        const ids = subjects.map(s => s._id);
        await Subject.deleteMany(query);
        if (ids.length) {
            await User.updateMany(
                { enrolledSubjects: { $in: ids } },
                { $pull: { enrolledSubjects: { $in: ids } } }
            );
        }
        return res.json({ ok: true, action: "deleted", count: ids.length });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// PATCH /api/subjects/category/:name — rename a category
router.patch("/category/:name", auth, async (req, res) => {
    try {
        const catName = decodeURIComponent(req.params.name);
        const { newName } = req.body;
        if (!newName?.trim()) return res.status(400).json({ error: "newName required" });

        const query = { $or: [{ domainCategory: catName }, { category: catName }] };
        const result = await Subject.updateMany(
            query,
            { $set: { domainCategory: newName.trim(), category: newName.trim() } }
        );
        return res.json({ ok: true, modifiedCount: result.modifiedCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// ─── WILDCARD ROUTES BELOW — must come LAST ───────────────────────────────

// PUT /api/subjects/:id — update subject
router.put("/:id", auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid Subject ID" });
        }
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ error: "Subject not found" });

        if (subject.createdBy && subject.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ error: "Not authorized" });
        }

        const { name, description, domainCategory, learningOutcomes, type, status, icon, color, topics, category, categoryName } = req.body;

        if (name) subject.name = name;
        if (description !== undefined) subject.description = description;
        if (learningOutcomes) subject.learningOutcomes = learningOutcomes;
        if (type) subject.type = type;
        if (status) subject.status = status;
        if (icon) subject.icon = icon;
        if (color) subject.color = color;
        if (topics) subject.topics = topics;

        const nextCat = domainCategory || category || categoryName;
        if (nextCat) {
            subject.domainCategory = nextCat;
            subject.category = nextCat;
        }

        await subject.save();
        return res.json(subject);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// DELETE /api/subjects/:id — delete single subject
router.delete("/:id", auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid Subject ID" });
        }
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ error: "Subject not found" });

        if (subject.createdBy && subject.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ error: "Not authorized" });
        }

        await Subject.findByIdAndDelete(req.params.id);
        await User.updateMany(
            { enrolledSubjects: req.params.id },
            { $pull: { enrolledSubjects: req.params.id } }
        );

        return res.status(204).send();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/subjects/:slug — get single subject by slug (must be last GET wildcard)
router.get("/:slug", async (req, res) => {
    try {
        const subject = await Subject.findOne({ slug: req.params.slug }).lean();
        if (!subject) return res.status(404).json({ error: "Subject not found" });
        return res.json(subject);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\syllabus.js`

```js
import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import Syllabus from "../models/Syllabus.js";
import Subject from "../models/Subject.js";

const router = express.Router();

// GET /api/syllabus/:subjectId - Get the syllabus for a given subject
router.get("/:subjectId", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.subjectId)) {
            return res.status(400).json({ error: "Invalid Subject ID format" });
        }

        const syllabus = await Syllabus.findOne({ subjectId: req.params.subjectId }).lean();
        if (!syllabus) return res.json({ modules: [] });

        return res.json(syllabus);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/syllabus - Create or update a syllabus structure for a subject
router.post("/", auth, async (req, res) => {
    try {
        const { subjectId, modules } = req.body;

        if (!subjectId) return res.status(400).json({ error: "subjectId is required" });
        if (!mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({ error: "Invalid Subject ID format" });
        }

        const subject = await Subject.findById(subjectId);
        if (!subject) return res.status(404).json({ error: "Subject not found, cannot attach syllabus." });

        if (subject.createdBy && subject.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ error: "Not authorized to update syllabus for this subject." });
        }

        const validModules = Array.isArray(modules) ? modules : [];

        let syllabus = await Syllabus.findOne({ subjectId });
        if (syllabus) {
            syllabus.modules = validModules;
            await syllabus.save();
        } else {
            syllabus = await Syllabus.create({
                subjectId,
                modules: validModules,
                createdBy: req.user._id
            });
        }

        return res.json(syllabus);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

export default router;
```

## File: `backend\routes\tutor.js`

```js
import express from 'express';
import { Ollama } from 'ollama';
import Subject from '../models/Subject.js';
import Syllabus from '../models/Syllabus.js';
import { config } from '../config/index.js';

const router = express.Router();

const ollamaUrl = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
    ? config.ollamaBaseUrl
    : 'http://127.0.0.1:11434';

const ollama = new Ollama({
    host: ollamaUrl
});

function isValidQuestion(question, topic) {
    // Build keywords from topic title/desc or subject name
    const textContext = `${topic.name || topic.title} ${topic.description || ''}`;
    const keywords = textContext.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    if (keywords.length === 0) return true; // Fallback

    return keywords.some(k => question.toLowerCase().includes(k));
}

function buildMessages({ subject, topic, syllabus, question }) {
    return [
        {
            role: "system",
            content: `You are a subject-restricted AI tutor.

Rules:
- Only answer within subject and topic
- Use only given syllabus
- If outside → say "Out of syllabus"
- No hallucination
- Structured answers only`
        },
        {
            role: "user",
            content: `Subject: ${subject}
Topic: ${topic}

Syllabus:
${syllabus}

Question:
${question}`
        }
    ];
}

router.post('/chat', async (req, res) => {
    try {
        const { subject_id, topic_id, question } = req.body;

        if (!subject_id || !question) return res.status(400).json({ error: "Missing subject_id or question" });

        // STEP 1: fetch subject + topic
        const subjectObj = await Subject.findById(subject_id).lean();
        if (!subjectObj) return res.status(404).json({ error: "Subject not found" });

        let topicObj = null;
        let fullSyllabusText = "";

        const syllabusObj = await Syllabus.findOne({ subjectId: subject_id }).lean();
        if (syllabusObj && syllabusObj.modules) {
            for (const m of syllabusObj.modules) {
                fullSyllabusText += `Module: ${m.title}\n`;
                if (Array.isArray(m.topics)) {
                    for (const t of m.topics) {
                        fullSyllabusText += `- ${t.title}: ${t.description || ''}\n`;
                        if (topic_id && (t._id?.toString() === topic_id || t.title === topic_id)) {
                            topicObj = t;
                        }
                    }
                }
            }
        }

        // Fallback if topic wasn't specifically found inside Syllabus
        if (!topicObj) {
            topicObj = subjectObj;
        }

        // STEP 2: applicability check
        if (!isValidQuestion(question, topicObj)) {
            return res.json({ error: "Out of syllabus" });
        }

        // STEP 3: build messages with behavior engine tuning
        const messages = buildMessages({
            subject: subjectObj.name,
            topic: topicObj.title || topicObj.name || String(topic_id || "General"),
            syllabus: fullSyllabusText || "Not provided.",
            question
        });

        // Inject user-specific behavior rules from settings engine
        try {
            const userId = req.user?._id || req.body.userId;
            if (userId) {
                const { buildTutorPromptSuffix } = await import('../services/behaviorEngine.js');
                const suffix = await buildTutorPromptSuffix(userId);
                if (suffix) {
                    messages[0].content += suffix;
                }
            }
        } catch { /* settings engine not ready — use defaults */ }

        // STEP 4: call Ollama
        const stream = await ollama.chat({
            model: config.ollamaModel || 'llama3',
            messages,
            stream: true,
            options: {
                temperature: 0.2,
                top_p: 0.9
            },
            keep_alive: "5m"
        });

        // The user strictly asked for this streaming loop behavior.
        res.setHeader("Content-Type", "text/plain");

        // STEP 5: stream response
        for await (const chunk of stream) {
            if (chunk.message && typeof chunk.message.content === 'string') {
                res.write(chunk.message.content);
            }
        }

        res.end();

    } catch (e) {
        if (!res.headersSent) {
            return res.status(500).json({ error: e.message });
        } else {
            res.write(`Error: ${e.message}`);
            res.end();
        }
    }
});

export default router;
```

## File: `backend\scripts\seed.js`

```js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";
import Item from "../models/Item.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/adiptify";

async function seed() {
    await mongoose.connect(MONGO_URI, { dbName: process.env.MONGO_DB || "adiptify" });
    console.log("Connected to MongoDB for seeding...");

    // Create demo users
    const passwordHash = await bcrypt.hash("password123", 10);

    const users = [
        { name: "Admin User", email: "admin@adiptify.com", passwordHash, role: "admin" },
        { name: "Instructor Demo", email: "instructor@adiptify.com", passwordHash, role: "instructor" },
        { name: "Student Demo", email: "student@adiptify.com", passwordHash, role: "student", studentId: "STU001" },
        {
            name: "Alice Johnson", email: "alice@adiptify.com", passwordHash, role: "student", studentId: "STU002",
            learnerProfile: { topics: { "Algebra": { mastery: 72, attempts: 15, streak: 3, timeOnTask: 45000 }, "Geometry": { mastery: 55, attempts: 8, streak: 0, timeOnTask: 22000 } } }
        },
        {
            name: "Bob Smith", email: "bob@adiptify.com", passwordHash, role: "student", studentId: "STU003",
            learnerProfile: { topics: { "Calculus": { mastery: 88, attempts: 20, streak: 5, timeOnTask: 60000 }, "Statistics": { mastery: 40, attempts: 6, streak: 1, timeOnTask: 15000 } } }
        },
    ];

    for (const u of users) {
        await User.findOneAndUpdate({ email: u.email }, u, { upsert: true, new: true });
    }
    console.log(`✅ ${users.length} users seeded`);

    // Create sample items
    const sampleItems = [
        { type: "mcq", question: "What is 2 + 2?", choices: ["3", "4", "5", "6"], answer: 1, difficulty: 1, bloom: "remember", topics: ["Arithmetic"], explanation: "Basic addition: 2 + 2 = 4", hints: ["Count on your fingers"] },
        { type: "mcq", question: "Solve for x: 2x + 3 = 7", choices: ["x = 1", "x = 2", "x = 3", "x = 4"], answer: 1, difficulty: 2, bloom: "apply", topics: ["Algebra"], explanation: "2x = 4, so x = 2" },
        { type: "mcq", question: "What is the derivative of x²?", choices: ["x", "2x", "x²", "2"], answer: 1, difficulty: 3, bloom: "understand", topics: ["Calculus"], explanation: "Using the power rule: d/dx(x²) = 2x" },
        { type: "mcq", question: "What is the area of a circle with radius 5?", choices: ["25π", "10π", "5π", "50π"], answer: 0, difficulty: 2, bloom: "apply", topics: ["Geometry"], explanation: "A = πr² = π(5)² = 25π" },
        { type: "mcq", question: "What is the mean of {2, 4, 6, 8, 10}?", choices: ["4", "5", "6", "7"], answer: 2, difficulty: 1, bloom: "remember", topics: ["Statistics"], explanation: "Mean = (2+4+6+8+10)/5 = 30/5 = 6" },
        { type: "mcq", question: "What is P(heads) for a fair coin?", choices: ["0.25", "0.5", "0.75", "1"], answer: 1, difficulty: 1, bloom: "remember", topics: ["Probability"], explanation: "A fair coin has equal probability for heads and tails = 0.5" },
        { type: "mcq", question: "Factorize: x² - 9", choices: ["(x-3)(x+3)", "(x-9)(x+1)", "(x-3)²", "(x+3)²"], answer: 0, difficulty: 3, bloom: "apply", topics: ["Algebra"], explanation: "Difference of squares: a² - b² = (a-b)(a+b)" },
        { type: "mcq", question: "What is the integral of 2x?", choices: ["x", "x²", "x² + C", "2x² + C"], answer: 2, difficulty: 3, bloom: "apply", topics: ["Calculus"], explanation: "∫2x dx = x² + C" },
        { type: "mcq", question: "The Pythagorean theorem states:", choices: ["a+b=c", "a²+b²=c²", "a×b=c", "a/b=c"], answer: 1, difficulty: 2, bloom: "remember", topics: ["Geometry"], explanation: "For a right triangle, the sum of squares of the two shorter sides equals the square of the hypotenuse." },
        { type: "mcq", question: "Standard deviation measures:", choices: ["Central tendency", "Spread of data", "Skewness", "Correlation"], answer: 1, difficulty: 2, bloom: "understand", topics: ["Statistics"], explanation: "Standard deviation quantifies the amount of variation or dispersion in a dataset." },
    ];

    await Item.deleteMany({});
    await Item.insertMany(sampleItems);
    console.log(`✅ ${sampleItems.length} sample items seeded`);

    await mongoose.disconnect();
    console.log("✅ Seeding complete!");
}

seed().catch(console.error);
```

## File: `backend\scripts\seedConcepts.js`

```js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Concept from "../models/Concept.js";

const concepts = [
    {
        conceptId: "linear_regression",
        title: "Linear Regression",
        description: "Model the relationship between a dependent variable and one or more independent variables using a linear function.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["supervised", "regression", "statistics"],
        pipeline: {
            explanation: "Linear regression fits a straight line y = mx + b to your data by minimizing the sum of squared residuals. The slope m measures how much y changes per unit change in x, and the intercept b is the predicted value when x = 0. The ordinary least squares (OLS) method finds the optimal parameters analytically.",
            demonstration: "Visualize a scatter plot of study hours vs exam score. Drag data points to see how the best-fit line adjusts in real time. Observe how outliers affect slope and R² score.",
            practiceQuestions: [
                { question: "What does the slope represent in a simple linear regression?", options: ["The y-intercept", "Rate of change of y per unit x", "The R² value", "The error term"], correctAnswer: 1, explanation: "The slope measures how much the dependent variable changes for each unit increase in the independent variable.", difficulty: 2 },
                { question: "Which metric measures goodness-of-fit in regression?", options: ["Accuracy", "R² (coefficient of determination)", "F1-score", "Cross-entropy"], correctAnswer: 1, explanation: "R² indicates the proportion of variance in the dependent variable explained by the model.", difficulty: 2 },
                { question: "What assumption does OLS require about residuals?", options: ["They must be positive", "They must be normally distributed with constant variance", "They must equal zero", "They must increase with x"], correctAnswer: 1, explanation: "OLS assumes residuals are i.i.d. normal with zero mean and constant variance (homoscedasticity).", difficulty: 3 },
            ],
            applicationTask: "Train a linear regression model on a housing price dataset. Use square footage as the feature and price as the target. Calculate R², MSE, and interpret the coefficients.",
            evaluationCriteria: "Model achieves R² > 0.6 and the student can explain what the slope and intercept mean for this domain.",
        },
    },
    {
        conceptId: "logistic_regression",
        title: "Logistic Regression",
        description: "A classification algorithm that models the probability of a binary outcome using the sigmoid function.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["linear_regression"],
        tags: ["supervised", "classification", "probability"],
        pipeline: {
            explanation: "Logistic regression maps a linear combination of features through the sigmoid function σ(z) = 1/(1+e^(-z)) to produce probabilities between 0 and 1. A threshold (usually 0.5) converts probabilities to class labels. It is trained by maximizing the log-likelihood using gradient descent.",
            demonstration: "Visualize the sigmoid curve. Adjust weights to see how the decision boundary shifts. Toggle between linear and logistic outputs to understand the probability mapping.",
            practiceQuestions: [
                { question: "What is the range of the sigmoid function?", options: ["(-∞, ∞)", "[-1, 1]", "(0, 1)", "[0, ∞)"], correctAnswer: 2, explanation: "The sigmoid function always outputs values strictly between 0 and 1.", difficulty: 2 },
                { question: "Which loss function is used for logistic regression?", options: ["MSE", "Binary cross-entropy", "Hinge loss", "Huber loss"], correctAnswer: 1, explanation: "Binary cross-entropy (log loss) penalizes confident wrong predictions heavily.", difficulty: 3 },
                { question: "What happens when the decision boundary threshold is lowered from 0.5 to 0.3?", options: ["Fewer positives predicted", "More positives predicted (higher recall)", "No change", "Model retrains"], correctAnswer: 1, explanation: "A lower threshold classifies more instances as positive, increasing recall but potentially decreasing precision.", difficulty: 3 },
            ],
            applicationTask: "Build a spam/not-spam classifier using logistic regression. Compute accuracy, precision, recall, and plot the ROC curve.",
            evaluationCriteria: "ROC-AUC > 0.75 and the student can explain the precision-recall tradeoff.",
        },
    },
    {
        conceptId: "gradient_descent",
        title: "Gradient Descent",
        description: "An iterative optimization algorithm that minimizes a function by moving in the direction of steepest descent.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["linear_regression"],
        tags: ["optimization", "calculus", "training"],
        pipeline: {
            explanation: "Gradient descent updates parameters by subtracting the gradient of the loss function scaled by a learning rate: θ = θ - α·∇J(θ). A small learning rate converges slowly, while a large one may overshoot. Variants include batch, stochastic (SGD), and mini-batch gradient descent.",
            demonstration: "Interactive 3D surface plot of a loss function. Adjust learning rate and watch the optimization path. Compare batch vs. SGD trajectories.",
            practiceQuestions: [
                { question: "What happens if the learning rate is too large?", options: ["Slow convergence", "The algorithm may overshoot and diverge", "Faster convergence always", "No effect"], correctAnswer: 1, explanation: "An excessively large learning rate causes the parameter updates to overshoot the minimum.", difficulty: 2 },
                { question: "What is the key difference between SGD and batch gradient descent?", options: ["SGD uses all data points", "SGD uses one data point per update", "Batch uses one point", "No difference"], correctAnswer: 1, explanation: "SGD approximates the gradient using a single randomly chosen sample, making it faster but noisier.", difficulty: 3 },
                { question: "When should you stop gradient descent?", options: ["After 100 iterations", "When the gradient is approximately zero", "When loss increases", "After one epoch"], correctAnswer: 1, explanation: "Convergence is reached when the gradient magnitude is near zero (or loss change is below a threshold).", difficulty: 2 },
            ],
            applicationTask: "Implement gradient descent from scratch to fit a linear model. Plot the loss curve over iterations for three different learning rates (0.001, 0.01, 0.1).",
            evaluationCriteria: "Correctly implements the update rule and can explain how learning rate affects convergence speed and stability.",
        },
    },
    {
        conceptId: "decision_trees",
        title: "Decision Trees",
        description: "A non-parametric model that splits data using feature-based rules to make predictions.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["supervised", "classification", "regression", "interpretable"],
        pipeline: {
            explanation: "Decision trees recursively partition the feature space by choosing the split that maximizes information gain (or minimizes Gini impurity). Each internal node tests a feature, each branch represents a test outcome, and each leaf holds a prediction. Trees are interpretable but prone to overfitting without pruning.",
            demonstration: "Build a decision tree step-by-step: select features, see how splits partition the data, and watch the tree grow. Toggle between Gini and entropy criteria.",
            practiceQuestions: [
                { question: "What metric does a decision tree use to choose the best split?", options: ["R² score", "Information gain or Gini impurity", "Cross-entropy loss", "Mean absolute error"], correctAnswer: 1, explanation: "Decision trees select splits that maximize information gain (or equivalently minimize impurity).", difficulty: 2 },
                { question: "What is overfitting in the context of decision trees?", options: ["Underfitting the training data", "Memorizing training data, poor generalization", "Using too few features", "Having high bias"], correctAnswer: 1, explanation: "Deep trees memorize noise in training data and fail to generalize to unseen data.", difficulty: 2 },
                { question: "How does pruning help a decision tree?", options: ["Makes it deeper", "Removes branches that add little predictive power", "Adds more features", "Changes the split criterion"], correctAnswer: 1, explanation: "Pruning reduces tree complexity by removing branches with minimal improvement, improving generalization.", difficulty: 3 },
            ],
            applicationTask: "Train a decision tree on the Iris dataset. Visualize the tree structure and compare accuracy with and without max_depth constraints.",
            evaluationCriteria: "Demonstrates understanding of overfitting by comparing pruned vs unpruned trees.",
        },
    },
    {
        conceptId: "neural_networks_basics",
        title: "Neural Networks Fundamentals",
        description: "Understand the building blocks of artificial neural networks: neurons, layers, activations, and forward propagation.",
        category: "Deep Learning",
        difficulty_level: 3,
        prerequisites: ["gradient_descent"],
        tags: ["deep-learning", "neural-network", "perceptron"],
        pipeline: {
            explanation: "A neural network is composed of layers of interconnected neurons. Each neuron computes a weighted sum of its inputs, adds a bias, and passes the result through an activation function (ReLU, sigmoid, tanh). Forward propagation passes data layer-by-layer from input to output. Backpropagation computes gradients for training.",
            demonstration: "Interactive network builder: add/remove layers, change neuron count and activation functions, watch data flow through the network as colored signals.",
            practiceQuestions: [
                { question: "What does the activation function do?", options: ["Normalizes weights", "Introduces non-linearity into the model", "Updates the learning rate", "Computes the loss"], correctAnswer: 1, explanation: "Without activation functions, a multi-layer network would collapse into a single linear transformation.", difficulty: 2 },
                { question: "What is the purpose of the bias term?", options: ["It speeds up training", "It allows the activation function to shift left or right", "It prevents overfitting", "It reduces dimensions"], correctAnswer: 1, explanation: "Bias allows the neuron to activate even when all inputs are zero, adding flexibility.", difficulty: 3 },
                { question: "How many parameters does a layer with 10 inputs and 5 neurons have?", options: ["50", "55", "15", "10"], correctAnswer: 1, explanation: "10×5 = 50 weights plus 5 biases = 55 parameters total.", difficulty: 3 },
            ],
            applicationTask: "Build a simple 2-layer neural network to classify XOR inputs. Verify it cannot be solved with a single-layer perceptron.",
            evaluationCriteria: "Successfully classifies XOR and explains why a single perceptron fails (linear inseparability).",
        },
    },
    {
        conceptId: "backpropagation",
        title: "Backpropagation",
        description: "The algorithm used to compute gradients for training neural networks via the chain rule of calculus.",
        category: "Deep Learning",
        difficulty_level: 4,
        prerequisites: ["neural_networks_basics", "gradient_descent"],
        tags: ["deep-learning", "training", "calculus"],
        pipeline: {
            explanation: "Backpropagation computes the gradient of the loss w.r.t. each weight by applying the chain rule backward through the network. Starting from the output loss, it propagates error signals layer-by-layer, computing ∂L/∂w for each weight. Combined with gradient descent, this allows training deep networks.",
            demonstration: "Step through backpropagation on a 2-layer network: see the forward pass values, loss computation, then gradient flow backward through each layer with numerical values displayed.",
            practiceQuestions: [
                { question: "What mathematical rule does backpropagation rely on?", options: ["Product rule", "Chain rule", "Quotient rule", "L'Hôpital's rule"], correctAnswer: 1, explanation: "The chain rule decomposes derivatives of composed functions, enabling gradient computation through layers.", difficulty: 3 },
                { question: "What is the vanishing gradient problem?", options: ["Gradients become too large", "Gradients become extremely small in deep networks", "Learning rate is zero", "Network has no bias"], correctAnswer: 1, explanation: "With sigmoid/tanh activations in deep networks, gradients shrink exponentially as they propagate back.", difficulty: 4 },
                { question: "Which activation function helps mitigate vanishing gradients?", options: ["Sigmoid", "Tanh", "ReLU", "Softmax"], correctAnswer: 2, explanation: "ReLU has a constant gradient of 1 for positive inputs, preventing gradient shrinkage.", difficulty: 3 },
            ],
            applicationTask: "Manually compute the backpropagation pass for a 2-neuron network on a given example. Verify your gradients using numerical differentiation.",
            evaluationCriteria: "Correctly applies chain rule and gradient values match numerical approximation within ε = 0.001.",
        },
    },
    {
        conceptId: "cnn_basics",
        title: "Convolutional Neural Networks",
        description: "Specialized neural networks for processing grid-structured data like images using convolutional filters.",
        category: "Deep Learning",
        difficulty_level: 4,
        prerequisites: ["neural_networks_basics", "backpropagation"],
        tags: ["deep-learning", "computer-vision", "convolution"],
        pipeline: {
            explanation: "CNNs apply learnable filters (kernels) that slide across images to detect local patterns like edges, textures, and shapes. Pooling layers reduce spatial dimensions. The architecture typically stacks Conv→ReLU→Pool layers followed by fully connected layers for classification.",
            demonstration: "Visualize convolution: apply different 3×3 kernels (edge detection, blur, sharpen) to an image. See pooling reduce dimensions and feature maps highlight detected patterns.",
            practiceQuestions: [
                { question: "What does a convolutional filter detect?", options: ["Global patterns", "Local spatial patterns like edges and textures", "Color histograms", "Sound frequencies"], correctAnswer: 1, explanation: "Convolutional filters learn to detect local patterns through their small receptive field.", difficulty: 3 },
                { question: "What is the purpose of max pooling?", options: ["Increases resolution", "Reduces spatial dimensions and provides translation invariance", "Adds more parameters", "Normalizes pixels"], correctAnswer: 1, explanation: "Max pooling down-samples feature maps, reducing computation and providing shift invariance.", difficulty: 3 },
                { question: "If an input image is 32×32 with 3 channels and you apply 16 filters of size 5×5 with no padding, what is the output size?", options: ["28×28×16", "32×32×16", "28×28×3", "5×5×16"], correctAnswer: 0, explanation: "Output size = 32 - 5 + 1 = 28 per dimension, with 16 feature maps from the 16 filters.", difficulty: 4 },
            ],
            applicationTask: "Build a CNN to classify handwritten digits (MNIST). Experiment with different numbers of convolutional layers and filter sizes.",
            evaluationCriteria: "Achieves > 95% accuracy on MNIST test set and can explain the role of each layer.",
        },
    },
    {
        conceptId: "clustering_kmeans",
        title: "K-Means Clustering",
        description: "An unsupervised algorithm that partitions data into K clusters by minimizing within-cluster variance.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["unsupervised", "clustering", "centroid"],
        pipeline: {
            explanation: "K-Means initializes K centroids randomly, then alternates between: (1) assigning each point to the nearest centroid, and (2) updating centroids as the mean of assigned points. It converges when assignments stabilize. The elbow method helps choose K by plotting inertia vs K.",
            demonstration: "Watch K-Means iterate: see centroids move and cluster colors update step-by-step. Adjust K and observe how clusters change.",
            practiceQuestions: [
                { question: "What does K represent in K-Means?", options: ["Number of features", "Number of clusters", "Number of iterations", "Number of data points"], correctAnswer: 1, explanation: "K is a hyperparameter specifying the desired number of clusters.", difficulty: 1 },
                { question: "How does K-Means assign a point to a cluster?", options: ["Random assignment", "Nearest centroid by Euclidean distance", "Based on class label", "Alphabetical order"], correctAnswer: 1, explanation: "Each point is assigned to the cluster whose centroid is closest (typically Euclidean distance).", difficulty: 2 },
                { question: "What is the elbow method?", options: ["A regularization technique", "Plotting inertia vs K to find the optimal number of clusters", "A dimensionality reduction method", "A type of activation function"], correctAnswer: 1, explanation: "The elbow method identifies the K where adding more clusters yields diminishing returns in inertia reduction.", difficulty: 3 },
            ],
            applicationTask: "Apply K-Means to customer data. Use the elbow method to determine the optimal K and profile each customer segment.",
            evaluationCriteria: "Correctly identifies the elbow point and provides meaningful segment descriptions.",
        },
    },
    {
        conceptId: "nlp_tokenization",
        title: "NLP Tokenization",
        description: "The process of breaking text into meaningful units (tokens) for natural language processing tasks.",
        category: "Natural Language Processing",
        difficulty_level: 2,
        prerequisites: [],
        tags: ["nlp", "text-processing", "preprocessing"],
        pipeline: {
            explanation: "Tokenization splits raw text into tokens: words, subwords, or characters. Word-level tokenization uses whitespace/punctuation splits. Subword methods (BPE, WordPiece) handle unknown words by breaking them into known subunits. Tokenization choices affect vocabulary size and model performance.",
            demonstration: "Enter any text and see it tokenized using different methods: whitespace, regex, BPE, and character-level. Compare vocabulary sizes and OOV handling.",
            practiceQuestions: [
                { question: "Why is subword tokenization preferred over word-level?", options: ["It is faster", "It handles unknown words by decomposing them", "It produces fewer tokens", "It is simpler to implement"], correctAnswer: 1, explanation: "Subword tokenization can represent rare/unseen words as combinations of known subword units.", difficulty: 3 },
                { question: "What problem does tokenization solve?", options: ["Image classification", "Converting text to numerical representations for models", "Database optimization", "Audio processing"], correctAnswer: 1, explanation: "Models need numerical input; tokenization is the first step to convert text into processable tokens.", difficulty: 2 },
                { question: "What is a token?", options: ["A word only", "A meaningful unit of text — word, subword, or character", "A sentence", "A document"], correctAnswer: 1, explanation: "Tokens can be words, subwords, or characters depending on the tokenization strategy.", difficulty: 1 },
            ],
            applicationTask: "Implement a basic tokenizer supporting whitespace and BPE modes. Tokenize a sample text and compare the vocabulary sizes.",
            evaluationCriteria: "Both tokenizers produce correct output and the student can discuss trade-offs.",
        },
    },
    {
        conceptId: "sentiment_analysis",
        title: "Sentiment Analysis",
        description: "Classify text as expressing positive, negative, or neutral sentiment using NLP techniques.",
        category: "Natural Language Processing",
        difficulty_level: 3,
        prerequisites: ["nlp_tokenization", "logistic_regression"],
        tags: ["nlp", "classification", "sentiment"],
        pipeline: {
            explanation: "Sentiment analysis pipelines involve: (1) text preprocessing (tokenization, stopword removal, lowercasing), (2) feature extraction (bag-of-words, TF-IDF, or embeddings), and (3) classification (Naive Bayes, logistic regression, or deep learning). Modern approaches use transformer encoders for richer contextual representations.",
            demonstration: "Enter movie reviews and see real-time sentiment scores. Toggle between bag-of-words and TF-IDF features to see how they affect predictions.",
            practiceQuestions: [
                { question: "What is TF-IDF?", options: ["A neural network architecture", "A weighting scheme that considers term frequency and document rarity", "A tokenization method", "A clustering algorithm"], correctAnswer: 1, explanation: "TF-IDF weights terms by how frequent they are in a document (TF) vs how rare across all documents (IDF).", difficulty: 3 },
                { question: "Which baseline model is commonly used for sentiment analysis?", options: ["K-Means", "Naive Bayes", "Linear Regression", "PCA"], correctAnswer: 1, explanation: "Naive Bayes is a strong baseline for text classification due to its effectiveness with bag-of-words features.", difficulty: 2 },
                { question: "Why is negation handling important in sentiment analysis?", options: ["It improves tokenization speed", "'not good' should be negative, not averaged as neutral", "It reduces vocabulary size", "It is not important"], correctAnswer: 1, explanation: "Negation flips sentiment polarity — without handling it, 'not good' might incorrectly seem positive from 'good'.", difficulty: 3 },
            ],
            applicationTask: "Build a sentiment classifier for product reviews using TF-IDF features and logistic regression. Evaluate with precision, recall, and F1.",
            evaluationCriteria: "F1 > 0.7 on a test split, with a confusion matrix showing balanced performance.",
        },
    },
    {
        conceptId: "data_preprocessing",
        title: "Data Preprocessing",
        description: "Transform raw data into a clean, structured format suitable for analysis and model training.",
        category: "Data Analytics",
        difficulty_level: 1,
        prerequisites: [],
        tags: ["data-science", "cleaning", "feature-engineering"],
        pipeline: {
            explanation: "Data preprocessing includes: handling missing values (imputation, deletion), encoding categorical variables (one-hot, label encoding), scaling numerical features (standardization, min-max), and detecting outliers. Good preprocessing is often the difference between a mediocre and an excellent model.",
            demonstration: "Load a messy dataset and interactively apply preprocessing steps: fill missing values, encode categories, and scale features. See summary statistics update after each step.",
            practiceQuestions: [
                { question: "Why is feature scaling important?", options: ["It makes data smaller", "Algorithms like SVM and kNN are sensitive to feature magnitudes", "It is purely cosmetic", "It removes outliers"], correctAnswer: 1, explanation: "Distance-based algorithms perform poorly when features have vastly different scales.", difficulty: 2 },
                { question: "What is one-hot encoding?", options: ["Converting floats to integers", "Creating binary columns for each category value", "Hashing categories", "Removing categorical features"], correctAnswer: 1, explanation: "One-hot encoding represents each category as a binary vector, avoiding ordinal assumptions.", difficulty: 2 },
                { question: "How should you handle missing values?", options: ["Always delete rows", "Choose between imputation (mean/median/mode) and deletion based on context", "Always fill with 0", "Ignore them"], correctAnswer: 1, explanation: "The strategy depends on the proportion of missing data and whether missingness is random or systematic.", difficulty: 2 },
            ],
            applicationTask: "Clean a real-world dataset: handle missing values, encode categoricals, scale numerics, and detect/handle outliers. Document each decision.",
            evaluationCriteria: "Dataset has no missing values, all features are model-ready, and preprocessing decisions are justified.",
        },
    },
    {
        conceptId: "eda",
        title: "Exploratory Data Analysis",
        description: "Use statistical summaries and visualizations to understand patterns, trends, and anomalies in data.",
        category: "Data Analytics",
        difficulty_level: 1,
        prerequisites: [],
        tags: ["data-science", "visualization", "statistics"],
        pipeline: {
            explanation: "EDA involves computing descriptive statistics (mean, median, std, quartiles), examining distributions (histograms, box plots), exploring relationships (scatter plots, correlation matrices), and identifying anomalies. It helps form hypotheses and guides subsequent modeling decisions.",
            demonstration: "Upload a CSV and get automatic EDA: summary statistics, distribution plots, correlation heatmap, and missing value report.",
            practiceQuestions: [
                { question: "What does a box plot show?", options: ["Only the mean", "Median, quartiles, and potential outliers", "Just the range", "Frequency distribution"], correctAnswer: 1, explanation: "Box plots display the median, IQR (Q1-Q3), and whiskers indicating the data spread, with outliers shown as points.", difficulty: 1 },
                { question: "What does a correlation coefficient of -0.9 indicate?", options: ["Weak positive relationship", "Strong negative linear relationship", "No relationship", "Quadratic relationship"], correctAnswer: 1, explanation: "A coefficient near -1 indicates a strong negative linear correlation between two variables.", difficulty: 2 },
                { question: "Why perform EDA before modeling?", options: ["It is required by law", "To understand data quality, distributions, and relationships that inform model choice", "To train the model", "It is optional"], correctAnswer: 1, explanation: "EDA reveals data issues, patterns, and relationships that should inform preprocessing and model selection.", difficulty: 1 },
            ],
            applicationTask: "Perform a complete EDA on a sales dataset. Produce at least 5 visualizations: distribution of revenue, correlation heatmap, time series trend, category comparison, and outlier detection.",
            evaluationCriteria: "Visualizations are properly labeled and each has an accompanying insight/interpretation.",
        },
    },
    {
        conceptId: "random_forests",
        title: "Random Forests",
        description: "An ensemble method that combines multiple decision trees trained on random subsets of data and features.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["decision_trees"],
        tags: ["ensemble", "classification", "regression", "bagging"],
        pipeline: {
            explanation: "Random forests build many decision trees (typically 100-500), each trained on a bootstrap sample of the data and considering a random subset of features at each split. Predictions are aggregated by majority vote (classification) or averaging (regression). This reduces variance and overfitting compared to a single tree.",
            demonstration: "Train individual trees and watch the ensemble prediction stabilize. Toggle the number of trees and see how accuracy and decision boundaries smoothen.",
            practiceQuestions: [
                { question: "How does a random forest reduce overfitting compared to a single decision tree?", options: ["By using fewer features", "By averaging predictions across many diverse trees", "By using a smaller dataset", "By increasing tree depth"], correctAnswer: 1, explanation: "Ensemble averaging reduces the variance that causes individual trees to overfit.", difficulty: 3 },
                { question: "What is bagging?", options: ["A feature selection method", "Bootstrap aggregating — training on random subsets with replacement", "A regularization technique", "A type of neural network"], correctAnswer: 1, explanation: "Bagging trains each model on a bootstrap (random with replacement) sample of the training data.", difficulty: 3 },
                { question: "What is feature importance in random forests?", options: ["The number of features", "A measure of how much each feature contributes to predictions", "Feature scaling", "Feature encoding"], correctAnswer: 1, explanation: "Feature importance quantifies each feature's contribution to reducing impurity across all trees.", difficulty: 2 },
            ],
            applicationTask: "Train a random forest on a customer churn dataset. Compare its performance against a single decision tree and report feature importances.",
            evaluationCriteria: "Random forest outperforms the single tree on test accuracy, and top-3 features are correctly identified.",
        },
    },
    {
        conceptId: "pca",
        title: "Principal Component Analysis",
        description: "A dimensionality reduction technique that projects data onto the directions of maximum variance.",
        category: "Machine Learning",
        difficulty_level: 3,
        prerequisites: ["data_preprocessing"],
        tags: ["unsupervised", "dimensionality-reduction", "linear-algebra"],
        pipeline: {
            explanation: "PCA finds orthogonal directions (principal components) that capture the most variance in the data. It involves: (1) standardizing features, (2) computing the covariance matrix, (3) extracting eigenvectors (loading vectors), and (4) projecting data onto the top-K eigenvectors. PCA is useful for visualization, noise reduction, and speeding up other algorithms.",
            demonstration: "Visualize high-dimensional data projected onto 2D/3D principal components. See the explained variance ratio change as you add more components.",
            practiceQuestions: [
                { question: "What do eigenvalues represent in PCA?", options: ["Feature importance", "The amount of variance explained by each principal component", "Cluster assignments", "Learning rate"], correctAnswer: 1, explanation: "Each eigenvalue indicates how much variance is captured along the corresponding eigenvector direction.", difficulty: 3 },
                { question: "When is PCA useful?", options: ["When you have too few features", "When you want to reduce dimensionality while preserving variance", "When labels are needed", "When data is already 2D"], correctAnswer: 1, explanation: "PCA is useful for high-dimensional data where you want to reduce features while keeping most information.", difficulty: 2 },
                { question: "What preprocessing step is essential before PCA?", options: ["One-hot encoding", "Feature standardization (zero mean, unit variance)", "Label encoding", "Outlier addition"], correctAnswer: 1, explanation: "PCA is affected by feature scales, so standardization ensures all features contribute equally.", difficulty: 3 },
            ],
            applicationTask: "Apply PCA to a high-dimensional dataset (50+ features). Plot the cumulative explained variance and determine how many components retain 95% of the variance.",
            evaluationCriteria: "Correctly identifies the number of components for 95% variance and provides a 2D scatter plot colored by class labels.",
        },
    },
    {
        conceptId: "cross_validation",
        title: "Cross-Validation",
        description: "A model evaluation technique that partitions data into multiple folds to estimate generalization performance.",
        category: "Machine Learning",
        difficulty_level: 2,
        prerequisites: ["linear_regression"],
        tags: ["evaluation", "validation", "model-selection"],
        pipeline: {
            explanation: "K-fold cross-validation splits data into K equal folds. The model is trained K times, each time using K-1 folds for training and 1 fold for validation. The average validation score provides a robust performance estimate. Stratified K-fold ensures class balance in each fold. Leave-one-out CV is K-fold where K = N.",
            demonstration: "Visualize data splitting into folds. See how training and validation sets rotate across folds, and watch the mean score stabilize as folds complete.",
            practiceQuestions: [
                { question: "Why use cross-validation instead of a single train/test split?", options: ["It is faster", "It provides a more reliable estimate of model performance", "It uses less data", "It only works with large datasets"], correctAnswer: 1, explanation: "Cross-validation averages performance across multiple splits, reducing variance in the estimate.", difficulty: 2 },
                { question: "What is stratified K-fold?", options: ["K-fold with data augmentation", "K-fold that maintains class proportions in each fold", "K-fold with feature selection", "K-fold with time ordering"], correctAnswer: 1, explanation: "Stratification ensures each fold has approximately the same percentage of samples of each class.", difficulty: 2 },
                { question: "What is a typical value for K?", options: ["2", "5 or 10", "100", "1"], correctAnswer: 1, explanation: "K=5 or K=10 is commonly used as a good tradeoff between bias and variance in the evaluation estimate.", difficulty: 1 },
            ],
            applicationTask: "Compare three models (linear regression, decision tree, random forest) on the same dataset using 5-fold cross-validation. Report mean and standard deviation of scores.",
            evaluationCriteria: "All three models are correctly evaluated with mean ± std scores, and the best model is justified.",
        },
    },
];

async function seed() {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/adiptify";
    await mongoose.connect(MONGO_URI, {
        dbName: process.env.MONGO_DB || "adiptify",
        serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");

    // Clear existing concepts
    await Concept.deleteMany({});
    console.log("🗑️  Cleared existing concepts");

    // Insert new concepts
    await Concept.insertMany(concepts);
    console.log(`✅ Seeded ${concepts.length} concepts`);

    await mongoose.disconnect();
    console.log("👋 Done");
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
```

## File: `backend\scripts\seedSubjects.js`

```js
/**
 * Seed default subjects into MongoDB.
 * Run: node scripts/seedSubjects.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Subject from "../models/Subject.js";

dotenv.config();

const DEFAULT_SUBJECTS = [
    {
        name: "Machine Learning",
        slug: "machine-learning",
        description: "Fundamentals of supervised and unsupervised learning, regression, classification, and clustering algorithms.",
        icon: "🤖",
        color: "emerald",
        topics: ["linear_regression", "logistic_regression", "gradient_descent", "decision_trees", "clustering_kmeans", "random_forests"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Deep Learning",
        slug: "deep-learning",
        description: "Neural networks, CNNs, RNNs, transformers, and modern architectures for AI.",
        icon: "🧠",
        color: "purple",
        topics: ["neural_networks_basics", "cnn", "rnn", "transformers", "backpropagation"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Natural Language Processing",
        slug: "natural-language-processing",
        description: "Text processing, tokenization, sentiment analysis, and language models.",
        icon: "💬",
        color: "sky",
        topics: ["nlp_tokenization", "sentiment_analysis", "word_embeddings", "text_classification"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Data Analytics",
        slug: "data-analytics",
        description: "Data preprocessing, EDA, visualization, and statistical analysis.",
        icon: "📊",
        color: "amber",
        topics: ["data_preprocessing", "eda", "data_visualization", "statistical_testing"],
        category: "Data Science",
        isDefault: true,
    },
    {
        name: "Web Development",
        slug: "web-development",
        description: "HTML, CSS, JavaScript, React, and modern web frameworks.",
        icon: "🌐",
        color: "blue",
        topics: ["html_css", "javascript_fundamentals", "react_basics", "web_apis", "http_protocols"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Python Programming",
        slug: "python-programming",
        description: "Python syntax, data structures, OOP, and standard library.",
        icon: "🐍",
        color: "yellow",
        topics: ["python_basics", "python_oop", "python_data_structures", "python_stdlib"],
        category: "Programming",
        isDefault: true,
    },
    {
        name: "Data Structures & Algorithms",
        slug: "data-structures-algorithms",
        description: "Arrays, trees, graphs, sorting, searching, and time complexity.",
        icon: "🏗️",
        color: "indigo",
        topics: ["arrays_strings", "linked_lists", "trees_graphs", "sorting_algorithms", "dynamic_programming", "time_complexity"],
        category: "Computer Science",
        isDefault: true,
    },
    {
        name: "Advanced Calculus",
        slug: "advanced-calculus",
        description: "Limits, derivatives, integrals, series, and multivariable calculus.",
        icon: "📐",
        color: "rose",
        topics: ["limits_continuity", "derivatives", "integrals", "series", "multivariable_calculus"],
        category: "Mathematics",
        isDefault: false,
    },
    {
        name: "Quantum Mechanics",
        slug: "quantum-mechanics",
        description: "Wave functions, Schrödinger equation, quantum states, and measurement.",
        icon: "⚛️",
        color: "teal",
        topics: ["wave_particle_duality", "schrodinger_equation", "quantum_states", "quantum_measurement"],
        category: "Physics",
        isDefault: false,
    },
];

async function seed() {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/adiptify";
    const MONGO_DB = process.env.MONGO_DB || "adiptify";

    try {
        await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
        console.log("✅ Connected to MongoDB");

        for (const subject of DEFAULT_SUBJECTS) {
            const exists = await Subject.findOne({ slug: subject.slug });
            if (exists) {
                console.log(`⏭️  "${subject.name}" already exists — skipping`);
            } else {
                await Subject.create(subject);
                console.log(`✅ Created "${subject.name}"`);
            }
        }

        console.log(`\n🎉 Seed complete — ${DEFAULT_SUBJECTS.length} subjects processed`);
    } catch (e) {
        console.error("❌ Seed failed:", e.message);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
```

## File: `backend\services\adaptiveLearningService.js`

```js
import UserProgress from "../models/UserProgress.js";
import Concept from "../models/Concept.js";
import Review from "../models/Review.js";

/**
 * Calculate cognitive load from performance signals
 * CL = (time_taken × error_rate) + hint_usage
 */
export function calculateCognitiveLoad(timeTakenMs, errorRate, hintUsage) {
    const timeFactor = timeTakenMs / 60000; // normalize to minutes
    const cl = (timeFactor * errorRate) + (hintUsage * 0.1);
    return Math.round(cl * 1000) / 1000;
}

/**
 * Calculate composite mastery score (0-1)
 * Mastery = cbrt(concept_accuracy × application_score × retention_score)
 * Using geometric mean (cube root of product) for balanced scoring
 */
export function calculateMasteryScore(conceptAccuracy, applicationScore, retentionScore) {
    const ca = Math.max(0, Math.min(1, conceptAccuracy));
    const as = Math.max(0, Math.min(1, applicationScore));
    const rs = Math.max(0, Math.min(1, retentionScore));
    const mastery = Math.cbrt(ca * as * rs);
    return Math.round(mastery * 1000) / 1000;
}

/**
 * Get the adaptive learning path for a user — ordered concept recommendations
 */
export async function getAdaptivePath(userId) {
    const concepts = await Concept.find({}).lean();
    const progressRecords = await UserProgress.find({ userId }).lean();
    const reviews = await Review.find({ userId }).lean();

    const progressMap = {};
    for (const p of progressRecords) {
        progressMap[p.conceptId] = p;
    }

    const reviewMap = {};
    for (const r of reviews) {
        reviewMap[r.conceptId] = r;
    }

    // Score each concept for priority
    const scored = concepts.map((concept) => {
        const progress = progressMap[concept.conceptId] || {};
        const review = reviewMap[concept.conceptId] || {};
        const mastery = progress.mastery_score || 0;
        const isDue = review.next_review ? new Date(review.next_review) <= new Date() : true;
        const pipelineComplete = progress.pipeline_completed || false;

        // Priority scoring: lower mastery = higher priority, due reviews boosted
        let priority = (1 - mastery) * 50;
        if (isDue) priority += 30;
        if (!pipelineComplete) priority += 20;

        // Check if prerequisites are met
        const prereqsMet = (concept.prerequisites || []).every((prereqId) => {
            const prereqProgress = progressMap[prereqId];
            return prereqProgress && prereqProgress.mastery_score >= 0.5;
        });

        return {
            ...concept,
            mastery_score: mastery,
            pipeline_stage: progress.pipeline_stage || 0,
            pipeline_completed: pipelineComplete,
            recommended_difficulty: progress.recommended_difficulty || concept.difficulty_level,
            cognitive_load: progress.cognitive_load || 0,
            isDue,
            prereqsMet,
            priority: prereqsMet ? priority : priority * 0.3, // deprioritize if prereqs not met
            next_review: review.next_review || null,
        };
    });

    scored.sort((a, b) => b.priority - a.priority);

    return scored;
}

/**
 * Submit performance data and adjust difficulty
 */
export async function submitPerformance(userId, conceptId, performanceData) {
    const {
        correct = 0,
        total = 1,
        timeTakenMs = 0,
        hintUsage = 0,
        applicationScore = 0,
        pipelineStage = 0,
    } = performanceData;

    const errorRate = total > 0 ? (total - correct) / total : 0;
    const accuracyRate = total > 0 ? correct / total : 0;
    const cl = calculateCognitiveLoad(timeTakenMs, errorRate, hintUsage);

    let progress = await UserProgress.findOne({ userId, conceptId });
    if (!progress) {
        progress = new UserProgress({ userId, conceptId });
    }

    // Update cumulative stats
    progress.total_correct += correct;
    progress.total_questions += total;
    progress.attempt_count += 1;
    progress.hint_usage += hintUsage;
    progress.total_time_spent += timeTakenMs;
    progress.accuracy_rate = progress.total_questions > 0
        ? progress.total_correct / progress.total_questions
        : 0;
    progress.concept_accuracy = progress.accuracy_rate;
    progress.application_score = Math.max(progress.application_score, applicationScore);
    progress.cognitive_load = cl;
    progress.pipeline_stage = Math.max(progress.pipeline_stage, pipelineStage);
    progress.pipeline_completed = progress.pipeline_stage >= 4;

    // Calculate composite mastery
    progress.mastery_score = calculateMasteryScore(
        progress.concept_accuracy,
        progress.application_score,
        progress.retention_score || 0.1
    );

    // Adaptive difficulty adjustment — uses behavior engine if available
    let downThreshold = 0.4;
    let upThreshold = 0.8;
    let minLevel = 1;
    let maxLevel = 5;
    try {
        const { getDifficultyParams } = await import('./behaviorEngine.js');
        const params = await getDifficultyParams(userId);
        downThreshold = params.downThreshold;
        upThreshold = params.upThreshold;
        minLevel = params.minLevel;
        maxLevel = params.maxLevel;
    } catch { /* fallback to defaults */ }

    if (progress.mastery_score < downThreshold) {
        progress.recommended_difficulty = Math.max(minLevel, (progress.recommended_difficulty || 2) - 1);
    } else if (progress.mastery_score > upThreshold) {
        progress.recommended_difficulty = Math.min(maxLevel, (progress.recommended_difficulty || 2) + 1);
    }

    // Cognitive load threshold — suggest remediation
    const needsRemediation = cl > 2.0;

    await progress.save();

    return {
        mastery_score: progress.mastery_score,
        concept_accuracy: progress.concept_accuracy,
        application_score: progress.application_score,
        retention_score: progress.retention_score,
        cognitive_load: cl,
        recommended_difficulty: progress.recommended_difficulty,
        pipeline_stage: progress.pipeline_stage,
        pipeline_completed: progress.pipeline_completed,
        needsRemediation,
    };
}

/**
 * Get the mastery breakdown for a specific concept
 */
export async function getMasteryBreakdown(userId, conceptId) {
    const progress = await UserProgress.findOne({ userId, conceptId }).lean();
    if (!progress) {
        return {
            mastery_score: 0,
            concept_accuracy: 0,
            application_score: 0,
            retention_score: 0,
            cognitive_load: 0,
            pipeline_stage: 0,
            recommended_difficulty: 2,
            attempt_count: 0,
        };
    }
    return progress;
}

export default {
    calculateCognitiveLoad,
    calculateMasteryScore,
    getAdaptivePath,
    submitPerformance,
    getMasteryBreakdown,
};
```

## File: `backend\services\analyticsService.js`

```js
import UserProgress from "../models/UserProgress.js";
import Review from "../models/Review.js";
import Concept from "../models/Concept.js";
import { getEnrolledSubjectNames } from "./generateConceptsService.js";

/**
 * Get full dashboard analytics for a user — filtered by enrolled subjects
 */
export async function getDashboardMetrics(userId) {
    // Get enrolled subject names to filter concepts
    const subjectNames = await getEnrolledSubjectNames(userId);

    // Build concept filter based on enrolled subjects
    const conceptFilter = subjectNames.length > 0
        ? { category: { $in: subjectNames } }
        : { category: "NON_EXISTENT_CATEGORY_FOR_EMPTY_STATE" }; // Force no results

    const allConcepts = await Concept.find(conceptFilter).lean();
    const conceptIds = allConcepts.map(c => c.conceptId);

    // Filter progress and reviews to only include enrolled subject concepts
    const allProgress = await UserProgress.find({
        userId,
        ...(conceptIds.length > 0 ? { conceptId: { $in: conceptIds } } : {}),
    }).lean();

    const allReviews = await Review.find({
        userId,
        ...(conceptIds.length > 0 ? { conceptId: { $in: conceptIds } } : {}),
    }).lean();

    const totalConcepts = allConcepts.length;
    const studiedConcepts = allProgress.length;

    // Mastery progression — average mastery per category
    const categoryMastery = {};
    for (const p of allProgress) {
        const concept = allConcepts.find((c) => c.conceptId === p.conceptId);
        const cat = concept?.category || "General";
        if (!categoryMastery[cat]) categoryMastery[cat] = { total: 0, count: 0 };
        categoryMastery[cat].total += p.mastery_score || 0;
        categoryMastery[cat].count += 1;
    }
    const masteryByCategory = Object.entries(categoryMastery).map(([category, data]) => ({
        category,
        mastery: data.count > 0 ? Math.round((data.total / data.count) * 100) : 0,
    }));

    // If no progress yet but we have concepts, show 0% for each subject
    if (masteryByCategory.length === 0 && subjectNames.length > 0) {
        for (const name of subjectNames) {
            masteryByCategory.push({ category: name, mastery: 0 });
        }
    }

    // Overall mastery
    const overallMastery = allProgress.length > 0
        ? Math.round((allProgress.reduce((sum, p) => sum + (p.mastery_score || 0), 0) / allProgress.length) * 100)
        : 0;

    // Retention rate — percentage of reviews with quality ≥ 3
    const totalReviewEvents = allReviews.reduce((sum, r) => sum + (r.history?.length || 0), 0);
    const successfulReviews = allReviews.reduce(
        (sum, r) => sum + (r.history || []).filter((h) => h.quality >= 3).length,
        0
    );
    const retentionRate = totalReviewEvents > 0
        ? Math.round((successfulReviews / totalReviewEvents) * 100)
        : 0;

    // Time per topic
    const timePerTopic = allProgress.map((p) => {
        const concept = allConcepts.find((c) => c.conceptId === p.conceptId);
        return {
            conceptId: p.conceptId,
            title: concept?.title || p.conceptId,
            timeSpent: Math.round((p.total_time_spent || 0) / 60000), // minutes
        };
    }).sort((a, b) => b.timeSpent - a.timeSpent);

    // Practice completion rate
    const completedPipelines = allProgress.filter((p) => p.pipeline_completed).length;
    const completionRate = studiedConcepts > 0
        ? Math.round((completedPipelines / studiedConcepts) * 100)
        : 0;

    // Learning velocity — concepts progressing per week (simplified)
    const recentProgress = allProgress.filter((p) => {
        const updated = new Date(p.updatedAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return updated >= weekAgo;
    });
    const learningVelocity = recentProgress.length;

    // Due reviews count
    const now = new Date();
    const dueCount = allReviews.filter((r) => new Date(r.next_review) <= now).length;

    // Skill radar data
    const radarData = masteryByCategory.map((mc) => ({
        axis: mc.category,
        value: mc.mastery / 100,
    }));

    // Mastery history (simplified — from review history dates)
    const masteryHistory = [];
    const allHistoryPoints = [];
    for (const r of allReviews) {
        for (const h of r.history || []) {
            allHistoryPoints.push({
                date: new Date(h.date),
                quality: h.quality,
            });
        }
    }
    allHistoryPoints.sort((a, b) => a.date - b.date);

    // Group by day
    const byDay = {};
    for (const point of allHistoryPoints) {
        const key = point.date.toISOString().split("T")[0];
        if (!byDay[key]) byDay[key] = { total: 0, count: 0 };
        byDay[key].total += point.quality / 5;
        byDay[key].count += 1;
    }
    for (const [date, data] of Object.entries(byDay)) {
        masteryHistory.push({
            date,
            value: Math.round((data.total / data.count) * 100),
        });
    }

    return {
        overallMastery,
        totalConcepts,
        studiedConcepts,
        completionRate,
        retentionRate,
        learningVelocity,
        dueReviewCount: dueCount,
        masteryByCategory,
        timePerTopic: timePerTopic.slice(0, 10),
        radarData,
        masteryHistory,
    };
}

/**
 * Get per-concept analytics
 */
export async function getConceptAnalytics(userId, conceptId) {
    const progress = await UserProgress.findOne({ userId, conceptId }).lean();
    const review = await Review.findOne({ userId, conceptId }).lean();
    const concept = await Concept.findOne({ conceptId }).lean();

    return {
        concept: concept || { conceptId, title: conceptId },
        progress: progress || { mastery_score: 0, attempt_count: 0, pipeline_stage: 0 },
        review: review || { easiness_factor: 2.5, interval: 0, repetition: 0, history: [] },
    };
}

export default { getDashboardMetrics, getConceptAnalytics };
```

## File: `backend\services\assessmentService.js`

```js
import Item from "../models/Item.js";
import AssessmentSession from "../models/AssessmentSession.js";
import { generateQuestionsFromTopic } from "./ollamaService.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";

/**
 * Start an assessment session for a user
 * - Finds or generates items for the requested topics
 * - Creates an AssessmentSession
 */
export async function startAssessment(userId, { mode = "formative", requestedTopics = [], limit = 5, proctored = false }) {
    let items = [];

    // Try to find existing items for requested topics
    if (requestedTopics.length > 0) {
        items = await Item.find({
            topics: { $in: requestedTopics },
        })
            .limit(limit)
            .lean();
    }

    // If not enough items, generate with AI
    if (items.length < limit && requestedTopics.length > 0) {
        const topic = requestedTopics[0];
        try {
            const generated = await generateQuestionsFromTopic(topic, {
                count: limit - items.length,
                distribution: { easy: 2, medium: 2, hard: 1 },
            });

            // Save generated assessment record
            const genRecord = await GeneratedAssessment.create({
                topic,
                title: generated.title,
                items: generated.items,
                rawResponse: generated.rawResponse,
                status: "published",
                createdBy: userId,
                publishedAt: new Date(),
                publishedBy: userId,
                proctored,
            });

            // Save items to Item collection
            const savedItems = await Item.insertMany(
                generated.items.map(i => ({ ...i, createdBy: userId }))
            );

            genRecord.linkedItemIds = savedItems.map(i => i._id);
            await genRecord.save();

            items = [...items, ...savedItems.map(i => i.toObject())];
        } catch (e) {
            console.error("AI generation failed:", e.message);
            // Continue with whatever items we have
        }
    }

    if (items.length === 0) {
        throw new Error("No questions available for the requested topics. Please try again.");
    }

    // Limit items
    items = items.slice(0, limit);

    // Create session
    const session = await AssessmentSession.create({
        user: userId,
        mode,
        itemIds: items.map(i => i._id),
        status: "active",
        metadata: { requestedTopics },
        proctored,
        proctorConfig: proctored ? {
            blockTabSwitch: true,
            blockCopyPaste: true,
            blockRightClick: true,
            allowTabSwitchCount: 2,
        } : {},
    });

    // Return session with populated items
    return {
        _id: session._id,
        mode: session.mode,
        status: session.status,
        proctored: session.proctored,
        proctorConfig: session.proctorConfig,
        items: items.map(i => ({
            _id: i._id,
            type: i.type,
            question: i.question,
            choices: i.choices,
            difficulty: i.difficulty,
            bloom: i.bloom,
            topics: i.topics,
            hints: i.hints,
        })),
        totalQuestions: items.length,
        currentIndex: 0,
    };
}

/**
 * Get user's assessment session history
 */
export async function getSessionHistory(userId, { status, limit = 10 } = {}) {
    const query = { user: userId };
    if (status) query.status = status;

    return await AssessmentSession.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}

export default { startAssessment, getSessionHistory };
```

## File: `backend\services\azureAgentService.js`

```js
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
```

## File: `backend\services\azureDocumentService.js`

```js
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
```

## File: `backend\services\azureSearchService.js`

```js
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
```

## File: `backend\services\behaviorEngine.js`

```js
/**
 * Behavior Engine — Decision layer that converts settings into runtime parameters.
 * Modules call this to get concrete values for their logic.
 */
import { resolveSettings, getTutorSettings, getDifficultySettings, getSrsSettings } from './settingsEngine.js';

// ── Difficulty Thresholds ──
const DIFFICULTY_THRESHOLDS = {
    conservative: { upThreshold: 0.85, downThreshold: 0.45, windowSize: 10 },
    moderate:     { upThreshold: 0.75, downThreshold: 0.40, windowSize: 7 },
    aggressive:   { upThreshold: 0.65, downThreshold: 0.35, windowSize: 5 },
};

// ── SRS Intervals ──
const SRS_FREQUENCY_MULTIPLIERS = {
    low: 1.5,    // Longer intervals → fewer reviews
    medium: 1.0, // Default SM-2
    high: 0.7,   // Shorter intervals → more reviews
};

// ── Tutor Token Budgets ──
const DEPTH_TOKEN_LIMITS = {
    brief: 150,
    medium: 300,
    detailed: 600,
};

/**
 * Get difficulty adaptation parameters for a user
 */
export async function getDifficultyParams(userId) {
    const settings = await getDifficultySettings(userId);
    const thresholds = DIFFICULTY_THRESHOLDS[settings.adaptationMode] || DIFFICULTY_THRESHOLDS.moderate;

    return {
        ...thresholds,
        minLevel: settings.minLevel,
        maxLevel: settings.maxLevel,
        adaptationMode: settings.adaptationMode,
    };
}

/**
 * Get SRS parameters for a user
 */
export async function getSrsParams(userId) {
    const settings = await getSrsSettings(userId);

    return {
        intervalMultiplier: SRS_FREQUENCY_MULTIPLIERS[settings.reviewFrequency] || 1.0,
        errorWeighting: settings.errorWeighting,
        retentionTarget: settings.retentionTarget,
        reviewFrequency: settings.reviewFrequency,
    };
}

/**
 * Get tutor behavior parameters for a user
 */
export async function getTutorParams(userId) {
    const settings = await getTutorSettings(userId);

    return {
        ...settings,
        maxTokens: DEPTH_TOKEN_LIMITS[settings.explanationDepth] || 300,
        shouldGiveHint: (isCorrect) => {
            if (settings.hintMode === 'never') return false;
            if (settings.hintMode === 'always_available') return true;
            return !isCorrect; // on_mistake
        },
        shouldIntervene: (mastery, streak) => {
            if (settings.interventionLevel === 'passive') return false;
            if (settings.interventionLevel === 'proactive') return mastery < 60 || streak < 0;
            return mastery < 40; // medium
        },
    };
}

/**
 * Build system prompt suffix from tutor settings
 */
export async function buildTutorPromptSuffix(userId) {
    const params = await getTutorParams(userId);
    const lines = [];

    if (params.reasoningMode === 'step_by_step') {
        lines.push('Break down your explanation into numbered steps.');
    } else if (params.reasoningMode === 'socratic') {
        lines.push('Guide the student with questions. Do NOT give the answer directly.');
    }

    if (params.explanationDepth === 'brief') {
        lines.push('Keep your response under 100 words.');
    } else if (params.explanationDepth === 'detailed') {
        lines.push('Provide comprehensive explanations with examples, analogies, and edge cases.');
    }

    return lines.length > 0 ? '\n\nBEHAVIOR RULES:\n' + lines.map(l => `- ${l}`).join('\n') : '';
}

export default {
    getDifficultyParams,
    getSrsParams,
    getTutorParams,
    buildTutorPromptSuffix,
};
```

## File: `backend\services\eventBus.js`

```js
/**
 * In-process Event Bus for Adiptify.
 * Decouples modules (Tutor, SRS, Difficulty, Leaderboard) via pub/sub events.
 * 
 * Usage:
 *   import { eventBus, EVENTS } from './eventBus.js';
 *   eventBus.on(EVENTS.QUIZ_COMPLETED, handler);
 *   eventBus.emit(EVENTS.QUIZ_COMPLETED, payload);
 */
import { EventEmitter } from 'events';

class AdiptifyEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
        this._eventLog = [];
    }

    /**
     * Emit with structured logging
     */
    emit(event, payload = {}) {
        const entry = {
            event,
            timestamp: Date.now(),
            userId: payload?.userId || null,
        };
        this._eventLog.push(entry);

        // Keep log bounded
        if (this._eventLog.length > 500) {
            this._eventLog = this._eventLog.slice(-250);
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[EventBus] ${event}`, payload?.userId ? `user=${payload.userId}` : '');
        }

        return super.emit(event, payload);
    }

    /**
     * Get recent event history for debugging
     */
    getRecentEvents(limit = 20) {
        return this._eventLog.slice(-limit);
    }
}

// ── Event Constants ──
export const EVENTS = {
    // User Settings
    SETTINGS_UPDATED: 'settings:updated',
    SETTINGS_RESET: 'settings:reset',

    // Quiz & Assessment
    QUIZ_COMPLETED: 'quiz:completed',
    QUIZ_STARTED: 'quiz:started',
    QUESTION_ANSWERED: 'question:answered',

    // Tutor
    TUTOR_MESSAGE: 'tutor:message',
    TUTOR_HINT_USED: 'tutor:hint_used',

    // Learning Progress
    MASTERY_UPDATED: 'mastery:updated',
    TOPIC_COMPLETED: 'topic:completed',
    MODULE_COMPLETED: 'module:completed',
    STREAK_UPDATED: 'streak:updated',

    // SRS
    SRS_REVIEW_DUE: 'srs:review_due',
    SRS_CARD_REVIEWED: 'srs:card_reviewed',

    // Difficulty
    DIFFICULTY_ADJUSTED: 'difficulty:adjusted',

    // Leaderboard
    LEADERBOARD_XP_EARNED: 'leaderboard:xp_earned',
    LEADERBOARD_RANK_CHANGED: 'leaderboard:rank_changed',

    // Syllabus
    SYLLABUS_PARSED: 'syllabus:parsed',
    SUBJECT_CREATED: 'subject:created',

    // Organization
    ORG_MEMBER_ADDED: 'org:member_added',
    ORG_MEMBER_REMOVED: 'org:member_removed',
};

export const eventBus = new AdiptifyEventBus();
export default eventBus;
```

## File: `backend\services\generateConceptsService.js`

```js
import { Ollama } from "ollama";
import { config } from "../config/index.js";
import Concept from "../models/Concept.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import Syllabus from "../models/Syllabus.js";

// ─── Prompt for generating study concepts from a topic ───
const CONCEPT_GENERATOR_SYSTEM = `You are an expert curriculum designer.
Generate EXACTLY 8 study concepts for the provided topic. Each concept must be a granular, distinct learning unit.

The output MUST be a valid JSON object with the following structure:
{
  "concepts": [
    {
      "title": "String",
      "description": "String",
      "difficulty_level": Number (1-5),
      "prerequisites": ["Titles of earlier concepts in this list"],
      "tags": ["topic_name", "category_name"],
      "pipeline": {
        "explanation": "String (Comprehensive explanation, at least 3 paragraphs)",
        "demonstration": "String (Practical example or code snippet)",
        "practiceQuestions": [
          { "question": "String", "options": [String, String, String, String], "correctAnswer": Number (0-3), "explanation": "String", "difficulty": Number(1-5) },
          { "question": "String", "options": [String, String, String, String], "correctAnswer": Number (0-3), "explanation": "String", "difficulty": Number(1-5) },
          { "question": "String", "options": [String, String, String, String], "correctAnswer": Number (0-3), "explanation": "String", "difficulty": Number(1-5) }
        ],
        "applicationTask": "String (Hands-on exercise)",
        "evaluationCriteria": "String (How to know if the task is done correctly)"
      }
    }
  ]
}

Rules:
1. STRICT: Generate EXACTLY 8 concepts.
2. COMPLETENESS: Every concept must have a detailed explanation, a demonstration, exactly 3 practice questions, an application task, and evaluation criteria.
3. GRANULARITY: Each concept should cover roughly 15-20 minutes of study time.
4. FORMAT: JSON only, no additional prose outside the JSON.`;

function conceptGeneratorUser(subjectName, topicTitle, topicDescription, learningOutcomes, moduleName) {
    let prompt = `Generate 8 study concepts for the following:\n\nSubject: "${subjectName}"\n`;
    if (moduleName) prompt += `Module/Unit: "${moduleName}"\n`;
    prompt += `Topic: "${topicTitle}"\nTopic Description: "${topicDescription || "Not provided"}"\n`;
    prompt += `Subject Learning Outcomes: ${JSON.stringify(learningOutcomes || [])}\n\n`;
    prompt += `Generate granular, well-structured concepts that cover this topic comprehensively. You MUST ensure the concepts perfectly align with the content expected in this academic module/syllabus level.`;
    return prompt;
}

/**
 * Parse JSON from AI response, handling markdown fences
 */
function parseJsonSafe(text) {
    let cleaned = text.trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {}

    if (cleaned.startsWith("```")) {
        let noMd = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        try { return JSON.parse(noMd); } catch (e) {}
    }

    const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (mdMatch && mdMatch[1]) {
        try { return JSON.parse(mdMatch[1].trim()); } catch (e) {}
    }
    
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    
    let objStr = objMatch ? objMatch[0] : null;
    let arrStr = arrMatch ? arrMatch[0] : null;
    
    if (objStr && arrStr) {
        const target = objStr.length > arrStr.length ? objStr : arrStr;
        try { return JSON.parse(target); } catch (e) {}
    } else if (objStr) {
        try { return JSON.parse(objStr); } catch (e) {}
    } else if (arrStr) {
        try { return JSON.parse(arrStr); } catch (e) {}
    }
    
    throw new Error("Could not extract valid JSON from response.");
}

/**
 * Generate concepts for a single topic using Ollama
 */
async function generateConceptsForTopic(subjectName, topic, learningOutcomes) {
    const ollamaBase = (typeof config.ollamaBaseUrl === "string" && config.ollamaBaseUrl.trim() !== "")
        ? config.ollamaBaseUrl
        : "http://127.0.0.1:11434";

    const ollama = new Ollama({ host: ollamaBase });

    let systemPrompt = CONCEPT_GENERATOR_SYSTEM;
    let userPrompt = conceptGeneratorUser(subjectName, topic.title || topic, topic.description || "", learningOutcomes, topic.moduleName);

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await ollama.chat({
                model: config.ollamaModel || "llama3",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                stream: false,
                format: "json",
            });

            const raw = response.message?.content || "";
            const parsed = parseJsonSafe(raw);
            return parsed.concepts || [];
        } catch (err) {
            lastError = err;
            console.warn(`[GenerateConcepts] Attempt ${attempt} failed for topic "${topic.title || topic}":`, err.message);
            userPrompt += `\n\nCRITICAL FEEDBACK ON PREVIOUS ATTEMPT:\nYour previous response failed to parse as valid JSON. Error: ${err.message}. Please strictly output ONLY valid JSON without any markdown formatting or preamble.`;
        }
    }

    console.error(`[GenerateConcepts] Ollama failed after 3 attempts for topic "${topic.title || topic}":`, lastError.message);
    // Return fallback concepts so the system still works without AI
    return generateFallbackConcepts(subjectName, topic);
}

/**
 * Generate fallback concepts when Ollama is unavailable
 */
function generateFallbackConcepts(subjectName, topic) {
    const topicTitle = topic.title || topic;
    const topicDesc = topic.description || `Study of ${topicTitle}`;
    
    const concepts = [];
    const subtopics = [
        { suffix: "Introduction", diff: 1, desc: `Fundamental introduction to ${topicTitle}` },
        { suffix: "Core Principles", diff: 2, desc: `Core principles and foundations of ${topicTitle}` },
        { suffix: "Key Terminology", diff: 1, desc: `Essential terminology and definitions in ${topicTitle}` },
        { suffix: "Practical Applications", diff: 3, desc: `Real-world applications of ${topicTitle}` },
        { suffix: "Problem Solving", diff: 3, desc: `Problem-solving techniques in ${topicTitle}` },
        { suffix: "Advanced Concepts", diff: 4, desc: `Advanced topics and patterns in ${topicTitle}` },
        { suffix: "Case Studies", diff: 3, desc: `Case studies and examples in ${topicTitle}` },
        { suffix: "Analysis & Evaluation", diff: 4, desc: `Critical analysis and evaluation of ${topicTitle}` },
    ];

    for (const sub of subtopics) {
        const title = `${topicTitle}: ${sub.suffix}`;
        concepts.push({
            conceptId: `id_${Math.random().toString(36).substr(2, 9)}`,
            title,
            description: sub.desc,
            category: subjectName,
            difficulty_level: sub.diff,
            prerequisites: sub.diff > 2 ? [`${topicTitle}: Introduction`] : [],
            tags: [topicTitle.toLowerCase(), sub.suffix.toLowerCase()],
            pipeline: {
                explanation: `${sub.desc}. This concept covers the essential aspects of ${sub.suffix.toLowerCase()} within ${topicTitle}. Understanding this is crucial for mastering ${subjectName}. It involves exploring the theoretical foundations and practical implications within the broader context of the subject. Studients should focus on the key mechanisms that drive this specific sub-topic.`,
                demonstration: `Practical demonstration of ${sub.suffix.toLowerCase()} in a real-world ${subjectName} context. Imagine a scenario where you encounter ${topicTitle} in production; this module shows how to handle it efficiently.`,
                practiceQuestions: [
                    {
                        question: `What is the primary focus of ${sub.suffix.toLowerCase()} in ${topicTitle}?`,
                        options: [`Understanding ${sub.suffix.toLowerCase()} fundamentals`, "Statistical noise", "Hardware constraints", "None of the above"],
                        correctAnswer: 0,
                        explanation: `${sub.suffix} in ${topicTitle} focuses on understanding the fundamental aspects.`,
                        difficulty: sub.diff,
                    },
                    {
                        question: `Which approach is most effective for studying ${topicTitle} ${sub.suffix.toLowerCase()}?`,
                        options: ["Memorization only", "Practice with hands-on examples", "Skipping prerequisites", "Reading summaries only"],
                        correctAnswer: 1,
                        explanation: "Hands-on practice with examples is the most effective learning approach.",
                        difficulty: sub.diff,
                    },
                    {
                        question: `Why is ${sub.suffix.toLowerCase()} important in ${topicTitle}?`,
                        options: ["It is not important", "It provides the structural base", "It is only for experts", "It is a legacy feature"],
                        correctAnswer: 1,
                        explanation: `The ${sub.suffix.toLowerCase()} provides the structural base for understanding the complex interactions in ${topicTitle}.`,
                        difficulty: sub.diff,
                    }
                ],
                applicationTask: `Implement a basic example of ${sub.suffix.toLowerCase()} using the principles discussed in the explanation.`,
                evaluationCriteria: "Correct implementation of the core logic with appropriate error handling."
            }
        });
    }
    return concepts;
}

/**
 * Main function: Generate all concepts for all enrolled subjects at once.
 * Caches in MongoDB — skips subjects that already have concepts.
 * Returns { generated, cached, total }
 */
export async function generateAllConceptsForUser(userId, onProgress = null) {
    // 1. Get user with enrolled subjects
    const user = await User.findById(userId).populate("enrolledSubjects").lean();
    if (!user || !user.enrolledSubjects?.length) {
        throw new Error("No enrolled subjects found. Please enroll in subjects first.");
    }

    const stats = { generated: 0, cached: 0, total: 0, subjects: [] };

    for (const subject of user.enrolledSubjects) {
        const subjectName = subject.name;
        const subjectCategory = subject.name; // Use subject name as category for concepts

        let topicList = [];

        // 2. Try to get topics from Syllabus Builder
        const syllabusObj = await Syllabus.findOne({ subjectId: subject._id }).lean();
        if (syllabusObj && syllabusObj.modules && syllabusObj.modules.length > 0) {
            syllabusObj.modules.forEach(mod => {
                if (mod.topics && mod.topics.length > 0) {
                    mod.topics.forEach(t => {
                        topicList.push({
                            title: t.title,
                            description: t.description || "",
                            moduleName: mod.title
                        });
                    });
                } else {
                     topicList.push({
                         title: mod.title,
                         description: mod.description || "",
                         moduleName: mod.title
                     });
                }
            });
        } else if (subject.topics && subject.topics.length > 0) {
            // Fallback to existing subject topics array
            topicList = subject.topics.map(t => (typeof t === "string" ? { title: t, description: "" } : t));
        } else {
            // Fallback to learning outcomes
            topicList = (subject.learningOutcomes || []).map(lo => ({ title: lo, description: lo }));
        }

        if (topicList.length === 0) {
            console.warn(`[GenerateConcepts] Subject "${subjectName}" has no topics or learning outcomes. Skipping.`);
            continue;
        }

        let subjectGenerated = 0;
        let subjectCached = 0;

        for (let ti = 0; ti < topicList.length; ti++) {
            const topic = topicList[ti];
            const topicTitle = topic.title || topic;

            // 3. Check if concepts already exist for this subject+topic combo
            const existingCount = await Concept.countDocuments({
                category: subjectCategory,
                tags: { $in: [topicTitle.toLowerCase()] },
            });

            if (existingCount >= 8) {
                // Already have enough concepts for this topic — skip
                subjectCached += existingCount;
                stats.cached += existingCount;
                continue;
            }

            // 4. Generate concepts via AI
            if (typeof onProgress === "function") {
                onProgress({
                    subject: subjectName,
                    topic: topicTitle,
                    topicIndex: ti,
                    totalTopics: topicList.length,
                });
            }

            console.log(`[GenerateConcepts] Generating for "${subjectName}" → "${topicTitle}"...`);
            const rawConcepts = await generateConceptsForTopic(subjectName, topic, subject.learningOutcomes);

            // 5. Save to MongoDB (deduplicate by conceptId)
            for (const concept of rawConcepts) {
                const conceptId = `${subjectName}_${concept.title}`
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_|_$/g, "")
                    .substring(0, 80);

                const exists = await Concept.findOne({ conceptId });
                if (exists) {
                    subjectCached++;
                    stats.cached++;
                    continue;
                }

                try {
                    await Concept.create({
                        conceptId,
                        title: concept.title,
                        description: concept.description || "",
                        category: subjectCategory,
                        difficulty_level: Math.min(5, Math.max(1, concept.difficulty_level || 2)),
                        prerequisites: (concept.prerequisites || []).map(p =>
                            `${subjectName}_${p}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 80)
                        ),
                        tags: [
                            ...(concept.tags || []),
                            topicTitle.toLowerCase(),
                            subjectName.toLowerCase(),
                        ],
                        pipeline: concept.pipeline || {},
                    });

                    // 6. Also initialize a Review record for spaced repetition
                    await Review.findOneAndUpdate(
                        { userId, conceptId },
                        {
                            $setOnInsert: {
                                userId,
                                conceptId,
                                easiness_factor: 2.5,
                                interval: 0,
                                repetition: 0,
                                quality_score: 0,
                                next_review: new Date(),
                                history: [],
                            },
                        },
                        { upsert: true, new: true }
                    );

                    subjectGenerated++;
                    stats.generated++;
                } catch (err) {
                    if (err.code === 11000) {
                        // Duplicate — already exists
                        subjectCached++;
                        stats.cached++;
                    } else {
                        console.error(`[GenerateConcepts] Error saving concept "${concept.title}":`, err.message);
                    }
                }
            }
        }

        stats.subjects.push({
            name: subjectName,
            generated: subjectGenerated,
            cached: subjectCached,
            topics: topicList.length,
        });
    }

    stats.total = stats.generated + stats.cached;
    console.log(`[GenerateConcepts] Complete: ${stats.generated} generated, ${stats.cached} cached, ${stats.total} total`);
    return stats;
}

/**
 * Get all concept IDs belonging to user's enrolled subjects
 */
export async function getEnrolledSubjectNames(userId) {
    const user = await User.findById(userId).populate("enrolledSubjects", "name").lean();
    if (!user?.enrolledSubjects?.length) return [];
    return user.enrolledSubjects.map(s => s.name);
}

export default {
    generateAllConceptsForUser,
    getEnrolledSubjectNames,
};
```

## File: `backend\services\gradingService.js`

```js
/**
 * Grade a student's answer against the correct answer
 * Supports MCQ (index comparison) and text-based answers
 */
export function gradeAnswer(item, userAnswer) {
    const type = item.type || "mcq";

    if (type === "mcq") {
        // MCQ: compare index
        const correctIdx = typeof item.answer === "number" ? item.answer : parseInt(item.answer);
        const userIdx = typeof userAnswer === "number" ? userAnswer : parseInt(userAnswer);
        const isCorrect = correctIdx === userIdx;
        return {
            isCorrect,
            score: isCorrect ? 1 : 0,
            feedback: isCorrect ? "Correct!" : `Incorrect. The correct answer was: ${item.choices?.[correctIdx] || item.answer}`,
        };
    }

    if (type === "fill_blank" || type === "short_answer") {
        // Text comparison: case-insensitive, trimmed
        const correct = String(item.answer).trim().toLowerCase();
        const user = String(userAnswer).trim().toLowerCase();
        const isCorrect = correct === user;
        return {
            isCorrect,
            score: isCorrect ? 1 : 0,
            feedback: isCorrect ? "Correct!" : `Incorrect. Expected: ${item.answer}`,
        };
    }

    // Default: exact match
    const isCorrect = JSON.stringify(item.answer) === JSON.stringify(userAnswer);
    return {
        isCorrect,
        score: isCorrect ? 1 : 0,
        feedback: isCorrect ? "Correct!" : "Incorrect.",
    };
}

export default { gradeAnswer };
```

## File: `backend\services\leaderboardService.js`

```js
/**
 * Leaderboard Service — Updates scores on events and queries rankings.
 */
import LeaderboardEntry from '../models/LeaderboardEntry.js';
import { eventBus, EVENTS } from './eventBus.js';

// ── XP Constants ──
const XP_REWARDS = {
    CORRECT_ANSWER: 10,
    QUIZ_COMPLETED: 50,
    STREAK_BONUS: 5, // per day
    DIFFICULTY_MULTIPLIER: [0, 0.8, 1.0, 1.2, 1.5, 2.0], // index = difficulty level
};

/**
 * Get or create a leaderboard entry for a user in a context
 */
async function getEntry(userId, { subjectId = null, orgId = null, period = 'alltime' } = {}) {
    let entry = await LeaderboardEntry.findOne({ userId, subjectId, orgId, period });
    if (!entry) {
        entry = new LeaderboardEntry({ userId, subjectId, orgId, period });
    }
    return entry;
}

/**
 * Award XP and update stats after a quiz is completed
 */
export async function onQuizCompleted({ userId, subjectId, orgId, accuracy, difficulty, questionsAnswered }) {
    const contexts = [
        { subjectId: null, orgId: null, period: 'alltime' }, // global
    ];
    if (subjectId) contexts.push({ subjectId, orgId: null, period: 'alltime' });
    if (orgId) contexts.push({ subjectId: null, orgId, period: 'alltime' });

    const diffMultiplier = XP_REWARDS.DIFFICULTY_MULTIPLIER[Math.round(difficulty)] || 1.0;
    const earnedXp = Math.round(
        (questionsAnswered * XP_REWARDS.CORRECT_ANSWER * (accuracy / 100) * diffMultiplier) +
        XP_REWARDS.QUIZ_COMPLETED
    );

    for (const ctx of contexts) {
        const entry = await getEntry(userId, ctx);
        entry.xp += earnedXp;
        entry.quizzesCompleted += 1;
        entry.questionsAnswered += questionsAnswered;

        // Rolling accuracy: weighted average
        const totalQ = entry.questionsAnswered;
        const prevQ = totalQ - questionsAnswered;
        entry.accuracy = prevQ > 0
            ? Math.round(((entry.accuracy * prevQ) + (accuracy * questionsAnswered)) / totalQ)
            : Math.round(accuracy);

        // Difficulty average
        entry.difficultyAvg = prevQ > 0
            ? ((entry.difficultyAvg * prevQ) + (difficulty * questionsAnswered)) / totalQ
            : difficulty;

        entry.lastActivityAt = new Date();
        await entry.save();
    }

    eventBus.emit(EVENTS.LEADERBOARD_XP_EARNED, { userId, earnedXp, subjectId, orgId });
    return earnedXp;
}

/**
 * Update streak
 */
export async function updateStreak(userId, currentStreak) {
    await LeaderboardEntry.updateMany(
        { userId, period: 'alltime' },
        { $set: { streak: currentStreak, lastActivityAt: new Date() } }
    );
}

/**
 * Get ranked leaderboard
 */
export async function getLeaderboard({ subjectId = null, orgId = null, period = 'alltime', limit = 50, skip = 0 } = {}) {
    const filter = { period };
    if (subjectId) filter.subjectId = subjectId;
    else filter.subjectId = null;
    if (orgId) filter.orgId = orgId;
    else filter.orgId = null;

    const entries = await LeaderboardEntry.find(filter)
        .sort({ compositeScore: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email avatar')
        .lean();

    return entries.map((e, idx) => ({
        rank: skip + idx + 1,
        userId: e.userId,
        xp: e.xp,
        accuracy: e.accuracy,
        streak: e.streak,
        compositeScore: e.compositeScore,
        questionsAnswered: e.questionsAnswered,
        quizzesCompleted: e.quizzesCompleted,
    }));
}

/**
 * Get a user's rank in context
 */
export async function getUserRank(userId, { subjectId = null, orgId = null, period = 'alltime' } = {}) {
    const entry = await LeaderboardEntry.findOne({ userId, subjectId, orgId, period }).lean();
    if (!entry) return { rank: null, score: 0 };

    const higherCount = await LeaderboardEntry.countDocuments({
        subjectId, orgId, period,
        compositeScore: { $gt: entry.compositeScore }
    });

    return { rank: higherCount + 1, ...entry };
}

// ── Wire up event listeners ──
export function initLeaderboardListeners() {
    eventBus.on(EVENTS.QUIZ_COMPLETED, async (payload) => {
        try {
            await onQuizCompleted(payload);
        } catch (err) {
            console.error('[Leaderboard] Quiz event handler error:', err.message);
        }
    });

    eventBus.on(EVENTS.STREAK_UPDATED, async ({ userId, streak }) => {
        try {
            await updateStreak(userId, streak);
        } catch (err) {
            console.error('[Leaderboard] Streak event handler error:', err.message);
        }
    });

    console.log('[Leaderboard] Event listeners initialized');
}

export default {
    onQuizCompleted,
    updateStreak,
    getLeaderboard,
    getUserRank,
    initLeaderboardListeners,
};
```

## File: `backend\services\masteryService.js`

```js
import User from "../models/User.js";

/**
 * Update mastery for a user on a topic using Exponential Moving Average (EMA)
 * alpha = 0.2 by default
 */
export async function updateMastery(userId, topic, isCorrect, timeTakenMs = 0, alpha = 0.2) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const profile = user.learnerProfile || {};
    const topics = profile.topics || new Map();

    let current = topics.get(topic) || { mastery: 0, attempts: 0, streak: 0, timeOnTask: 0 };

    const score = isCorrect ? 100 : 0;
    current.mastery = alpha * score + (1 - alpha) * (current.mastery || 0);
    current.mastery = Math.round(current.mastery * 100) / 100;
    current.attempts = (current.attempts || 0) + 1;
    current.streak = isCorrect ? (current.streak || 0) + 1 : 0;
    current.timeOnTask = (current.timeOnTask || 0) + timeTakenMs;

    topics.set(topic, current);

    user.learnerProfile = { ...profile, topics, lastActiveAt: new Date() };
    await user.save();

    return current;
}

/**
 * Get mastery data for a user
 */
export async function getMastery(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    const topics = user.learnerProfile?.topics || {};
    return topics;
}

/**
 * Check if remediation is needed (2 wrong in last 5 attempts for same topic)
 */
export function checkRemediation(attemptHistory, topic) {
    const topicAttempts = attemptHistory
        .filter(a => a.topics?.includes(topic) || a.topic === topic)
        .slice(-5);

    const wrongCount = topicAttempts.filter(a => !a.isCorrect).length;
    return wrongCount >= 2;
}

export default { updateMastery, getMastery, checkRemediation };
```

## File: `backend\services\ollamaService.js`

```js
import { config } from "../config/index.js";
import { Ollama } from 'ollama';
import { QUESTION_GENERATOR_SYSTEM, questionGeneratorUser, EXPLANATION_SYSTEM, explanationUser, CHATBOT_SYSTEM, TOPIC_SUMMARY_SYSTEM, VALIDATE_SUBJECT_SYSTEM, validateSubjectUser, PARSE_SYLLABUS_SYSTEM, parseSyllabusUser, PARSE_SYLLABUS_CHUNK_SYSTEM, parseSyllabusChunkUser, PERFECT_PARSER_CHUNK_SYSTEM, perfectParserChunkUser } from "../prompts/ollamaPrompts.js";
import GeneratedAssessment from "../models/GeneratedAssessment.js";

/**
 * Call Ollama chat API
 */
async function callOllama(systemPrompt, userPrompt, options = {}) {
    try {
        const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
            ? config.ollamaBaseUrl
            : 'http://127.0.0.1:11434';

        const ollama = new Ollama({ host: ollamaBase });

        const response = await ollama.chat({
            model: options.model || config.ollamaModel || 'llama3',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            stream: false,
            format: options.format || undefined,
        });

        return response.message?.content || "";
    } catch (err) {
        console.warn("Ollama is unreachable, returning mock response for testing. Error:", err.message);

        // Return structured mock data based on the prompt type
        if (systemPrompt.includes("Assessment Designer") || systemPrompt.includes("exam questions")) {
            return JSON.stringify({
                items: [
                    {
                        question: "What is a fallback mechanism in software?",
                        options: ["A backup strategy when primary service fails", "A database query type", "A UI component", "A network protocol"],
                        correctIndex: 0,
                        topic: "Software Engineering",
                        difficulty: "easy",
                        bloom: "understand",
                        skills: [],
                        outcomes: [],
                        explanation: "Fallback mechanisms provide alternative behavior when the primary service is unavailable.",
                        hint: "Think about what happens when a service goes offline."
                    },
                    {
                        question: "Which pattern is commonly used for handling AI service outages?",
                        options: ["Observer pattern", "Circuit breaker pattern", "Singleton pattern", "Factory pattern"],
                        correctIndex: 1,
                        topic: "Software Engineering",
                        difficulty: "medium",
                        bloom: "apply",
                        skills: [],
                        outcomes: [],
                        explanation: "The circuit breaker pattern prevents cascading failures when external services are down.",
                        hint: "Think about electrical circuit breakers."
                    }
                ]
            });
        }

        if (systemPrompt.includes("curriculum designer") || systemPrompt.includes("validation engine")) {
            return JSON.stringify({
                isValid: true,
                feedback: ["Mock response: The subject looks well-structured.", "Note: Ollama is offline — using mock validation."],
                suggestedLevel: "Beginner"
            });
        }

        if (systemPrompt.includes("tutor") || systemPrompt.includes("explanations")) {
            return JSON.stringify({
                explanation: "This is a mock explanation since Ollama is offline. Review the basics of this topic and try again when the AI service is running.",
                remediationResources: [{ title: "Review Material", url: "#", type: "article" }]
            });
        }

        if (systemPrompt.includes("curriculum parser") || systemPrompt.includes("syllabus")) {
            return JSON.stringify({
                name: "Mock Subject (Ollama Offline)",
                description: "This is placeholder data. Start Ollama to get real parsing.",
                category: "General",
                learningOutcomes: ["Placeholder outcome"],
                modules: [{
                    title: "Module 1",
                    description: "Placeholder module",
                    topics: [{ title: "Topic 1", description: "Placeholder topic" }]
                }]
            });
        }

        return "This is a fallback mock response because Ollama is offline. Start Ollama with: $env:OLLAMA_ORIGINS='*'; ollama serve";
    }
}

/**
 * Parse JSON from AI response (robust extraction for agentic workflow)
 */
function parseJsonResponse(text) {
    let cleaned = text.trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {}

    // Try stripping markdown blocks
    if (cleaned.startsWith("```")) {
        let noMd = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        try { return JSON.parse(noMd); } catch (e) {}
    }

    // Try finding inner markdown block
    const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (mdMatch && mdMatch[1]) {
        try { return JSON.parse(mdMatch[1].trim()); } catch (e) {}
    }
    
    // Try regex matching objects or arrays
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    
    let objStr = objMatch ? objMatch[0] : null;
    let arrStr = arrMatch ? arrMatch[0] : null;
    
    if (objStr && arrStr) {
        const target = objStr.length > arrStr.length ? objStr : arrStr;
        try { return JSON.parse(target); } catch (e) {}
    } else if (objStr) {
        try { return JSON.parse(objStr); } catch (e) {}
    } else if (arrStr) {
        try { return JSON.parse(arrStr); } catch (e) {}
    }
    
    throw new Error("Could not extract valid JSON from response.");
}

/**
 * Call Ollama with an agentic critique-and-revise retry loop and optional timeout
 */
async function callOllamaWithRetry(systemPrompt, userPrompt, options = {}, retries = 2) {
    let lastError;
    let currentSystemPrompt = systemPrompt;
    let currentUserPrompt = userPrompt;
    const timeoutMs = options.timeoutMs || 0;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            let rawResponse;
            const callPromise = callOllama(currentSystemPrompt, currentUserPrompt, options);
            
            if (timeoutMs > 0) {
                rawResponse = await Promise.race([
                    callPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Ollama call timed out after ${timeoutMs / 1000}s`)), timeoutMs))
                ]);
            } else {
                rawResponse = await callPromise;
            }
            
            if (!options.requireJson) {
                return { rawResponse, parsed: null };
            }
            
            const parsed = parseJsonResponse(rawResponse);
            return { rawResponse, parsed };
            
        } catch (err) {
            lastError = err;
            console.warn(`[Agentic Workflow] Attempt ${attempt} failed: ${err.message}. Retrying...`);
            currentUserPrompt = userPrompt + `\n\nCRITICAL FEEDBACK ON PREVIOUS ATTEMPT:\nYour previous response failed to parse as valid JSON or timed out. Error: ${err.message}. Please strictly output ONLY valid JSON. No prose, no markdown fences.`;
        }
    }
    throw new Error(`Failed after ${retries + 1} attempts. Last error: ${lastError.message}`);
}

/**
 * Generate questions from a topic using Ollama
 */
export async function generateQuestionsFromTopic(topic, options = {}) {
    const count = options.count || 5;
    const distribution = options.distribution || { easy: 2, medium: 2, hard: 1 };

    const { rawResponse, parsed } = await callOllamaWithRetry(
        QUESTION_GENERATOR_SYSTEM,
        questionGeneratorUser(topic, count, distribution),
        { requireJson: true }
    );

    const items = parsed.items || parsed;
    if (!Array.isArray(items)) throw new Error("AI response did not contain an items array");

    const mappedItems = items.map((item, idx) => ({
        type: "mcq",
        question: item.question,
        choices: item.options || [],
        answer: item.correctIndex ?? 0,
        difficulty: difficultyToNumber(item.difficulty),
        bloom: item.bloom || "understand",
        topics: [topic],
        skills: item.skills || [],
        hints: item.hint ? [item.hint] : [],
        explanation: item.explanation || "",
        aiGenerated: true,
        seedId: `seed_${topic.replace(/\s+/g, "_")}_${Date.now()}_${idx}`,
    }));

    return { items: mappedItems, rawResponse, title: `${topic} Assessment` };
}

function difficultyToNumber(d) {
    if (typeof d === "number") return Math.min(5, Math.max(1, d));
    const map = { easy: 2, medium: 3, hard: 4 };
    return map[d?.toLowerCase()] || 3;
}

export async function generateExplanation(question, correctOption, studentAnswer, topic) {
    try {
        const { parsed } = await callOllamaWithRetry(
            EXPLANATION_SYSTEM,
            explanationUser(question, correctOption, studentAnswer, topic),
            { requireJson: true },
            1 // 1 retry
        );
        return parsed;
    } catch (e) {
        return { explanation: "Could not generate an explanation at this time.", remediationResources: [] };
    }
}

export async function chatWithTutor(messages, context = null) {
    let systemPrompt = CHATBOT_SYSTEM;
    if (context) {
        systemPrompt += `\n\nSTUDENT CONTEXT:\n- Mastery: ${context.mastery || "unknown"}%\n- Weak Area: ${context.weakArea || "unknown"}`;
    }

    const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
    ];

    try {
        const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
            ? config.ollamaBaseUrl
            : 'http://127.0.0.1:11434';

        const ollama = new Ollama({ host: ollamaBase });

        const response = await ollama.chat({
            model: config.ollamaModel || 'llama3',
            messages: apiMessages,
            stream: false,
        });

        return response.message?.content || "";
    } catch (err) {
        console.warn("Ollama is unreachable for tutor chat, returning mock response.");
        return "I am a mock AI Tutor. The main Ollama LLM is currently offline. How else can I pretend to help you today?";
    }
}

/**
 * Parse Syllabus JSON from raw text (e.g. PDF extraction) — single-shot
 */
export async function parseSyllabusFromText(text) {
    const { rawResponse, parsed } = await callOllamaWithRetry(
        PARSE_SYLLABUS_SYSTEM,
        parseSyllabusUser(text),
        { requireJson: true },
        2
    );

    return parsed;
}

/**
 * Parse Syllabus JSON from an array of text chunks — iterative strategy.
 * Returns an array of partial syllabus objects (one per chunk).
 * Failed chunks are skipped with a warning rather than aborting the whole job.
 *
 * @param {string[]} chunks  — Array of cleaned text chunks
 * @param {function} onProgress — Optional callback(chunkIndex, totalChunks)
 * @returns {Promise<object[]>} Array of partial syllabus objects
 */
export async function parseSyllabusChunked(chunks, onProgress = null) {
    const partials = [];

    for (let i = 0; i < chunks.length; i++) {
        if (typeof onProgress === 'function') {
            onProgress(i, chunks.length);
        }

        try {
            const { parsed } = await callOllamaWithRetry(
                PARSE_SYLLABUS_CHUNK_SYSTEM,
                parseSyllabusChunkUser(chunks[i], i, chunks.length),
                { requireJson: true },
                1
            );
            partials.push(parsed);
        } catch (err) {
            console.warn(`[parseSyllabusChunked] Chunk ${i + 1}/${chunks.length} failed:`, err.message);
            // Skip failed chunks — the aggregator will still work with partial data
        }
    }

    return partials;
}

/**
 * Refined production-stable syllabus extraction from iterative chunks.
 * Merges topics into a Map and filters out noise.
 * 
 * @param {AsyncGenerator} chunkGenerator - Generator yielding text chunks
 * @returns {Promise<Array>} Array of merged and filtered topics
 */
export async function parseSyllabusIterative(chunkGenerator) {
    const topicMap = new Map();
    const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
        ? config.ollamaBaseUrl
        : 'http://127.0.0.1:11434';
    const ollama = new Ollama({ host: ollamaBase });

    console.log("[AI] Starting iterative syllabus parsing...");

    for await (const chunk of chunkGenerator) {
        try {
            const { parsed } = await callOllamaWithRetry(
                PERFECT_PARSER_CHUNK_SYSTEM,
                perfectParserChunkUser(chunk),
                { format: 'json', requireJson: true },
                1
            );

            const data = parsed;

            const topics = data.topics || (Array.isArray(data) ? data : []);

            for (const topic of topics) {
                if (!topic.name || !shouldKeepTopic(topic.name)) continue;

                const key = topic.name.toLowerCase().trim();
                
                if (!topicMap.has(key)) {
                    topicMap.set(key, {
                        name: topic.name,
                        keywords: Array.isArray(topic.keywords) 
                            ? [...new Set(topic.keywords.map(k => k.trim()).filter(k => k))] 
                            : []
                    });
                } else {
                    const existing = topicMap.get(key);
                    if (Array.isArray(topic.keywords)) {
                        const mergedKeywords = new Set([
                            ...(existing.keywords || []), 
                            ...topic.keywords.map(k => k.trim()).filter(k => k)
                        ]);
                        existing.keywords = Array.from(mergedKeywords);
                    }
                }
            }

            // Memory management: Manual GC if threshold met
            const memory = process.memoryUsage();
            if (global.gc && memory.heapUsed > 500 * 1024 * 1024) {
                console.log(`[GC] Heap at ${Math.round(memory.heapUsed/1024/1024)}MB. Triggering manual GC.`);
                global.gc();
            }

        } catch (err) {
            console.error("[AI] Error processing chunk:", err.message);
        }
    }

    const finalTopics = Array.from(topicMap.values());
    console.log(`[AI] Iterative parsing complete. Found ${finalTopics.length} unique topics.`);
    return finalTopics;
}

/**
 * Production syllabus pipeline — properly extracts modules/topics structure.
 * Uses concurrent batch processing (3 at a time) with timeout + aggregator.
 * 
 * @param {AsyncGenerator|string[]} chunkSource - Generator or array of text chunks
 * @param {function} onProgress - Optional callback(processed, total)
 * @returns {Promise<object>} Merged syllabus { name, description, category, learningOutcomes, modules }
 */
export async function parseSyllabusPipeline(chunkSource, onProgress = null) {
    const { mergeSyllabusPartials } = await import('../utils/syllabusAggregator.js');
    
    // Collect chunks from generator into array
    const chunks = [];
    if (Symbol.asyncIterator in Object(chunkSource)) {
        for await (const chunk of chunkSource) {
            if (chunk && chunk.trim()) chunks.push(chunk);
        }
    } else if (Array.isArray(chunkSource)) {
        chunks.push(...chunkSource.filter(c => c && c.trim()));
    }

    if (chunks.length === 0) {
        throw new Error("No text content to parse. The document may be empty.");
    }

    console.log(`[AI Pipeline] Starting structured extraction: ${chunks.length} chunks, batch size 3`);
    
    const partials = [];
    const BATCH_SIZE = 3;
    const TIMEOUT_MS = 90000; // 90 seconds per call

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map((chunk, batchIdx) => {
            const chunkIdx = i + batchIdx;
            return callOllamaWithRetry(
                PARSE_SYLLABUS_CHUNK_SYSTEM,
                parseSyllabusChunkUser(chunk, chunkIdx, chunks.length),
                { requireJson: true, timeoutMs: TIMEOUT_MS },
                1
            ).then(({ parsed }) => {
                console.log(`[AI Pipeline] Chunk ${chunkIdx + 1}/${chunks.length} ✓ — ${(parsed.modules || []).length} modules`);
                return parsed;
            }).catch(err => {
                console.warn(`[AI Pipeline] Chunk ${chunkIdx + 1}/${chunks.length} — LLM call failed:`, err.message);
                return null;
            });
        });

        const results = await Promise.all(batchPromises);
        for (const r of results) {
            if (r) partials.push(r);
        }

        if (typeof onProgress === 'function') {
            onProgress(Math.min(i + BATCH_SIZE, chunks.length), chunks.length);
        }

        // Memory management
        const memory = process.memoryUsage();
        if (global.gc && memory.heapUsed > 500 * 1024 * 1024) {
            console.log(`[GC] Heap at ${Math.round(memory.heapUsed / 1024 / 1024)}MB. Triggering manual GC.`);
            global.gc();
        }
    }

    if (partials.length === 0) {
        throw new Error("All chunks failed to parse. The AI model may be offline or the document format is incompatible.");
    }

    // Merge all partials into unified syllabus
    const merged = mergeSyllabusPartials(partials);
    console.log(`[AI Pipeline] Complete: "${merged.name || 'Untitled'}" — ${merged.modules.length} modules, ${merged.modules.reduce((sum, m) => sum + (m.topics?.length || 0), 0)} topics`);
    
    return merged;
}

// callOllamaWithTimeout removed as it's replaced by callOllamaWithRetry

/**
 * Filter to exclude meta-topics like POs, PEOs, Reference Books, etc.
 */
function shouldKeepTopic(name) {
    if (!name || typeof name !== 'string') return false;
    const blacklist = [
        'po', 'peo', 'pso', 'reference', 'assessment', 'marks', 
        'model', 'outcome', 'course description', 'experiment', 
        'lab manual', 'objective', 'prerequisite', 'syllabus', 
        'curriculum', 'university', 'credit', 'hours', 'total'
    ];
    const lowerName = name.toLowerCase();
    
    if (/^(po|peo|pso)\s*\d+/i.test(lowerName)) return false;
    
    return !blacklist.some(term => lowerName.includes(term));
}

export async function generateTopicNotes(topic, mistakes = []) {
    const userPrompt = mistakes.length
        ? `Generate study notes for "${topic}". The student has made these mistakes: ${JSON.stringify(mistakes)}`
        : `Generate comprehensive study notes for "${topic}".`;

    return await callOllama(TOPIC_SUMMARY_SYSTEM, userPrompt);
}

export async function validateSubject(subjectData) {
    try {
        const { parsed } = await callOllamaWithRetry(
            VALIDATE_SUBJECT_SYSTEM,
            validateSubjectUser(subjectData),
            { format: "json", requireJson: true },
            1
        );
        return parsed;
    } catch {
        return { isValid: true, feedback: ["Could not parse AI validation correctly. Approving format by default."], suggestedLevel: "Beginner" };
    }
}

export default {
    generateQuestionsFromTopic,
    generateExplanation,
    chatWithTutor,
    generateTopicNotes,
    validateSubject,
    parseSyllabusFromText,
    parseSyllabusChunked,
    parseSyllabusIterative,
    parseSyllabusPipeline,
};
```

## File: `backend\services\settingsEngine.js`

```js
/**
 * Settings Engine — O(1) resolver + in-memory cache for user settings.
 * Provides a unified config object to all modules (Tutor, SRS, Difficulty).
 * 
 * Architecture:
 *   UserSettings (DB) → SettingsEngine (cached resolver) → BehaviorEngine → Modules
 */
import UserSettings from '../models/UserSettings.js';
import { eventBus, EVENTS } from './eventBus.js';

// ── In-memory LRU cache (bounded) ──
const CACHE_MAX = 500;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

function cacheGet(userId) {
    const entry = cache.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(userId);
        return null;
    }
    return entry.data;
}

function cacheSet(userId, data) {
    // Evict oldest if at capacity
    if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(userId, { data, ts: Date.now() });
}

function cacheInvalidate(userId) {
    cache.delete(userId);
}

// ── Learning Mode Presets ──
const LEARNING_MODE_PRESETS = {
    relaxed: {
        aiTutor: { explanationDepth: 'detailed', reasoningMode: 'step_by_step', hintMode: 'always_available', interventionLevel: 'proactive' },
        difficulty: { adaptationMode: 'conservative', minLevel: 1, maxLevel: 3 },
        srs: { reviewFrequency: 'low', retentionTarget: 0.75 },
    },
    balanced: {
        aiTutor: { explanationDepth: 'medium', reasoningMode: 'step_by_step', hintMode: 'on_mistake', interventionLevel: 'medium' },
        difficulty: { adaptationMode: 'moderate', minLevel: 1, maxLevel: 5 },
        srs: { reviewFrequency: 'medium', retentionTarget: 0.85 },
    },
    intensive: {
        aiTutor: { explanationDepth: 'brief', reasoningMode: 'direct_answer', hintMode: 'on_mistake', interventionLevel: 'passive' },
        difficulty: { adaptationMode: 'aggressive', minLevel: 2, maxLevel: 5 },
        srs: { reviewFrequency: 'high', retentionTarget: 0.90 },
    },
    exam_prep: {
        aiTutor: { explanationDepth: 'medium', reasoningMode: 'direct_answer', hintMode: 'never', interventionLevel: 'passive' },
        difficulty: { adaptationMode: 'aggressive', minLevel: 3, maxLevel: 5 },
        srs: { reviewFrequency: 'high', retentionTarget: 0.95 },
    },
};

// ── Core Resolver ──
export async function resolveSettings(userId) {
    // 1. Check cache
    const cached = cacheGet(userId);
    if (cached) return cached;

    // 2. Get from DB (lazy init)
    const settings = await UserSettings.getForUser(userId);
    const resolved = settings.toObject();

    // 3. Cache and return
    cacheSet(userId, resolved);
    return resolved;
}

// ── Update Settings ──
export async function updateSettings(userId, updates) {
    const settings = await UserSettings.getForUser(userId);

    // If learningMode changed, apply preset
    if (updates.learningMode && updates.learningMode !== settings.learningMode) {
        const preset = LEARNING_MODE_PRESETS[updates.learningMode];
        if (preset) {
            Object.assign(settings.aiTutor, preset.aiTutor);
            Object.assign(settings.difficulty, preset.difficulty);
            Object.assign(settings.srs, preset.srs);
        }
        settings.learningMode = updates.learningMode;
    }

    // Apply section-level overrides
    for (const section of ['aiTutor', 'difficulty', 'srs', 'performance', 'ui']) {
        if (updates[section] && typeof updates[section] === 'object') {
            Object.assign(settings[section], updates[section]);
        }
    }

    await settings.save();
    cacheInvalidate(userId);

    // Emit event for other modules
    eventBus.emit(EVENTS.SETTINGS_UPDATED, {
        userId,
        learningMode: settings.learningMode,
        sections: Object.keys(updates),
    });

    return settings;
}

// ── Update specific section ──
export async function updateSection(userId, section, data) {
    const updated = await UserSettings.updateSection(userId, section, data);
    cacheInvalidate(userId);

    eventBus.emit(EVENTS.SETTINGS_UPDATED, {
        userId,
        section,
        changes: Object.keys(data),
    });

    return updated;
}

// ── Reset to mode preset ──
export async function resetToPreset(userId, mode = 'balanced') {
    const preset = LEARNING_MODE_PRESETS[mode];
    if (!preset) throw new Error(`Unknown learning mode: ${mode}`);

    const settings = await UserSettings.getForUser(userId);
    settings.learningMode = mode;
    Object.assign(settings.aiTutor, preset.aiTutor);
    Object.assign(settings.difficulty, preset.difficulty);
    Object.assign(settings.srs, preset.srs);

    await settings.save();
    cacheInvalidate(userId);

    eventBus.emit(EVENTS.SETTINGS_RESET, { userId, mode });
    return settings;
}

// ── Quick accessors for modules ──
export async function getTutorSettings(userId) {
    const s = await resolveSettings(userId);
    return s.aiTutor;
}

export async function getDifficultySettings(userId) {
    const s = await resolveSettings(userId);
    return s.difficulty;
}

export async function getSrsSettings(userId) {
    const s = await resolveSettings(userId);
    return s.srs;
}

export async function getPerformanceSettings(userId) {
    const s = await resolveSettings(userId);
    return s.performance;
}

// ── Available presets for frontend ──
export function getPresets() {
    return Object.keys(LEARNING_MODE_PRESETS);
}

export function getPresetConfig(mode) {
    return LEARNING_MODE_PRESETS[mode] || null;
}

export default {
    resolveSettings,
    updateSettings,
    updateSection,
    resetToPreset,
    getTutorSettings,
    getDifficultySettings,
    getSrsSettings,
    getPerformanceSettings,
    getPresets,
    getPresetConfig,
};
```

## File: `backend\services\spacedRepetitionService.js`

```js
import Review from "../models/Review.js";
import UserProgress from "../models/UserProgress.js";

/**
 * Pure SM-2 algorithm calculation
 * @param {number} ef   - current easiness factor (≥ 1.3)
 * @param {number} rep  - current repetition count
 * @param {number} prevInterval - previous interval in days
 * @param {number} quality - recall quality 0-5
 * @returns {{ ef: number, rep: number, interval: number, nextReview: Date }}
 */
export function calculateSM2(ef, rep, prevInterval, quality) {
    // Update easiness factor
    let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < 1.3) newEF = 1.3;

    let newRep, newInterval;

    if (quality >= 3) {
        newRep = rep + 1;
        if (newRep === 1) {
            newInterval = 1;
        } else if (newRep === 2) {
            newInterval = 6;
        } else {
            newInterval = Math.round(prevInterval * newEF);
        }
    } else {
        // Failed recall — reset
        newRep = 0;
        newInterval = 1;
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);

    return {
        ef: Math.round(newEF * 100) / 100,
        rep: newRep,
        interval: newInterval,
        nextReview,
    };
}

/**
 * Apply user-specific interval scaling from settings engine
 */
async function applyUserIntervalMultiplier(userId, interval) {
    try {
        const { getSrsParams } = await import('./behaviorEngine.js');
        const params = await getSrsParams(userId);
        return Math.max(1, Math.round(interval * params.intervalMultiplier));
    } catch {
        return interval; // fallback: no adjustment
    }
}

/**
 * Submit a review for a user-concept pair
 */
export async function submitReview(userId, conceptId, quality) {
    quality = Math.max(0, Math.min(5, Math.round(quality)));

    let review = await Review.findOne({ userId, conceptId });

    if (!review) {
        review = new Review({ userId, conceptId });
    }

    const result = calculateSM2(
        review.easiness_factor,
        review.repetition,
        review.interval,
        quality
    );

    review.easiness_factor = result.ef;
    review.repetition = result.rep;

    // Apply user settings multiplier (low/medium/high review frequency)
    const adjustedInterval = await applyUserIntervalMultiplier(userId, result.interval);
    review.interval = adjustedInterval;

    review.quality_score = quality;
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + adjustedInterval);
    review.next_review = nextReview;
    review.last_review = new Date();
    review.history.push({
        quality,
        date: new Date(),
        interval: result.interval,
    });

    await review.save();

    // Update user progress next_review_date
    await UserProgress.findOneAndUpdate(
        { userId, conceptId },
        {
            next_review_date: result.nextReview,
            last_review_date: new Date(),
            retention_score: quality >= 3 ? Math.min(1, (review.repetition / 10) + 0.5) : Math.max(0, (review.repetition / 10)),
        },
        { upsert: true, new: true }
    );

    return review;
}

/**
 * Get all concepts due for review for a user
 */
export async function getDueReviews(userId) {
    const now = new Date();
    const dueReviews = await Review.find({
        userId,
        next_review: { $lte: now },
    }).sort({ next_review: 1 });

    return dueReviews;
}

/**
 * Get review stats for a specific concept
 */
export async function getReviewStats(userId, conceptId) {
    const review = await Review.findOne({ userId, conceptId });
    if (!review) {
        return {
            easiness_factor: 2.5,
            interval: 0,
            repetition: 0,
            quality_score: 0,
            next_review: null,
            history: [],
        };
    }
    return review;
}

/**
 * Initialize review records for all concepts a user hasn't started
 */
export async function initializeReviews(userId, conceptIds) {
    const existing = await Review.find({ userId, conceptId: { $in: conceptIds } });
    const existingIds = new Set(existing.map((r) => r.conceptId));

    const newReviews = conceptIds
        .filter((id) => !existingIds.has(id))
        .map((conceptId) => ({
            userId,
            conceptId,
            easiness_factor: 2.5,
            interval: 0,
            repetition: 0,
            quality_score: 0,
            next_review: new Date(),
        }));

    if (newReviews.length > 0) {
        await Review.insertMany(newReviews);
    }

    return newReviews.length;
}

export default { calculateSM2, submitReview, getDueReviews, getReviewStats, initializeReviews };
```

## File: `backend\utils\parserUtils.js`

```js
import JSZip from 'jszip';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParseRaw = require("pdf-parse");

let pdfParse;
if (typeof pdfParseRaw === 'function') {
    pdfParse = pdfParseRaw;
} else if (pdfParseRaw && typeof pdfParseRaw.default === 'function') {
    pdfParse = pdfParseRaw.default;
}

/**
 * Streams pages from a PDF buffer.
 * @param {Buffer} buffer 
 */
export async function* extractPdfPages(buffer) {
    if (!pdfParse) throw new Error("PDF parser not initialized");
    const data = await pdfParse(buffer);
    const pages = data.text.split('\f');
    for (const page of pages) {
        yield cleanAndFilterText(page);
    }
}

/**
 * Streams slides from a PPTX buffer using JSZip.
 * @param {Buffer} buffer 
 */
export async function* extractSlides(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
        .filter(name => name.includes('ppt/slides/slide'))
        .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
            const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
            return numA - numB;
        });

    for (const file of slideFiles) {
        const content = await zip.files[file].async('text');
        // Extract text content from XML tags (safe fallback)
        const text = content.match(/>([^<>]+)</g)?.map(t =>
            t.replace(/[<>]/g, '')
        ).join(' ') || '';
        
        yield cleanAndFilterText(text);
        
        // Manual cleanup to help GC
        zip.files[file] = null;
    }
}

/**
 * Generator that yields text chunks of a specific size.
 * Uses an array to avoid string accumulation memory spikes.
 * @param {AsyncGenerator} stream 
 * @param {number} maxWords 
 */
export async function* chunkGenerator(stream, maxWords = 500) {
    let currentChunk = [];
    let wordCount = 0;

    for await (const text of stream) {
        const words = text.split(/\s+/);

        for (const word of words) {
            if (!word) continue;
            currentChunk.push(word);
            wordCount++;

            if (wordCount >= maxWords) {
                yield currentChunk.join(' ');
                currentChunk = [];
                wordCount = 0;
            }
        }
    }

    if (currentChunk.length > 0) {
        yield currentChunk.join(' ');
    }
}

/**
 * Cleans syllabus text by removing noise like PEOs, POs, and References.
 * @param {string} text 
 */
export function cleanAndFilterText(text) {
    return text
        .replace(/PEO\s*\d.*?(\n|$)/gi, '')
        .replace(/PO\s*\d.*?(\n|$)/gi, '')
        .replace(/PSO\s*\d.*?(\n|$)/gi, '')
        .replace(/Reference Books.*?/gis, '')
        .replace(/Assessment Model.*?/gis, '')
        .replace(/\s+/g, ' ')
        .trim();
}
```

## File: `backend\utils\pdfUtils.js`

```js
/**
 * PDF Text Processing Utilities
 * 
 * cleanText  — Strips headers, footers, page numbers, and normalises whitespace.
 * chunkText  — Splits cleaned text into 500-1000 word windows with overlap
 *              to prevent LLM context overflow and hallucination.
 */

/**
 * Clean raw extracted PDF text.
 * Removes:
 *  - Page number lines  (e.g. "Page 12", "- 3 -", standalone digits)
 *  - Common header/footer artifacts
 *  - Excessive whitespace / line-breaks
 *  - Non-printable characters
 */
export function cleanText(raw) {
    if (!raw || typeof raw !== 'string') return '';

    let text = raw;

    // 1. Strip non-printable / zero-width chars (keep newlines)
    text = text.replace(/[^\S\n\r]*[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 2. Remove standalone page-number lines
    //    "Page 5", "— 12 —", "- 3 -", or just a bare number on its own line
    text = text.replace(/^\s*(?:page\s*\d+|\d+\s*$|[-—–]\s*\d+\s*[-—–])\s*$/gim, '');

    // 3. Collapse 3+ consecutive newlines into 2 (paragraph boundary)
    text = text.replace(/\n{3,}/g, '\n\n');

    // 4. Collapse multiple spaces/tabs on the same line
    text = text.replace(/[^\S\n]+/g, ' ');

    // 5. Trim each line
    text = text
        .split('\n')
        .map(line => line.trim())
        .join('\n');

    // 6. Final overall trim
    return text.trim();
}

/**
 * Split cleaned text into overlapping word-based chunks.
 *
 * @param {string} text        — Cleaned text
 * @param {object} opts
 * @param {number} opts.target — Target chunk size in words (default 750)
 * @param {number} opts.min    — Minimum chunk size in words  (default 400)
 * @param {number} opts.max    — Maximum chunk size in words  (default 1000)
 * @param {number} opts.overlap — Word overlap between chunks  (default 50)
 * @returns {string[]}  Array of text chunks
 */
export function chunkText(text, opts = {}) {
    const {
        target = 750,
        min = 400,
        max = 1000,
        overlap = 50,
    } = opts;

    if (!text || typeof text !== 'string') return [];

    const words = text.split(/\s+/).filter(Boolean);

    // If already within a single chunk, return as-is
    if (words.length <= max) {
        return [words.join(' ')];
    }

    const chunks = [];
    let start = 0;

    while (start < words.length) {
        let end = Math.min(start + target, words.length);

        // Try to extend to a sentence boundary (period followed by capital or newline)
        // within the max window
        const windowEnd = Math.min(start + max, words.length);
        for (let i = end; i < windowEnd; i++) {
            if (/[.!?]$/.test(words[i])) {
                end = i + 1;
                break;
            }
        }

        // If we couldn't reach a sentence boundary, just use the target
        end = Math.min(end, windowEnd);

        const chunk = words.slice(start, end).join(' ');

        // Only add if the chunk meets the minimum word count
        // (last chunk is exempt from minimum)
        if (chunk.split(/\s+/).length >= min || start + target >= words.length) {
            chunks.push(chunk);
        } else {
            // If the remaining tail is too short, merge it with the previous chunk
            if (chunks.length > 0) {
                chunks[chunks.length - 1] += ' ' + chunk;
            } else {
                chunks.push(chunk);
            }
        }

        // Advance with overlap
        start = end - overlap;
        if (start <= (end - target) || start < 0) start = end; // safety guard
    }

    return chunks;
}
```

## File: `backend\utils\pptUtils.js`

```js
/**
 * PPT Processing Utilities
 * 
 * Handles PPTX → JSON conversion via pptxtojson, then:
 *  - extractSlideTexts: pulls readable text from each slide's elements
 *  - chunkSlides: groups slides into LLM-sized chunks (2-3 slides per chunk)
 *  - stripHtml: removes HTML tags from pptxtojson's rich-text content
 */

import { createRequire } from 'module';

// pptxtojson only ships a CJS build for Node.js
const require = createRequire(import.meta.url);
const pptxtojson = require('pptxtojson/dist/index.cjs');

/**
 * Parse a PPTX buffer into the pptxtojson JSON structure.
 * @param {Buffer} buffer  — The raw PPTX file buffer
 * @returns {Promise<object>} Parsed JSON: { slides, size, themeColors }
 */
export async function parsePptxToJson(buffer) {
    // pptxtojson.parse expects an ArrayBuffer.
    // Ensure we handle Node.js Buffer → ArrayBuffer correctly regardless of pooling.
    const arrayBuffer = new Uint8Array(buffer).buffer;
    
    try {
        const json = await pptxtojson.parse(arrayBuffer);
        return json;
    } catch (err) {
        console.error("[pptUtils] pptxtojson.parse core error:", err.message);
        if (err.message.includes('a:firstCol')) {
            throw new Error("PPTX Parsing failed: This file contains complex tables that the parser cannot process. Try simplifying the tables or exporting to PDF before uploading.");
        }
        throw err;
    }
}

/**
 * Strip HTML tags from a string, returning plain text.
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Recursively extract text from a pptxtojson element.
 * Handles nested groups and diagrams with a safety depth limit.
 */
function extractElementText(el, depth = 0) {
    if (depth > 10) return []; // Safety limit to prevent heap exhaustion on circular/deep structures
    const texts = [];

    // Direct content field (HTML rich text)
    if (el.content) {
        const plain = stripHtml(el.content);
        if (plain) texts.push(plain);
    }

    // Table data
    if (el.type === 'table' && Array.isArray(el.data)) {
        for (const row of el.data) {
            for (const cell of row) {
                if (cell?.text) texts.push(stripHtml(cell.text));
                if (cell?.content) texts.push(stripHtml(cell.content));
            }
        }
    }

    // Diagram/Smart Art text list
    if (el.type === 'diagram' && Array.isArray(el.textList)) {
        for (const t of el.textList) {
            if (t) texts.push(stripHtml(t));
        }
    }

    // Nested elements (groups, diagrams)
    if (Array.isArray(el.elements)) {
        for (const child of el.elements) {
            texts.push(...extractElementText(child, depth + 1));
        }
    }

    return texts;
}

/**
 * Extract readable text from each slide, returning per-slide text arrays.
 *
 * @param {object[]} slides — The `slides` array from pptxtojson output
 * @returns {{ slideIndex: number, texts: string[], note: string }[]}
 */
export function extractSlideTexts(slides) {
    if (!Array.isArray(slides)) return [];

    return slides.map((slide, idx) => {
        const texts = [];

        // Process main elements
        if (Array.isArray(slide.elements)) {
            for (const el of slide.elements) {
                texts.push(...extractElementText(el));
            }
        }

        // Process layout (master) elements
        if (Array.isArray(slide.layoutElements)) {
            for (const el of slide.layoutElements) {
                texts.push(...extractElementText(el));
            }
        }

        return {
            slideIndex: idx,
            texts: texts.filter(Boolean),
            note: slide.note ? stripHtml(slide.note) : '',
        };
    });
}

/**
 * Group slide texts into chunks for LLM processing.
 * Default: 3 slides per chunk.
 *
 * @param {{ slideIndex: number, texts: string[], note: string }[]} slideTexts
 * @param {number} slidesPerChunk — How many slides per chunk (default 3)
 * @returns {string[]} Array of text chunks, each is the combined text of N slides
 */
export function chunkSlides(slideTexts, slidesPerChunk = 3) {
    const chunks = [];

    for (let i = 0; i < slideTexts.length; i += slidesPerChunk) {
        const group = slideTexts.slice(i, i + slidesPerChunk);
        const combined = group
            .map(s => {
                const body = s.texts.join(' ');
                const note = s.note ? ` [Speaker Notes: ${s.note}]` : '';
                return `[Slide ${s.slideIndex + 1}] ${body}${note}`;
            })
            .join('\n\n');

        if (combined.trim()) {
            chunks.push(combined.trim());
        }
    }

    return chunks;
}
```

## File: `backend\utils\syllabusAggregator.js`

```js
/**
 * Syllabus Aggregator
 * 
 * Merges multiple partial syllabus extractions (from chunked LLM calls)
 * into a single unified structure.  Handles:
 *  - Module de-duplication (by normalised title)
 *  - Topic de-duplication within modules
 *  - Learning-outcomes de-duplication
 *  - Picking the best (longest) name / description / category
 */

/**
 * Normalise a string for comparison: lowercase, collapse whitespace, strip punctuation.
 */
function normalise(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Pick the longer (more descriptive) of two strings.
 */
function pickLonger(a, b) {
    if (!a) return b || '';
    if (!b) return a || '';
    return a.length >= b.length ? a : b;
}

/**
 * De-duplicate an array of strings (case-insensitive).
 */
function dedupeStrings(arr) {
    const seen = new Set();
    return arr.filter(s => {
        const key = normalise(s);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Merge an array of partial syllabus JSON objects into one.
 *
 * Each partial can have:
 *   { name, description, category, learningOutcomes[], modules[] }
 *
 * @param {object[]} partials - Array of partial extractions
 * @returns {object} Unified syllabus
 */
export function mergeSyllabusPartials(partials) {
    if (!Array.isArray(partials) || partials.length === 0) {
        return { name: '', description: '', category: '', learningOutcomes: [], modules: [] };
    }

    // If there's only one partial, return it directly (already complete)
    if (partials.length === 1) {
        const p = partials[0];
        return {
            name: p.name || '',
            description: p.description || '',
            category: p.category || '',
            learningOutcomes: Array.isArray(p.learningOutcomes) ? p.learningOutcomes : [],
            modules: Array.isArray(p.modules) ? p.modules : [],
        };
    }

    // ── Aggregate top-level metadata ──
    let name = '';
    let description = '';
    let category = '';
    let learningOutcomes = [];

    for (const p of partials) {
        name = pickLonger(name, p.name);
        description = pickLonger(description, p.description);
        category = pickLonger(category, p.category);

        if (Array.isArray(p.learningOutcomes)) {
            learningOutcomes.push(...p.learningOutcomes);
        }
    }

    learningOutcomes = dedupeStrings(learningOutcomes);

    // ── Merge modules ──
    // Key: normalised module title → aggregated module
    const moduleMap = new Map();

    for (const p of partials) {
        if (!Array.isArray(p.modules)) continue;

        for (const mod of p.modules) {
            const key = normalise(mod.title);
            if (!key) continue;

            if (!moduleMap.has(key)) {
                moduleMap.set(key, {
                    title: mod.title,
                    description: mod.description || '',
                    topics: [],
                    _topicKeys: new Set(),
                });
            }

            const target = moduleMap.get(key);
            target.title = pickLonger(target.title, mod.title);
            target.description = pickLonger(target.description, mod.description);

            if (Array.isArray(mod.topics)) {
                for (const topic of mod.topics) {
                    const topicKey = normalise(topic.title);
                    if (!topicKey || target._topicKeys.has(topicKey)) continue;
                    target._topicKeys.add(topicKey);
                    target.topics.push({
                        title: topic.title,
                        description: topic.description || '',
                    });
                }
            }
        }
    }

    // Clean up internal tracking field
    const modules = [...moduleMap.values()].map(({ _topicKeys, ...mod }) => mod);

    return { name, description, category, learningOutcomes, modules };
}
```

## File: `Frontend\.gitignore`

```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

## File: `Frontend\eslint.config.js`

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
```

## File: `Frontend\index.html`

```html
<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description"
    content="Adiptify — Adaptive AI-powered learning platform. Personalized study modules, spaced repetition, AI tutoring, and mastery tracking for every learner." />
  <meta name="theme-color" content="#2D3C59" />
  <title>Adiptify — Adapting Your Education</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
    rel="stylesheet" />
  <script>
    // Anti-FODT: apply dark class before first paint
    (function () {
      var t = localStorage.getItem('adiptify_theme');
      var isDark = t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) document.documentElement.classList.add('dark');
    })();
  </script>
</head>

<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>

</html>
```

## File: `Frontend\package.json`

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.9",
    "@mui/material": "^7.3.9",
    "clsx": "^2.1.1",
    "dagre": "^0.8.5",
    "framer-motion": "^12.34.3",
    "lucide-react": "^0.575.0",
    "ollama": "^0.6.3",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.13.1",
    "reactflow": "^11.11.4",
    "tailwind-merge": "^3.5.0",
    "zod": "^4.3.6",
    "zod-to-json-schema": "^3.25.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@tailwindcss/postcss": "^4.2.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react-swc": "^4.2.2",
    "autoprefixer": "^10.4.27",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "postcss": "^8.5.6",
    "tailwindcss": "^4.2.1",
    "vite": "^7.3.1"
  }
}
```

## File: `Frontend\postcss.config.js`

```js
export default {
    plugins: {
        '@tailwindcss/postcss': {},
        autoprefixer: {},
    },
}
```

## File: `Frontend\README.md`

```md
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Adiptify-0.2
```

## File: `Frontend\tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                adiptify: {
                    navy: "#2D3C59",
                    olive: "#94A378",
                    gold: "#E5BA41",
                    terracotta: "#D1855C",
                },
            },
            fontFamily: {
                sans: ['Inter', 'Outfit', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
```

## File: `Frontend\vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

## File: `Frontend\src\App.css`

```css
/* App-level styles - intentionally minimal to avoid conflicts with Tailwind */
```

## File: `Frontend\src\App.jsx`

```jsx
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QuizProvider, useQuiz } from './context/QuizContext';
import { AdaptifyProvider } from './context/AdaptifyContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import MasteryDashboard from './components/dashboard/MasteryDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import QuizDashboard from './pages/QuizDashboard';
import QuizPage from './pages/Quiz';
import Result from './pages/Result';
import Leaderboard from './pages/Leaderboard';
import StudyModules from './pages/StudyModules';
import ConceptLearning from './pages/ConceptLearning';
import SpacedReview from './pages/SpacedReview';
import ExperimentLab from './pages/ExperimentLab';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import UserPreferences from './pages/UserPreferences';
import GraphExplorer from './components/graph/GraphExplorer';
import AITutorPage from './pages/AITutorPage';
import SubjectCatalog from './pages/SubjectCatalog';
import AITutor from './components/quiz/AITutor';
import {
  BookOpen, BarChart2, MessageSquare, User, Trophy, GraduationCap,
  Network, LogOut, Brain, FlaskConical, BarChart3, Sun, Moon,
  Settings, Library, ClipboardList, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';

/* ─── Page transition variants ─── */
const pageVariants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(2px)' },
};
const pageTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

function AnimatedPage({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="flex-1 flex flex-col h-full"
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useQuiz();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  // Derive active tab from route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/quiz-dashboard' || path.startsWith('/quiz/') || path === '/result') return 'quiz';
    if (path === '/leaderboard') return 'leaderboard';
    if (path === '/graph') return 'graph';
    if (path === '/modules' || path.startsWith('/concept/')) return 'modules';
    if (path === '/review') return 'review';
    if (path === '/lab') return 'lab';
    if (path === '/analytics') return 'analytics';
    if (path === '/catalog') return 'catalog';
    if (path === '/tutor') return 'tutor';
    if (path === '/settings') return 'settings';
    if (path === '/login') return 'login';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Hide sidebar on login page
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      {!isLoginPage && (
        <aside
          className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-adiptify-navy dark:bg-slate-950 text-white flex flex-col shadow-xl z-20 flex-shrink-0 transition-all duration-300 relative`}
        >
          {/* Logo */}
          <div className={`${collapsed ? 'p-3' : 'p-6'} flex items-center justify-center min-h-[80px]`}>
            {collapsed ? (
              <img
                src="/favicon.png"
                alt="A"
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
              />
            ) : (
              <img
                src={resolvedTheme === 'dark' ? '/logos/logo-dark-premium.png' : '/logos/logo-dark-gold.png'}
                alt="Adiptify"
                className="w-full object-contain max-h-14 drop-shadow-[0_0_12px_rgba(255,215,0,0.3)] transition-transform hover:scale-105 duration-300"
              />
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-adiptify-navy dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 text-white flex items-center justify-center z-30 hover:bg-adiptify-gold hover:text-adiptify-navy transition-all duration-200 shadow-md"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>

          <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto custom-scrollbar">
            {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/60 px-3 mb-2 mt-1">Learning</p>}
            <NavItem icon={<BarChart2 size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigate('/')} collapsed={collapsed} />
            <NavItem icon={<Library size={20} />} label="Subject Catalog" active={activeTab === 'catalog'} onClick={() => navigate('/catalog')} collapsed={collapsed} />
            <NavItem icon={<BookOpen size={20} />} label="Study Modules" active={activeTab === 'modules'} onClick={() => navigate('/modules')} collapsed={collapsed} />
            <NavItem icon={<Brain size={20} />} label="Spaced Review" active={activeTab === 'review'} onClick={() => navigate('/review')} collapsed={collapsed} />
            <NavItem icon={<MessageSquare size={20} />} label="AI Tutor" active={activeTab === 'tutor'} onClick={() => navigate('/tutor')} collapsed={collapsed} />

            <div className="my-2 mx-2 border-t border-white/8" />
            {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/60 px-3 mb-2">Assessment</p>}
            <NavItem icon={<ClipboardList size={20} />} label="Quizzes" active={activeTab === 'quiz'} onClick={() => navigate('/quiz-dashboard')} collapsed={collapsed} />
            <NavItem icon={<Trophy size={20} />} label="Leaderboard" active={activeTab === 'leaderboard'} onClick={() => navigate('/leaderboard')} collapsed={collapsed} />

            <div className="my-2 mx-2 border-t border-white/8" />
            {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/60 px-3 mb-2">Explore</p>}
            <NavItem icon={<FlaskConical size={20} />} label="Experiment Lab" active={activeTab === 'lab'} onClick={() => navigate('/lab')} collapsed={collapsed} />
            <NavItem icon={<BarChart3 size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => navigate('/analytics')} collapsed={collapsed} />
            <NavItem icon={<Network size={20} />} label="Knowledge Graph" active={activeTab === 'graph'} onClick={() => navigate('/graph')} collapsed={collapsed} />

            <div className="my-2 mx-2 border-t border-white/8" />
            <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => navigate('/settings')} collapsed={collapsed} />
          </nav>

          {/* User footer */}
          <div className="p-3 border-t border-white/10">
            {user ? (
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
                <div className={`flex items-center gap-2.5 ${collapsed ? '' : 'px-1'} py-1`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-adiptify-gold to-adiptify-terracotta flex items-center justify-center text-sm font-bold text-adiptify-navy flex-shrink-0 shadow-lg ring-2 ring-white/10">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  {!collapsed && (
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email || 'Student'}</p>
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={toggleTheme}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-adiptify-gold transition-colors"
                      title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                    >
                      {resolvedTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                      title="Logout"
                    >
                      <LogOut size={15} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <button
                  onClick={() => navigate('/login')}
                  className={`flex items-center gap-2.5 ${collapsed ? 'p-2' : 'px-3 py-2.5'} rounded-xl hover:bg-white/5 transition-colors w-full`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center text-adiptify-navy flex-shrink-0">
                    <User size={18} />
                  </div>
                  {!collapsed && (
                    <div>
                      <p className="text-sm font-medium">Guest</p>
                      <p className="text-[10px] text-slate-400">Sign in</p>
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<AnimatedPage><ProtectedRoute><MasteryDashboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/login" element={<Login />} />
            <Route path="/modules" element={<AnimatedPage><ProtectedRoute><StudyModules /></ProtectedRoute></AnimatedPage>} />
            <Route path="/concept/:conceptId" element={<AnimatedPage><ProtectedRoute><ConceptLearning /></ProtectedRoute></AnimatedPage>} />
            <Route path="/review" element={<AnimatedPage><ProtectedRoute><SpacedReview /></ProtectedRoute></AnimatedPage>} />
            <Route path="/lab" element={<AnimatedPage><ProtectedRoute><ExperimentLab /></ProtectedRoute></AnimatedPage>} />
            <Route path="/analytics" element={<AnimatedPage><ProtectedRoute><AnalyticsDashboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/tutor" element={<AnimatedPage><ProtectedRoute><AITutorPage /></ProtectedRoute></AnimatedPage>} />
            <Route path="/quiz-dashboard" element={<AnimatedPage><ProtectedRoute><QuizDashboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/catalog" element={<AnimatedPage><ProtectedRoute><SubjectCatalog /></ProtectedRoute></AnimatedPage>} />
            <Route path="/quiz/:id" element={<AnimatedPage><ProtectedRoute><QuizPage /></ProtectedRoute></AnimatedPage>} />
            <Route path="/result" element={<AnimatedPage><ProtectedRoute><Result /></ProtectedRoute></AnimatedPage>} />
            <Route path="/leaderboard" element={<AnimatedPage><ProtectedRoute><Leaderboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/graph" element={<AnimatedPage><ProtectedRoute><GraphExplorer /></ProtectedRoute></AnimatedPage>} />
            <Route path="/settings" element={<AnimatedPage><ProtectedRoute><UserPreferences /></ProtectedRoute></AnimatedPage>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Floating AI Tutor */}
      {!isLoginPage && <AITutor />}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3.5 ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl transition-all duration-200 text-left group relative overflow-hidden ${active
        ? 'text-adiptify-gold font-medium bg-gradient-to-r from-adiptify-gold/10 to-transparent'
        : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-white/5 hover:to-transparent'
      }`}
    >
      {/* Active indicator bar */}
      {active && (
        <motion.div
          layoutId="activeNav"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-6 rounded-r-full bg-adiptify-gold shadow-[0_0_8px_rgba(255,215,0,0.8)]"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      <span className={`flex-shrink-0 flex items-center justify-center transition-all duration-200 ${active ? 'text-adiptify-gold drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]' : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-110'}`}>
        {icon}
      </span>
      {!collapsed && <span className="text-sm truncate pt-0.5">{label}</span>}
    </button>
  );
}

function App() {
  return (
    <QuizProvider>
      <ThemeProvider>
        <AdaptifyProvider>
          <Router>
            <AppContent />
          </Router>
        </AdaptifyProvider>
      </ThemeProvider>
    </QuizProvider>
  );
}

export default App;
```

## File: `Frontend\src\index.css`

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-adiptify-navy: #2D3C59;
  --color-adiptify-navy-deep: #1E2A3F;
  --color-adiptify-olive: #94A378;
  --color-adiptify-gold: #E5BA41;
  --color-adiptify-terracotta: #D1855C;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* ─── Light mode defaults ─── */
:root {
  --color-navy: #2D3C59;
  --color-olive: #94A378;
  --color-gold: #E5BA41;
  --color-terracotta: #D1855C;
  --surface-primary: #f8fafc;
  --surface-card: #ffffff;
  --surface-hover: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-default: #e2e8f0;
  --border-subtle: rgba(0, 0, 0, 0.06);
  --glow-color: rgba(229, 186, 65, 0.15);
}

/* ─── Dark mode overrides ─── */
.dark {
  --color-navy: #1E2A3F;
  --color-olive: #A8B88C;
  --color-gold: #F0CA50;
  --color-terracotta: #E09570;
  --surface-primary: #0f172a;
  --surface-card: #1e293b;
  --surface-hover: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;
  --border-default: #334155;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --glow-color: rgba(240, 202, 80, 0.2);
}

body {
  background-color: var(--surface-primary);
  color: var(--text-primary);
  overflow-x: hidden;
  font-family: var(--font-sans);
  transition: background-color 0.2s ease, color 0.2s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ─── Custom Scrollbar — thin, branded ─── */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background-color: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(45, 60, 89, 0.15);
  border-radius: 9999px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.2);
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(45, 60, 89, 0.3);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(148, 163, 184, 0.35);
}

/* ─── Fade-in animation for page transitions ─── */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.35s ease-out;
}

/* ─── Pulse glow for active cards ─── */
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229, 186, 65, 0); }
  50%      { box-shadow: 0 0 12px 2px var(--glow-color, rgba(229, 186, 65, 0.15)); }
}
.animate-pulseGlow {
  animation: pulseGlow 2s ease-in-out infinite;
}

/* ─── Shimmer loading effect ─── */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.animate-shimmer {
  background: linear-gradient(90deg, transparent 25%, rgba(229, 186, 65, 0.08) 50%, transparent 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* ─── Float animation for hero elements ─── */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-10px); }
}
.animate-float {
  animation: float 3s ease-in-out infinite;
}

/* ─── Gradient border glow ─── */
@keyframes borderGlow {
  0%, 100% { border-color: rgba(229, 186, 65, 0.2); }
  50%      { border-color: rgba(229, 186, 65, 0.5); }
}
.animate-borderGlow {
  animation: borderGlow 3s ease-in-out infinite;
}

/* ─── Theme transition for smooth switching ─── */
*,
*::before,
*::after {
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

/* Exclude elements that shouldn't transition (animations, transforms) */
.react-flow *,
.graph-container * {
  transition: none !important;
}

/* ─── SVG Mountain path smooth transitions ─── */
.mountain-graph-path {
  transition: d 0.5s ease-in-out;
}

/* ─── Card hover lift effect ─── */
.card-hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1),
              0 4px 10px -5px rgba(0, 0, 0, 0.06);
}
.dark .card-hover-lift:hover {
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.4),
              0 4px 10px -5px rgba(0, 0, 0, 0.3);
}

/* ─── Glass morphism utility ─── */
.glass {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.dark .glass {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ─── Focus ring for accessibility ─── */
*:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
}

/* ─── Gradient text utility ─── */
.gradient-text-brand {
  background: linear-gradient(135deg, var(--color-navy), var(--color-terracotta));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.dark .gradient-text-brand {
  background: linear-gradient(135deg, var(--color-gold), var(--color-terracotta));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─── Select / input appearance reset for dark mode ─── */
select, input[type="text"], input[type="email"], input[type="password"], input[type="number"], textarea {
  color-scheme: light;
}
.dark select, .dark input[type="text"], .dark input[type="email"], .dark input[type="password"], .dark input[type="number"], .dark textarea {
  color-scheme: dark;
}

/* ─── Range slider branded accent ─── */
input[type="range"] {
  accent-color: var(--color-gold);
}
```

## File: `Frontend\src\main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

## File: `Frontend\src\api\client.js`

```js
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Fetch wrapper that includes JWT token and handles errors
 */
export async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('adiptify_token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
        ...options,
    };

    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
        config.body = options.body;
    } else if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // If it's a 401, but not from the login endpoint, treat as session expiration
    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
        localStorage.removeItem('adiptify_token');
        localStorage.removeItem('adiptify_user');
        window.location.hash = '#/login';
        throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Login user and save token
 */
export async function loginUser(email, password) {
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email, password },
    });
    localStorage.setItem('adiptify_token', data.token);
    localStorage.setItem('adiptify_user', JSON.stringify(data.user));
    return data;
}

/**
 * Register a new user
 */
export async function registerUser({ name, email, password, studentId, role }) {
    return apiFetch('/api/auth/register', {
        method: 'POST',
        body: { name, email, password, studentId, role },
    });
}

/**
 * Get current user profile
 */
export async function getMe() {
    return apiFetch('/api/auth/me');
}

/**
 * Check if user is logged in
 */
export function isAuthenticated() {
    return !!localStorage.getItem('adiptify_token');
}

/**
 * Get stored user
 */
export function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('adiptify_user'));
    } catch {
        return null;
    }
}

/**
 * Logout
 */
export function logoutUser() {
    localStorage.removeItem('adiptify_token');
    localStorage.removeItem('adiptify_user');
}
```

## File: `Frontend\src\components\ProtectedRoute.jsx`

```jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';

const ProtectedRoute = ({ children }) => {
    const { user } = useQuiz();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
```

## File: `Frontend\src\components\SyllabusUpload.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, CircularProgress, Alert, Paper, Stepper, Step, StepLabel, Checkbox, FormControlLabel } from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import { apiFetch } from '../api/client';
import { useQuiz } from '../context/QuizContext';

const SyllabusUpload = ({ onComplete }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadId, setUploadId] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, processing, extracted, confirmed, error
    const [error, setError] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [selectedTopics, setSelectedTopics] = useState([]);

    const { loadUserData } = useQuiz();

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            setError(null);
            setStatus('idle');
            setAiResult(null);
        }
    };

    const startUpload = async () => {
        if (!file) return;
        setUploading(true);
        setStatus('uploading');
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('adiptify_token');
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/syllabus/upload`, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: formData
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Upload failed');
            }

            const data = await res.json();
            setUploadId(data.uploadId);
            setStatus('processing');
            pollStatus(data.uploadId);
        } catch (err) {
            setError(err.message);
            setStatus('error');
            setUploading(false);
        }
    };

    const pollStatus = async (id) => {
        const interval = setInterval(async () => {
            try {
                const data = await apiFetch(`/api/syllabus/${id}`);
                if (data.status === 'extracted') {
                    clearInterval(interval);
                    setAiResult(data);
                    setSelectedTopics(data.extractedTopics.map(t => t.name));
                    setStatus('extracted');
                    setUploading(false);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    setError('AI extraction failed to process this document.');
                    setStatus('error');
                    setUploading(false);
                }
            } catch (err) {
                clearInterval(interval);
                setError('Failed to check status.');
                setStatus('error');
                setUploading(false);
            }
        }, 3000);
    };

    const toggleTopic = (name) => {
        setSelectedTopics(prev =>
            prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
        );
    };

    const confirmTopics = async () => {
        if (!uploadId) return;
        setStatus('uploading');
        try {
            await apiFetch(`/api/syllabus/${uploadId}/confirm`, {
                method: 'POST',
                body: { selectedTopics }
            });
            setStatus('confirmed');
            await loadUserData(); // Refresh subjects
            if (onComplete) onComplete();
        } catch (err) {
            setError(err.message);
            setStatus('extracted');
        }
    };

    const steps = ['Upload Syllabus', 'AI Extraction', 'Confirm Topics'];
    const activeStep = ['idle', 'uploading'].includes(status) ? 0
        : status === 'processing' ? 1
            : status === 'extracted' ? 2 : 3;

    return (
        <Paper sx={{ p: 3, borderRadius: 3, my: 3, border: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
                Upload Syllabus or Curriculum
            </Typography>
            <Typography variant="body2" color="textSecondary" mb={3}>
                Upload a PDF, DOCX, or TXT file. Our AI will analyze the document, summarize it, and extract the core topics for your curriculum.
            </Typography>

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                    <Step key={label}><StepLabel>{label}</StepLabel></Step>
                ))}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {status === 'idle' || status === 'uploading' ? (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2} p={4} border="2px dashed #ccc" borderRadius={2}>
                    <input
                        accept=".pdf,.docx,.txt,application/pdf,text/plain"
                        style={{ display: 'none' }}
                        id="raised-button-file"
                        type="file"
                        onChange={handleFileChange}
                        disabled={uploading}
                    />
                    <label htmlFor="raised-button-file">
                        <Button variant="outlined" component="span" startIcon={<UploadFile />} disabled={uploading}>
                            {file ? file.name : "Select File"}
                        </Button>
                    </label>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={startUpload}
                        disabled={!file || uploading}
                    >
                        {uploading ? <CircularProgress size={24} color="inherit" /> : "Upload & Analyze"}
                    </Button>
                </Box>
            ) : null}

            {status === 'processing' && (
                <Box display="flex" flexDirection="column" alignItems="center" gap={2} p={4}>
                    <CircularProgress />
                    <Typography>AI is reading and finding topics... This may take up to a minute.</Typography>
                </Box>
            )}

            {status === 'extracted' && aiResult && (
                <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>Extraction complete!</Alert>

                    <Typography variant="subtitle1" fontWeight="bold">AI Summary:</Typography>
                    <Typography variant="body2" sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                        {aiResult.summary}
                    </Typography>

                    <Typography variant="subtitle1" fontWeight="bold" mb={1}>Select topics to add as subjects:</Typography>
                    <Box display="flex" flexDirection="column" gap={1} mb={3}>
                        {aiResult.extractedTopics.map((t, idx) => (
                            <FormControlLabel
                                key={idx}
                                control={<Checkbox checked={selectedTopics.includes(t.name)} onChange={() => toggleTopic(t.name)} />}
                                label={`${t.name} (${t.category}) - Confidence: ${Math.round(t.confidence * 100)}%`}
                            />
                        ))}
                    </Box>

                    <Button variant="contained" color="secondary" onClick={confirmTopics} disabled={selectedTopics.length === 0}>
                        Confirm Selected Topics
                    </Button>
                </Box>
            )}

            {status === 'confirmed' && (
                <Alert severity="success">
                    Topics confirmed! They are now available in your subject catalog.
                </Alert>
            )}
        </Paper>
    );
};

export default SyllabusUpload;
```

## File: `Frontend\src\components\chat\LearningRoom.jsx`

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, Bot, Loader2, StopCircle, Maximize2, Minimize2 } from 'lucide-react';
import { useOllama } from '../../hooks/useOllama';
import ReactMarkdown from 'react-markdown';

// Using React.memo for high performance rendering of individual chat messages
const ChatMessage = React.memo(({ message, isLatestStreaming }) => {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''} mb-6`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-gradient-to-br from-adiptify-navy to-slate-700 text-white' : 'bg-gradient-to-br from-adiptify-terracotta to-orange-400 text-white shadow-md'
                }`}>
                {isUser ? <User size={20} /> : <Bot size={20} />}
            </div>

            <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${isUser
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tr-none'
                : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-100 rounded-tl-none'
                }`}>
                {isUser ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                    <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                        {message.content ? (
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-sm">Thinking...</span>
                            </div>
                        )}
                        {isLatestStreaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-adiptify-terracotta animate-pulse" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default function LearningRoom({ subject, isOpen, onClose }) {
    const [input, setInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef(null);

    const { messages, isStreaming, error, sendMessage, stopStreaming } = useOllama();

    // Auto-scroll logic utilizing requestAnimationFrame for smoothness
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        const contextPayload = subject ? {
            mastery: subject.mastery,
            weakestModule: subject.weakestModule,
        } : null;

        sendMessage(input, contextPayload);
        setInput('');
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/60 dark:border-slate-700/60 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isExpanded
                    ? 'inset-4 rounded-2xl'
                    : 'bottom-4 right-4 w-[450px] h-[600px] rounded-2xl'
                    }`}
            >
                {/* Header */}
                <header className="px-6 py-4 bg-white/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-adiptify-terracotta to-orange-400 flex items-center justify-center text-white shadow-md">
                            <Bot size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-adiptify-navy dark:text-white leading-tight">AI Tutor</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                                {subject ? `Context: ${subject.title}` : 'General Assistance'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
                        >
                            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
                            <Bot size={48} className="text-slate-200 dark:text-slate-700" />
                            <p className="text-center max-w-xs">
                                I am Adiptify, your intelligent learning assistant. How can I help you master {subject?.title || 'this subject'} today?
                            </p>
                        </div>
                    ) : (
                        <div className="pb-4">
                            {messages.map((msg, idx) => (
                                <ChatMessage
                                    key={idx}
                                    message={msg}
                                    isLatestStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
                                />
                            ))}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>
                    )}

                    {error && (
                        <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800 text-center">
                            {error}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    <form onSubmit={handleSubmit} className="flex gap-2 relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a question or request an explanation..."
                            className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-adiptify-terracotta/50 focus:bg-white dark:focus:bg-slate-600 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-white"
                            disabled={isStreaming}
                        />

                        {isStreaming ? (
                            <button
                                type="button"
                                onClick={stopStreaming}
                                className="absolute right-2 top-2 bottom-2 bg-slate-800 dark:bg-slate-600 text-white rounded-lg px-4 flex items-center justify-center hover:bg-slate-700 dark:hover:bg-slate-500 transition-colors"
                            >
                                <StopCircle size={20} />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="absolute right-2 top-2 bottom-2 bg-adiptify-terracotta text-white rounded-lg px-4 flex items-center justify-center hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-adiptify-terracotta transition-colors shadow-sm"
                            >
                                <Send size={18} className="translate-x-px translate-y-px" />
                            </button>
                        )}
                    </form>
                    <div className="text-center mt-2">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-adiptify-olive animate-pulse"></span>
                            DeepSeek-v3.1 Engine Active
                        </span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
```

## File: `Frontend\src\components\dashboard\DeepDivePanel.jsx`

```jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Target, BrainCircuit, Activity, BookOpen, Share2, Layers, RefreshCcw, FlaskConical, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DeepDivePanel({ subject, onClose, onEnterLearningRoom }) {
    const navigate = useNavigate();

    // Cache the subject to prevent crashes during the exit animation when subject becomes null
    const [cachedSubject, setCachedSubject] = React.useState(subject);

    React.useEffect(() => {
        if (subject) {
            setCachedSubject(subject);
        }
    }, [subject]);

    const displaySubject = subject || cachedSubject;

    return (
        <AnimatePresence>
            {subject && displaySubject && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-30 flex flex-col border-l border-slate-100 dark:border-slate-700"
                >
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md sticky top-0">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-adiptify-navy dark:text-white">{displaySubject.title}</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                                <span className="w-2 h-2 rounded-full bg-adiptify-olive"></span>
                                {displaySubject.mastery}% EMA Mastery
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">

                        {/* Weakest Area Alert */}
                        <div className="bg-adiptify-gold/10 border border-adiptify-gold/20 rounded-xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-adiptify-navy dark:text-adiptify-gold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Target size={16} className="text-adiptify-terracotta" />
                                Focus Area Identified
                            </h3>
                            <p className="text-slate-700 dark:text-slate-300 text-sm">
                                Your mastery in <span className="font-semibold text-adiptify-navy dark:text-white">"{displaySubject.weakestModule}"</span> is currently tracking below ideal threshold.
                                The Learning Room is calibrated to prioritize foundations here.
                            </p>
                        </div>

                        {/* Module Metrics */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Explore Subject Modules</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Click a module to explore it in the interactive Mind Map.</p>
                            <div className="space-y-4">
                                <MetricBar
                                    icon={<BrainCircuit size={18} />}
                                    label="Interest"
                                    value={displaySubject.modules?.interest || 0}
                                    color="bg-adiptify-navy"
                                    onClick={() => navigate('/graph', { state: { topic: `${displaySubject.title} Interest`, subjectId: displaySubject._id } })}
                                />
                                <MetricBar
                                    icon={<BookOpen size={18} />}
                                    label="Research"
                                    value={displaySubject.modules?.research || 0}
                                    color="bg-adiptify-olive"
                                    onClick={() => navigate('/graph', { state: { topic: `${displaySubject.title} Research`, subjectId: displaySubject._id } })}
                                />
                                <MetricBar
                                    icon={<Activity size={18} />}
                                    label="Practice"
                                    value={displaySubject.modules?.practice || 0}
                                    color="bg-adiptify-terracotta"
                                    onClick={() => navigate('/graph', { state: { topic: `${displaySubject.title} Practice`, subjectId: displaySubject._id } })}
                                />
                                <MetricBar
                                    icon={<Target size={18} />}
                                    label="Goals"
                                    value={displaySubject.modules?.goals || 0}
                                    color="bg-adiptify-gold"
                                    onClick={() => navigate('/graph', { state: { topic: `${displaySubject.title} Goals`, subjectId: displaySubject._id } })}
                                />
                            </div>

                            {displaySubject.isEnrolled && (
                                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Enrolled Features</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => navigate('/modules')}
                                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-600 transition-colors"
                                        >
                                            <Layers size={20} className="text-adiptify-navy dark:text-adiptify-gold" />
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Study Modules</span>
                                        </button>
                                        <button
                                            onClick={() => navigate('/review')}
                                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-600 transition-colors"
                                        >
                                            <RefreshCcw size={20} className="text-adiptify-olive" />
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Spaced Review</span>
                                        </button>
                                        <button
                                            onClick={() => navigate('/lab')}
                                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-600 transition-colors"
                                        >
                                            <FlaskConical size={20} className="text-adiptify-terracotta" />
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Experiment Lab</span>
                                        </button>
                                        <button
                                            onClick={() => navigate('/analytics')}
                                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-600 transition-colors"
                                        >
                                            <BarChart2 size={20} className="text-purple-600 dark:text-purple-400" />
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Analytics</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Explore Topic Button (Graph Explorer) */}
                    <div className="px-6 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 pt-4">
                        <button
                            onClick={() => navigate('/graph', { state: { topic: displaySubject.title, subjectId: displaySubject._id } })}
                            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-bold tracking-wide hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-300 flex justify-center items-center gap-2 group"
                        >
                            Explore in Mind Map
                            <Share2 size={18} className="group-hover:scale-110 transition-transform" />
                        </button>
                    </div>

                    {/* CTA Button */}
                    <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <button
                            onClick={onEnterLearningRoom}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-adiptify-terracotta to-orange-500 text-white font-bold tracking-wide shadow-lg shadow-adiptify-terracotta/30 hover:shadow-adiptify-terracotta/50 hover:-translate-y-1 transition-all duration-300 flex justify-center items-center gap-2 group"
                        >
                            Enter Learning Room
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function MetricBar({ icon, label, value, color, onClick }) {
    return (
        <div
            className={`flex items-center gap-4 ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-2 -mx-2 rounded-lg transition-colors' : ''}`}
            onClick={onClick}
        >
            <div className={`p-2 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-600 ${onClick ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700'}`}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{value}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${color}`}
                    />
                </div>
            </div>
        </div>
    );
}
```

## File: `Frontend\src\components\dashboard\MasteryDashboard.jsx`

```jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SubjectCard from './SubjectCard';
import DeepDivePanel from './DeepDivePanel';
import LearningRoom from '../chat/LearningRoom';
import { Loader2, BookOpen, Play, Clock, HelpCircle, Trophy, Sparkles, Brain, BarChart3, Zap, GraduationCap, ArrowRight, TrendingUp, Library } from 'lucide-react';
import { useQuiz } from '../../context/QuizContext';
import { useAdaptify } from '../../context/AdaptifyContext';
import { apiFetch } from '../../api/client';

const subjectColors = [
    'from-adiptify-navy to-blue-800',
    'from-adiptify-olive to-green-700',
    'from-adiptify-terracotta to-orange-700',
    'from-adiptify-gold to-yellow-600',
    'from-indigo-600 to-purple-700',
    'from-rose-600 to-red-700',
    'from-teal-600 to-cyan-700',
];

// Color mapping from subject color names to the format SubjectCard expects
const COLOR_REMAP = {
    emerald: 'emerald',
    purple: 'violet',
    sky: 'sky',
    amber: 'amber',
    blue: 'blue',
    yellow: 'yellow',
    indigo: 'indigo',
    rose: 'rose',
    teal: 'teal',
};

export default function MasteryDashboard() {
    const navigate = useNavigate();
    const { user, leaderboard, quizzes } = useQuiz();
    const {
        enrolledSubjects,
        concepts,
        userProgress,
        analytics,
        dueReviews,
        loading: adaptifyLoading,
    } = useAdaptify();

    const [dailyPlan, setDailyPlan] = useState(null);
    const [planLoading, setPlanLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: 'Generate your plan to start studying.', type: 'neutral' });

    // Fetch daily plan
    const fetchPlan = async () => {
        setPlanLoading(true);
        try {
            const plan = await apiFetch('/api/plan/generate', {
                method: 'POST',
                body: { goal: 'daily_study' }
            });
            setDailyPlan(plan.daily_plan);
            setStatusMessage({ text: plan.message || 'Ready to learn', type: plan.status || 'on_track' });
        } catch (error) {
            console.error('Failed to generate plan', error);
            setStatusMessage({ text: 'Failed to load plan', type: 'error' });
        } finally {
            setPlanLoading(false);
        }
    };
    
    // Auto-fetch if subjects exist
    React.useEffect(() => {
        if (enrolledSubjects && enrolledSubjects.length > 0 && !dailyPlan && !planLoading) {
            fetchPlan();
        }
    }, [enrolledSubjects]);

    // ─── Compute real mastery data from AdaptifyContext ───
    const subjectsWithMastery = useMemo(() => {
        if (!enrolledSubjects || enrolledSubjects.length === 0) return [];

        return enrolledSubjects.map(subject => {
            const subjectName = subject.name || subject.title;
            // Find concepts belonging to this subject
            const subjectConcepts = concepts.filter(c => c.category === subjectName);
            
            // Calculate real mastery from user progress
            let mastery = 0;
            let studiedCount = 0;
            if (subjectConcepts.length > 0) {
                const scores = subjectConcepts.map(c => {
                    const prog = userProgress[c.conceptId];
                    if (prog && prog.mastery_score > 0) {
                        studiedCount++;
                        return prog.mastery_score;
                    }
                    return 0;
                });
                mastery = Math.round(
                    (scores.reduce((s, v) => s + v, 0) / subjectConcepts.length) * 100
                );
            }

            return {
                id: subject._id || subject.slug,
                title: subjectName,
                mastery,
                totalConcepts: subjectConcepts.length,
                studiedCount,
                trend: mastery > 0 ? `+${mastery}%` : '—',
                modules: {
                    interest: studiedCount > 0 ? Math.round((studiedCount / Math.max(subjectConcepts.length, 1)) * 100) : 0,
                    research: mastery,
                    practice: Math.round(subjectConcepts.filter(c => {
                        const p = userProgress[c.conceptId];
                        return p && p.pipeline_stage >= 2;
                    }).length / Math.max(subjectConcepts.length, 1) * 100),
                    goals: Math.round(subjectConcepts.filter(c => {
                        const p = userProgress[c.conceptId];
                        return p && p.pipeline_completed;
                    }).length / Math.max(subjectConcepts.length, 1) * 100),
                },
                weakestModule: subjectConcepts.length > 0
                    ? (subjectConcepts.reduce((worst, c) => {
                        const p = userProgress[c.conceptId];
                        const score = p?.mastery_score || 0;
                        return score < (worst.score || Infinity) ? { title: c.title, score } : worst;
                    }, { score: Infinity }).title || 'General')
                    : 'No concepts yet',
                color: COLOR_REMAP[subject.color] || 'emerald',
                icon: subject.icon,
                isEnrolled: true,
                topicCount: subject.topics?.length || 0,
            };
        });
    }, [enrolledSubjects, concepts, userProgress]);

    // ─── Leaderboard stats ───
    const userStats = leaderboard.filter(entry => entry.name === user?.name);
    const bestScore = userStats.length > 0 ? Math.max(...userStats.map(s => s.score)) : 0;
    const attempts = userStats.length;

    // ─── Overall mastery (real) ───
    const overallMastery = subjectsWithMastery.length > 0
        ? Math.round(subjectsWithMastery.reduce((sum, s) => sum + s.mastery, 0) / subjectsWithMastery.length)
        : 0;

    // ─── Quick stats from analytics ───
    const totalConceptsStudied = Object.keys(userProgress).length;
    const totalConceptsAvailable = concepts.length;
    const dueCount = dueReviews?.length || 0;

    const [selectedSubject, setSelectedSubject] = useState(null);
    const [isLearningRoomOpen, setIsLearningRoomOpen] = useState(false);

    const loading = adaptifyLoading;

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto relative bg-slate-50/50 dark:bg-slate-900/50">

            {/* ─── Hero Header ─── */}
            <header className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-adiptify-navy via-[#1e2d45] to-[#162236]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(229,186,65,0.08),transparent_70%)]" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-adiptify-gold/30 to-transparent" />

                <div className="relative px-8 py-8 md:py-10 flex justify-between items-end">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <p className="text-adiptify-gold/70 text-sm font-medium mb-1">
                            {new Date().getHours() < 12 ? '☀️ Good morning' : new Date().getHours() < 17 ? '🌤️ Good afternoon' : '🌙 Good evening'}{user ? `, ${user.name}` : ''}
                        </p>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Mastery Dashboard</h2>
                        <p className="text-slate-300/60 mt-1 text-sm">Track your adaptive learning progress across all subjects.</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                        className="hidden sm:flex items-center gap-5"
                    >
                        {/* Due badge */}
                        {dueCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-300 text-xs font-medium animate-pulseGlow">
                                <Clock size={13} /> {dueCount} reviews due
                            </div>
                        )}
                        {/* Mastery ring */}
                        <div className="text-right mr-1">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Overall Mastery</p>
                            <p className="text-2xl font-bold text-adiptify-gold">{overallMastery}%</p>
                        </div>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center relative">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <path
                                    className="text-white/10"
                                    strokeWidth="3"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className="text-adiptify-gold drop-shadow-sm"
                                    strokeDasharray={`${overallMastery}, 100`}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                                />
                            </svg>
                            <Zap size={14} className="absolute text-adiptify-gold/40" />
                        </div>
                    </motion.div>
                </div>
            </header>

            <div className="p-8 flex-1 space-y-8">
                {/* ─── Command Center (Today's Mission) ─── */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative rounded-2xl bg-gradient-to-r from-adiptify-navy via-slate-800 to-slate-900 p-[1px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-adiptify-gold/20 via-transparent to-transparent opacity-50 animate-pulse" />
                    
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-8 z-10">
                        {/* LEFT: Context */}
                        <div className="flex-1 w-full text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <Sparkles className="text-adiptify-gold w-6 h-6" />
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Today's Mission</h2>
                                <span className="ml-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                    {planLoading ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span> Analyzing...</>
                                    ) : dailyPlan ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Plan Ready</>
                                    ) : (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Standing By</>
                                    )}
                                </span>
                            </div>
                            
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-6">
                                {statusMessage.text || "You are slightly behind. Start with the easiest topic."}
                            </p>
                            
                            {dailyPlan ? (
                                <div className="flex flex-wrap gap-3">
                                    {dailyPlan.topics_to_study?.[0] && (
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Study: {dailyPlan.topics_to_study[0].split('(')[0]}</span>
                                        </div>
                                    )}
                                    {dailyPlan.revision_topics?.[0] && (
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Review: {dailyPlan.revision_topics[0].split('(')[0]}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-slate-500 text-sm italic">Click generate to build your optimal path today.</div>
                            )}
                        </div>

                        {/* RIGHT: Action & Progress */}
                        <div className="flex flex-col md:flex-row items-center gap-8 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-6 md:pt-0 md:pl-8 w-full md:w-auto">
                            <div className="flex flex-col items-center">
                                <div className="relative w-24 h-24 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                                        <path className="text-slate-100 dark:text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        <path className="text-adiptify-gold drop-shadow-[0_0_6px_rgba(255,215,0,0.5)]" strokeDasharray={`${overallMastery}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ transition: 'stroke-dasharray 1.5s ease-out' }} />
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center">
                                        <span className="text-xl font-bold text-slate-800 dark:text-white">{overallMastery}%</span>
                                    </div>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-2">Daily Completion</span>
                            </div>
                            
                            <button
                                onClick={planLoading ? undefined : (dailyPlan ? () => navigate('/modules') : fetchPlan)}
                                className="group relative w-full sm:w-auto overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 p-[1px] shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
                            >
                                <div className="relative bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3.5 rounded-xl flex items-center justify-center gap-2">
                                    <span className="text-white font-bold text-sm tracking-wide">
                                        {planLoading ? "Generating..." : dailyPlan ? "Start Mission" : "Generate Plan"}
                                    </span>
                                    {!planLoading && <ArrowRight size={16} className="text-white group-hover:translate-x-1 transition-transform" />}
                                </div>
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* ─── Quick Stats Row ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 border border-blue-200/40 dark:border-blue-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><GraduationCap size={20} className="text-blue-500" /></div>
                        <div>
                            <p className="text-xs text-blue-500/80 dark:text-blue-400 font-medium">Subjects Enrolled</p>
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{enrolledSubjects?.length || 0}</p>
                        </div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-500/10 dark:to-purple-500/5 border border-purple-200/40 dark:border-purple-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><Brain size={20} className="text-purple-500" /></div>
                        <div>
                            <p className="text-xs text-purple-500/80 dark:text-purple-400 font-medium">Concepts Studied</p>
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{totalConceptsStudied} / {totalConceptsAvailable}</p>
                        </div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/10 dark:to-amber-500/5 border border-amber-200/40 dark:border-amber-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock size={20} className="text-amber-500" /></div>
                        <div>
                            <p className="text-xs text-amber-500/80 dark:text-amber-400 font-medium">Due for Review</p>
                            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{dueCount}</p>
                        </div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Trophy size={20} className="text-emerald-500" /></div>
                        <div>
                            <p className="text-xs text-emerald-500/80 dark:text-emerald-400 font-medium">Best Quiz Score</p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{bestScore}%</p>
                        </div>
                    </motion.div>
                </div>

                {/* ─── Subject Cards ─── */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-adiptify-gold" />
                    </div>
                ) : subjectsWithMastery.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/20 dark:shadow-none"
                    >
                        <motion.div 
                            animate={{ y: [0, -10, 0] }} 
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="w-24 h-24 mx-auto mb-8 relative"
                        >
                            <div className="absolute inset-0 bg-adiptify-gold/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative bg-gradient-to-br from-adiptify-gold to-orange-500 w-full h-full rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)] border-2 border-white/10">
                                <Sparkles className="w-10 h-10 text-white drop-shadow-md" />
                            </div>
                        </motion.div>
                        
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-3">Welcome to Adiptify</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-lg mx-auto font-medium">
                            Your intelligent learning journey begins here. Complete these 3 steps to start mastering any subject:
                        </p>
                        
                        <div className="flex flex-col md:flex-row justify-center gap-6 max-w-4xl mx-auto mb-12 text-left px-6">
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-cyan-400 opacity-80" />
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold mb-4">1</div>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Add Subject</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Enroll in a subject from the catalog to build your knowledge graph.</p>
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-400 opacity-80" />
                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold mb-4">2</div>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Generate Plan</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Our AI builds your daily mission based on your progress.</p>
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-400 opacity-80" />
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold mb-4">3</div>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Start Learning</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Master concepts via active recall and verify with quizzes.</p>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/catalog')}
                            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-lg rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all active:scale-[0.98] hover:-translate-y-1"
                        >
                            <Library size={22} className="group-hover:rotate-12 transition-transform" />
                            Browse Catalog & Begin
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-adiptify-navy dark:text-white">Your Subjects</h3>
                            <button
                                onClick={() => navigate('/catalog')}
                                className="text-xs font-medium text-adiptify-gold hover:text-adiptify-gold/80 flex items-center gap-1 transition-colors"
                            >
                                Explore more <ArrowRight size={12} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {subjectsWithMastery.map((subject, idx) => (
                                <motion.div
                                    key={subject.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.07 }}
                                >
                                    <SubjectCard
                                        subject={subject}
                                        onClick={() => setSelectedSubject(subject)}
                                        isActive={selectedSubject?.id === subject.id}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </>
                )}

                {/* ─── Next Action Panel (Layer 2) ─── */}
                {subjectsWithMastery.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4">
                        <motion.button
                            onClick={() => navigate('/modules')}
                            whileHover={{ y: -4 }}
                            className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                    <BookOpen size={24} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-base font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Continue Topic</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Explore {totalConceptsAvailable} concepts</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/50 transition-colors">
                                <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </motion.button>

                        <motion.button
                            onClick={() => navigate('/review')}
                            whileHover={{ y: -4 }}
                            className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700 hover:shadow-xl hover:border-amber-300 dark:hover:border-amber-600/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                                    <Brain size={24} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-base font-bold text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Review Weak Areas</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{dueCount} cards due</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-amber-50 dark:group-hover:bg-amber-900/50 transition-colors">
                                <ArrowRight size={16} className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </motion.button>

                        <motion.button
                            onClick={() => navigate('/quiz-dashboard')}
                            whileHover={{ y: -4 }}
                            className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700 hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-600/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                                    <HelpCircle size={24} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-base font-bold text-slate-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Start Quiz</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Verify your mastery</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-purple-50 dark:group-hover:bg-purple-900/50 transition-colors">
                                <ArrowRight size={16} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </motion.button>
                    </div>
                )}

                {/* ─── Recent Quizzes Section ─── */}
                {quizzes.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-adiptify-navy dark:text-white">Recent Quizzes</h3>
                            <button
                                onClick={() => navigate('/quiz-dashboard')}
                                className="text-xs font-medium text-adiptify-gold hover:text-adiptify-gold/80 flex items-center gap-1 transition-colors"
                            >
                                View all <ArrowRight size={12} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {quizzes.slice(0, 3).map((quiz, index) => (
                                <motion.div
                                    key={quiz.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.08 }}
                                    whileHover={{ y: -4 }}
                                    className="group cursor-pointer"
                                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                                >
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full border border-slate-100 dark:border-slate-700">
                                        <div className={`h-24 bg-gradient-to-br ${subjectColors[index % subjectColors.length]} relative`}>
                                            <span className="absolute bottom-2 right-4 text-5xl font-black text-white/10">
                                                {index + 1}
                                            </span>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <h4 className="text-base font-bold text-adiptify-navy dark:text-white mb-1 group-hover:text-adiptify-terracotta transition-colors">
                                                {quiz.title}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex-1 line-clamp-2">
                                                {quiz.description}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-adiptify-olive">
                                                    <Clock size={10} /> {quiz.duration} mins
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                    <HelpCircle size={10} /> {quiz.questions.length} Qs
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Slide-in Right Panel */}
            <DeepDivePanel
                subject={selectedSubject}
                onClose={() => setSelectedSubject(null)}
                onEnterLearningRoom={() => setIsLearningRoomOpen(true)}
            />

            {/* Learning Room Overlay Chat */}
            <LearningRoom
                subject={selectedSubject}
                isOpen={isLearningRoomOpen}
                onClose={() => setIsLearningRoomOpen(false)}
            />
        </div>
    );
}
```

## File: `Frontend\src\components\dashboard\ProctoringShield.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProctoringShield() {
    const [violations, setViolations] = useState(0);
    const [isFocused, setIsFocused] = useState(true);
    const [showWarning, setShowWarning] = useState(false);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                setIsFocused(false);
                setViolations(prev => {
                    const newCount = prev + 1;
                    console.warn(`[Proctoring] Focus lost. Violation log recorded. Count: ${newCount}`);
                    return newCount;
                });
                setShowWarning(true);
            } else {
                setIsFocused(true);
                setTimeout(() => setShowWarning(false), 5000);
            }
        };

        const handleBlur = () => {
            if (isFocused) handleVisibilityChange();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isFocused]);

    return (
        <>
            {/* Persistent Status Indicator */}
            <div className="fixed top-4 right-4 z-40">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm border backdrop-blur-md text-xs font-bold uppercase tracking-wider transition-colors ${violations > 0
                    ? 'bg-adiptify-gold/10 border-adiptify-gold/20 text-adiptify-gold'
                    : 'bg-adiptify-olive/10 border-adiptify-olive/20 text-adiptify-olive'
                    }`}>
                    {violations > 0 ? (
                        <>
                            <ShieldAlert size={14} className="animate-pulse" />
                            <span>Proctoring: {violations} Violations</span>
                        </>
                    ) : (
                        <>
                            <ShieldCheck size={14} />
                            <span>Proctoring Active</span>
                        </>
                    )}
                </div>
            </div>

            {/* Screen Warning Overlay */}
            <AnimatePresence>
                {(!isFocused || showWarning) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`fixed inset-0 z-[100] flex items-center justify-center pointer-events-none transition-colors duration-500 ${!isFocused ? 'bg-adiptify-navy/90 backdrop-blur-sm' : 'bg-transparent'
                            }`}
                    >
                        {!isFocused ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
                                <ShieldAlert size={48} className="text-adiptify-terracotta mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-adiptify-navy dark:text-white mb-2">Focus Lost</h2>
                                <p className="text-slate-600 dark:text-slate-300 mb-6">
                                    You have navigated away from the learning session. This event has been logged to the proctoring engine. Return to the tab to resume.
                                </p>
                                <div className="animate-pulse text-sm font-bold text-adiptify-terracotta uppercase tracking-wider">
                                    Waiting for return...
                                </div>
                            </div>
                        ) : (
                            <div className="absolute top-16 right-4 bg-white dark:bg-slate-800 border border-adiptify-gold rounded-xl p-4 shadow-xl max-w-xs pointer-events-auto">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    <span className="font-bold text-adiptify-gold block mb-1">Warning Recorded</span>
                                    Please keep the Adiptify dashboard active during assessments.
                                </p>
                                <button
                                    onClick={() => setShowWarning(false)}
                                    className="mt-3 text-xs w-full py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors font-semibold"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
```

## File: `Frontend\src\components\dashboard\SubjectCard.jsx`

```jsx
import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

const ACCENT_GRADIENTS = {
    emerald: 'from-emerald-500 to-teal-500',
    violet: 'from-violet-500 to-purple-600',
    sky: 'from-sky-500 to-blue-600',
    amber: 'from-amber-500 to-yellow-600',
    blue: 'from-blue-500 to-indigo-600',
    yellow: 'from-yellow-500 to-amber-600',
    indigo: 'from-indigo-500 to-purple-600',
    rose: 'from-rose-500 to-pink-600',
    teal: 'from-teal-500 to-cyan-600',
};

export default function SubjectCard({ subject, onClick, isActive }) {
    const accentGradient = ACCENT_GRADIENTS[subject.color] || ACCENT_GRADIENTS.emerald;

    return (
        <div
            onClick={onClick}
            className={`
                group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border
                ${isActive
                    ? 'bg-white dark:bg-slate-800 shadow-xl ring-2 ring-adiptify-gold/50 scale-[1.01] border-adiptify-gold/20'
                    : 'bg-white dark:bg-slate-800 shadow-md hover:shadow-xl hover:-translate-y-1 border-slate-100 dark:border-slate-700'
                }
            `}
        >
            {/* Top accent bar */}
            <div className={`h-1.5 bg-gradient-to-r ${accentGradient}`} />

            <div className="p-6">
                <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 min-w-0 pr-3">
                        <h3 className="text-lg font-bold tracking-tight text-adiptify-navy dark:text-white group-hover:text-adiptify-terracotta dark:group-hover:text-adiptify-gold transition-colors truncate">
                            {subject.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {subject.studiedCount > 0
                                ? `${subject.studiedCount} of ${subject.totalConcepts} concepts studied`
                                : subject.totalConcepts > 0
                                    ? `${subject.totalConcepts} concepts available`
                                    : 'Generate modules to start'
                            }
                        </p>
                    </div>
                    <div className={`relative w-14 h-14 flex-shrink-0`}>
                        {/* Mastery ring */}
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" className="stroke-slate-100 dark:stroke-slate-700" />
                            <circle
                                cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" strokeLinecap="round"
                                className={`transition-all duration-700`}
                                style={{
                                    stroke: subject.mastery >= 70 ? '#94A378' : subject.mastery >= 40 ? '#E5BA41' : '#D1855C',
                                    strokeDasharray: `${subject.mastery}, 100`
                                }}
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-adiptify-navy dark:text-white">
                            {subject.mastery}
                        </span>
                    </div>
                </div>

                {/* Mini progress bars */}
                <div className="space-y-1.5 mb-5">
                    {[
                        { label: 'Coverage', value: subject.modules?.interest || 0, color: 'bg-blue-500' },
                        { label: 'Mastery', value: subject.modules?.research || 0, color: 'bg-adiptify-gold' },
                        { label: 'Practice', value: subject.modules?.practice || 0, color: 'bg-emerald-500' },
                        { label: 'Completed', value: subject.modules?.goals || 0, color: 'bg-purple-500' },
                    ].map(bar => (
                        <div key={bar.label} className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-400 dark:text-slate-500 w-14 text-right font-medium">{bar.label}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${bar.color} transition-all duration-700`}
                                    style={{ width: `${bar.value}%` }}
                                />
                            </div>
                            <span className="text-[8px] text-slate-500 dark:text-slate-400 w-7 font-bold tabular-nums">{bar.value}%</span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="min-w-0">
                        <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                            {subject.mastery > 0 ? 'Focus Area' : 'Status'}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-[140px]">
                            {subject.weakestModule}
                        </p>
                    </div>

                    <div className={`flex items-center gap-1 text-xs font-semibold transition-all
                        ${isActive ? 'text-adiptify-gold' : 'text-slate-400 group-hover:text-adiptify-gold'}
                    `}>
                        <Sparkles size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span>Details</span>
                        <ChevronRight size={14} className={`transition-transform ${isActive ? 'translate-x-0.5' : 'group-hover:translate-x-0.5'}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
```

## File: `Frontend\src\components\graph\CustomNode.jsx`

```jsx
import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { ChevronRight, ChevronDown, Info, PlusCircle, Pin, PinOff } from 'lucide-react';

const CustomNode = ({ id, data }) => {
    const hasChildren = data.childCount > 0;
    const level = data.level || 0;
    const [pinned, setPinned] = useState(false);

    return (
        <div className={`custom-node-wrapper ${data.isRoot ? 'root-node' : ''} node-level-${level} ${pinned ? 'pinned' : ''}`}>
            <Handle type="target" position={Position.Left} />
            <div className="custom-node-content">
                <div className="node-header">
                    <span className="node-label">{data.label}</span>
                    <div className="node-actions">
                        {!hasChildren && (
                            <button
                                className="toggle-btn expand-btn"
                                title="Explore more"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    data.onExpand?.(data.label, id);
                                }}
                            >
                                <PlusCircle size={14} />
                            </button>
                        )}
                        {hasChildren && (
                            <button
                                className="toggle-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    data.onToggleChildren?.(id);
                                }}
                            >
                                {data.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                        <button
                            className={`toggle-btn pin-btn ${pinned ? 'pin-active' : ''}`}
                            title={pinned ? 'Unpin info' : 'Pin info'}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPinned(prev => !prev);
                            }}
                        >
                            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                    </div>
                </div>
                <div className={`hover-info ${pinned ? 'info-pinned' : ''}`}>
                    <Info size={12} className="info-icon" />
                    <div className="tooltip-desc">{data.desc}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
};

export default memo(CustomNode);

```

## File: `Frontend\src\components\graph\GraphExplorer.css`

```css
:root {
  --bg: #000000;
  --card: #222222;
  --accent: #1DCD9F;
  --accent-glow: rgba(29, 205, 159, 0.5);
  --accent-dark: #169976;
  --text-dim: rgba(255, 255, 255, 0.55);
  --text-light: #ffffff;
}

.app-container {
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--bg);
  color: var(--text-light);
  overflow: hidden;
}

.glass-header {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: 90%;
  max-width: 900px;
  background: rgba(34, 34, 34, 0.85);
  backdrop-filter: blur(16px);
  padding: 10px 25px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.6);
  transition: opacity 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.4s ease, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.header-hover-zone {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  z-index: 1001;
}

.glass-header.graph-active {
  transform: translate(-50%, -150%);
  opacity: 0;
  pointer-events: none;
}

.header-hover-zone:hover+.glass-header.graph-active,
.glass-header.graph-active:hover,
.glass-header.graph-active:focus-within {
  transform: translate(-50%, 0);
  opacity: 1;
  pointer-events: all;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-family: 'Inter', sans-serif;
  letter-spacing: -0.5px;
  color: #fff;
}

.icon-glow {
  filter: drop-shadow(0 0 8px var(--accent));
  color: var(--accent);
}

.search-box {
  display: flex;
  gap: 12px;
  flex: 1;
  margin: 0 30px;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(29, 205, 159, 0.2);
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-light);
  outline: none;
  font-size: 15px;
}

.search-box button {
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}

.search-box button:hover {
  transform: scale(1.1);
}

/* Custom Node Styles */
.custom-node-wrapper {
  background: var(--card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 14px;
  min-width: 180px;
  max-width: 280px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Level Based Styling */
.node-level-0 {
  min-width: 260px;
  max-width: 350px;
  padding: 18px 22px;
  border-color: var(--accent);
  background: rgba(29, 205, 159, 0.12);
  resize: horizontal;
  overflow: auto;
}

.node-level-0 .node-label {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
}

.node-level-1 {
  min-width: 220px;
  max-width: 300px;
  padding: 14px 18px;
  border-color: rgba(29, 205, 159, 0.4);
  resize: horizontal;
  overflow: auto;
}

.node-level-1 .node-label {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
}

.node-level-2 {
  min-width: 190px;
  max-width: 260px;
  resize: horizontal;
  overflow: auto;
}

.node-level-2 .node-label {
  font-size: 0.95rem;
  font-weight: 500;
}

.node-level-3,
.node-level-4,
.node-level-5,
.node-level-6,
.node-level-7,
.node-level-8,
.node-level-9 {
  min-width: 160px;
  max-width: 220px;
  opacity: 0.9;
  resize: horizontal;
  overflow: auto;
}

.node-level-3 .node-label,
.node-level-4 .node-label,
.node-level-5 .node-label,
.node-level-6 .node-label,
.node-level-7 .node-label,
.node-level-8 .node-label,
.node-level-9 .node-label {
  font-size: 0.85rem;
}

.custom-node-content {
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.root-node {
  border: 2px solid var(--accent);
  box-shadow: 0 0 20px var(--accent-glow);
  background: rgba(34, 34, 34, 0.95);
}

.custom-node-wrapper:hover {
  border-color: var(--accent);
  box-shadow: 0 0 25px rgba(29, 205, 159, 0.3);
  z-index: 5000 !important;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.node-label {
  font-weight: 700;
  font-size: 14px;
  color: #fff;
  flex: 1;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  line-height: 1.3;
}

.node-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.expand-btn {
  color: var(--accent) !important;
  background: rgba(29, 205, 159, 0.1) !important;
  border-color: rgba(29, 205, 159, 0.3) !important;
}

.expand-btn:hover {
  background: var(--accent) !important;
  color: #000 !important;
}

.toggle-btn {
  background: rgba(29, 205, 159, 0.1);
  border: 1px solid rgba(29, 205, 159, 0.3);
  border-radius: 6px;
  color: var(--accent);
  cursor: pointer;
  padding: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
  transform: scale(1.1);
}

/* Pin Button */
.pin-btn {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

.pin-btn:hover {
  background: rgba(29, 205, 159, 0.15) !important;
  color: var(--accent) !important;
}

.pin-btn.pin-active {
  background: var(--accent-dark) !important;
  color: #fff !important;
  border-color: var(--accent-dark) !important;
  box-shadow: 0 0 8px rgba(22, 153, 118, 0.5);
}

.custom-node-wrapper.pinned {
  border-color: rgba(22, 153, 118, 0.5);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4), 0 0 12px rgba(22, 153, 118, 0.2);
}

.hover-info {
  margin-top: 0;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}

.custom-node-wrapper:hover .hover-info {
  margin-top: 10px;
  max-height: 150px;
  opacity: 1;
  overflow-y: auto;
}

/* Pinned state — stays open regardless of hover/cursor */
.hover-info.info-pinned {
  margin-top: 10px !important;
  max-height: 150px !important;
  opacity: 1 !important;
  overflow-y: auto !important;
}

.info-icon {
  color: var(--accent);
  margin-top: 2px;
  flex-shrink: 0;
}

.tooltip-desc {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-dim);
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  cursor: pointer;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.spinning {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.loader-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 40px;
  z-index: 2000;
}

.loader-overlay {
  background: var(--accent-dark);
  color: #fff;
  padding: 12px 24px;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 14px;
  animation: slideUp 0.3s ease-out;
  box-shadow: 0 10px 25px -5px rgba(22, 153, 118, 0.5);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* ReactFlow overrides and animations */
.react-flow__node {
  transition: all 0.3s ease-in-out;
}

.react-flow__node.dragging {
  transition: none !important;
}

.react-flow__handle {
  width: 8px;
  height: 8px;
  background: var(--accent);
  border: 2px solid #000000;
  transition: transform 0.2s;
}

.react-flow__handle:hover {
  transform: scale(1.5);
  background: var(--accent-dark);
}

.react-flow__edge-path {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
  stroke-width: 2.5;
  transition: opacity 0.3s;
}

@keyframes dashdraw {
  from {
    stroke-dashoffset: 10;
  }

  to {
    stroke-dashoffset: 0;
  }
}

.react-flow__controls {
  background: rgba(34, 34, 34, 0.9) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 8px !important;
  overflow: hidden;
}

.react-flow__controls button {
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  fill: #fff !important;
  color: #fff !important;
}

.react-flow__controls button:hover {
  background: rgba(29, 205, 159, 0.1) !important;
}

.react-flow__minimap {
  background: #222222 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px !important;
}

/* Context Menu styling */
.context-menu {
  position: absolute;
  background: var(--card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  padding: 8px;
  z-index: 9999;
  min-width: 160px;
  backdrop-filter: blur(12px);
}

.context-menu button {
  background: transparent;
  border: none;
  color: #fff;
  padding: 10px 14px;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
  font-weight: 500;
}

.context-menu button:hover {
  background: rgba(29, 205, 159, 0.15);
  color: var(--accent);
}

.context-menu .delete-action {
  color: #ef4444;
  margin-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0 0 6px 6px;
}

.context-menu .delete-action:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Focus Mode */
.react-flow__node.active-node .custom-node-wrapper {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(29, 205, 159, 0.7) !important;
  border-color: var(--accent) !important;
}

.react-flow__node.connected-node {
  opacity: 0.7;
}

.react-flow__node.dimmed {
  opacity: 0.1;
  filter: grayscale(100%) blur(1px);
  pointer-events: none;
  z-index: -1 !important;
}

.dimmed-edge {
  opacity: 0.05 !important;
}

/* Entry Animation */
@keyframes fadeInScale {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.entry-animation {
  animation: fadeInScale 0.5s ease-out forwards;
}
```

## File: `Frontend\src\components\graph\GraphExplorer.jsx`

```jsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  useNodesState, useEdgesState, Background, Controls, MiniMap, MarkerType, useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getAIResponse } from '../../services/llmService';
import { getLayoutedElements } from './layoutEngine';
import { Send, Trash2, Zap, Cpu, RefreshCcw, Layout } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import CustomNode from './CustomNode';
import './GraphExplorer.css';

import { ReactFlowProvider } from 'reactflow';

const nodeTypes = {
  custom: CustomNode,
};

function GraphExplorerInner({ defaultTopic, defaultSubjectId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const { fitView, setCenter } = useReactFlow();
  const location = useLocation();
  const autoExpandTopic = defaultTopic || location.state?.topic;
  const autoExpandSubjectId = defaultSubjectId || location.state?.subjectId;

  // Focus and Context Menu State
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Load from Memory — collapse everything to root on refresh for a clean view
  useEffect(() => {
    const saved = localStorage.getItem('ai_graph_memory');
    if (saved) {
      try {
        const { nodes: n, edges: e } = JSON.parse(saved);
        if (Array.isArray(n) && Array.isArray(e) && n.length > 0) {
          // Find all nodes that have children (i.e. are a source of at least one edge)
          const parentIds = new Set(e.map(edge => edge.source));
          // Collapse every parent node so only the root is visible
          const initialCollapsed = new Set();
          parentIds.forEach(id => initialCollapsed.add(id));

          const hiddenOnLoad = getHiddenIds(initialCollapsed, e);
          const { nodes: layoutedNodes } = getLayoutedElements(n, e, hiddenOnLoad);

          setNodes(layoutedNodes);
          setEdges(e);
          setCollapsedNodes(initialCollapsed);

          // Center on root after a tick
          setTimeout(() => {
            fitView({ duration: 600, padding: 0.3, maxZoom: 1, minZoom: 0.15 });
          }, 100);
        }
      } catch (err) {
        console.error("Failed to load memory:", err);
        localStorage.removeItem('ai_graph_memory');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand from router state
  useEffect(() => {
    if ((autoExpandTopic || autoExpandSubjectId) && !loading && nodes.length === 0) {
      setInput(autoExpandTopic || 'Subject Graph');
      // Use setTimeout to avoid calling onExpand before it's ready or causing a render loop
      setTimeout(() => onExpand(autoExpandTopic || 'Subject Graph', null, autoExpandSubjectId), 100);
    }
  }, [autoExpandTopic, autoExpandSubjectId]);

  const getHiddenIds = useCallback((collapsedSet, currentEdges) => {
    const ids = new Set();
    const checkHidden = (parentId) => {
      currentEdges.forEach(edge => {
        if (edge.source === parentId) {
          ids.add(edge.target);
          checkHidden(edge.target);
        }
      });
    };
    collapsedSet.forEach(id => checkHidden(id));
    return ids;
  }, []);

  // Track the last toggled node for camera framing
  const [lastToggledNode, setLastToggledNode] = useState(null);

  const toggleChildren = useCallback((nodeId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId); // expanding
        setLastToggledNode({ id: nodeId, action: 'expand' });
      } else {
        next.add(nodeId); // collapsing
        setLastToggledNode({ id: nodeId, action: 'collapse' });
      }
      return next;
    });
  }, []);

  // Re-layout whenever collapsedNodes changes — uses LATEST nodes and edges from state
  useEffect(() => {
    if (nodes.length === 0) return;
    const currentHiddenIds = getHiddenIds(collapsedNodes, edges);
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, currentHiddenIds);

    // Only update if positions actually changed to avoid infinite loop
    const positionsChanged = layoutedNodes.some((ln, i) => {
      const orig = nodes[i];
      return !orig || ln.position.x !== orig.position.x || ln.position.y !== orig.position.y;
    });

    if (positionsChanged) {
      setNodes(layoutedNodes);
    }

    // Camera framing for the last toggled node
    if (lastToggledNode) {
      setTimeout(() => {
        if (lastToggledNode.action === 'expand') {
          const childrenIds = edges
            .filter(e => e.source === lastToggledNode.id && !currentHiddenIds.has(e.target))
            .map(e => ({ id: e.target }));
          const nodesToFrame = [{ id: lastToggledNode.id }, ...childrenIds];
          fitView({ nodes: nodesToFrame, duration: 800, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        } else {
          fitView({ nodes: [{ id: lastToggledNode.id }], duration: 600, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        }
        setLastToggledNode(null);
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsedNodes]);

  // Derived state for hidden nodes/edges
  const hiddenIds = useMemo(() => getHiddenIds(collapsedNodes, edges), [collapsedNodes, edges, getHiddenIds]);

  const onExpand = useCallback(async (topic, parentId = null, subjectId = null) => {
    if (!topic?.trim() && !subjectId) return;

    setLoading(true);
    try {
      const data = await getAIResponse(topic, parentId, subjectId);
      let nodesToAdd = [];
      let edgesToAdd = [];

      if (!parentId && data?.root) {
        // Initial deep load
        const rootId = `root-${Date.now()}`;
        const initialCollapsed = new Set();

        // COLLAPSE BY DEFAULT: Root and Level-1
        initialCollapsed.add(rootId);

        const rootNode = {
          id: rootId,
          type: 'custom',
          data: {
            label: data.root.label || topic,
            desc: data.root.desc || '',
            isRoot: true,
            level: 0,
            onToggleChildren: toggleChildren,
            childCount: data.children?.length || 0
          },
          position: { x: 0, y: 0 },
        };
        nodesToAdd.push(rootNode);

        if (Array.isArray(data.children)) {
          data.children.forEach((l1, i) => {
            const l1Id = `l1-${i}-${Date.now()}`;
            initialCollapsed.add(l1Id);

            nodesToAdd.push({
              id: l1Id,
              type: 'custom',
              data: {
                label: l1.label || 'Category',
                desc: l1.desc || '',
                level: 1,
                childCount: l1.children?.length || 0,
                onToggleChildren: toggleChildren
              },
              position: { x: 0, y: 0 }
            });
            edgesToAdd.push({
              id: `e-${rootId}-${l1Id}`,
              source: rootId,
              target: l1Id,
              type: 'smoothstep',
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
            });

            if (Array.isArray(l1.children)) {
              l1.children.forEach((l2, j) => {
                const l2Id = `l2-${i}-${j}-${Date.now()}`;
                nodesToAdd.push({
                  id: l2Id,
                  type: 'custom',
                  data: {
                    label: l2.label || 'Sub-category',
                    desc: l2.desc || '',
                    level: 2,
                    onToggleChildren: toggleChildren
                  },
                  position: { x: 0, y: 0 }
                });
                edgesToAdd.push({
                  id: `e-${l1Id}-${l2Id}`,
                  source: l1Id,
                  target: l2Id,
                  type: 'smoothstep',
                  animated: true,
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
                });
              });
            }
          });
        }
        setCollapsedNodes(prev => new Set([...prev, ...initialCollapsed]));
      } else if (data?.nodes) {
        // Recursive expansion (2 levels deep)
        const parentNode = nodes.find(n => n.id === parentId);
        const parentLevel = parentNode?.data?.level || 0;
        const parentPos = parentNode?.position || { x: 0, y: 0 };

        data.nodes.forEach(n => {
          const l1Id = `${n.id}-${Math.random().toString(36).substr(2, 9)}`;

          nodesToAdd.push({
            id: l1Id,
            type: 'custom',
            data: {
              label: n.label || 'Topic',
              desc: n.desc || '',
              level: parentLevel + 1,
              onToggleChildren: toggleChildren,
              childCount: n.children?.length || 0
            },
            position: { x: parentPos.x, y: parentPos.y }, // Spawn exactly at parent for outward expansion
          });

          edgesToAdd.push({
            id: `e-${parentId}-${l1Id}`,
            source: parentId,
            target: l1Id,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
          });

          // Handle Level 2 Children if they exist
          if (Array.isArray(n.children)) {
            n.children.forEach(c => {
              const l2Id = `${c.id}-${Math.random().toString(36).substr(2, 9)}`;
              nodesToAdd.push({
                id: l2Id,
                type: 'custom',
                data: {
                  label: c.label || 'Detail',
                  desc: c.desc || '',
                  level: parentLevel + 2,
                  onToggleChildren: toggleChildren
                },
                position: { x: parentPos.x, y: parentPos.y }, // Nested offset spawns exactly at parent
              });
              edgesToAdd.push({
                id: `e-${l1Id}-${l2Id}`,
                source: l1Id,
                target: l2Id,
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#1DCD9F' }
              });
            });
          }
        });

        // Ensure the expanded parent is not collapsed
        setCollapsedNodes(prev => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }

      const allNodes = [...nodes, ...nodesToAdd];
      const allEdges = [...edges, ...edgesToAdd];

      const tempCollapsed = new Set(collapsedNodes);
      if (!parentId && data?.root) {
        const rootId = nodesToAdd[0]?.id;
        if (rootId) tempCollapsed.add(rootId);
        nodesToAdd.filter(n => n.id.startsWith('l1')).forEach(n => tempCollapsed.add(n.id));
      } else if (parentId) {
        tempCollapsed.delete(parentId);
      }

      const nextHiddenIds = getHiddenIds(tempCollapsed, allEdges);
      const { nodes: layoutedNodes } = getLayoutedElements(allNodes, allEdges, nextHiddenIds);

      // UPDATE childCount on parent and set final positions
      const finalNodes = layoutedNodes.map(n => {
        if (parentId && n.id === parentId) {
          return {
            ...n,
            data: {
              ...n.data,
              childCount: (n.data.childCount || 0) + data.nodes.length
            }
          };
        }
        return n;
      });

      setCollapsedNodes(tempCollapsed);
      setNodes(finalNodes);
      setEdges(allEdges);
      localStorage.setItem('ai_graph_memory', JSON.stringify({ nodes: finalNodes, edges: allEdges }));

      // Smooth camera shift to frame the parent and newly expanded children
      setTimeout(() => {
        if (parentId) {
          const nodesToFrame = [{ id: parentId }, ...nodesToAdd.map(n => ({ id: n.id }))];
          fitView({ nodes: nodesToFrame, duration: 800, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        } else {
          // Frame main cluster on root generation
          const nodesToFrame = nodesToAdd.map(n => ({ id: n.id }));
          fitView({ nodes: nodesToFrame, duration: 800, padding: 0.25, maxZoom: 0.9, minZoom: 0.15 });
        }
      }, 150); // slight delay to ensure React Flow has mounted the new coordinates

    } catch (error) {
      console.error("Expansion error:", error);
    } finally {
      setLoading(false);
      if (!parentId) setInput('');
    }
  }, [nodes, edges, setNodes, setEdges, toggleChildren, collapsedNodes]);

  const visibleNodes = useMemo(() => {
    // If there's a focused node, calculate its ancestors and descendants
    const connectedIds = new Set();
    if (focusedNodeId) {
      connectedIds.add(focusedNodeId);
      // Find descendants
      const getDescendants = (id) => {
        edges.forEach(e => {
          if (e.source === id && !connectedIds.has(e.target)) {
            connectedIds.add(e.target);
            getDescendants(e.target);
          }
        });
      };
      // Find ancestors
      const getAncestors = (id) => {
        edges.forEach(e => {
          if (e.target === id && !connectedIds.has(e.source)) {
            connectedIds.add(e.source);
            getAncestors(e.source);
          }
        });
      };
      getDescendants(focusedNodeId);
      getAncestors(focusedNodeId);
    }

    return nodes.map(node => {
      const isHidden = hiddenIds.has(node.id);
      const isDimmed = focusedNodeId && !connectedIds.has(node.id);
      const isActive = node.id === focusedNodeId;
      const isConnected = focusedNodeId && connectedIds.has(node.id) && !isActive;

      let zIndex = 1;
      if (isActive) zIndex = 1000;
      else if (isConnected) zIndex = 500;

      let cls = node.className || '';
      if (isDimmed) cls += ' dimmed';
      if (isActive) cls += ' active-node';
      if (isConnected) cls += ' connected-node';

      return {
        ...node,
        hidden: isHidden,
        zIndex: zIndex,
        className: cls.trim(),
        data: {
          ...node.data,
          isCollapsed: collapsedNodes.has(node.id),
          onToggleChildren: toggleChildren,
          onExpand: onExpand
        }
      };
    });
  }, [nodes, hiddenIds, collapsedNodes, toggleChildren, onExpand, focusedNodeId, edges]);

  const visibleEdges = useMemo(() => {
    // Same connection logic for edges
    const connectedIds = new Set();
    if (focusedNodeId) {
      connectedIds.add(focusedNodeId);
      const getDescendants = (id) => {
        edges.forEach(e => {
          if (e.source === id && !connectedIds.has(e.target)) {
            connectedIds.add(e.target);
            getDescendants(e.target);
          }
        });
      };
      const getAncestors = (id) => {
        edges.forEach(e => {
          if (e.target === id && !connectedIds.has(e.source)) {
            connectedIds.add(e.source);
            getAncestors(e.source);
          }
        });
      };
      getDescendants(focusedNodeId);
      getAncestors(focusedNodeId);
    }

    return edges.map(edge => {
      const isHidden = hiddenIds.has(edge.target) || hiddenIds.has(edge.source);
      const isDimmed = focusedNodeId && (!connectedIds.has(edge.source) || !connectedIds.has(edge.target));

      return {
        ...edge,
        hidden: isHidden,
        className: isDimmed ? 'dimmed-edge' : ''
      };
    });
  }, [edges, hiddenIds, focusedNodeId]);

  const clearGraph = useCallback(() => {
    if (window.confirm("Clear all nodes?")) {
      setNodes([]);
      setEdges([]);
      localStorage.removeItem('ai_graph_memory');
      setCollapsedNodes(new Set());
    }
  }, [setNodes, setEdges]);

  const triggerLayout = useCallback(() => {
    const { nodes: lNodes } = getLayoutedElements(nodes, edges, hiddenIds);
    setNodes(lNodes);
  }, [nodes, edges, hiddenIds, setNodes]);

  const clearMemory = useCallback(() => {
    if (window.confirm("This will clear the saved memory and reload. Continue?")) {
      localStorage.removeItem('ai_graph_memory');
      setNodes([]);
      setEdges([]);
      setCollapsedNodes(new Set());
    }
  }, [setNodes, setEdges, setCollapsedNodes]);

  // Context Menu Handlers
  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
        node: node,
      });
    },
    [setContextMenu]
  );

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setFocusedNodeId(null);
  }, [setContextMenu, setFocusedNodeId]);

  const onNodeClick = useCallback((event, node) => {
    setFocusedNodeId(node.id);
    setCenter(node.position.x, node.position.y, { duration: 400, zoom: 1 });
  }, [setCenter]);

  const handleContextMenuAction = useCallback((action) => {
    if (!contextMenu) return;
    const { id, node } = contextMenu;

    if (action === 'expand') {
      onExpand(node.data.label, id);
    } else if (action === 'explain') {
      alert(`Explanation for: ${node.data.label}\n\n${node.data.desc}\n\n(Future: Opens in dedicated side-chat)`);
    } else if (action === 'edit') {
      const newLabel = prompt("Edit node label:", node.data.label);
      if (newLabel && newLabel.trim() !== '') {
        setNodes(nds => nds.map(n => {
          if (n.id === id) {
            n.data = { ...n.data, label: newLabel };
          }
          return n;
        }));
      }
    } else if (action === 'link') {
      alert("Attach external links logic will go here.");
    } else if (action === 'delete') {
      // Recursive delete
      const idsToDelete = new Set([id]);
      const checkChildren = (parentId) => {
        edges.forEach(e => {
          if (e.source === parentId) {
            idsToDelete.add(e.target);
            checkChildren(e.target);
          }
        });
      };
      checkChildren(id);

      setNodes(nds => nds.filter(n => !idsToDelete.has(n.id)));
      setEdges(eds => eds.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)));
      setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 100);
    }
    setContextMenu(null);
  }, [contextMenu, edges, onExpand, setNodes, setEdges, fitView]);

  return (
    <div className="app-container">
      {nodes.length > 0 && <div className="header-hover-zone" />}
      <header className={`glass-header ${nodes.length > 0 ? 'graph-active' : ''}`}>
        <div className="logo">
          <Cpu size={24} className="icon-glow" />
          <span>GEN-AI Graph Explorer</span>
        </div>

        <div className="search-box">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Explore a topic (e.g. LLM Architecture)..."
            onKeyDown={(e) => e.key === 'Enter' && onExpand(input)}
          />
          <button onClick={() => onExpand(input)} disabled={loading}>
            {loading ? <RefreshCcw className="spinning" /> : <Send size={18} />}
          </button>
        </div>

        <div className="actions">
          <button className="btn-icon" onClick={triggerLayout} title="Rearrange Layout">
            <Layout size={18} />
          </button>
          <button className="btn-icon" onClick={clearMemory} title="Reset App Memory">
            <RefreshCcw size={18} />
          </button>
          <button className="btn-icon btn-danger" onClick={clearGraph} title="Clear Current Graph">
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodesDraggable={true}
        nodesConnectable={false}
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.25, duration: 800, minZoom: 0.15, maxZoom: 0.9 }}
        onNodeDragStop={() => {
          localStorage.setItem('ai_graph_memory', JSON.stringify({ nodes, edges }));
        }}
      >
        <Background color="#222222" variant="dots" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => n.hidden ? 'transparent' : '#1DCD9F'}
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.top, left: contextMenu.left }}
        >
          <button onClick={() => handleContextMenuAction('expand')}>Expand Nodes</button>
          <button onClick={() => handleContextMenuAction('explain')}>Explain in Detail</button>
          <button onClick={() => handleContextMenuAction('edit')}>Edit Label</button>
          <button onClick={() => handleContextMenuAction('link')}>Link Resource</button>
          <button onClick={() => handleContextMenuAction('delete')} className="delete-action">Delete Branch</button>
        </div>
      )}

      {loading && (
        <div className="loader-container">
          <div className="loader-overlay">
            <Zap className="spinning" size={16} />
            <span>Generating 2-Level Deep Graph...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GraphExplorer({ defaultTopic, defaultSubjectId }) {
  return (
    <ReactFlowProvider>
      <GraphExplorerInner defaultTopic={defaultTopic} defaultSubjectId={defaultSubjectId} />
    </ReactFlowProvider>
  );
}
```

## File: `Frontend\src\components\graph\layoutEngine.js`

```js
import dagre from 'dagre';

export const getLayoutedElements = (nodes, edges, hiddenIds = new Set(), direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 200, // Horizontal gap between parent and child
        nodesep: 150, // Vertical gap between sibling nodes (increased to prevent overlap)
        marginx: 100,
        marginy: 100,
    });

    const visibleNodes = nodes.filter(n => !hiddenIds.has(n.id));
    const visibleEdges = edges.filter(e => !hiddenIds.has(e.source) && !hiddenIds.has(e.target));

    visibleNodes.forEach((node) => {
        const level = node.data?.level || 0;
        const label = node.data?.label || '';

        // Estimate how many lines the label wraps to, based on approximate chars-per-line at each level's width
        const charsPerLine = level === 0 ? 22 : level === 1 ? 18 : level === 2 ? 16 : 14;
        const labelLines = Math.max(1, Math.ceil(label.length / charsPerLine));
        const lineHeight = 20; // approximate rendered line-height in px
        const labelHeight = labelLines * lineHeight;

        // Match dagre dimensions to CSS max-widths and dynamically compute height
        let width, height;

        if (level === 0) {
            width = 350;   // CSS max-width for .node-level-0
            height = Math.max(140, 60 + labelHeight);
        } else if (level === 1) {
            width = 300;   // CSS max-width for .node-level-1
            height = Math.max(130, 55 + labelHeight);
        } else if (level === 2) {
            width = 260;   // CSS max-width for .node-level-2
            height = Math.max(120, 50 + labelHeight);
        } else {
            width = 220;   // CSS max-width for .node-level-3+
            height = Math.max(100, 45 + labelHeight);
        }

        dagreGraph.setNode(node.id, { width, height });
    });

    visibleEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    // Map to find parents quickly for hidden nodes
    const parentMap = {};
    edges.forEach(e => { parentMap[e.target] = e.source; });

    const layoutedNodes = nodes.map((node) => {
        if (!hiddenIds.has(node.id)) {
            // Visible node -> Get absolute center position from Dagre
            const nodeWithPosition = dagreGraph.node(node.id);

            return {
                ...node,
                targetPosition: 'left',
                sourcePosition: 'right',
                position: {
                    x: nodeWithPosition.x - (nodeWithPosition.width / 2),
                    y: nodeWithPosition.y - (nodeWithPosition.height / 2),
                },
            };
        } else {
            // Hidden node -> Snap to nearest visible ancestor's center position
            let ancestorId = parentMap[node.id];
            let ancestorPos = { x: 0, y: 0 };

            // Traverse up until we find a visible node or run out
            while (ancestorId) {
                if (!hiddenIds.has(ancestorId)) {
                    const nodeWithPosition = dagreGraph.node(ancestorId);
                    if (nodeWithPosition) {
                        ancestorPos = {
                            x: nodeWithPosition.x - (nodeWithPosition.width / 2),
                            y: nodeWithPosition.y - (nodeWithPosition.height / 2)
                        };
                    }
                    break;
                }
                ancestorId = parentMap[ancestorId];
            }

            return {
                ...node,
                position: ancestorPos
            };
        }
    });

    return { nodes: layoutedNodes, edges };
};
```

## File: `Frontend\src\components\graph\llmService.js`

```js
import { apiFetch } from '../../api/client';

export const getAIResponse = async (topic, pathContext = "") => {
  const isInitial = !pathContext;
  try {
    const data = await apiFetch('/api/graph/generate', {
      method: 'POST',
      body: { topic, pathContext }
    });


    return data;
  } catch (error) {
    console.error("LLM Service Error:", error);
    return isInitial ? { root: { id: 'root', label: topic, desc: 'Error generating graph' }, children: [] } : { nodes: [] };
  }
};
```

## File: `Frontend\src\components\quiz\AIQuizGenerator.jsx`

```jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuiz } from '../../context/QuizContext';
import { apiFetch } from '../../api/client';
import { Sparkles, Loader2, AlertCircle, Bot, CheckCircle, Wifi, WifiOff } from 'lucide-react';

const AIQuizGenerator = () => {
    const [topic, setTopic] = useState('');
    const [count, setCount] = useState(5);
    const [quizMode, setQuizMode] = useState('mixed');
    const [difficulty, setDifficulty] = useState('adaptive');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const { addQuiz, ollamaStatus, ollamaModel } = useQuiz();

    const generateQuiz = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        setError(null);
        setSuccess(null);

        try {
            // Call backend API (same pattern as CaseStudy-1 but through server)
            const result = await apiFetch('/api/ai/generate', {
                method: 'POST',
                body: {
                    topic: topic.trim(),
                    count,
                    mode: quizMode,
                    difficulty,
                    saveToBank: true
                }
            });

            // Show success with item count
            const itemCount = result.itemCount || result.items?.length || 0;
            setSuccess(`✓ Generated ${itemCount} questions on "${topic}" and saved to your quiz bank!`);
            addQuiz(); // triggers refetch from backend
            setTopic('');
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            console.error('AI Generation Error:', err);

            // Try direct Ollama call as fallback (CaseStudy-1 approach)
            try {
                const ollamaResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/ai/ollama-proxy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: ollamaModel || 'deepseek-r1',
                        messages: [{
                            role: 'user',
                            content: `Generate ${count} MCQ questions about "${topic.trim()}". 
                            Return EXACTLY this JSON structure:
                            {
                              "items": [
                                {
                                  "question": "String",
                                  "options": ["Op1", "Op2", "Op3", "Op4"],
                                  "correctIndex": Number(0-3),
                                  "difficulty": "easy|medium|hard",
                                  "explanation": "String",
                                  "hint": "String"
                                }
                              ]
                            }
                            Respond ONLY with valid JSON.`
                        }],
                        stream: false
                    })
                });

                if (ollamaResponse.ok) {
                    const data = await ollamaResponse.json();
                    const rawContent = data.message?.content || '';
                    const cleaned = rawContent.replace(/```json|```/g, '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
                    const parsed = JSON.parse(cleaned);

                    if (parsed.items && parsed.items.length > 0) {
                        // Save to backend
                        try {
                            await apiFetch('/api/ai/generate', {
                                method: 'POST',
                                body: { topic: topic.trim(), count, saveToBank: true }
                            });
                        } catch { /* backend save may fail but quiz was generated */ }

                        setSuccess(`✓ Generated ${parsed.items.length} questions via direct AI call! Refresh to see them.`);
                        addQuiz();
                        setTopic('');
                        setTimeout(() => setSuccess(null), 5000);
                        return;
                    }
                }
                throw new Error('Direct Ollama call also failed');
            } catch (fallbackErr) {
                setError(
                    `Generation failed. Troubleshooting:\n` +
                    `1. Make sure Ollama is running: $env:OLLAMA_ORIGINS="*"; ollama serve\n` +
                    `2. Pull the model: ollama pull ${ollamaModel || 'deepseek-r1'}\n` +
                    `3. Make sure the backend server is running on port 4000`
                );
            }
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4"
        >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                {/* Top accent bar — color indicates Ollama status */}
                <div className={`h-1 ${
                    ollamaStatus === 'connected' 
                        ? 'bg-emerald-500' 
                        : ollamaStatus === 'error' 
                            ? 'bg-red-500' 
                            : 'bg-amber-500'
                }`} />

                <div className="p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-adiptify-gold" size={20} />
                            <h3 className="text-lg font-bold text-adiptify-navy dark:text-white">AI Quiz Generator</h3>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 border ${
                            ollamaStatus === 'connected'
                                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
                                : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                        }`}>
                            {ollamaStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {ollamaStatus === 'connected' ? ollamaModel : 'Ollama Offline'}
                        </span>
                    </div>

                    {/* Ollama offline warning */}
                    {ollamaStatus === 'error' && (
                        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">⚠ Ollama not detected</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                1. Open PowerShell → run: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">$env:OLLAMA_ORIGINS="*"; ollama serve</code><br/>
                                2. In another terminal → run: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">ollama pull deepseek-r1</code>
                            </p>
                        </div>
                    )}

                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                        Enter a topic to generate a <strong>{count}-question</strong> AI quiz using <strong>{ollamaModel || 'AI'}</strong>, saved to the question bank.
                    </p>

                    {/* Input row */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="e.g. History of Rome, Python Basics, Neural Networks..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={isGenerating}
                            onKeyDown={(e) => e.key === 'Enter' && generateQuiz()}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 focus:border-adiptify-gold transition-all disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800"
                        />
                        <select
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                            disabled={isGenerating}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 disabled:opacity-50"
                        >
                            <option value={3}>3 Q</option>
                            <option value={5}>5 Q</option>
                            <option value={10}>10 Q</option>
                        </select>
                        <select
                            value={quizMode}
                            onChange={(e) => setQuizMode(e.target.value)}
                            disabled={isGenerating}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 disabled:opacity-50"
                        >
                            <option value="mixed">Mixed</option>
                            <option value="mcq">MCQ</option>
                            <option value="short_answer">Short</option>
                        </select>
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            disabled={isGenerating}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 disabled:opacity-50"
                        >
                            <option value="adaptive">Adaptive</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                        <button
                            onClick={generateQuiz}
                            disabled={isGenerating || !topic.trim()}
                            className="px-5 py-2.5 bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </button>
                    </div>

                    {/* Generating indicator */}
                    {isGenerating && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
                            <p className="text-xs text-blue-700 dark:text-blue-400">Generating questions with AI... This may take 15-60 seconds depending on your model.</p>
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2">
                            <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{success}</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-700 dark:text-red-400 whitespace-pre-line">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default AIQuizGenerator;
```

## File: `Frontend\src\components\quiz\AITutor.jsx`

```jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuiz } from '../../context/QuizContext';
import { Bot, X, Send, Loader2, Brain, ChevronDown, ChevronRight, StopCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Simple inline markdown for chat bubbles
function renderInline(text) {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, i) => {
        // Code block fence — skip
        if (line.trim().startsWith('```')) return null;
        // Bold + code spans
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        const rendered = parts.map((p, j) => {
            if (p.startsWith('**') && p.endsWith('**')) return <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>;
            if (p.startsWith('`') && p.endsWith('`')) return <code key={j} className="bg-adiptify-navy/10 dark:bg-adiptify-gold/10 px-1 rounded text-[11px] font-mono text-adiptify-terracotta dark:text-adiptify-gold">{p.slice(1, -1)}</code>;
            return p;
        });
        return <React.Fragment key={i}>{rendered}{i < lines.length - 1 && <br />}</React.Fragment>;
    });
}

const AITutor = () => {
    const { user, ollamaStatus, ollamaModel } = useQuiz();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([
        { sender: 'ai', content: 'Hello! I\'m your AI Study Tutor. Ask me anything!' }
    ]);
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef(null);
    const abortRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    const handleStop = () => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setIsStreaming(false);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        let sessionId = activeSessionId;

        // Create session if needed
        if (!sessionId) {
            try {
                const session = await apiFetch('/api/chat/sessions', {
                    method: 'POST',
                    body: { title: input.substring(0, 30) }
                });
                sessionId = session._id;
                setActiveSessionId(sessionId);
            } catch (err) {
                console.error("Failed to create session", err);
                setMessages(prev => [...prev, { sender: 'ai', content: '⚠️ Could not create chat session. Is the backend running?' }]);
                return;
            }
        }

        const userMessage = { sender: 'user', content: input };
        const aiPlaceholder = { sender: 'ai', content: '', thinking: '', isStreaming: true };

        setMessages(prev => [...prev, userMessage, aiPlaceholder]);
        setInput('');
        setIsStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const token = localStorage.getItem('adiptify_token');
            const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ message: userMessage.content }),
                signal: controller.signal,
            });

            if (!response.ok) throw new Error(`Server: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accThinking = '';
            let accContent = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') continue;

                    try {
                        const event = JSON.parse(payload);
                        if (event.error) throw new Error(event.error);
                        if (event.thinking) accThinking += event.thinking;
                        if (event.content) accContent += event.content;

                        setMessages(prev => {
                            const updated = [...prev];
                            const last = updated.length - 1;
                            if (last >= 0 && updated[last].isStreaming) {
                                updated[last] = { ...updated[last], thinking: accThinking, content: accContent };
                            }
                            return updated;
                        });
                        scrollToBottom();
                    } catch { /* skip parse errors */ }
                }
            }

            // Finalize
            setMessages(prev => {
                const updated = [...prev];
                const last = updated.length - 1;
                if (last >= 0 && updated[last].isStreaming) {
                    updated[last] = { ...updated[last], isStreaming: false, content: accContent || 'No response.' };
                }
                return updated;
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated.length - 1;
                    if (last >= 0 && updated[last].isStreaming) {
                        updated[last] = { ...updated[last], isStreaming: false, content: updated[last].content || '⏹ Stopped.' };
                    }
                    return updated;
                });
            } else {
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated.length - 1;
                    if (last >= 0 && updated[last].isStreaming) {
                        updated[last] = { sender: 'ai', content: `⚠️ ${err.message}`, isStreaming: false };
                    }
                    return updated;
                });
            }
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    };

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    className="fixed bottom-5 right-5 z-50"
                >
                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-adiptify-navy to-[#1e2d45] dark:from-adiptify-gold dark:to-adiptify-terracotta text-white dark:text-adiptify-navy shadow-xl hover:shadow-2xl flex items-center justify-center transition-all relative group"
                    >
                        <img src="/favicon.png" alt="Adiptify AI" className="w-8 h-8 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                        {/* Status dot */}
                        <span className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${ollamaStatus === 'connected' ? 'bg-adiptify-olive' : 'bg-adiptify-terracotta'}`} />
                    </button>
                </motion.div>
            )}

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed bottom-5 right-5 z-[60] w-[400px] max-w-[92vw]"
                    >
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden flex flex-col h-[540px]">
                            {/* Header — Adiptify branded */}
                            <div className="bg-gradient-to-r from-adiptify-navy to-[#1e2d45] dark:from-slate-900 dark:to-slate-800 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 flex items-center justify-center">
                                        <img src="/favicon.png" alt="Adiptify" className="w-8 h-8 object-contain drop-shadow-md" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold leading-tight">AI Study Tutor</p>
                                        <p className="text-[10px] text-white/50 flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${ollamaStatus === 'connected' ? 'bg-adiptify-olive animate-pulse' : 'bg-adiptify-terracotta'}`} />
                                            {ollamaStatus === 'connected' ? `${ollamaModel} · Online` : 'Offline'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        handleStop();
                                    }}
                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
                                {messages.map((m, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className="max-w-[88%]">
                                            {/* Thinking indicator */}
                                            {m.sender === 'ai' && m.thinking && (
                                                <div className="mb-1 flex items-center gap-1 text-[10px] text-adiptify-olive dark:text-adiptify-olive">
                                                    {m.isStreaming && !m.content ? (
                                                        <Loader2 size={10} className="animate-spin" />
                                                    ) : (
                                                        <Brain size={10} />
                                                    )}
                                                    <span className="italic truncate max-w-[180px]">
                                                        {m.isStreaming && !m.content ? 'Thinking...' : 'Reasoned through this'}
                                                    </span>
                                                </div>
                                            )}

                                            <div className={`px-3.5 py-2.5 text-[13px] leading-relaxed ${m.sender === 'user'
                                                ? 'bg-gradient-to-br from-adiptify-navy to-[#1e2d45] text-white rounded-2xl rounded-br-md shadow-sm'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl rounded-bl-md shadow-sm border border-slate-100 dark:border-slate-700'
                                            }`}>
                                                {m.sender === 'ai' ? (
                                                    m.content ? renderInline(m.content) : (
                                                        m.isStreaming ? (
                                                            <div className="flex items-center gap-2">
                                                                <Loader2 size={14} className="animate-spin text-adiptify-gold" />
                                                                <span className="text-xs text-slate-400">{m.thinking ? 'Thinking...' : 'Connecting...'}</span>
                                                            </div>
                                                        ) : null
                                                    )
                                                ) : m.content}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input — polished with brand colors */}
                            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 flex-shrink-0">
                                <input
                                    type="text"
                                    placeholder="Ask a question..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={isStreaming}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/40 focus:border-adiptify-gold transition-all disabled:opacity-50 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                                {isStreaming ? (
                                    <button
                                        type="button"
                                        onClick={handleStop}
                                        className="w-10 h-10 rounded-xl bg-adiptify-terracotta text-white flex items-center justify-center hover:bg-adiptify-terracotta/90 transition-all flex-shrink-0"
                                    >
                                        <StopCircle size={16} />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-adiptify-navy to-[#1e2d45] dark:from-adiptify-gold dark:to-adiptify-terracotta text-white dark:text-adiptify-navy flex items-center justify-center hover:shadow-md transition-all disabled:opacity-30 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:from-slate-200 disabled:to-slate-200 flex-shrink-0"
                                    >
                                        <Send size={16} />
                                    </button>
                                )}
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AITutor;
```

## File: `Frontend\src\context\AdaptifyContext.jsx`

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AdaptifyContext = createContext();

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '') + '/api';

// Helper: get auth headers
function getAuthHeaders() {
    try {
        const token = localStorage.getItem('adiptify_token');
        if (token) {
            return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        }
    } catch (e) { /* ignore */ }
    return { 'Content-Type': 'application/json' };
}

export const AdaptifyProvider = ({ children }) => {
    const [concepts, setConcepts] = useState([]);
    const [userProgress, setUserProgress] = useState({});
    const [dueReviews, setDueReviews] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generateStatus, setGenerateStatus] = useState(null);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [experimentHistory, setExperimentHistory] = useState([]);

    // Fetch enrolled subjects
    const fetchEnrolledSubjects = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/subjects/enrolled`, { headers: getAuthHeaders() });
            if (res.ok) {
                const subjects = await res.json();
                setEnrolledSubjects(subjects);
                return subjects;
            }
        } catch (e) { /* offline */ }
        return [];
    }, []);

    // Fetch concepts filtered by enrolled subjects + user progress
    const fetchConcepts = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/adaptive/concepts?enrolled=true`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setConcepts(data.concepts || []);
                setUserProgress(data.progress || {});
                return data.concepts || [];
            }
        } catch (e) {
            console.warn("[AdaptifyContext] Failed to fetch concepts:", e.message);
        }
        setConcepts([]);
        setUserProgress({});
        return [];
    }, []);

    // Generate AI modules for all enrolled subjects
    const generateModules = useCallback(async () => {
        setGenerating(true);
        setGenerateStatus('Generating AI study modules for your subjects...');
        try {
            const res = await fetch(`${API_BASE}/adaptive/generate`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setGenerateStatus(`Generated ${data.generated} new concepts across ${data.subjects?.length || 0} subjects!`);
                // Refresh concepts after generation
                await fetchConcepts();
                return data;
            } else {
                const err = await res.json();
                setGenerateStatus(`Error: ${err.error || 'Failed to generate'}`);
            }
        } catch (e) {
            setGenerateStatus(`Error: ${e.message}`);
        } finally {
            setGenerating(false);
        }
        return null;
    }, [fetchConcepts]);

    // Fetch due reviews
    const fetchDueReviews = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/sr/due`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setDueReviews(data.due || []);
            }
        } catch (e) { /* ignore */ }
    }, []);

    // Fetch analytics
    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/analytics/dashboard`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
                return data;
            }
        } catch (e) { 
            console.error("[AdaptifyContext] Analytics fetch failed:", e);
        }
        return null;
    }, []);

    // Submit performance
    const submitPerformance = useCallback(async (conceptId, performanceData) => {
        try {
            const res = await fetch(`${API_BASE}/adaptive/submit`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ conceptId, ...performanceData }),
            });
            if (res.ok) {
                const data = await res.json();
                setUserProgress(prev => ({ ...prev, [conceptId]: data }));
                return data;
            }
        } catch (e) { /* ignore */ }
        return { ok: false };
    }, []);

    // Submit review
    const submitReview = useCallback(async (conceptId, quality) => {
        try {
            const res = await fetch(`${API_BASE}/sr/review`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ conceptId, quality }),
            });
            if (res.ok) {
                const data = await res.json();
                await fetchDueReviews();
                return data;
            }
        } catch (e) { /* ignore */ }
        return { ok: false };
    }, [fetchDueReviews]);

    // Get concept by ID
    const getConceptById = useCallback((conceptId) => {
        return concepts.find(c => c.conceptId === conceptId) || null;
    }, [concepts]);

    // Fetch experiment history
    const fetchExperimentHistory = useCallback(async (type) => {
        try {
            const url = type ? `${API_BASE}/experiments/history?type=${type}` : `${API_BASE}/experiments/history`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setExperimentHistory(data.results || []);
                return data.results;
            }
        } catch (e) { /* ignore */ }
        return [];
    }, []);

    // Save experiment result
    const saveExperimentResult = useCallback(async (experimentData) => {
        try {
            const res = await fetch(`${API_BASE}/experiments/save`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(experimentData),
            });
            if (res.ok) {
                await fetchExperimentHistory(experimentData.experimentType);
                return await res.json();
            }
        } catch (e) { /* ignore */ }
        return { ok: false };
    }, [fetchExperimentHistory]);

    // Initialize on mount
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await fetchEnrolledSubjects();
            await fetchConcepts();
            setLoading(false);
        };
        init();
    }, [fetchEnrolledSubjects, fetchConcepts]);

    // Fetch dependent data after initial load
    useEffect(() => {
        if (!loading) {
            fetchDueReviews();
            fetchAnalytics();
        }
    }, [loading, fetchDueReviews, fetchAnalytics]);

    return (
        <AdaptifyContext.Provider value={{
            concepts,
            userProgress,
            dueReviews,
            analytics,
            loading,
            generating,
            generateStatus,
            enrolledSubjects,
            experimentHistory,
            submitPerformance,
            submitReview,
            fetchDueReviews,
            fetchAnalytics,
            fetchConcepts,
            fetchEnrolledSubjects,
            fetchExperimentHistory,
            saveExperimentResult,
            getConceptById,
            generateModules,
        }}>
            {children}
        </AdaptifyContext.Provider>
    );
};

export const useAdaptify = () => useContext(AdaptifyContext);

export default AdaptifyContext;
```

## File: `Frontend\src\context\QuizContext.jsx`

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

const QuizContext = createContext();

export const QuizProvider = ({ children }) => {
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [ollamaStatus, setOllamaStatus] = useState('checking');
    const [ollamaModel, setOllamaModel] = useState('deepseek-r1');

    // Fetch enrolled subjects from backend
    useEffect(() => {
        const fetchEnrolled = async () => {
            try {
                const subjects = await apiFetch('/api/subjects/enrolled');
                setEnrolledSubjects(subjects);
            } catch (e) { /* ignore — offline mode */ }
        };
        fetchEnrolled();
    }, []);

    // Check Ollama connectivity (matching CaseStudy-1 approach)
    useEffect(() => {
        const checkOllama = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/ai/ollama-status`);
                if (response.ok) {
                    const data = await response.json();
                    setOllamaStatus('connected');
                    // Pick the first available model or use env default
                    if (data.models && data.models.length > 0) {
                        setOllamaModel(data.models[0].name);
                    }
                } else {
                    setOllamaStatus('error');
                }
            } catch {
                setOllamaStatus('error');
            }
        };
        checkOllama();
        // Re-check every 30s
        const interval = setInterval(checkOllama, 30000);
        return () => clearInterval(interval);
    }, []);

    const [categories, setCategories] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('adiptify_user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    // Fetch initial quizzes from Backend
    const fetchQuizzes = useCallback(async () => {
        try {
            const data = await apiFetch('/api/ai/generated');
            // Map backend generated assessments to frontend quiz shape
            const formattedQuizzes = data.map(assessment => {
                return {
                    id: assessment._id,
                    title: assessment.title || assessment.topic,
                    topic: assessment.topic,
                    description: `AI Generated Quiz on ${assessment.topic}`,
                    duration: Math.max(2, (assessment.items?.length || 3) * 2), // 2 mins per question
                    aiGenerated: true,
                    questions: (assessment.items || []).map((item, idx) => {
                        let correctIndex = 0;
                        if (typeof item.answer === 'number') {
                            correctIndex = item.answer;
                        } else if (typeof item.correctIndex === 'number') {
                            correctIndex = item.correctIndex;
                        } else if (typeof item.answer === 'string') {
                            correctIndex = (item.choices || item.options || []).indexOf(item.answer);
                            if (correctIndex === -1) correctIndex = 0;
                        }
                        return {
                            id: item._id || idx,
                            question: item.question,
                            options: item.choices || item.options || [],
                            correctAnswer: correctIndex,
                            explanation: item.explanation || '',
                            hint: item.hints?.[0] || item.hint || '',
                        };
                    }).filter(q => q.question && q.options.length > 0) // filter out broken items
                };
            }).filter(q => q.questions.length > 0); // filter out empty quizzes
            setQuizzes(formattedQuizzes);
        } catch (e) {
            console.error('Failed to load quizzes', e);
        }
    }, []);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const data = await apiFetch('/api/assessment/leaderboard');
            setLeaderboard(data || []);
        } catch (e) {
            console.error('Failed to load leaderboard', e);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const subjectsContent = await apiFetch('/api/subjects');
            if (subjectsContent) {
                const uniqueCategories = new Set();
                const processedCategories = [];
                subjectsContent.forEach(sub => {
                    const catName = sub.category?.name || sub.category || "General";
                    if (!uniqueCategories.has(catName)) {
                        uniqueCategories.add(catName);
                        processedCategories.push({ _id: catName, name: catName });
                    }
                });
                setCategories(processedCategories);
            }
        } catch (e) {
            console.error('Failed to load categories', e);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchQuizzes();
            fetchLeaderboard();
            fetchCategories();
        }
    }, [user, fetchQuizzes, fetchLeaderboard, fetchCategories]);

    // Show ALL quizzes — no aggressive filtering that hides AI-generated ones
    // The old filter was hiding quizzes when enrolled topics didn't match quiz titles
    const addQuiz = (newQuiz) => {
        fetchQuizzes(); // refetch from backend after a new one is saved
    };

    const login = (userData) => {
        setUser(userData);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('adiptify_user');
        localStorage.removeItem('adiptify_token');
    };

    const addScore = async (score, quizId = null, answers = {}) => {
        if (user) {
            try {
                await apiFetch('/api/assessment/simple-finish', {
                    method: 'POST',
                    body: { score, quizId, answers }
                });
                fetchLeaderboard();
            } catch (e) {
                console.error("Failed to save score", e);
            }
        }
    };

    const refreshSubjects = useCallback(async () => {
        try {
            const subjects = await apiFetch('/api/subjects/enrolled');
            setEnrolledSubjects(subjects);
        } catch (e) { /* ignore */ }
    }, []);

    return (
        <QuizContext.Provider value={{
            user, login, logout,
            leaderboard, addScore,
            quizzes,
            allQuizzes: quizzes,
            addQuiz,
            enrolledSubjects, refreshSubjects,
            fetchQuizzes,
            categories,
            ollamaStatus, ollamaModel,
        }}>
            {children}
        </QuizContext.Provider>
    );
};

export const useQuiz = () => useContext(QuizContext);
```

## File: `Frontend\src\context\ThemeContext.jsx`

```jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuiz } from './QuizContext';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const ThemeContext = createContext();

const STORAGE_KEY = 'adiptify_theme';

function getSystemTheme() {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved) {
    const root = document.documentElement;
    if (resolved === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
}

export const ThemeProvider = ({ children }) => {
    const { user } = useQuiz();

    // Initialize theme: backend preference → localStorage → 'system'
    const [theme, setThemeState] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && ['light', 'dark', 'system'].includes(stored)) return stored;
        } catch (e) { /* ignore */ }
        return 'system';
    });

    const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

    // Apply theme class to <html> on mount and on change
    useEffect(() => {
        applyTheme(resolvedTheme);
    }, [resolvedTheme]);

    // Listen for OS theme changes when in system mode
    useEffect(() => {
        if (theme !== 'system') return;
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => applyTheme(e.matches ? 'dark' : 'light');
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [theme]);

    // Sync theme to backend when user is logged in
    const setTheme = useCallback((newTheme) => {
        setThemeState(newTheme);
        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch (e) { /* ignore */ }

        // If user is logged in, persist to backend
        if (user?.token) {
            fetch(`${API_BASE}/api/user/preferences`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token || localStorage.getItem('adiptify_token')}`,
                },
                body: JSON.stringify({ themePreference: newTheme }),
            }).catch(() => { /* silent fail — localStorage is the fallback */ });
        }
    }, [user]);

    // Load preference from backend when user logs in
    useEffect(() => {
        if (!user?.token) return;
        fetch(`${API_BASE}/api/user/preferences`, {
            headers: { 'Authorization': `Bearer ${user.token || localStorage.getItem('adiptify_token')}` },
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.themePreference && ['light', 'dark', 'system'].includes(data.themePreference)) {
                    setThemeState(data.themePreference);
                    localStorage.setItem(STORAGE_KEY, data.themePreference);
                }
            })
            .catch(() => { /* silent fail */ });
    }, [user?.token]);

    // Toggle function for the UI button (cycles: system → dark → light → system)
    const toggleTheme = useCallback(() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }, [resolvedTheme, setTheme]);

    const muiTheme = useMemo(() => createTheme({
        palette: {
            mode: resolvedTheme,
            primary: {
                main: '#2D3C59',
                ...(resolvedTheme === 'dark' && { main: '#E5BA41' }),
            },
            secondary: {
                main: '#94A378',
            },
            background: {
                default: resolvedTheme === 'dark' ? '#0f172a' : '#f8fafc',
                paper: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff',
            }
        },
        typography: {
            fontFamily: "'Inter', 'Outfit', sans-serif"
        }
    }), [resolvedTheme]);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            <MuiThemeProvider theme={muiTheme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
```

## File: `Frontend\src\hooks\useEMA.js`

```js
import { useCallback } from 'react';

/**
 * Custom hook providing Exponential Moving Average logic and Smart Grading metrics
 */
export function useEMA(alpha = 0.3) {
    // alpha is the Weight. 0.3 means new scores account for 30%, past history 70%

    /**
     * Calculate new EMA mastery score
     * @param {number} currentScore The score of the most recent assessment (0-100)
     * @param {number} previousMastery The current EMA mastery score (0-100)
     * @returns {number} The updated mastery score, bounded 0-100
     */
    const calculateNewMastery = useCallback((currentScore, previousMastery) => {
        if (typeof previousMastery !== 'number') return currentScore;

        // EMA Formula: New_Mastery = (Current_Score * Weight) + (Previous_Mastery * (1 - Weight))
        const newMastery = (currentScore * alpha) + (previousMastery * (1 - alpha));

        // Ensure bounds and round to 1 decimal place
        return Math.min(100, Math.max(0, Math.round(newMastery * 10) / 10));
    }, [alpha]);

    /**
     * Determine the appropriate difficulty multiplier for the next question
     * @param {number} currentMastery The student's current mastery percentage
     * @returns {number} Difficulty scale from 0.6 to 1.4
     */
    const getDifficultyScale = useCallback((currentMastery) => {
        // Basic scaling logic:
        // If mastery is very low (<30), scale to 0.6 (easiest)
        // If mastery is very high (>90), scale to 1.4 (hardest)

        if (currentMastery < 30) return 0.6;
        if (currentMastery > 90) return 1.4;

        // Linear interpolation between 30 and 90, mapping to 0.7-1.3
        const normalized = (currentMastery - 30) / 60; // 0 to 1
        return parseFloat((0.7 + (normalized * 0.6)).toFixed(2));
    }, []);

    /**
     * Simple Levenshtein distance for fill-in-the-blanks fallback
     */
    const calculateLevenshteinSimilarity = useCallback((str1, str2) => {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return 1.0;
        if (s1.length === 0 || s2.length === 0) return 0.0;

        const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

        for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= s2.length; j++) {
            for (let i = 1; i <= s1.length; i++) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }

        const maxLen = Math.max(s1.length, s2.length);
        const distance = matrix[s2.length][s1.length];

        return 1 - (distance / maxLen);
    }, []);

    return {
        calculateNewMastery,
        getDifficultyScale,
        calculateLevenshteinSimilarity
    };
}
```

## File: `Frontend\src\hooks\useOllama.js`

```js
import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook to manage streaming chat with Ollama (DeepSeek-v3.1)
 */
export function useOllama() {
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const sendMessage = useCallback(async (content, contextPayload = null) => {
        try {
            setIsStreaming(true);
            setError(null);

            // Cancel previous request if still streaming
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            // System Prompt generation with adaptive context
            let systemPrompt = "You are Adiptify, an adaptive AI tutor. Provide concise, helpful answers.";

            if (contextPayload) {
                systemPrompt += `\n\nSTUDENT CONTEXT (ADAPT YOUR RESPONSE):`;
                systemPrompt += `\n- Mastery Score: ${contextPayload.mastery}%`;
                systemPrompt += `\n- Weakest Area: ${contextPayload.weakestModule}`;

                // Bloom's taxonomy adaptation
                if (contextPayload.mastery > 80) {
                    systemPrompt += `\n- Learning Level: Advanced (Focus on evaluation, creation, and deep synthesis. Use advanced terminology.)`;
                } else if (contextPayload.mastery > 50) {
                    systemPrompt += `\n- Learning Level: Intermediate (Focus on application and analysis. Use clear examples.)`;
                } else {
                    systemPrompt += `\n- Learning Level: Foundational (Focus on remembering and understanding. Use simple metaphors and step-by-step breakdowns.)`;
                }
            }

            const newMessages = [...messages, { role: 'user', content }];
            setMessages(newMessages);

            // Add a placeholder assistant message that we will stream into
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            // Format messages for Ollama API
            // Note: Adjusting model name assuming standard convention, user specified DeepSeek-v3.1 
            const apiMessages = [
                { role: 'system', content: systemPrompt },
                ...newMessages
            ];

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/ai/ollama-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-r1',
                    messages: apiMessages,
                    stream: true,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message && parsed.message.content) {
                            setMessages(prev => {
                                const updatedMessages = [...prev];
                                const lastMessage = updatedMessages[updatedMessages.length - 1];
                                if (lastMessage.role === 'assistant') {
                                    lastMessage.content += parsed.message.content;
                                }
                                return updatedMessages;
                            });
                        }
                    } catch (e) {
                        console.error('Error parsing streaming JSON chunk', e);
                    }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message || 'Failed to connect to the AI Tutor.');
                console.error('Ollama Hook Error:', err);
            }
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    }, [messages]);

    const stopStreaming = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsStreaming(false);
        }
    }, []);

    const clearChat = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    return {
        messages,
        isStreaming,
        error,
        sendMessage,
        stopStreaming,
        clearChat
    };
}
```

## File: `Frontend\src\pages\AITutorPage.jsx`

```jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, Plus, MessageSquare, Library, Network, Brain, ChevronDown, ChevronRight, Copy, Check, Sparkles, StopCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { apiFetch } from '../api/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ─── Markdown-lite renderer ────────────────────────────────
function renderMarkdown(text) {
    if (!text) return null;
    // Split into lines and process
    const lines = text.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeLines = [];
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code fences
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <pre key={`code-${i}`} className="bg-slate-900 text-emerald-300 rounded-xl p-4 text-sm font-mono overflow-x-auto my-2 border border-slate-700">
                        <code>{codeLines.join('\n')}</code>
                    </pre>
                );
                codeLines = [];
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
                codeLang = line.trim().slice(3);
            }
            continue;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        // Headers
        if (line.startsWith('### ')) {
            elements.push(<h4 key={i} className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-3 mb-1">{processInline(line.slice(4))}</h4>);
        } else if (line.startsWith('## ')) {
            elements.push(<h3 key={i} className="text-base font-bold text-slate-800 dark:text-white mt-3 mb-1">{processInline(line.slice(3))}</h3>);
        } else if (line.startsWith('# ')) {
            elements.push(<h2 key={i} className="text-lg font-bold text-slate-900 dark:text-white mt-3 mb-1">{processInline(line.slice(2))}</h2>);
        }
        // Bullet list
        else if (line.match(/^\s*[-*]\s/)) {
            elements.push(<li key={i} className="ml-4 text-sm list-disc text-slate-700 dark:text-slate-300">{processInline(line.replace(/^\s*[-*]\s/, ''))}</li>);
        }
        // Numbered list
        else if (line.match(/^\s*\d+\.\s/)) {
            elements.push(<li key={i} className="ml-4 text-sm list-decimal text-slate-700 dark:text-slate-300">{processInline(line.replace(/^\s*\d+\.\s/, ''))}</li>);
        }
        // Empty line
        else if (line.trim() === '') {
            elements.push(<div key={i} className="h-2" />);
        }
        // Regular text
        else {
            elements.push(<p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{processInline(line)}</p>);
        }
    }

    // Flush remaining code block
    if (inCodeBlock && codeLines.length) {
        elements.push(
            <pre key="code-end" className="bg-slate-900 text-emerald-300 rounded-xl p-4 text-sm font-mono overflow-x-auto my-2 border border-slate-700">
                <code>{codeLines.join('\n')}</code>
            </pre>
        );
    }

    return elements;
}

function processInline(text) {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-slate-800 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400">{part.slice(1, -1)}</code>;
        }
        return part;
    });
}

// ─── Thinking Collapsible ────────────────────────────────
function ThinkingBlock({ thinking, isStreaming }) {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!thinking) return null;

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
                {isStreaming ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : isExpanded ? (
                    <ChevronDown size={12} />
                ) : (
                    <ChevronRight size={12} />
                )}
                <Brain size={12} />
                {isStreaming ? 'Thinking...' : 'Show reasoning'}
            </button>
            <AnimatePresence>
                {(isExpanded || isStreaming) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-1.5 pl-3 border-l-2 border-purple-300 dark:border-purple-700 text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar italic">
                            {thinking}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Message Bubble ────────────────────────────────
function MessageBubble({ message, navigate }) {
    const [copied, setCopied] = useState(false);
    const isUser = message.sender === 'user';

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Parse <GRAPH>topic</GRAPH> links
    const parseGraphLinks = (elements) => {
        if (typeof elements === 'string') {
            const parts = elements.split(/(<GRAPH>.*?<\/GRAPH>)/s);
            return parts.map((part, i) => {
                if (part.startsWith('<GRAPH>') && part.endsWith('</GRAPH>')) {
                    const topic = part.slice(7, -8).trim();
                    return (
                        <button key={i} onClick={() => navigate('/graph', { state: { autoExpandTopic: topic } })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-adiptify-gold/10 hover:bg-adiptify-gold/20 text-adiptify-gold border border-adiptify-gold/30 rounded-lg text-xs font-semibold transition-colors mt-1">
                            <Network size={11} /> {topic}
                        </button>
                    );
                }
                return <span key={i}>{part}</span>;
            });
        }
        return elements;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}
        >
                <div className="w-8 h-8 rounded-full flex-shrink-0 mr-3 flex items-center justify-center mt-1">
                    <img src="/favicon.png" alt="Adiptify" className="w-6 h-6 object-contain shadow-sm drop-shadow-sm" />
                </div>
            <div className={`max-w-[78%] relative ${!isUser ? 'group' : ''}`}>
                {/* Thinking block */}
                {!isUser && message.thinking && (
                    <ThinkingBlock thinking={message.thinking} isStreaming={message.isStreaming && !message.content} />
                )}

                {/* Content */}
                <div className={`px-4 py-3 leading-relaxed ${isUser
                    ? 'bg-adiptify-navy text-white rounded-2xl rounded-tr-sm text-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-700 shadow-sm'
                }`}>
                    {isUser ? (
                        <span className="text-sm">{message.content}</span>
                    ) : (
                        <div className="prose-compact">
                            {message.content ? renderMarkdown(message.content) : (
                                message.isStreaming && !message.thinking ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-slate-400" />
                                        <span className="text-sm text-slate-400">Connecting to AI...</span>
                                    </div>
                                ) : null
                            )}
                            {parseGraphLinks('')}
                        </div>
                    )}
                </div>

                {/* Copy button for AI messages */}
                {!isUser && message.content && !message.isStreaming && (
                    <button
                        onClick={handleCopy}
                        className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        {copied ? <Check size={10} /> : <Copy size={10} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ─── Main Page Component ─────────────────────────────
const AITutorPage = () => {
    const { user, ollamaStatus, ollamaModel } = useQuiz();
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const abortRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        loadSessions();
        loadSubjects();
    }, []);

    useEffect(() => {
        if (activeSessionId) {
            loadMessages(activeSessionId);
        } else {
            setMessages([{ sender: 'ai', content: 'Hello! I\'m your AI Study Tutor. Select a conversation or start typing to begin.' }]);
        }
    }, [activeSessionId]);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    const loadSubjects = async () => {
        try {
            const data = await apiFetch('/api/subjects');
            setSubjects(data);
        } catch (e) { console.error("Failed to load subjects", e); }
    };

    const loadSessions = async () => {
        try {
            const data = await apiFetch('/api/chat/sessions');
            setSessions(data);
        } catch (e) { console.error("Failed to load sessions", e); }
    };

    const loadMessages = async (sessionId) => {
        try {
            const data = await apiFetch(`/api/chat/sessions/${sessionId}/messages`);
            setMessages(data);
        } catch (e) { console.error("Failed to load messages", e); }
    };

    const handleNewSession = async () => {
        try {
            const session = await apiFetch('/api/chat/sessions', {
                method: 'POST',
                body: { subjectId: selectedSubjectId || null, title: 'New Conversation' }
            });
            setSessions([session, ...sessions]);
            setActiveSessionId(session._id);
        } catch (e) { console.error("New session failed", e); }
    };

    const handleStop = () => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setIsStreaming(false);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        let sessionId = activeSessionId;

        // Create session if none exists
        if (!sessionId) {
            try {
                const session = await apiFetch('/api/chat/sessions', {
                    method: 'POST',
                    body: { subjectId: selectedSubjectId || null, title: input.substring(0, 30) }
                });
                setSessions(prev => [session, ...prev]);
                sessionId = session._id;
                setActiveSessionId(sessionId);
            } catch (e) {
                console.error("New session failed", e);
                return;
            }
        }

        const userMessage = { sender: 'user', content: input };
        const aiPlaceholder = { sender: 'ai', content: '', thinking: '', isStreaming: true };

        setMessages(prev => [...prev, userMessage, aiPlaceholder]);
        setInput('');
        setIsStreaming(true);

        // Build history from current messages (exclude the placeholder we just added)
        const history = messages
            .filter(m => m.content && !m.isStreaming)
            .map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.content
            }));

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const token = localStorage.getItem('adiptify_token');
            const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ message: userMessage.content }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accThinking = '';
            let accContent = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep last partial line

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    
                    const payload = trimmed.slice(6);
                    if (payload === '[DONE]') continue;

                    try {
                        const event = JSON.parse(payload);
                        if (event.error) throw new Error(event.error);

                        if (event.thinking) {
                            accThinking += event.thinking;
                        }
                        if (event.content) {
                            accContent += event.content;
                        }

                        // Update the AI placeholder in real-time
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                                updated[lastIdx] = {
                                    ...updated[lastIdx],
                                    thinking: accThinking,
                                    content: accContent,
                                };
                            }
                            return updated;
                        });
                        
                        scrollToBottom();
                    } catch (parseErr) {
                        // Sometimes chunks are fragmented across lines, wait for more data
                        console.debug('SSE parse delay:', parseErr.message);
                    }
                }
            }

            // Finalize the message — remove streaming flag
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                    updated[lastIdx] = {
                        ...updated[lastIdx],
                        isStreaming: false,
                        content: accContent || 'No response received.',
                    };
                }
                return updated;
            });

            // Refresh sessions list for updated title
            loadSessions();

        } catch (err) {
            if (err.name === 'AbortError') {
                // User cancelled
                setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                        updated[lastIdx] = { ...updated[lastIdx], isStreaming: false, content: updated[lastIdx].content || '⏹ Generation stopped.' };
                    }
                    return updated;
                });
            } else {
                console.error('Stream error:', err);
                setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                        updated[lastIdx] = { sender: 'ai', content: `⚠️ Error: ${err.message}\n\nMake sure Ollama is running:\n\`$env:OLLAMA_ORIGINS="*"; ollama serve\``, isStreaming: false };
                    }
                    return updated;
                });
            }
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-50 dark:bg-slate-900">
            {/* ─── Sidebar ─── */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={handleNewSession}
                        className="w-full flex items-center justify-center gap-2 bg-adiptify-navy hover:bg-adiptify-navy/90 text-white py-2.5 px-4 rounded-xl transition-colors shadow-sm text-sm font-medium"
                    >
                        <Plus size={16} /> New Chat
                    </button>

                    <div className="mt-3">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Context Subject</label>
                        <select
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2 text-slate-700 dark:text-slate-300"
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                        >
                            <option value="">General (No Subject)</option>
                            {subjects.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-2 mt-2 mb-2">Conversations</p>
                    {sessions.map(s => (
                        <button
                            key={s._id}
                            onClick={() => setActiveSessionId(s._id)}
                            className={`w-full flex flex-col text-left px-3 py-2 rounded-xl transition-all ${activeSessionId === s._id
                                ? 'bg-adiptify-navy/5 dark:bg-slate-800 text-adiptify-navy dark:text-white border border-adiptify-navy/10 dark:border-slate-700'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                            }`}
                        >
                            <span className="text-sm font-medium truncate flex items-center gap-1.5">
                                <MessageSquare size={12} className="flex-shrink-0 opacity-50" />
                                {s.title || "New Conversation"}
                            </span>
                            {s.subjectId && (
                                <span className="text-[10px] flex items-center gap-1 mt-0.5 opacity-60 ml-5">
                                    <Library size={9} /> {s.subjectId.name}
                                </span>
                            )}
                        </button>
                    ))}
                    {sessions.length === 0 && (
                        <p className="text-xs text-slate-400 text-center mt-6">No history yet</p>
                    )}
                </div>

                {/* Ollama Status */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                    <div className={`flex items-center gap-2 text-xs ${ollamaStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {ollamaStatus === 'connected' ? `${ollamaModel}` : 'Ollama Offline'}
                    </div>
                </div>
            </div>

            {/* ─── Main Chat Area ─── */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 relative min-w-0">
                {/* Header */}
                <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center">
                            <img src="/favicon.png" alt="Adiptify" className="w-8 h-8 object-contain drop-shadow-md" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-800 dark:text-white leading-tight text-sm">AI Study Tutor</h2>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Sparkles size={10} className="text-adiptify-gold" />
                                {ollamaModel || 'qwen3'} · Streaming
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/graph')}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                            title="Explore in Graph"
                        >
                            <Network size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar scroll-smooth">
                    {messages.length === 0 && !activeSessionId && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                            <img src="/favicon.png" alt="Adiptify" className="w-16 h-16 object-contain mb-4 opacity-70" />
                            <p className="text-lg font-medium">How can I help you study today?</p>
                            <p className="text-sm mt-1">Start typing or select a conversation from the sidebar.</p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <MessageBubble key={i} message={m} navigate={navigate} />
                    ))}

                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-end gap-2">
                        <textarea
                            rows={1}
                            placeholder="Ask a question or request an explanation..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            disabled={isStreaming}
                            className="w-full min-h-[52px] max-h-[180px] resize-y rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-3.5 pr-14 focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 focus:border-adiptify-gold transition-all disabled:opacity-50 text-sm custom-scrollbar shadow-sm"
                        />
                        {isStreaming ? (
                            <button
                                type="button"
                                onClick={handleStop}
                                className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all"
                                title="Stop generation"
                            >
                                <StopCircle size={18} />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 flex items-center justify-center hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all disabled:opacity-30 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400"
                            >
                                <Send size={18} className="translate-x-[1px]" />
                            </button>
                        )}
                    </form>
                    <p className="text-center text-[10px] text-slate-400 mt-2">AI can make mistakes. Verify important information.</p>
                </div>
            </div>
        </div>
    );
};

export default AITutorPage;
```

## File: `Frontend\src\pages\AnalyticsDashboard.jsx`

```jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdaptify } from '../context/AdaptifyContext';
import { BarChart3, TrendingUp, Clock, Target, Zap, Brain, Activity, Gauge, AlertCircle, BookOpen } from 'lucide-react';

// ─── SVG Mastery Progression Chart ───
function MasteryProgressionChart({ data }) {
    if (!data || data.length === 0) return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Activity size={32} className="opacity-20 mb-2" />
            <p className="text-xs">No progression data available yet.</p>
        </div>
    );

    const w = 480, h = 180, pad = 40;
    const plotW = w - pad * 2, plotH = h - pad * 2;
    const maxVal = Math.max(...data.map(d => d.value), 1);

    const points = data.map((d, i) => ({
        x: pad + (i / Math.max(data.length - 1, 1)) * plotW,
        y: pad + plotH - (d.value / maxVal) * plotH,
    }));

    const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
    const areaPoints = `${pad},${pad + plotH} ${linePoints} ${pad + plotW},${pad + plotH}`;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map(frac => (
                <g key={frac}>
                    <line x1={pad} y1={pad + plotH * (1 - frac)} x2={pad + plotW} y2={pad + plotH * (1 - frac)} stroke="currentColor" strokeWidth="1" className="text-slate-100 dark:text-slate-800" />
                    <text x={pad - 4} y={pad + plotH * (1 - frac) + 3} textAnchor="end" className="text-[8px] fill-slate-400 dark:fill-slate-500">{Math.round(maxVal * frac)}</text>
                </g>
            ))}
            {/* Area gradient */}
            <defs>
                <linearGradient id="masteryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E5BA41" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#E5BA41" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#masteryGrad)" />
            {/* Line */}
            <polyline fill="none" stroke="#E5BA41" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
            {/* Points */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" className="fill-white dark:fill-slate-800" stroke="#E5BA41" strokeWidth="2" />
            ))}
            {/* X-axis labels */}
            {data.map((d, i) => (
                <text key={i} x={points[i].x} y={h - 4} textAnchor="middle" className="text-[7px] fill-slate-400 dark:fill-slate-500">{d.date?.slice(5) || `D${i + 1}`}</text>
            ))}
        </svg>
    );
}

// ─── SVG Bar Chart ───
function BarChart({ data, valueKey = 'timeSpent', labelKey = 'title', maxBars = 8, color = '#94A378' }) {
    if (!data || data.length === 0) return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Clock size={32} className="opacity-20 mb-2" />
            <p className="text-xs">No time tracking data yet.</p>
        </div>
    );

    const items = data.slice(0, maxBars);
    const maxVal = Math.max(...items.map(d => d[valueKey] || 0), 1);
    const barH = 24, gap = 6;
    const w = 480, pad = 120;
    const h = items.length * (barH + gap) + 20;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
            {items.map((item, i) => {
                const barW = ((item[valueKey] || 0) / maxVal) * (w - pad - 20);
                const y = i * (barH + gap) + 10;
                return (
                    <g key={i}>
                        <text x={pad - 8} y={y + barH / 2 + 4} textAnchor="end" className="text-[9px] fill-slate-600 dark:fill-slate-400">{(item[labelKey] || '').slice(0, 18)}</text>
                        <rect x={pad} y={y} width={Math.max(barW, 2)} height={barH} rx="6" fill={color} opacity="0.7" />
                        <rect x={pad} y={y} width={Math.max(barW, 2)} height={barH} rx="6" fill={color} opacity="0.15" />
                        <text x={pad + barW + 5} y={y + barH / 2 + 4} className="text-[9px] fill-slate-500 dark:fill-slate-400 font-medium">{item[valueKey]}{valueKey === 'timeSpent' ? 'm' : '%'}</text>
                    </g>
                );
            })}
        </svg>
    );
}

// ─── Radar Chart ───
function RadarChart({ data, size = 220 }) {
    if (!data || data.length === 0) return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Target size={32} className="opacity-20 mb-2" />
            <p className="text-xs">Start studying to see your radar.</p>
        </div>
    );

    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 30;
    const n = data.length;
    const angleStep = (2 * Math.PI) / n;

    // Grid rings
    const rings = [0.25, 0.5, 0.75, 1.0];

    // Data polygon
    const dataPoints = data.map((d, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return {
            x: cx + Math.cos(angle) * r * d.value,
            y: cy + Math.sin(angle) * r * d.value,
        };
    });

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full mx-auto" style={{ maxWidth: size }}>
            {/* Background rings */}
            {rings.map(ring => (
                <polygon key={ring} points={
                    Array.from({ length: n }).map((_, i) => {
                        const angle = i * angleStep - Math.PI / 2;
                        return `${cx + Math.cos(angle) * r * ring},${cy + Math.sin(angle) * r * ring}`;
                    }).join(' ')
                } fill="none" stroke="currentColor" strokeWidth="0.8" className="text-slate-200 dark:text-slate-700" />
            ))}
            {/* Axis lines */}
            {data.map((d, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const ex = cx + Math.cos(angle) * r;
                const ey = cy + Math.sin(angle) * r;
                return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />;
            })}
            {/* Data area */}
            <polygon points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="#E5BA41" fillOpacity="0.15" stroke="#E5BA41" strokeWidth="2" />
            {/* Data points */}
            {dataPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" className="fill-white dark:fill-slate-800" stroke="#E5BA41" strokeWidth="2" />
            ))}
            {/* Labels */}
            {data.map((d, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const lx = cx + Math.cos(angle) * (r + 18);
                const ly = cy + Math.sin(angle) * (r + 18);
                return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-slate-600 dark:fill-slate-400 font-medium">{d.axis}</text>;
            })}
        </svg>
    );
}

// ─── Gauge Widget ───
function GaugeWidget({ value, label, icon: Icon, color = 'text-adiptify-gold', bgColor = 'bg-amber-50' }) {
    return (
        <div className={`p-5 rounded-2xl ${bgColor} border border-slate-200/30 dark:border-slate-700/30 shadow-sm transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
                {Icon && <Icon size={16} className={color} />}
            </div>
            <p className={`text-3xl font-black ${color}`}>
                {typeof value === 'number' ? (value > 1 ? value : `${Math.round(value * 100)}%`) : value}
            </p>
        </div>
    );
}

// ─── Retention Gauge (circular) ───
function RetentionGauge({ value, size = 140 }) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (value / 100) * circumference;
    const color = value >= 70 ? '#94A378' : value >= 40 ? '#E5BA41' : '#D1855C';

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isNaN(progress) ? circumference : progress} style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black" style={{ color }}>{value}%</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Retention</span>
            </div>
        </div>
    );
}

function EmptyAnalyticsState() {
    const navigate = useNavigate();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white/50 dark:bg-slate-900/50 m-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                <BarChart3 size={36} className="text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Learning Data Yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8">
                Your analytics will populate as you explore subjects, complete study modules, and perform spaced reviews.
            </p>
            <div className="flex gap-4">
                <button onClick={() => navigate('/catalog')} className="px-6 py-2.5 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white font-medium text-sm hover:bg-slate-700 transition-colors">
                    Explore Subjects
                </button>
                <button onClick={() => navigate('/modules')} className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    Go to Modules
                </button>
            </div>
        </div>
    );
}

// ─── Main Dashboard ───
export default function AnalyticsDashboard() {
    const { analytics, loading, enrolledSubjects, concepts } = useAdaptify();

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-3 border-adiptify-gold border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!enrolledSubjects || enrolledSubjects.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                    <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <BarChart3 className="text-adiptify-olive" size={28} />
                        Learning Analytics
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Enroll in subjects to start tracking your progress.</p>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Subjects Enrolled</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Head to the explorer to begin your journey.</p>
                </div>
            </div>
        );
    }

    // If no concepts but enrolled, prompt to generate
    if (concepts.length === 0) {
        return (
             <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                    <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <BarChart3 className="text-adiptify-olive" size={28} />
                        Learning Analytics
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Generate your study modules to see analytics.</p>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={28} className="text-purple-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Ready to Start Analyzing?</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Go to Study Modules to generate your personalized AI learning path.</p>
                </div>
            </div>
        )
    }

    // Real data from context
    const data = analytics || {
        overallMastery: 0,
        totalConcepts: 0,
        studiedConcepts: 0,
        completionRate: 0,
        retentionRate: 0,
        learningVelocity: 0,
        dueReviewCount: 0,
        masteryByCategory: [],
        timePerTopic: [],
        radarData: [],
        masteryHistory: [],
    };

    const hasData = data.studiedConcepts > 0;

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Header */}
            <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                            <BarChart3 className="text-adiptify-olive" size={28} />
                            Learning Analytics
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Comprehensive metrics tracking your cognitive learning journey.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="w-2 h-2 rounded-full bg-adiptify-gold animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Real-time Data</span>
                    </div>
                </div>
            </header>

            {!hasData ? <EmptyAnalyticsState /> : (
                <div className="p-8 space-y-6 animate-fadeIn">
                    {/* Top metric cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <GaugeWidget value={data.overallMastery} label="Overall Mastery" icon={Brain} color="text-adiptify-gold" bgColor="bg-gradient-to-br from-amber-50 to-orange-50/30 dark:from-amber-500/10 dark:to-orange-500/5" />
                        <GaugeWidget value={`${data.studiedConcepts}/${data.totalConcepts}`} label="Concepts Studied" icon={Target} color="text-blue-600 dark:text-blue-400" bgColor="bg-gradient-to-br from-blue-50 to-indigo-50/30 dark:from-blue-500/10 dark:to-indigo-500/5" />
                        <GaugeWidget value={data.completionRate} label="Completion Rate" icon={Activity} color="text-emerald-600 dark:text-emerald-400" bgColor="bg-gradient-to-br from-emerald-50 to-teal-50/30 dark:from-emerald-500/10 dark:to-teal-500/5" />
                        <GaugeWidget value={data.learningVelocity} label="Velocity (weekly)" icon={Zap} color="text-purple-600 dark:text-purple-400" bgColor="bg-gradient-to-br from-purple-50 to-violet-50/30 dark:from-purple-500/10 dark:to-violet-500/5" />
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Mastery Progression */}
                        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><TrendingUp size={16} className="text-adiptify-gold" /> Mastery Progression</h3>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Over time</span>
                            </div>
                            <MasteryProgressionChart data={data.masteryHistory} />
                        </div>

                        {/* Retention Gauge */}
                        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4"><Gauge size={16} className="text-adiptify-olive" /> Retention Rate</h3>
                            <RetentionGauge value={data.retentionRate} />
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">Based on spaced repetition recall quality</p>
                        </div>
                    </div>

                    {/* Charts row 2 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Time per Topic */}
                        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4"><Clock size={16} className="text-blue-500" /> Time per Topic (mins)</h3>
                            <BarChart data={data.timePerTopic} valueKey="timeSpent" labelKey="title" color="#3b82f6" />
                        </div>

                        {/* Skill Radar */}
                        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4"><Target size={16} className="text-adiptify-terracotta" /> Skill Radar</h3>
                            <RadarChart data={data.radarData} />
                        </div>
                    </div>

                    {/* Category mastery breakdown */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-5"><Brain size={16} className="text-purple-500" /> Mastery by Category</h3>
                        <div className="space-y-3">
                            {(data.masteryByCategory || []).map((cat, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <span className="text-xs text-slate-600 dark:text-slate-400 w-40 truncate font-medium">{cat.category}</span>
                                    <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden text-[0px]">
                                        <div className="h-full rounded-full bg-gradient-to-r from-adiptify-gold to-adiptify-terracotta transition-all duration-700" style={{ width: `${cat.mastery}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{cat.mastery}%</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Due reviews notice */}
                    {data.dueReviewCount > 0 && (
                        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/40 dark:border-amber-500/20 flex items-center gap-4 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                <Clock size={20} className="text-amber-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">You have {data.dueReviewCount} concepts due for review</p>
                                <p className="text-xs text-amber-600 dark:text-amber-400/70 mt-0.5">Head to Spaced Review to maintain your retention scores.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
```

## File: `Frontend\src\pages\ConceptLearning.jsx`

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdaptify } from '../context/AdaptifyContext';
import { ArrowLeft, BookOpen, Play, PenTool, Rocket, CheckCircle2, ChevronRight, Lightbulb, Clock, AlertTriangle, Trophy } from 'lucide-react';

const STAGES = [
    { key: 'explain', label: 'Explain', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500' },
    { key: 'demo', label: 'Demo', icon: Play, color: 'text-purple-500', bg: 'bg-purple-500' },
    { key: 'practice', label: 'Practice', icon: PenTool, color: 'text-amber-500', bg: 'bg-amber-500' },
    { key: 'apply', label: 'Apply', icon: Rocket, color: 'text-emerald-500', bg: 'bg-emerald-500' },
    { key: 'evaluate', label: 'Evaluate', icon: CheckCircle2, color: 'text-red-500', bg: 'bg-red-500' },
];

function StepperBar({ currentStage, onStageClick }) {
    return (
        <div className="flex items-center gap-1 px-6 py-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60">
            {STAGES.map((stage, i) => {
                const Icon = stage.icon;
                const isActive = i === currentStage;
                const isComplete = i < currentStage;
                return (
                    <React.Fragment key={stage.key}>
                        <button onClick={() => onStageClick(i)} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${isActive ? `${stage.bg}/10 font-semibold shadow-sm` : isComplete ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isActive ? `${stage.bg} text-white shadow-md` : isComplete ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                {isComplete ? '✓' : i + 1}
                            </div>
                            <span className={`text-xs hidden sm:inline ${isActive ? stage.color : isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{stage.label}</span>
                        </button>
                        {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 rounded-full transition-colors ${isComplete ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function ExplainSection({ concept }) {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/30 dark:from-blue-500/10 dark:to-blue-500/5 border border-blue-200/40 dark:border-blue-500/20">
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3"><BookOpen size={20} /> Concept Explanation</h3>
                <p className="text-sm text-blue-900/80 dark:text-blue-200/80 leading-relaxed whitespace-pre-wrap">{concept.pipeline?.explanation || 'No explanation available.'}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Key Information</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50"><span className="text-slate-400 dark:text-slate-500">Category</span><p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">{concept.category}</p></div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50"><span className="text-slate-400 dark:text-slate-500">Difficulty</span><p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">Level {concept.difficulty_level}/5</p></div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50"><span className="text-slate-400 dark:text-slate-500">Prerequisites</span><p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">{concept.prerequisites?.length > 0 ? concept.prerequisites.join(', ') : 'None'}</p></div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50"><span className="text-slate-400 dark:text-slate-500">Tags</span><p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">{concept.tags?.join(', ') || 'N/A'}</p></div>
                </div>
            </div>
        </div>
    );
}

function DemoSection({ concept }) {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/30 dark:from-purple-500/10 dark:to-purple-500/5 border border-purple-200/40 dark:border-purple-500/20">
                <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2 mb-3"><Play size={20} /> Interactive Demonstration</h3>
                <p className="text-sm text-purple-900/80 dark:text-purple-200/80 leading-relaxed">{concept.pipeline?.demonstration || 'No demonstration available.'}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-center">
                <div className="w-full h-48 rounded-xl bg-gradient-to-br from-purple-100/40 to-blue-100/40 dark:from-purple-500/10 dark:to-blue-500/10 flex items-center justify-center border border-purple-200/20 dark:border-purple-500/10">
                    <div className="text-center">
                        <Play size={36} className="mx-auto text-purple-400 mb-2" />
                        <p className="text-xs text-purple-500 dark:text-purple-400 font-medium">Interactive visualization loads here</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Check the Experiment Lab for hands-on simulators</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PracticeSection({ concept, onComplete }) {
    const questions = concept.pipeline?.practiceQuestions || [];
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showResult, setShowResult] = useState(false);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const startTime = useRef(Date.now());

    if (questions.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                <PenTool size={48} className="mx-auto mb-3 opacity-30" />
                <p>No practice questions available for this concept.</p>
            </div>
        );
    }

    const q = questions[currentQ];
    const selected = answers[currentQ];
    const isCorrect = selected === q.correctAnswer;
    const allAnswered = Object.keys(answers).length === questions.length;
    const totalCorrect = Object.entries(answers).filter(([i, a]) => a === questions[i].correctAnswer).length;

    const handleAnswer = (optionIdx) => {
        if (answers[currentQ] !== undefined) return;
        setAnswers(prev => ({ ...prev, [currentQ]: optionIdx }));
        setShowHint(false);
    };

    const handleFinish = () => {
        const timeTaken = Date.now() - startTime.current;
        onComplete({
            correct: totalCorrect,
            total: questions.length,
            timeTakenMs: timeTaken,
            hintUsage: hintsUsed,
        });
    };

    if (showResult) {
        return (
            <div className="p-8 text-center animate-fadeIn">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200 dark:shadow-amber-900/40">
                    <Trophy size={36} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Practice Complete</h3>
                <p className="text-3xl font-black text-adiptify-gold mb-1">{totalCorrect}/{questions.length}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {totalCorrect === questions.length ? 'Perfect score! 🎉' : totalCorrect >= questions.length * 0.7 ? 'Great job! 💪' : 'Keep practicing! 📚'}
                </p>
                <button onClick={handleFinish} className="px-6 py-2.5 rounded-xl bg-adiptify-gold text-white font-medium hover:bg-amber-500 transition-colors shadow-md">
                    Continue to Application →
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Progress */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Question {currentQ + 1} of {questions.length}</span>
                <div className="flex gap-1">
                    {questions.map((_, i) => (
                        <div key={i} className={`w-6 h-1.5 rounded-full transition-colors ${answers[i] !== undefined ? (answers[i] === questions[i].correctAnswer ? 'bg-emerald-400' : 'bg-red-400') : i === currentQ ? 'bg-adiptify-gold' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    ))}
                </div>
            </div>

            {/* Question */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">{q.question}</h3>
                <div className="space-y-2.5">
                    {q.options.map((opt, i) => {
                        const isSelected = selected === i;
                        const isRight = i === q.correctAnswer;
                        const answered = selected !== undefined;
                        let style = 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500';
                        if (answered && isRight) style = 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300';
                        else if (answered && isSelected && !isRight) style = 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300';
                        return (
                            <button key={i} onClick={() => handleAnswer(i)} disabled={answered} className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-200 ${style}`}>
                                <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                            </button>
                        );
                    })}
                </div>

                {/* Explanation shown after answering */}
                {selected !== undefined && q.explanation && (
                    <div className="mt-4 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-500/10 border border-blue-200/40 dark:border-blue-500/20 text-xs text-blue-800 dark:text-blue-300">
                        <span className="font-semibold">Explanation:</span> {q.explanation}
                    </div>
                )}
            </div>

            {/* Hint + Navigation */}
            <div className="flex items-center justify-between">
                <button onClick={() => { setShowHint(!showHint); if (!showHint) setHintsUsed(h => h + 1); }} className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                    <Lightbulb size={14} /> {showHint ? 'Hide hint' : 'Show hint'}
                </button>
                <div className="flex gap-2">
                    {currentQ > 0 && (
                        <button onClick={() => { setCurrentQ(c => c - 1); setShowHint(false); }} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Back</button>
                    )}
                    {currentQ < questions.length - 1 ? (
                        <button onClick={() => { setCurrentQ(c => c + 1); setShowHint(false); }} disabled={selected === undefined} className="px-4 py-2 rounded-xl bg-adiptify-navy dark:bg-slate-600 text-sm text-white hover:bg-slate-700 dark:hover:bg-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">Next <ChevronRight size={14} /></button>
                    ) : (
                        <button onClick={() => setShowResult(true)} disabled={!allAnswered} className="px-4 py-2 rounded-xl bg-adiptify-gold text-sm text-white hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">See Results</button>
                    )}
                </div>
            </div>

            {showHint && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/40 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 animate-fadeIn">
                    <Lightbulb size={12} className="inline mr-1" /> Think about the core definition and how it relates to the answer choices.
                </div>
            )}
        </div>
    );
}

function ApplicationSection({ concept }) {
    const [completed, setCompleted] = useState(false);
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20">
                <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mb-3"><Rocket size={20} /> Application Task</h3>
                <p className="text-sm text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">{concept.pipeline?.applicationTask || 'No application task available.'}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Evaluation Criteria</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">{concept.pipeline?.evaluationCriteria || 'Complete the task above.'}</p>
            </div>
            <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200/30 dark:border-amber-500/20">
                <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">This task should be completed in your local development environment. Mark it complete when you've finished.</p>
                </div>
            </div>
            <button onClick={() => setCompleted(!completed)} className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${completed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40' : 'bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}>
                {completed ? '✓ Marked Complete' : 'Mark as Complete'}
            </button>
        </div>
    );
}

function EvaluationSection({ concept, practiceResult }) {
    const accuracy = practiceResult ? (practiceResult.correct / practiceResult.total) : 0;
    const timeMinutes = practiceResult ? (practiceResult.timeTakenMs / 60000).toFixed(1) : 0;
    const hints = practiceResult?.hintUsage || 0;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50/50 dark:from-red-500/10 dark:to-orange-500/5 border border-red-200/40 dark:border-red-500/20">
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300 flex items-center gap-2 mb-3"><CheckCircle2 size={20} /> Performance Evaluation</h3>
                <p className="text-sm text-red-900/80 dark:text-red-200/80">Your learning metrics for this concept.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {[
                    { label: 'Accuracy', value: `${Math.round(accuracy * 100)}%`, desc: 'Practice questions', color: accuracy >= 0.7 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400' },
                    { label: 'Time Spent', value: `${timeMinutes} min`, desc: 'Practice session', color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Hints Used', value: hints, desc: 'During practice', color: hints <= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400' },
                    { label: 'Mastery Est.', value: `${Math.round(accuracy * 80)}%`, desc: 'Composite score', color: 'text-purple-600 dark:text-purple-400' },
                ].map(stat => (
                    <div key={stat.label} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-center">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">{stat.label}</p>
                        <p className={`text-xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{stat.desc}</p>
                    </div>
                ))}
            </div>

            {accuracy < 0.6 && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/40 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <div><span className="font-semibold">Recommendation:</span> Your mastery is below 60%. Consider reviewing the explanation and practicing again before moving on.</div>
                </div>
            )}

            {accuracy >= 0.8 && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/40 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                    <Trophy size={14} className="mt-0.5 flex-shrink-0" />
                    <div><span className="font-semibold">Excellent!</span> You've demonstrated strong mastery. Advanced exercises are now available.</div>
                </div>
            )}
        </div>
    );
}

export default function ConceptLearning() {
    const { conceptId } = useParams();
    const navigate = useNavigate();
    const { getConceptById, submitPerformance } = useAdaptify();
    const [stage, setStage] = useState(0);
    const [practiceResult, setPracticeResult] = useState(null);

    const concept = getConceptById(conceptId);

    useEffect(() => {
        setStage(0);
        setPracticeResult(null);
    }, [conceptId]);

    if (!concept) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <div className="text-center">
                    <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Concept not found.</p>
                    <button onClick={() => navigate('/modules')} className="mt-4 px-4 py-2 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white text-sm">← Back to Modules</button>
                </div>
            </div>
        );
    }

    const handlePracticeComplete = async (result) => {
        setPracticeResult(result);
        await submitPerformance(conceptId, {
            correct: result.correct,
            total: result.total,
            timeTakenMs: result.timeTakenMs,
            hintUsage: result.hintUsage,
            pipelineStage: 2, // practice stage
        });
    };

    const handleStageClick = (i) => {
        // Allow only completed or current+1 stages
        if (i <= stage + 1) setStage(i);
    };

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Top bar */}
            <div className="px-6 py-4 flex items-center gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60 sticky top-0 z-20">
                <button onClick={() => navigate('/modules')} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-adiptify-navy dark:text-slate-100 truncate">{concept.title}</h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">{concept.category} • Level {concept.difficulty_level}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Clock size={12} />
                    <span>Step {stage + 1} of 5</span>
                </div>
            </div>

            {/* Stepper */}
            <StepperBar currentStage={stage} onStageClick={handleStageClick} />

            {/* Content */}
            <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
                {stage === 0 && <ExplainSection concept={concept} />}
                {stage === 1 && <DemoSection concept={concept} />}
                {stage === 2 && <PracticeSection concept={concept} onComplete={handlePracticeComplete} />}
                {stage === 3 && <ApplicationSection concept={concept} />}
                {stage === 4 && <EvaluationSection concept={concept} practiceResult={practiceResult} />}

                {/* Next stage button */}
                {stage < 4 && (
                    <div className="mt-8 flex justify-end">
                        <button onClick={() => setStage(s => s + 1)} className="px-5 py-2.5 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 shadow-md">
                            Continue to {STAGES[stage + 1]?.label} <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
```

## File: `Frontend\src\pages\EmptyStatePage.jsx`

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

export default function EmptyStatePage() {
    const navigate = useNavigate();

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative p-8 h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            <button
                onClick={() => navigate(-1)}
                className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
            >
                <ArrowLeft size={16} />
                Go Back
            </button>

            <div className="max-w-md w-full bg-white dark:bg-slate-800 p-10 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-6">
                    <Construction className="w-10 h-10 text-adiptify-gold" />
                </div>
                <h2 className="text-2xl font-bold text-adiptify-navy dark:text-white mb-3">Under Construction</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    This feature is currently being developed. Check back later for updates as we continue to improve your learning experience!
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="inline-flex justify-center items-center px-6 py-3 bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-adiptify-navy font-bold rounded-xl hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-colors shadow-md w-full"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
}
```

## File: `Frontend\src\pages\ExperimentLab.jsx`

```jsx
import React, { useState, useCallback, useMemo, useContext, useEffect } from 'react';
import { FlaskConical, SlidersHorizontal, Play, RotateCcw, Layers, Activity, Target, Save, History, Clock, Brain, Trash2, ExternalLink } from 'lucide-react';
import AdaptifyContext from '../context/AdaptifyContext';

// ─── Gradient Descent Simulator ───
function GradientDescentSim({ onSave }) {
    const [lr, setLr] = useState(0.05);
    const [iterations, setIterations] = useState(50);
    const [running, setRunning] = useState(false);

    // Simulate gradient descent on f(x) = x²
    const results = useMemo(() => {
        let x = 5.0;
        const points = [{ iter: 0, x, loss: x * x }];
        for (let i = 1; i <= iterations; i++) {
            const grad = 2 * x;
            x = x - lr * grad;
            points.push({ iter: i, x: Math.round(x * 10000) / 10000, loss: Math.round(x * x * 10000) / 10000 });
        }
        return points;
    }, [lr, iterations]);

    const maxLoss = Math.max(...results.map(r => r.loss), 1);
    const finalLoss = results[results.length - 1].loss;
    const converged = finalLoss < 0.01;
    const diverged = finalLoss > 1000 || isNaN(finalLoss) || !isFinite(finalLoss);

    // SVG chart
    const chartW = 500, chartH = 200, pad = 30;
    const plotW = chartW - pad * 2, plotH = chartH - pad * 2;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Learning Rate: <span className="text-adiptify-gold font-bold">{lr}</span></label>
                    <input type="range" min="0.001" max="1.2" step="0.001" value={lr} onChange={e => setLr(parseFloat(e.target.value))} className="w-full accent-adiptify-gold" />
                    <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500"><span>0.001</span><span>1.2</span></div>
                </div>
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Iterations: <span className="text-adiptify-gold font-bold">{iterations}</span></label>
                    <input type="range" min="5" max="200" step="5" value={iterations} onChange={e => setIterations(parseInt(e.target.value))} className="w-full accent-adiptify-gold" />
                    <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500"><span>5</span><span>200</span></div>
                </div>
            </div>

            {/* Loss curve chart */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Loss Curve — f(x) = x²</p>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxHeight: 220 }}>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(frac => (
                        <g key={frac}>
                            <line x1={pad} y1={pad + plotH * frac} x2={pad + plotW} y2={pad + plotH * frac} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />
                            <text x={pad - 4} y={pad + plotH * frac + 3} textAnchor="end" className="text-[8px] fill-slate-400 dark:fill-slate-500">{Math.round(maxLoss * (1 - frac) * 10) / 10}</text>
                        </g>
                    ))}
                    {/* Loss curve */}
                    {!diverged && (
                        <polyline
                            fill="none"
                            stroke="#E5BA41"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={results.map((r, i) => {
                                const x = pad + (i / iterations) * plotW;
                                const y = pad + plotH - (Math.min(r.loss, maxLoss) / maxLoss) * plotH;
                                return `${x},${y}`;
                            }).join(' ')}
                        />
                    )}
                    {/* Axis labels */}
                    <text x={chartW / 2} y={chartH - 4} textAnchor="middle" className="text-[9px] fill-slate-400 dark:fill-slate-500">Iterations</text>
                    <text x={8} y={chartH / 2} textAnchor="middle" className="text-[9px] fill-slate-400 dark:fill-slate-500" transform={`rotate(-90, 8, ${chartH / 2})`}>Loss</text>
                </svg>
            </div>

            <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${converged ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-500/20' : diverged ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/40 dark:border-red-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-500/20'}`}>
                    {converged ? '✓ Converged!' : diverged ? '⚠ Diverged — reduce learning rate' : '⏳ Still converging...'} | Final loss: {diverged ? '∞' : finalLoss.toFixed(4)}
                </div>
                <button
                    disabled={diverged || !converged}
                    onClick={() => onSave({
                        experimentType: 'gradient_descent',
                        parameters_used: { lr, iterations },
                        result_metrics: { finalLoss, status: converged ? 'converged' : 'not_converged' }
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-adiptify-gold text-white text-xs font-medium hover:bg-adiptify-gold/90 transition-colors disabled:opacity-40 shadow-sm"
                >
                    <Save size={13} /> Save Result
                </button>
            </div>
        </div>
    );
}

// ─── Neural Network Builder ───
function NeuralNetworkBuilder({ onSave }) {
    const [layers, setLayers] = useState([4, 8, 6, 3]);
    const [activation, setActivation] = useState('relu');
    const [learningRate, setLearningRate] = useState(0.01);

    const addLayer = () => setLayers(prev => [...prev.slice(0, -1), 4, prev[prev.length - 1]]);
    const removeLayer = () => { if (layers.length > 2) setLayers(prev => [...prev.slice(0, -2), prev[prev.length - 1]]); };
    const updateNeurons = (idx, val) => setLayers(prev => prev.map((n, i) => i === idx ? Math.max(1, Math.min(12, val)) : n));

    const totalParams = useMemo(() => {
        let params = 0;
        for (let i = 1; i < layers.length; i++) {
            params += layers[i - 1] * layers[i] + layers[i]; // weights + biases
        }
        return params;
    }, [layers]);

    // Network visualization
    const svgW = 460, svgH = 240;
    const layerSpacing = svgW / (layers.length + 1);
    const maxNeurons = Math.max(...layers);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Activation Function</label>
                    <select value={activation} onChange={e => setActivation(e.target.value)} className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none">
                        <option value="relu">ReLU</option>
                        <option value="sigmoid">Sigmoid</option>
                        <option value="tanh">Tanh</option>
                        <option value="leaky_relu">Leaky ReLU</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Learning Rate: {learningRate}</label>
                    <input type="range" min="0.0001" max="0.1" step="0.0001" value={learningRate} onChange={e => setLearningRate(parseFloat(e.target.value))} className="w-full accent-purple-500" />
                </div>
            </div>

            {/* Layer controls */}
            <div className="flex items-center gap-2 flex-wrap">
                {layers.map((n, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">{i === 0 ? 'Input' : i === layers.length - 1 ? 'Output' : `Hidden ${i}`}</span>
                        <input type="number" value={n} onChange={e => updateNeurons(i, parseInt(e.target.value) || 1)} className="w-12 text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-center" />
                    </div>
                ))}
                <div className="flex gap-1 ml-2">
                    <button onClick={addLayer} className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-bold hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors">+</button>
                    <button onClick={removeLayer} className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors">−</button>
                </div>
            </div>

            {/* Network visualization */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 overflow-hidden">
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 260 }}>
                    {/* Connections */}
                    {layers.map((size, li) => {
                        if (li === 0) return null;
                        const prevSize = layers[li - 1];
                        return Array.from({ length: prevSize }).map((_, pi) =>
                            Array.from({ length: size }).map((_, ni) => {
                                const x1 = layerSpacing * li;
                                const y1 = (svgH / (prevSize + 1)) * (pi + 1);
                                const x2 = layerSpacing * (li + 1);
                                const y2 = (svgH / (size + 1)) * (ni + 1);
                                return <line key={`${li}-${pi}-${ni}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="0.5" opacity="0.6" className="text-slate-200 dark:text-slate-700" />;
                            })
                        );
                    })}
                    {/* Neurons */}
                    {layers.map((size, li) =>
                        Array.from({ length: size }).map((_, ni) => {
                            const cx = layerSpacing * (li + 1);
                            const cy = (svgH / (size + 1)) * (ni + 1);
                            const color = li === 0 ? '#3b82f6' : li === layers.length - 1 ? '#ef4444' : '#8b5cf6';
                            return <circle key={`n-${li}-${ni}`} cx={cx} cy={cy} r={Math.max(4, 14 - maxNeurons)} fill={color} opacity="0.7" />;
                        })
                    )}
                </svg>
            </div>

            <div className="flex justify-between items-center mt-2">
                <div className="flex gap-2">
                    <div className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 border border-slate-100 dark:border-slate-700">Inputs: {layers[0]}</div>
                    <div className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 border border-slate-100 dark:border-slate-700">Outputs: {layers[layers.length-1]}</div>
                </div>
                <button
                    onClick={() => onSave({
                        experimentType: 'neural_network',
                        parameters_used: { layers, activation, learningRate },
                        result_metrics: { totalParams }
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 transition-colors shadow-sm"
                >
                    <Save size={13} /> Save Blueprint
                </button>
            </div>
        </div>
    );
}

// ─── Classification Trainer ───
function ClassificationTrainer({ onSave }) {
    const [algorithm, setAlgorithm] = useState('logistic');
    const [dataSize, setDataSize] = useState(100);
    const [noise, setNoise] = useState(0.2);
    const [trained, setTrained] = useState(false);

    // Generate synthetic 2D data
    const data = useMemo(() => {
        const points = [];
        const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
        const rand = rng(42);
        for (let i = 0; i < dataSize; i++) {
            const cls = i < dataSize / 2 ? 0 : 1;
            const cx = cls === 0 ? 0.35 : 0.65;
            const cy = cls === 0 ? 0.35 : 0.65;
            const x = cx + (rand() - 0.5) * noise * 2;
            const y = cy + (rand() - 0.5) * noise * 2;
            points.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), cls });
        }
        return points;
    }, [dataSize, noise]);

    const accuracy = useMemo(() => {
        if (!trained) return 0;
        // Simulate accuracy based on noise and algorithm
        const base = { logistic: 0.88, svm: 0.92, tree: 0.85, knn: 0.87 }[algorithm] || 0.85;
        return Math.max(0.5, Math.min(0.99, base - noise * 0.3 + 0.02));
    }, [trained, algorithm, noise]);

    const svgSize = 300;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Algorithm</label>
                    <select value={algorithm} onChange={e => { setAlgorithm(e.target.value); setTrained(false); }} className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none">
                        <option value="logistic">Logistic Regression</option>
                        <option value="svm">SVM</option>
                        <option value="tree">Decision Tree</option>
                        <option value="knn">K-NN</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Data Size: {dataSize}</label>
                    <input type="range" min="20" max="300" step="10" value={dataSize} onChange={e => { setDataSize(parseInt(e.target.value)); setTrained(false); }} className="w-full accent-emerald-500" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 block">Noise: {noise.toFixed(2)}</label>
                    <input type="range" min="0.05" max="0.8" step="0.05" value={noise} onChange={e => { setNoise(parseFloat(e.target.value)); setTrained(false); }} className="w-full accent-emerald-500" />
                </div>
            </div>

            {/* Scatter plot */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex justify-center">
                <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full" style={{ maxHeight: 300 }}>
                    <rect x="0" y="0" width={svgSize} height={svgSize} className="fill-slate-50 dark:fill-slate-900" rx="8" />
                    {/* Decision boundary (simple line for trained model) */}
                    {trained && (
                        <line x1="0" y1={svgSize} x2={svgSize} y2="0" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6,4" opacity="0.5" />
                    )}
                    {/* Data points */}
                    {data.map((p, i) => (
                        <circle key={i} cx={p.x * svgSize} cy={(1 - p.y) * svgSize} r="4"
                            fill={p.cls === 0 ? '#3b82f6' : '#ef4444'} opacity="0.7"
                            stroke={p.cls === 0 ? '#1d4ed8' : '#b91c1c'} strokeWidth="0.5" />
                    ))}
                    {/* Axis labels */}
                    <text x={svgSize / 2} y={svgSize - 4} textAnchor="middle" className="text-[10px] fill-slate-400 dark:fill-slate-500">Feature 1</text>
                    <text x={8} y={svgSize / 2} textAnchor="middle" className="text-[10px] fill-slate-400 dark:fill-slate-500" transform={`rotate(-90, 8, ${svgSize / 2})`}>Feature 2</text>
                </svg>
            </div>

            {/* Train button + results */}
            <div className="flex items-center gap-4">
                <button onClick={() => setTrained(true)} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2 shadow-md">
                    <Play size={16} /> {trained ? 'Re-train' : 'Train Model'}
                </button>
                {trained && (
                    <div className="flex-1 flex justify-between items-center">
                        <div className="flex gap-3 animate-fadeIn">
                            <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/40 dark:border-emerald-500/20">
                                <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">Accuracy</span>
                                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{(accuracy * 100).toFixed(1)}%</p>
                            </div>
                            <div className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/40 dark:border-blue-500/20">
                                <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">Algorithm</span>
                                <p className="text-sm font-bold text-blue-700 dark:text-blue-300 capitalize">{algorithm}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onSave({
                                experimentType: 'classification',
                                parameters_used: { algorithm, dataSize, noise },
                                result_metrics: { accuracy, trained: true }
                            })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors shadow-sm ml-auto"
                        >
                            <Save size={13} /> Log Training Result
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Experiment Lab ───
const EXPERIMENTS = [
    { id: 'gradient_descent', title: 'Gradient Descent Simulator', icon: Activity, desc: 'Explore how learning rate and iterations affect convergence.', color: 'from-amber-500 to-orange-500' },
    { id: 'neural_network', title: 'Neural Network Builder', icon: Layers, desc: 'Design network architectures and see parameter counts.', color: 'from-purple-500 to-indigo-500' },
    { id: 'classification', title: 'Classification Trainer', icon: Target, desc: 'Train classifiers on synthetic data with adjustable noise.', color: 'from-emerald-500 to-teal-500' },
];

export default function ExperimentLab() {
    const [active, setActive] = useState('gradient_descent');
    const { fetchExperimentHistory, experimentHistory, saveExperimentResult } = useContext(AdaptifyContext);

    useEffect(() => {
        fetchExperimentHistory(active);
    }, [active, fetchExperimentHistory]);

    const handleSave = async (data) => {
        const res = await saveExperimentResult(data);
        if (res.ok) {
            // Success alert could go here
        }
    };

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Header */}
            <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                    <FlaskConical className="text-adiptify-terracotta" size={28} />
                    Experiment Lab
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Interactive algorithm exploration through parameter manipulation.</p>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6">
                {/* Experiment selector */}
                <div className="lg:w-72 flex-shrink-0 space-y-3">
                    {EXPERIMENTS.map(exp => {
                        const Icon = exp.icon;
                        const isActive = active === exp.id;
                        return (
                            <button key={exp.id} onClick={() => setActive(exp.id)} className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${isActive ? 'bg-white dark:bg-slate-800 shadow-lg border-adiptify-gold/30 dark:border-adiptify-gold/40 ring-2 ring-adiptify-gold/10' : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md'}`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${exp.color} flex items-center justify-center shadow-sm`}>
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <h3 className={`text-sm font-semibold ${isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>{exp.title}</h3>
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 ml-12">{exp.desc}</p>
                            </button>
                        );
                    })}
                </div>

                {/* Active experiment */}
                <div className="flex-1 p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700">
                        <SlidersHorizontal size={16} className="text-slate-400 dark:text-slate-500" />
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{EXPERIMENTS.find(e => e.id === active)?.title}</h3>
                    </div>
                    {active === 'gradient_descent' && <GradientDescentSim onSave={handleSave} />}
                    {active === 'neural_network' && <NeuralNetworkBuilder onSave={handleSave} />}
                    {active === 'classification' && <ClassificationTrainer onSave={handleSave} />}
                </div>

                {/* History Sidebar */}
                <div className="lg:w-80 flex-shrink-0 space-y-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm flex flex-col h-full max-h-[600px]">
                        <div className="flex items-center gap-2 mb-4">
                            <History size={16} className="text-adiptify-gold" />
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Recent Experiments</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                            {experimentHistory.length > 0 ? (
                                experimentHistory.map((h, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 hover:border-adiptify-gold/20 transition-colors group">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                <Clock size={10} /> {new Date(h.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-[9px] text-slate-500 border border-slate-100 dark:border-slate-700">ID: {h._id.slice(-4)}</span>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 capitalize truncate mb-2">
                                            {h.experimentType.replace('_', ' ')}
                                        </p>
                                        <div className="space-y-1">
                                            {h.result_metrics && Object.entries(h.result_metrics).slice(0, 3).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center text-[10px]">
                                                    <span className="text-slate-500 dark:text-slate-500 capitalize">{key}:</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                        {typeof value === 'number' ? value.toFixed(3) : String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="flex-1 py-1 rounded-lg bg-white dark:bg-slate-800 text-[9px] font-medium text-adiptify-gold border border-adiptify-gold/20 hover:bg-adiptify-gold hover:text-white transition-all">Restore</button>
                                            <button className="p-1 px-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-400 hover:text-red-500"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-32 flex flex-col items-center justify-center text-center p-4">
                                    <Clock size={24} className="text-slate-200 dark:text-slate-700 mb-2" />
                                    <p className="text-[11px] text-slate-400">No experiments logged yet</p>
                                </div>
                            )}
                        </div>

                        <button className="mt-4 w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2">
                            View Full History <ExternalLink size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

## File: `Frontend\src\pages\Leaderboard.jsx`

```jsx
import React from 'react';
import { useQuiz } from '../context/QuizContext';
import { motion } from 'framer-motion';
import { Trophy, Medal } from 'lucide-react';

const Leaderboard = () => {
    const { leaderboard, user } = useQuiz();

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-6">
                <Trophy className="text-adiptify-gold" size={28} />
                <h1 className="text-2xl font-bold text-adiptify-navy dark:text-white">Leaderboard</h1>
            </div>

            {leaderboard.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 p-12 text-center"
                >
                    <Medal className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
                    <h2 className="text-lg font-semibold text-slate-500 dark:text-slate-400">No scores yet</h2>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Complete a quiz to appear on the leaderboard!</p>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Rank</th>
                                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Name</th>
                                <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Score</th>
                                <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry, index) => {
                                const isCurrentUser = user && entry.name === user.name;
                                return (
                                    <tr
                                        key={index}
                                        className={`border-b border-slate-50 dark:border-slate-700/50 transition-colors ${isCurrentUser ? 'bg-adiptify-gold/5 dark:bg-adiptify-gold/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                                    >
                                        <td className="px-6 py-4">
                                            {index < 3 ? (
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400' :
                                                    index === 1 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                                                        'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-slate-500 dark:text-slate-400 pl-2">{index + 1}</span>
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 text-sm ${isCurrentUser ? 'font-bold text-adiptify-navy dark:text-adiptify-gold' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {entry.name} {isCurrentUser && <span className="text-adiptify-gold ml-1">(You)</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-semibold ${entry.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : entry.score >= 50 ? 'text-adiptify-gold' : 'text-red-500 dark:text-red-400'}`}>
                                                {entry.score}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-slate-400 dark:text-slate-500">
                                            {entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </motion.div>
            )}
        </div>
    );
};

export default Leaderboard;
```

## File: `Frontend\src\pages\Login.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useQuiz } from '../context/QuizContext';
import { loginUser, registerUser } from '../api/client';
import { LogIn, UserPlus, Sun, Moon, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from 'lucide-react';

const Login = () => {
    const [tab, setTab] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { resolvedTheme, toggleTheme } = useTheme();
    const { login } = useQuiz();
    const navigate = useNavigate();

    // Reset error when switching tabs
    useEffect(() => {
        setError('');
    }, [tab]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await loginUser(email.trim(), password);
            if (data && data.user) {
                login(data.user);
                navigate('/quiz-dashboard');
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (err) {
            setError(err.message || 'Connecting to server failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Name is required'); return; }
        setLoading(true);
        try {
            await registerUser({ name: name.trim(), email: email.trim(), password, studentId: studentId.trim() || undefined });
            // Auto-login after register
            const data = await loginUser(email.trim(), password);
            if (data && data.user) {
                login(data.user);
                navigate('/quiz-dashboard');
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const Orb = ({ className, delay }) => (
        <div 
            className={`absolute rounded-full mix-blend-screen filter blur-[80px] opacity-50 dark:opacity-30 animate-pulse ${className}`} 
            style={{ animationDelay: delay, animationDuration: '8s' }} 
        />
    );

    return (
        <div className="relative min-h-screen w-full overflow-y-auto bg-slate-50 dark:bg-[#0B0F19] flex transition-colors duration-500">
            {/* Background Animations — Adiptify branded orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden h-full w-full fixed">
                <Orb className="w-96 h-96 bg-adiptify-navy/60 dark:bg-adiptify-navy/40 top-[-10%] left-[-10%]" delay="0ms" />
                <Orb className="w-[40rem] h-[40rem] bg-adiptify-gold/30 dark:bg-adiptify-gold/15 bottom-[-20%] right-[-10%]" delay="2000ms" />
                <Orb className="w-80 h-80 bg-adiptify-olive/40 dark:bg-adiptify-olive/20 top-[20%] right-[10%]" delay="4000ms" />
                
                {/* Subtle Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)]"></div>
            </div>

            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/40 dark:bg-slate-800/60 backdrop-blur-md border border-white/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-adiptify-gold dark:hover:text-adiptify-gold shadow-lg transition-all duration-300 hover:scale-105"
                title={resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
                {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="relative z-10 flex w-full max-w-7xl mx-auto min-h-screen p-4 md:p-8 lg:p-12 gap-12 items-center justify-center">
                
                {/* Left Side: Form Container */}
                <motion.div
                    initial={{ opacity: 0, x: -40, y: 20 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-md xl:max-w-lg shrink-0 my-auto py-8"
                >
                    <div className="relative bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/50 rounded-[2.5rem] shadow-2xl p-8 sm:p-12 overflow-hidden">
                        
                        {/* Decorative top gradient border — Adiptify brand */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-adiptify-navy via-adiptify-gold to-adiptify-terracotta" />

                        {/* Logo & Header */}
                        <div className="mb-10 text-center relative z-10">
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.5, type: "spring", bounce: 0.5 }}
                                className="mb-6"
                            >
                                <img
                                    src={resolvedTheme === 'dark' ? '/logos/logo-dark-premium.png' : '/logos/logo-dark-gold.png'}
                                    alt="Adiptify — Adapting Your Education"
                                    className="h-20 w-auto mx-auto object-contain"
                                />
                            </motion.div>
                            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Your localized learning universe</p>
                        </div>

                        {/* Animated Tabs — Brand colors */}
                        <div className="relative flex p-1.5 mb-8 bg-slate-200/50 dark:bg-slate-800/80 rounded-2xl backdrop-blur-md z-10 w-full overflow-hidden">
                            <motion.div
                                className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-white dark:bg-slate-700/80 rounded-xl shadow-sm"
                                animate={{ x: tab === 'login' ? 0 : '100%' }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                            {['login', 'register'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`relative z-10 flex-1 py-3 text-sm font-bold transition-all duration-300 ${
                                        tab === t 
                                            ? 'text-adiptify-navy dark:text-adiptify-gold' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {t === 'login' ? 'Sign In' : 'Create Account'}
                                </button>
                            ))}
                        </div>

                        {/* Error Message */}
                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, y: -10, height: 0 }}
                                    className="mb-6 overflow-hidden"
                                >
                                    <div className="p-4 bg-red-50/90 dark:bg-red-900/30 border border-red-200/80 dark:border-red-800/50 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
                                        <AlertCircle size={18} className="text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm font-semibold text-red-800 dark:text-red-300 leading-relaxed shadow-sm">{error}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Forms wrapper */}
                        <div className="relative z-10">
                            <AnimatePresence mode="wait">
                                <motion.form
                                    key={tab}
                                    initial={{ opacity: 0, x: tab === 'login' ? -20 : 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: tab === 'login' ? 20 : -20 }}
                                    transition={{ duration: 0.3 }}
                                    onSubmit={tab === 'login' ? handleLogin : handleRegister} 
                                    className="space-y-5"
                                >
                                    {tab === 'register' && (
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="John Doe"
                                                required
                                                className="w-full px-5 py-3.5 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-adiptify-gold/60 focus:border-adiptify-gold transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@university.edu"
                                            required
                                            className="w-full px-5 py-3.5 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-adiptify-gold/60 focus:border-adiptify-gold transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                        />
                                    </div>

                                    {tab === 'register' && (
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                                Student ID <span className="text-slate-400 font-normal ml-1">Optional</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={studentId}
                                                onChange={(e) => setStudentId(e.target.value)}
                                                placeholder="e.g. 23BAI70412"
                                                className="w-full px-5 py-3.5 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-adiptify-gold/60 focus:border-adiptify-gold transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                                            {tab === 'login' && (
                                                <a href="#" className="flex-shrink-0 text-xs font-bold text-adiptify-terracotta dark:text-adiptify-gold hover:text-adiptify-gold dark:hover:text-adiptify-terracotta transition-colors">
                                                    Forgot?
                                                </a>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={tab === 'register' ? "Minimum 6 characters" : "••••••••"}
                                                required
                                                minLength={tab === 'register' ? 6 : undefined}
                                                className="w-full px-5 py-3.5 pr-14 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-adiptify-gold/60 focus:border-adiptify-gold transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowPassword(!showPassword)} 
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-adiptify-navy dark:hover:text-adiptify-gold p-1.5 rounded-lg transition-colors focus:outline-none"
                                            >
                                                {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="relative w-full overflow-hidden group mt-10 bg-gradient-to-r from-adiptify-navy to-[#1e2d45] hover:from-[#364a6b] hover:to-adiptify-navy text-white rounded-2xl py-4 font-extrabold text-[15px] transition-all shadow-[0_8px_25px_-8px_rgba(45,60,89,0.5)] active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
                                    >
                                        <div className="absolute inset-0 w-full h-full bg-adiptify-gold/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        {loading ? (
                                            <Loader2 size={20} className="animate-spin relative z-10" />
                                        ) : (
                                            tab === 'login' ? <LogIn size={20} className="relative z-10" strokeWidth={2.5} /> : <UserPlus size={20} className="relative z-10" strokeWidth={2.5} />
                                        )}
                                        <span className="relative z-10 tracking-wide uppercase">
                                            {loading 
                                                ? (tab === 'login' ? 'Authenticating...' : 'Creating Account...') 
                                                : (tab === 'login' ? 'Sign In to Dashboard' : 'Get Started Now')}
                                        </span>
                                    </button>
                                </motion.form>
                            </AnimatePresence>
                        </div>
                    </div>
                    
                    {/* Tiny footer under form */}
                    <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mt-8 drop-shadow-sm">
                        By continuing, you agree to Adiptify's <a href="#" className="text-adiptify-terracotta dark:text-adiptify-gold hover:underline">Terms of Service</a> & <a href="#" className="text-adiptify-terracotta dark:text-adiptify-gold hover:underline">Privacy Policy</a>
                    </p>
                </motion.div>

                {/* Right Side: Animated Hero (Hidden on smaller screens) */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    className="hidden lg:flex flex-col justify-center flex-1 h-[85vh] rounded-[3rem] p-12 relative overflow-hidden my-auto"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-adiptify-navy/10 via-transparent to-adiptify-gold/10 backdrop-blur-3xl border border-white/30 dark:border-white/10 rounded-[4rem] shadow-2xl"></div>
                    
                    {/* Hero Content Elements */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                        <motion.div
                            animate={{ y: [0, -20, 0] }}
                            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
                            className="bg-white/80 dark:bg-slate-800/80 p-8 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] mb-12 border border-white/50 dark:border-slate-700/50 backdrop-blur-md relative"
                        >
                            <div className="absolute -top-5 -right-5 bg-gradient-to-br from-adiptify-gold to-adiptify-terracotta text-white p-3 rounded-2xl rotate-12 shadow-xl border border-white/30">
                                <Sparkles size={24} strokeWidth={2.5} />
                            </div>
                            <img
                                src={resolvedTheme === 'dark' ? '/logos/logo-dark-premium.png' : '/logos/logo-dark-gold.png'}
                                alt="Adiptify"
                                className="h-24 w-auto object-contain"
                            />
                        </motion.div>

                        <h2 className="text-5xl xl:text-6xl font-extrabold text-slate-800 dark:text-white leading-[1.1] mb-8 tracking-tight">
                            Master any subject with <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-adiptify-navy to-adiptify-terracotta dark:from-adiptify-gold dark:to-adiptify-terracotta">Intelligent Adaptation</span>
                        </h2>
                        
                        <p className="text-lg xl:text-xl text-slate-600 dark:text-slate-300 max-w-lg mb-14 leading-relaxed font-medium">
                            Adiptify creates custom learning paths, interactive quizzes, and spaced repetition schedules based on your precise knowledge gaps.
                        </p>

                        <div className="flex items-center gap-5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 py-3.5 px-8 rounded-full shadow-lg backdrop-blur-xl border border-white/50 dark:border-slate-700/50">
                            <span className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-adiptify-olive animate-pulse shadow-[0_0_10px_rgba(148,163,120,0.8)]"></span>
                                AI Models Active
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            <span>Spaced Repetition</span>
                        </div>
                    </div>
                    
                    {/* Decorative abstract orbital rings */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 50, ease: "linear" }}
                        className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] border-2 border-adiptify-navy/10 dark:border-adiptify-gold/10 rounded-full border-dashed"
                    />
                    <motion.div 
                        animate={{ rotate: -360 }}
                        transition={{ repeat: Infinity, duration: 70, ease: "linear" }}
                        className="absolute -top-32 -right-32 w-[40rem] h-[40rem] border border-adiptify-gold/10 dark:border-adiptify-terracotta/10 rounded-full"
                    />
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
```

## File: `Frontend\src\pages\Quiz.jsx`

```jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import ProctoringShield from '../components/dashboard/ProctoringShield';

const Quiz = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addScore, quizzes } = useQuiz();

    const quiz = quizzes.find(q => String(q.id) === String(id));

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef(null);
    const answersRef = useRef(answers);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    const handleFinish = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!quiz) return;
        const currentAnswers = answersRef.current;
        let score = 0;
        quiz.questions.forEach((q, idx) => {
            if (currentAnswers[idx] === q.correctAnswer) {
                score += (100 / quiz.questions.length);
            }
        });
        const finalScore = Math.round(score);
        addScore(finalScore);
        navigate('/result', { state: { score: finalScore, quizId: quiz.id, answers: currentAnswers } });
    }, [quiz, addScore, navigate]);

    useEffect(() => {
        if (quiz) {
            setCurrentQuestionIndex(0);
            setAnswers({});
            answersRef.current = {};
            setTimeLeft(quiz.duration * 60);

            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [id, quiz]);

    useEffect(() => {
        if (timeLeft === 0 && quiz && timerRef.current === null) {
            // Timer just expired
        }
    }, [timeLeft]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    if (!quiz) return (
        <div className="flex-1 h-full flex flex-col items-center bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            <ProctoringShield />
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center max-w-md">
                <AlertTriangle className="mx-auto mb-3 text-red-500" size={40} />
                <h2 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Quiz Not Found</h2>
                <p className="text-red-600 dark:text-red-400 text-sm mb-4">This quiz session was not found or has expired.</p>
                <button
                    onClick={() => navigate('/quiz-dashboard')}
                    className="px-6 py-2.5 bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );

    const currentQuestion = quiz.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
    const isLowTime = timeLeft < 60;

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 relative">
            <ProctoringShield />
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
                <h1 className="text-xl font-bold text-adiptify-navy dark:text-white">{quiz.title}</h1>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm shadow-sm ${isLowTime ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`}>
                    <Clock size={16} />
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-adiptify-gold to-adiptify-terracotta rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4 }}
                    />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Question {currentQuestionIndex + 1} of {quiz.questions.length}
                </p>
            </div>

            {/* Question card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentQuestionIndex}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -50, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 p-6 mb-6">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5">
                            {currentQuestion.question}
                        </h2>
                        <div className="space-y-3">
                            {currentQuestion.options.map((option, idx) => {
                                const isSelected = answers[currentQuestionIndex] === idx;
                                return (
                                    <label
                                        key={idx}
                                        className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${isSelected
                                            ? 'border-adiptify-gold bg-adiptify-gold/5 dark:bg-adiptify-gold/10 shadow-sm'
                                            : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name={`question-${currentQuestionIndex}`}
                                            value={idx}
                                            checked={isSelected}
                                            onChange={() => setAnswers(prev => ({ ...prev, [currentQuestionIndex]: idx }))}
                                            className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected
                                            ? 'border-adiptify-gold bg-adiptify-gold'
                                            : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                        <span className={`text-sm ${isSelected ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {option}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <button
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={16} />
                    Previous
                </button>
                {currentQuestionIndex === quiz.questions.length - 1 ? (
                    <button
                        onClick={handleFinish}
                        className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all shadow-lg active:scale-[0.98]"
                    >
                        <CheckCircle size={16} />
                        Finish Quiz
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 font-semibold text-sm hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all active:scale-[0.98]"
                    >
                        Next
                        <ChevronRight size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default Quiz;
```

## File: `Frontend\src\pages\QuizDashboard.jsx`

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuiz } from '../context/QuizContext';
import AIQuizGenerator from '../components/quiz/AIQuizGenerator';
import { Play, Clock, HelpCircle, Trophy, Sparkles, BookOpen } from 'lucide-react';

const subjectColors = [
    'from-adiptify-navy to-blue-800',
    'from-adiptify-olive to-green-700',
    'from-adiptify-terracotta to-orange-700',
    'from-adiptify-gold to-yellow-600',
    'from-indigo-600 to-purple-700',
    'from-rose-600 to-red-700',
    'from-teal-600 to-cyan-700',
];

const QuizDashboard = () => {
    const navigate = useNavigate();
    const { user, leaderboard, quizzes } = useQuiz();

    const userStats = leaderboard.filter(entry => entry.name === user?.name);
    const bestScore = userStats.length > 0 ? Math.max(...userStats.map(s => s.score)) : 0;
    const attempts = userStats.length;

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
            {/* User Stats Banner */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mb-6"
            >
                <div className="bg-gradient-to-r from-adiptify-navy to-[#1e2d45] rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-adiptify-gold to-adiptify-terracotta flex items-center justify-center text-3xl font-bold text-adiptify-navy shadow-lg">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Hello, {user?.name || 'Student'}!</h2>
                            <p className="text-white/70 mt-1">Ready to sharpen your skills today?</p>
                            <div className="flex gap-3 mt-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/20 text-sm">
                                    <Trophy size={14} className="text-adiptify-gold" />
                                    Best: {bestScore}%
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/20 text-sm">
                                    <Sparkles size={14} className="text-adiptify-olive" />
                                    Attempts: {attempts}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* AI Quiz Generator */}
            <AIQuizGenerator />

            {/* Quiz Grid */}
            <h2 className="text-xl font-bold text-adiptify-navy dark:text-white mb-4 mt-6">Recommended Quizzes</h2>

            {quizzes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <BookOpen className="w-14 h-14 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-400 dark:text-slate-500 mb-2">No quizzes yet</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">Use the AI Quiz Generator above to create your first quiz, or enroll in subjects with existing content.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {quizzes.map((quiz, index) => (
                        <motion.div
                            key={quiz.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.08 }}
                            whileHover={{ y: -6 }}
                            className="group"
                        >
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full border border-slate-100 dark:border-slate-700">
                                {/* Colored header */}
                                <div className={`h-32 bg-gradient-to-br ${subjectColors[index % subjectColors.length]} relative`}>
                                    <span className="absolute bottom-2 right-4 text-6xl font-black text-white/10">
                                        {index + 1}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="text-lg font-bold text-adiptify-navy dark:text-white mb-1 group-hover:text-adiptify-terracotta transition-colors">
                                        {quiz.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-1">
                                        {quiz.description}
                                    </p>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-adiptify-olive border border-adiptify-olive/30 rounded-full px-2.5 py-1">
                                            <Clock size={12} />
                                            {quiz.duration} mins
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                                            <HelpCircle size={12} />
                                            {quiz.questions.length} Questions
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/quiz/${quiz.id}`)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all active:scale-[0.98]"
                                    >
                                        <Play size={16} />
                                        Start Examination
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuizDashboard;
```

## File: `Frontend\src\pages\Result.jsx`

```jsx
import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, CheckCircle, XCircle } from 'lucide-react';

const Result = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { quizzes } = useQuiz();
    const { score, quizId, answers } = location.state || { score: 0, quizId: null, answers: {} };

    const quiz = quizzes.find(q => String(q.id) === String(quizId));

    if (!quizId || !quiz) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4">No session data found.</h2>
                <button
                    onClick={() => navigate('/quiz-dashboard')}
                    className="px-6 py-2.5 bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const passed = score >= 50;

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
            <h1 className="text-2xl font-bold text-adiptify-navy dark:text-white text-center mb-6">Quiz Results</h1>

            {/* Score Card */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-md mx-auto mb-8"
            >
                <div className={`rounded-2xl p-8 text-center shadow-lg ${passed ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'}`}>
                    <div className={`text-7xl font-black mb-3 ${passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {score}%
                    </div>
                    <p className={`text-lg font-semibold ${passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                        {passed ? 'Great job! You passed.' : 'Keep practicing, you can do better!'}
                    </p>
                </div>
            </motion.div>

            {/* Answer Review */}
            <h2 className="text-lg font-bold text-adiptify-navy dark:text-white mb-4">Review Answers</h2>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden mb-8">
                {quiz.questions.map((q, idx) => {
                    const isCorrect = answers[idx] === q.correctAnswer;
                    return (
                        <div key={q.id} className={`p-5 ${idx < quiz.questions.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                    {idx + 1}. {q.question}
                                </h3>
                                <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${isCorrect
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                                    }`}>
                                    {isCorrect ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                    {isCorrect ? 'Correct' : 'Incorrect'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Your Answer: <span className="font-medium text-slate-700 dark:text-slate-200">{q.options[answers[idx]] || 'None'}</span>
                            </p>
                            {!isCorrect && (
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                                    Correct Answer: <span className="font-medium">{q.options[q.correctAnswer]}</span>
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={() => navigate('/quiz-dashboard')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all"
                >
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </button>
                <Link
                    to="/leaderboard"
                    className="flex items-center gap-2 px-6 py-2.5 border border-adiptify-navy dark:border-adiptify-gold text-adiptify-navy dark:text-adiptify-gold rounded-xl font-semibold hover:bg-adiptify-navy/5 dark:hover:bg-adiptify-gold/10 transition-all"
                >
                    <Trophy size={16} />
                    View Leaderboard
                </Link>
            </div>
        </div>
    );
};

export default Result;
```

## File: `Frontend\src\pages\SpacedReview.jsx`

```jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdaptify } from '../context/AdaptifyContext';
import { RotateCcw, Zap, CheckCircle2, Brain, ChevronRight, RefreshCw, Calendar, BookOpen, AlertCircle } from 'lucide-react';

const QUALITY_BUTTONS = [
    { score: 0, label: 'Blackout', desc: 'No recall', color: 'bg-red-500 hover:bg-red-600' },
    { score: 1, label: 'Wrong', desc: 'Incorrect, recognized', color: 'bg-red-400 hover:bg-red-500' },
    { score: 2, label: 'Hard', desc: 'Incorrect, seemed easy', color: 'bg-orange-400 hover:bg-orange-500' },
    { score: 3, label: 'Difficult', desc: 'Correct with difficulty', color: 'bg-amber-400 hover:bg-amber-500' },
    { score: 4, label: 'Good', desc: 'Correct, some thought', color: 'bg-emerald-400 hover:bg-emerald-500' },
    { score: 5, label: 'Easy', desc: 'Perfect recall', color: 'bg-emerald-500 hover:bg-emerald-600' },
];

function Flashcard({ concept, onRate, isFlipped, onFlip }) {
    return (
        <div className="perspective-1000 w-full max-w-xl mx-auto" style={{ perspective: '1000px' }}>
            <div className={`relative w-full min-h-[280px] transition-transform duration-500 cursor-pointer`} onClick={onFlip} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* Front */}
                <div className="absolute inset-0 rounded-2xl p-8 bg-gradient-to-br from-adiptify-navy to-slate-700 text-white flex flex-col justify-center items-center shadow-xl" style={{ backfaceVisibility: 'hidden' }}>
                    <span className="text-[10px] uppercase tracking-widest text-adiptify-gold/80 font-semibold mb-4">{concept.category}</span>
                    <h3 className="text-2xl font-bold text-center mb-3">{concept.title}</h3>
                    <p className="text-sm text-slate-300 text-center max-w-sm">{concept.description}</p>
                    <p className="mt-6 text-xs text-slate-400 flex items-center gap-1"><RotateCcw size={12} /> Tap to reveal answer</p>
                </div>
                {/* Back */}
                <div className="absolute inset-0 rounded-2xl p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col justify-center overflow-y-auto" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-3">Explanation</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{concept.pipeline?.explanation || concept.description}</p>
                    {concept.pipeline?.practiceQuestions?.[0] && (
                        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/40 dark:border-blue-500/20">
                            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Quick Check: {concept.pipeline.practiceQuestions[0].question}</p>
                            <p className="text-[10px] text-blue-500 dark:text-blue-400/70 mt-1">Answer: {concept.pipeline.practiceQuestions[0].options[concept.pipeline.practiceQuestions[0].correctAnswer]}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SpacedReview() {
    const { dueReviews, concepts, submitReview, enrolledSubjects, loading } = useAdaptify();
    const navigate = useNavigate();
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewed, setReviewed] = useState([]);
    const [sessionStats, setSessionStats] = useState({ total: 0, avgQuality: 0 });

    const reviewItems = useMemo(() => {
        if (!dueReviews || dueReviews.length === 0) return [];
        return dueReviews.map(r => ({
            ...r,
            concept: r.concept || concepts.find(c => c.conceptId === r.conceptId) || { title: r.conceptId, description: '', category: 'Unknown', pipeline: {} },
        }));
    }, [dueReviews, concepts]);

    const remaining = reviewItems.filter(r => !reviewed.includes(r.conceptId));
    const current = remaining[0];

    const handleRate = async (quality) => {
        if (!current) return;
        await submitReview(current.conceptId, quality);
        setReviewed(prev => [...prev, current.conceptId]);
        setSessionStats(prev => ({
            total: prev.total + 1,
            avgQuality: ((prev.avgQuality * prev.total) + quality) / (prev.total + 1),
        }));
        setIsFlipped(false);
    };

    const resetSession = () => {
        setReviewed([]);
        setSessionStats({ total: 0, avgQuality: 0 });
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-3 border-adiptify-gold border-t-transparent rounded-full" />
            </div>
        );
    }

    // No enrolled subjects
    if (!enrolledSubjects || enrolledSubjects.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 p-8">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Subjects Enrolled</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Enroll in subjects and generate study modules to start spaced review.</p>
                    <button onClick={() => navigate('/catalog')} className="px-6 py-2.5 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white font-medium text-sm hover:bg-slate-700 transition-colors">
                        Browse Subjects
                    </button>
                </div>
            </div>
        );
    }

    // No concepts generated yet
    if (concepts.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 p-8">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={28} className="text-purple-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Generate Study Modules First</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Head to Study Modules to generate AI content, then come back for spaced review.</p>
                    <button onClick={() => navigate('/modules')} className="px-6 py-2.5 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors flex items-center gap-2 mx-auto">
                        <BookOpen size={16} /> Go to Study Modules
                    </button>
                </div>
            </div>
        );
    }

    // No reviews due — all caught up!
    if (reviewItems.length === 0 && reviewed.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 p-8">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40">
                        <CheckCircle2 size={36} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">All Caught Up! 🎉</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        No concepts are due for review right now. Keep studying to add more cards!
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => navigate('/modules')} className="px-5 py-2.5 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white font-medium text-sm hover:bg-slate-700 transition-colors flex items-center gap-2">
                            <BookOpen size={16} /> Study More
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Session complete
    if (!current || remaining.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 p-8">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40">
                        <CheckCircle2 size={36} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Review Session Complete! 🎉</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        You reviewed <span className="font-semibold text-slate-700 dark:text-slate-200">{sessionStats.total}</span> concepts
                        with an average quality of <span className="font-semibold text-slate-700 dark:text-slate-200">{sessionStats.avgQuality.toFixed(1)}/5</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-center">
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{sessionStats.total}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cards Reviewed</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-center">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sessionStats.avgQuality.toFixed(1)}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Avg Quality</p>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-center">
                        <button onClick={resetSession} className="px-6 py-2.5 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white font-medium text-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors flex items-center gap-2">
                            <RefreshCw size={16} /> Review Again
                        </button>
                        <button onClick={() => navigate('/modules')} className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
                            <BookOpen size={16} /> Study More
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Header */}
            <header className="px-8 py-6 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                            <Brain className="text-purple-500" size={28} />
                            Spaced Review
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">SM-2 algorithm-powered memory optimization.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200/60 dark:border-purple-500/20">
                            <Calendar size={14} className="text-purple-500" />
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">{remaining.length} cards remaining</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
                            <Zap size={14} className="text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{reviewed.length} reviewed</span>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-adiptify-gold transition-all duration-500" style={{ width: `${reviewItems.length > 0 ? (reviewed.length / reviewItems.length) * 100 : 0}%` }} />
                </div>
            </header>

            {/* Flashcard Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
                <Flashcard concept={current.concept} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} />

                {/* Quality Rating */}
                {isFlipped && (
                    <div className="w-full max-w-xl animate-fadeIn">
                        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-3 font-medium uppercase tracking-wider">How well did you recall this?</p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {QUALITY_BUTTONS.map(btn => (
                                <button key={btn.score} onClick={() => handleRate(btn.score)} className={`${btn.color} text-white rounded-xl p-2.5 text-center transition-all hover:scale-105 hover:shadow-md`}>
                                    <p className="text-sm font-bold">{btn.score}</p>
                                    <p className="text-[10px] font-medium opacity-90">{btn.label}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!isFlipped && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5"><RotateCcw size={12} /> Click the card to reveal the answer, then rate your recall</p>
                )}
            </div>
        </div>
    );
}
```

## File: `Frontend\src\pages\StudyModules.jsx`

```jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdaptify } from '../context/AdaptifyContext';
import { BookOpen, Clock, TrendingUp, Filter, ChevronRight, Zap, Brain, BarChart3, Sparkles, Loader2, AlertCircle } from 'lucide-react';

const CATEGORY_COLORS_LIST = [
    { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', ring: 'stroke-blue-500' },
    { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', ring: 'stroke-purple-500' },
    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', ring: 'stroke-emerald-500' },
    { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', ring: 'stroke-amber-500' },
    { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', ring: 'stroke-rose-500' },
    { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', ring: 'stroke-cyan-500' },
    { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', ring: 'stroke-indigo-500' },
    { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', ring: 'stroke-teal-500' },
];

function getCategoryColors(category, index) {
    return CATEGORY_COLORS_LIST[index % CATEGORY_COLORS_LIST.length];
}

const DIFFICULTY_LABELS = ['', 'Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert'];
const DIFFICULTY_COLORS = ['', 'text-emerald-500', 'text-sky-500', 'text-amber-500', 'text-orange-500', 'text-red-500'];

function MasteryRing({ value, size = 48, stroke = 4, color = 'stroke-adiptify-gold' }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (value / 100) * circumference;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200 dark:text-slate-700" />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={progress} className={color} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">{value}%</span>
        </div>
    );
}

function ConceptCard({ concept, progress, onClick, colorIndex }) {
    const colors = getCategoryColors(concept.category, colorIndex);
    const mastery = Math.round((progress?.mastery_score || 0) * 100);
    const stage = progress?.pipeline_stage || 0;
    const stages = ['Learn', 'Demo', 'Practice', 'Apply', 'Evaluate'];

    return (
        <button onClick={onClick} className={`group relative w-full text-left p-5 rounded-2xl border ${colors.border} bg-white dark:bg-slate-800 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-900/60 hover:-translate-y-0.5 transition-all duration-300`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text} mb-2`}>{concept.category}</span>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">{concept.title}</h3>
                </div>
                <MasteryRing value={mastery} color={colors.ring} />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{concept.description}</p>

            {/* Difficulty badge */}
            <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-semibold ${DIFFICULTY_COLORS[concept.difficulty_level]}`}>
                    ◆ {DIFFICULTY_LABELS[concept.difficulty_level]}
                </span>
                {concept.prerequisites?.length > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{concept.prerequisites.length} prereq{concept.prerequisites.length > 1 ? 's' : ''}</span>
                )}
            </div>

            {/* Pipeline progress bar */}
            <div className="flex gap-1 mb-4">
                {stages.map((s, i) => (
                    <div key={s} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className={`w-full h-1.5 rounded-full transition-colors ${i <= stage ? 'bg-adiptify-gold' : 'bg-slate-100 dark:bg-slate-700'}`} />
                        <span className="text-[8px] text-slate-400 dark:text-slate-500">{s}</span>
                    </div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 relative z-10" onClick={e => e.stopPropagation()}>
                <button
                    onClick={(e) => { e.preventDefault(); /* Logic to start quiz */ }}
                    className="flex-1 px-3 py-2 bg-adiptify-gold text-adiptify-navy font-semibold text-xs rounded-xl hover:bg-adiptify-gold/90 transition-all active:scale-[0.98]"
                >
                    Start Quiz
                </button>
                <button
                    onClick={(e) => { e.preventDefault(); /* Logic to mark complete */ }}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                >
                    Mark Complete
                </button>
            </div>

            <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-hover:text-adiptify-gold group-hover:translate-x-1 transition-all" />
        </button>
    );
}

// Empty state when no enrolled subjects
function NoSubjectsState() {
    const navigate = useNavigate();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/20 dark:to-amber-500/10 flex items-center justify-center mb-6">
                <AlertCircle size={36} className="text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Subjects Enrolled</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
                Enroll in subjects from the Subject Explorer to unlock AI-powered study modules, spaced review, and analytics.
            </p>
            <button
                onClick={() => navigate('/catalog')}
                className="px-6 py-2.5 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white font-medium text-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
            >
                Browse Subjects
            </button>
        </div>
    );
}

// Empty state when enrolled but no concepts generated yet
function GenerateModulesState({ onGenerate, generating, generateStatus }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-500/20 dark:to-blue-500/10 flex items-center justify-center mb-6">
                <Sparkles size={36} className="text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                {generating ? 'Generating Study Modules...' : 'Ready to Generate Study Modules'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
                {generating
                    ? generateStatus || 'AI is creating personalized study concepts from your enrolled subjects. This may take a minute...'
                    : 'Your enrolled subjects have topics ready. Click below to let AI generate 8 study concepts per topic with explanations, practice questions, and application tasks.'}
            </p>
            {generating ? (
                <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200/40 dark:border-purple-500/20">
                    <Loader2 size={20} className="text-purple-500 animate-spin" />
                    <span className="text-sm text-purple-700 dark:text-purple-400 font-medium">{generateStatus || 'Generating...'}</span>
                </div>
            ) : (
                <button
                    onClick={onGenerate}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm hover:from-purple-600 hover:to-blue-600 transition-all shadow-lg shadow-purple-200 dark:shadow-purple-900/30 flex items-center gap-2"
                >
                    <Sparkles size={18} />
                    Generate AI Study Modules
                </button>
            )}
        </div>
    );
}

export default function StudyModules() {
    const { concepts, userProgress, loading, dueReviews, enrolledSubjects, generating, generateStatus, generateModules } = useAdaptify();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [studyMode, setStudyMode] = useState('quick'); // quick, exam, deep

    // Build category list from actual concepts (subjects)
    const categories = useMemo(() => {
        const cats = new Set(concepts.map(c => c.category));
        return ['all', ...Array.from(cats)];
    }, [concepts]);

    // Assign color index per category
    const categoryColorMap = useMemo(() => {
        const map = {};
        const uniqueCats = [...new Set(concepts.map(c => c.category))];
        uniqueCats.forEach((cat, i) => { map[cat] = i; });
        return map;
    }, [concepts]);

    const filtered = useMemo(() => {
        return concepts.filter(c => {
            if (filter !== 'all' && c.category !== filter) return false;
            if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [concepts, filter, search]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-3 border-adiptify-gold border-t-transparent rounded-full" />
            </div>
        );
    }

    // No enrolled subjects
    if (!enrolledSubjects || enrolledSubjects.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                    <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <BookOpen className="text-adiptify-gold" size={28} />
                        Study Modules
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Master concepts through the structured learning pipeline.</p>
                </header>
                <NoSubjectsState />
            </div>
        );
    }

    // Enrolled but no concepts generated yet
    if (concepts.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                    <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <BookOpen className="text-adiptify-gold" size={28} />
                        Study Modules
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        You're enrolled in {enrolledSubjects.length} subject{enrolledSubjects.length > 1 ? 's' : ''}. Generate AI modules to start learning.
                    </p>
                </header>
                <GenerateModulesState onGenerate={generateModules} generating={generating} generateStatus={generateStatus} />
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Header */}
            <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                            <BookOpen className="text-adiptify-gold" size={28} />
                            Study Modules
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Master concepts through the structured learning pipeline.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={generateModules}
                            disabled={generating}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200/60 dark:border-purple-500/20 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                        >
                            {generating ? <Loader2 size={14} className="text-purple-500 animate-spin" /> : <Sparkles size={14} className="text-purple-500" />}
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                                {generating ? 'Generating...' : 'Regenerate'}
                            </span>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
                            <Clock size={14} className="text-amber-500" />
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{dueReviews.length} due for review</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
                            <TrendingUp size={14} className="text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{concepts.length} concepts</span>
                        </div>
                    </div>
                </div>

                {/* Filters + Search */}
                <div className="flex flex-wrap items-center gap-3 mt-5">
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
                        <Filter size={14} className="text-slate-400" />
                        <select value={filter} onChange={e => setFilter(e.target.value)} className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-transparent outline-none cursor-pointer">
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat === 'all' ? 'All Subjects' : cat}</option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="text"
                        placeholder="Search concepts..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="text-xs px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-adiptify-gold/50 focus:ring-2 focus:ring-adiptify-gold/10 transition w-52"
                    />
                    
                    {/* Mode Switch */}
                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                        {['quick', 'exam', 'deep'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setStudyMode(mode)}
                                className={`px-4 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                                    studyMode === mode
                                        ? 'bg-white dark:bg-slate-700 text-adiptify-navy dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="px-8 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 border border-blue-200/40 dark:border-blue-500/20">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Brain size={20} className="text-blue-500" /></div>
                    <div>
                        <p className="text-xs text-blue-500/80 dark:text-blue-400 font-medium">Concepts Studied</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{Object.keys(userProgress).length} / {concepts.length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/10 dark:to-amber-500/5 border border-amber-200/40 dark:border-amber-500/20">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Zap size={20} className="text-amber-500" /></div>
                    <div>
                        <p className="text-xs text-amber-500/80 dark:text-amber-400 font-medium">Pipeline Completions</p>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{Object.values(userProgress).filter(p => p.pipeline_completed || p.pipeline_stage >= 4).length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><BarChart3 size={20} className="text-emerald-500" /></div>
                    <div>
                        <p className="text-xs text-emerald-500/80 dark:text-emerald-400 font-medium">Avg Mastery</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                            {Object.values(userProgress).length > 0
                                ? Math.round(Object.values(userProgress).reduce((sum, p) => sum + (p.mastery_score || 0), 0) / Object.values(userProgress).length * 100)
                                : 0}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Concept Grid */}
            <div className="p-8 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filtered.map(concept => (
                        <ConceptCard
                            key={concept.conceptId}
                            concept={concept}
                            progress={userProgress[concept.conceptId]}
                            colorIndex={categoryColorMap[concept.category] || 0}
                            onClick={() => navigate(`/concept/${concept.conceptId}`)}
                        />
                    ))}
                </div>
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                        <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No concepts match your filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
```

## File: `Frontend\src\pages\SubjectCatalog.jsx`

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Typography, Grid, Card, CardContent, Chip, Box, Button,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions,
    IconButton, Menu, MenuItem, Alert, CircularProgress, Tabs, Tab,
    Collapse, Paper, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Add, Edit, Delete, KeyboardArrowDown, School, Business, ExpandMore, ExpandLess, Save } from '@mui/icons-material';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import FolderDeleteIcon from '@mui/icons-material/FolderDelete';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuiz } from '../context/QuizContext';
import { apiFetch } from '../api/client';
import GraphExplorer from '../components/graph/GraphExplorer';

/* ─── helpers ─── */
const PALETTE = ['#1DCD9F', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const catColor = cat => PALETTE[Math.abs([...cat].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length];

/* ─── SUBJECT CARD ─── */
function SubjectCard({ subject, user, isOrganization, onEdit, onDelete, isSelected, onSelect }) {
    const [anchor, setAnchor] = useState(null);
    const color = subject.color || catColor(subject.domainCategory || 'x');
    const canManage = true; // User requested CRUD UI to be visible

    return (
        <motion.div layout initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: .95 }} transition={{ duration: .22 }}>
            <Card onClick={() => onSelect(subject)} sx={{
                borderRadius: 3, height: '100%', borderTop: `5px solid ${color}`, cursor: 'pointer',
                transition: 'box-shadow .2s, transform .15s',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isSelected ? `0 0 0 2.5px ${color}, 0 8px 24px rgba(0,0,0,.12)` : undefined,
                '&:hover': { boxShadow: `0 4px 20px rgba(0,0,0,.1)`, transform: 'translateY(-2px)' }
            }}>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={.5}>
                        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
                            {subject.icon || '📚'} {subject.name}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={.5}>
                            {subject.status === 'pending_validation' && <Chip size="small" label="Pending" color="warning" />}
                            {canManage && (
                                <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                    <Chip size="small" label={subject.domainCategory || 'General'} sx={{ mb: 1.5, fontSize: '.7rem' }} />
                    <Typography variant="body2" color="text.secondary" sx={{
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'
                    }}>
                        {subject.description || 'No description provided.'}
                    </Typography>
                </CardContent>
            </Card>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => { setAnchor(null); onEdit(subject); }}>✏️ Edit Subject</MenuItem>
                <MenuItem onClick={() => { setAnchor(null); onDelete(subject._id, subject.name); }} sx={{ color: 'error.main' }}>
                    🗑️ Delete Subject
                </MenuItem>
            </Menu>
        </motion.div>
    );
}

/* ─── CATEGORY HEADER with actions ─── */
function CategorySection({ cat, subjects, user, isOrganization, selectedId, onEdit, onDelete, onSelect, onRenameCategory, onDeleteCategory }) {
    const [expanded, setExpanded] = useState(true);
    const color = catColor(cat);
    const canAdmin = true; // User requested CRUD UI to be visible

    return (
        <Box mb={5}>
            <Box display="flex" alignItems="center" gap={1} mb={2}
                sx={{ borderBottom: `2px solid ${color}`, pb: .75 }}>
                <Typography variant="subtitle1" fontWeight="bold" flex={1}>{cat}</Typography>
                <Chip size="small" label={`${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`}
                    sx={{ bgcolor: color + '22', color }} />
                {canAdmin && (
                    <>
                        <IconButton size="small" title="Rename category" onClick={() => onRenameCategory(cat)}>
                            <DriveFileRenameOutlineIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Delete category" color="error" onClick={() => onDeleteCategory(cat, subjects.length)}>
                            <FolderDeleteIcon fontSize="small" />
                        </IconButton>
                    </>
                )}
                <IconButton size="small" onClick={() => setExpanded(v => !v)}>
                    {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </IconButton>
            </Box>
            <Collapse in={expanded}>
                <Grid container spacing={2.5}>
                    {subjects.map(sub => (
                        <Grid item xs={12} sm={6} md={4} key={sub._id}>
                            <SubjectCard subject={sub} user={user} isOrganization={isOrganization}
                                onEdit={onEdit} onDelete={onDelete}
                                isSelected={selectedId === sub._id}
                                onSelect={onSelect} />
                        </Grid>
                    ))}
                </Grid>
            </Collapse>
        </Box>
    );
}

/* ─── SYLLABUS PANEL (inline) ─── */
function SyllabusPanel({ subject }) {
    const [modules, setModules] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [openMods, setOpenMods] = useState([]);

    useEffect(() => {
        if (!subject?._id) return;
        setLoading(true);
        apiFetch(`/api/syllabus/${subject._id}`)
            .then(d => setModules(Array.isArray(d?.modules) ? d.modules : []))
            .catch(() => setModules([]))
            .finally(() => setLoading(false));
    }, [subject?._id]);

    const toggleMod = i => setOpenMods(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]);

    const save = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/syllabus', { method: 'POST', body: { subjectId: subject._id, modules } });
        } catch (e) {
            alert('Save failed: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const updateMod = (mi, field, value) =>
        setModules(prev => prev.map((m, i) => i === mi ? { ...m, [field]: value } : m));

    const removeMod = mi =>
        setModules(prev => prev.filter((_, i) => i !== mi));

    const addMod = () => {
        setModules(prev => [...prev, { title: '', description: '', topics: [] }]);
        setOpenMods(p => [...p, modules.length]);
    };

    const addTopic = mi =>
        setModules(prev => prev.map((m, i) =>
            i === mi ? { ...m, topics: [...(m.topics || []), { title: '', description: '' }] } : m
        ));

    const updateTopic = (mi, ti, field, value) =>
        setModules(prev => prev.map((m, i) =>
            i !== mi ? m : {
                ...m,
                topics: m.topics.map((t, j) => j === ti ? { ...t, [field]: value } : t)
            }
        ));

    const removeTopic = (mi, ti) =>
        setModules(prev => prev.map((m, i) =>
            i !== mi ? m : { ...m, topics: m.topics.filter((_, j) => j !== ti) }
        ));

    if (loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>;

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold">📋 Syllabus — {subject.name}</Typography>
                <Button variant="contained" size="small"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    disabled={saving} onClick={save}>Save</Button>
            </Box>
            <AnimatePresence>
                {modules.map((mod, mi) => (
                    <motion.div key={`mod-${mi}`} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: .2 }}>
                        <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2, borderLeft: '4px solid #3b82f6', overflow: 'hidden' }}>
                            <Box display="flex" alignItems="center" px={2} py={1.5}
                                sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleMod(mi)}>
                                <Box flex={1} onClick={e => e.stopPropagation()}>
                                    <TextField variant="standard" placeholder={`Module ${mi + 1} title…`}
                                        value={mod.title} fullWidth
                                        onChange={e => updateMod(mi, 'title', e.target.value)}
                                        sx={{ '& input': { fontWeight: 600, fontSize: 15 } }} />
                                </Box>
                                <IconButton size="small" color="error"
                                    onClick={e => { e.stopPropagation(); removeMod(mi); }}>
                                    <Delete fontSize="small" />
                                </IconButton>
                                {openMods.includes(mi) ? <ExpandLess /> : <ExpandMore />}
                            </Box>
                            <Collapse in={openMods.includes(mi)} unmountOnExit>
                                <Box px={2} pb={2}>
                                    <TextField fullWidth label="Module description" size="small" multiline rows={1} sx={{ mb: 2 }}
                                        value={mod.description}
                                        onChange={e => updateMod(mi, 'description', e.target.value)} />
                                    {(mod.topics || []).map((t, ti) => (
                                        <Box key={`topic-${mi}-${ti}`} display="flex" gap={1} mb={1.5} pl={2} alignItems="flex-start">
                                            <TextField size="small" label="Topic" sx={{ flex: 1 }}
                                                value={t.title}
                                                onChange={e => updateTopic(mi, ti, 'title', e.target.value)} />
                                            <TextField size="small" label="Description" sx={{ flex: 2 }}
                                                value={t.description}
                                                onChange={e => updateTopic(mi, ti, 'description', e.target.value)} />
                                            <IconButton size="small" color="error" onClick={() => removeTopic(mi, ti)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                    <Button size="small" startIcon={<Add />} sx={{ ml: 2 }}
                                        onClick={() => addTopic(mi)}>
                                        Add Topic
                                    </Button>
                                </Box>
                            </Collapse>
                        </Paper>
                    </motion.div>
                ))}
            </AnimatePresence>
            <Button variant="outlined" startIcon={<Add />} fullWidth
                sx={{ py: 1.5, borderStyle: 'dashed', borderRadius: 2, mt: 1 }}
                onClick={addMod}>
                Add Module
            </Button>
        </Box>
    );
}

/* ─── MAIN PAGE ─── */
const SubjectCatalog = () => {
    const { user, refreshSubjects } = useQuiz();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [selectedSubject, setSelectedSubject] = useState(null);

    /* subject form */
    const [showCreate, setShowCreate] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState({ name: '', domainCategory: '', description: '', learningOutcomes: '' });
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [bypassValidation, setBypassValidation] = useState(false);
    const [createMode, setCreateMode] = useState('manual');
    const [pdfFile, setPdfFile] = useState(null);
    const [pptFile, setPptFile] = useState(null);
    const [parsingPdf, setParsingPdf] = useState(false);
    const [parsingPpt, setParsingPpt] = useState(false);
    const [parsedSyllabus, setParsedSyllabus] = useState([]);
    const [pdfMeta, setPdfMeta] = useState(null);
    const [slideData, setSlideData] = useState(null);

    /* category dialogs */
    const [renameDialog, setRenameDialog] = useState({ open: false, cat: '', newName: '' });
    const [deleteCatDialog, setDeleteCatDialog] = useState({ open: false, cat: '', count: 0, mode: 'delete', reassignTo: '' });
    const [catBusy, setCatBusy] = useState(false);

    const isOrganization = user?.accountType === 'organization';

    const loadSubjects = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/api/subjects');
            setSubjects(Array.isArray(data) ? data : []);
        } catch { setSubjects([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadSubjects(); }, [loadSubjects]);

    const grouped = subjects.reduce((acc, sub) => {
        const cat = sub.domainCategory || sub.category?.name || sub.category || 'Uncategorized';
        (acc[cat] = acc[cat] || []).push(sub);
        return acc;
    }, {});

    /* ── subject CRUD ── */
    const handleSelectSubject = sub => { setSelectedSubject(sub); setTab(1); };

    const handleEdit = sub => {
        setForm({
            name: sub.name || '', domainCategory: sub.domainCategory || sub.category || '',
            description: sub.description || '', learningOutcomes: (sub.learningOutcomes || []).join('\n')
        });
        setEditTarget(sub); setIsEditing(true); setShowCreate(true);
    };

    const handleDeleteSubject = async (id, name) => {
        if (!window.confirm(`Delete subject "${name}"?`)) return;
        try {
            await apiFetch(`/api/subjects/${id}`, { method: 'DELETE' });
            if (selectedSubject?._id === id) setSelectedSubject(null);
            await loadSubjects(); refreshSubjects?.();
        } catch (e) { alert(e.message); }
    };

    const handleValidate = async () => {
        if (!form.name || !form.domainCategory) return;
        setValidating(true); setValidationResult(null);
        try {
            const val = await apiFetch('/api/ai/validate-subject', {
                method: 'POST',
                body: {
                    subjectData: {
                        name: form.name, domainCategory: form.domainCategory,
                        description: form.description, learningOutcomes: form.learningOutcomes.split('\n').filter(Boolean),
                        type: isOrganization ? 'organization' : 'general'
                    },
                    bypassValidation: bypassValidation && user?.role === 'admin'
                }
            });
            setValidationResult(val);
        } catch (e) { alert('Validation failed: ' + e.message); } finally { setValidating(false); }
    };

    const handleParsePdf = async (autoCreate = false) => {
        if (!pdfFile) return;
        setParsingPdf(true);
        setPdfMeta(null);
        const formData = new FormData();
        formData.append('file', pdfFile);
        if (autoCreate) formData.append('autoCreate', 'true');

        try {
            const token = localStorage.getItem('adiptify_token');
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/ai/parse-pdf`, {
                method: 'POST',
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: formData
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Parse failed');
            }
            const data = await res.json();

            if (data._createdSubject) {
                // Auto-created — reload and navigate directly
                await loadSubjects(); refreshSubjects?.();
                setSelectedSubject(data._createdSubject);
                setTab(1);
                closeModal();
                return;
            }

            // Manual mode — fill form for review
            if (data) {
                setForm({
                    name: data.name || '',
                    description: data.description || '',
                    domainCategory: data.category || '',
                    learningOutcomes: (data.learningOutcomes || []).join('\n')
                });
                const modules = (data.modules || []).map(m => ({ ...m, topics: m.topics || [] }));
                setParsedSyllabus(modules);
                if (data._meta) setPdfMeta(data._meta);
                setCreateMode('manual');
            }
        } catch (e) {
            alert("Failed to parse PDF: " + e.message);
        } finally {
            setParsingPdf(false);
        }
    };

    const handleParsePpt = async (autoCreate = false) => {
        if (!pptFile) return;
        setParsingPpt(true);
        setPdfMeta(null);
        setSlideData(null);
        const formData = new FormData();
        formData.append('file', pptFile);
        if (autoCreate) formData.append('autoCreate', 'true');

        try {
            const token = localStorage.getItem('adiptify_token');
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/ai/parse-ppt`, {
                method: 'POST',
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: formData
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Parse failed');
            }
            const data = await res.json();

            if (data._createdSubject) {
                await loadSubjects(); refreshSubjects?.();
                setSelectedSubject(data._createdSubject);
                setTab(1);
                closeModal();
                return;
            }

            if (data) {
                setForm({
                    name: data.name || '',
                    description: data.description || '',
                    domainCategory: data.category || '',
                    learningOutcomes: (data.learningOutcomes || []).join('\n')
                });
                const modules = (data.modules || []).map(m => ({ ...m, topics: m.topics || [] }));
                setParsedSyllabus(modules);
                if (data._meta) setPdfMeta(data._meta);
                if (data._slideData) setSlideData(data._slideData);
                setCreateMode('manual');
            }
        } catch (e) {
            alert("Failed to parse PPT: " + e.message);
        } finally {
            setParsingPpt(false);
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        const body = {
            name: form.name, domainCategory: form.domainCategory,
            description: form.description, learningOutcomes: form.learningOutcomes.split('\n').filter(Boolean),
            type: isOrganization ? 'organization' : 'general'
        };
        try {
            let savedSubject;
            if (isEditing && editTarget) {
                savedSubject = await apiFetch(`/api/subjects/${editTarget._id}`, { method: 'PUT', body });
            } else {
                savedSubject = await apiFetch('/api/subjects', { method: 'POST', body });
            }

            if (parsedSyllabus.length > 0) {
                await apiFetch('/api/syllabus', {
                    method: 'POST',
                    body: { subjectId: savedSubject._id, modules: parsedSyllabus }
                });
            }

            // Store PPT slide JSON as Content for future study module rendering
            if (slideData) {
                try {
                    await apiFetch('/api/content', {
                        method: 'POST',
                        body: {
                            subjectId: savedSubject._id,
                            type: 'pptx',
                            contentBody: `PPT upload: ${pdfMeta?.filename || pptFile?.name || 'unknown'}`,
                            slideData: slideData,
                            metadata: { source: 'ppt-upload', filename: pdfMeta?.filename || pptFile?.name }
                        }
                    });
                } catch (e) {
                    console.warn('Failed to store PPT slide data:', e.message);
                }
            }

            await loadSubjects(); refreshSubjects?.();
            closeModal();

            if (parsedSyllabus.length > 0) {
                setSelectedSubject(savedSubject);
                setTab(1);
            }
        } catch (e) { alert(e.message || 'Failed to save'); } finally { setSaving(false); }
    };

    const closeModal = () => {
        if (saving || validating) return;
        setShowCreate(false); setIsEditing(false); setEditTarget(null);
        setForm({ name: '', domainCategory: '', description: '', learningOutcomes: '' });
        setValidationResult(null); setBypassValidation(false);
        setCreateMode('manual'); setPdfFile(null); setPptFile(null); setParsedSyllabus([]); setPdfMeta(null); setSlideData(null);
    };

    /* ── category CRUD ── */
    const openRename = cat => setRenameDialog({ open: true, cat, newName: cat });
    const openDeleteCat = (cat, count) => setDeleteCatDialog({ open: true, cat, count, mode: 'delete', reassignTo: '' });

    const doRename = async () => {
        if (!renameDialog.newName.trim()) return;
        setCatBusy(true);
        try {
            await apiFetch(`/api/subjects/category/${encodeURIComponent(renameDialog.cat)}`, {
                method: 'PATCH', body: { newName: renameDialog.newName.trim() }
            });
            await loadSubjects();
            setRenameDialog({ open: false, cat: '', newName: '' });
        } catch (e) { alert(e.message); } finally { setCatBusy(false); }
    };

    const doDeleteCat = async () => {
        setCatBusy(true);
        try {
            const url = deleteCatDialog.mode === 'reassign' && deleteCatDialog.reassignTo.trim()
                ? `/api/subjects/category/${encodeURIComponent(deleteCatDialog.cat)}?reassignTo=${encodeURIComponent(deleteCatDialog.reassignTo.trim())}`
                : `/api/subjects/category/${encodeURIComponent(deleteCatDialog.cat)}`;
            await apiFetch(url, { method: 'DELETE' });
            await loadSubjects(); refreshSubjects?.();
            if (selectedSubject && deleteCatDialog.mode !== 'reassign') setSelectedSubject(null);
            setDeleteCatDialog({ open: false, cat: '', count: 0, mode: 'delete', reassignTo: '' });
        } catch (e) { alert(e.message); } finally { setCatBusy(false); }
    };

    const canCreateSubject = !isOrganization || user?.role !== 'student';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Header + Tabs */}
            <Box sx={{ px: 4, pt: 3, pb: 0, flexShrink: 0, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h5" fontWeight="bold" color="primary">Subject Catalog</Typography>
                    <Box display="flex" gap={1.5}>
                        {canCreateSubject && (
                            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setShowCreate(true)}>
                                {isOrganization && user?.role === 'student' ? 'Suggest Subject' : 'New Subject'}
                            </Button>
                        )}
                    </Box>
                </Box>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: '-1px' }}>
                    <Tab label="📚 Catalog" />
                    <Tab label="📋 Syllabus Builder" disabled={!selectedSubject} />
                    <Tab label="🕸️ Knowledge Graph" disabled={!selectedSubject} />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
                <AnimatePresence mode="wait">
                    {tab === 0 && (
                        <motion.div key="catalog" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }} transition={{ duration: .18 }}>
                            {loading ? (
                                <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
                            ) : subjects.length === 0 ? (
                                <Alert severity="info" sx={{ mt: 2 }}>No subjects yet. Click <strong>New Subject</strong> to start!</Alert>
                            ) : (
                                Object.entries(grouped).map(([cat, subs]) => (
                                    <CategorySection key={cat} cat={cat} subjects={subs}
                                        user={user} isOrganization={isOrganization}
                                        selectedId={selectedSubject?._id}
                                        onEdit={handleEdit}
                                        onDelete={handleDeleteSubject}
                                        onSelect={handleSelectSubject}
                                        onRenameCategory={openRename}
                                        onDeleteCategory={openDeleteCat} />
                                ))
                            )}
                        </motion.div>
                    )}

                    {tab === 1 && selectedSubject && (
                        <motion.div key="syllabus" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }} transition={{ duration: .18 }}>
                            <Box display="flex" alignItems="center" gap={1} mb={3}>
                                <Button variant="text" size="small" onClick={() => setTab(0)}>← Back to Catalog</Button>
                                <Typography variant="body2" color="text.secondary">
                                    | Click any card in the Catalog to switch subject
                                </Typography>
                            </Box>
                            <SyllabusPanel subject={selectedSubject} />
                        </motion.div>
                    )}

                    {tab === 2 && selectedSubject && (
                        <motion.div key="graph" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }} transition={{ duration: .18 }} style={{ height: 'calc(100vh - 150px)', width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <Button variant="text" size="small" onClick={() => setTab(0)}>← Back to Catalog</Button>
                                <Typography variant="body2" color="text.secondary">
                                    | Interactive Knowledge Map for {selectedSubject.name}
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                                <GraphExplorer defaultTopic={selectedSubject.name} defaultSubjectId={selectedSubject._id} />
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            {/* ═══════════ CREATE / EDIT SUBJECT DIALOG ═══════════ */}
            <Dialog open={showCreate} onClose={closeModal} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {isEditing ? 'Edit Subject' : isOrganization && user?.role === 'student' ? 'Suggest a Subject' : 'Create New Subject'}
                </DialogTitle>
                <DialogContent>
                    {!isEditing && (
                        <Tabs value={createMode} onChange={(e, v) => setCreateMode(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <Tab label="✍️ Manual" value="manual" />
                            <Tab label="📄 PDF Upload" value="pdf" />
                            <Tab label="📊 PPT Upload" value="ppt" />
                        </Tabs>
                    )}

                    {createMode === 'pdf' ? (
                        <Box sx={{ p: 4, border: '2px dashed', borderColor: 'divider', borderRadius: 2, textAlign: 'center', mt: 2 }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Upload Syllabus PDF</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Upload a PDF syllabus document. The AI will extract subject metadata, modules, and topics using a concurrent pipeline.
                            </Typography>
                            <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files[0])} style={{ marginBottom: 16 }} />
                            <br />
                            <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                                <Button variant="contained" disabled={!pdfFile || parsingPdf} onClick={() => handleParsePdf(true)}
                                    sx={{ minWidth: 200 }} color="success">
                                    {parsingPdf ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Creating subject…</span>
                                        </Box>
                                    ) : '🚀 Quick Create Subject'}
                                </Button>
                                <Button variant="outlined" disabled={!pdfFile || parsingPdf} onClick={() => handleParsePdf(false)}
                                    sx={{ minWidth: 200 }}>
                                    {parsingPdf ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Extracting…</span>
                                        </Box>
                                    ) : 'Extract & Review First'}
                                </Button>
                            </Box>
                            {pdfMeta && (
                                <Box mt={2} p={1.5} borderRadius={1} sx={{ bgcolor: 'action.hover', textAlign: 'left' }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        📊 Pipeline Summary
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        File: {pdfMeta.filename} &nbsp;|&nbsp;
                                        Modules: {pdfMeta.moduleCount || 0} &nbsp;|&nbsp;
                                        Topics: {pdfMeta.topicCount || 0} &nbsp;|&nbsp;
                                        Strategy: <strong>{pdfMeta.strategy}</strong>
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : createMode === 'ppt' ? (
                        <Box sx={{ p: 4, border: '2px dashed', borderColor: 'divider', borderRadius: 2, textAlign: 'center', mt: 2 }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Upload Syllabus PPT</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Upload a PowerPoint (.pptx) file. Slides are parsed, chunked, and sent to the AI for structured module/topic extraction.
                            </Typography>
                            <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={e => setPptFile(e.target.files[0])} style={{ marginBottom: 16 }} />
                            <br />
                            <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                                <Button variant="contained" disabled={!pptFile || parsingPpt} onClick={() => handleParsePpt(true)}
                                    sx={{ minWidth: 200 }} color="success">
                                    {parsingPpt ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Creating subject…</span>
                                        </Box>
                                    ) : '🚀 Quick Create Subject'}
                                </Button>
                                <Button variant="outlined" disabled={!pptFile || parsingPpt} onClick={() => handleParsePpt(false)}
                                    sx={{ minWidth: 200 }}>
                                    {parsingPpt ? (
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <CircularProgress size={18} color="inherit" />
                                            <span>Extracting slides…</span>
                                        </Box>
                                    ) : 'Extract & Review First'}
                                </Button>
                            </Box>
                            {pdfMeta && pdfMeta.fileType === 'pptx' && (
                                <Box mt={2} p={1.5} borderRadius={1} sx={{ bgcolor: 'action.hover', textAlign: 'left' }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        📊 Pipeline Summary
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        File: {pdfMeta.filename} &nbsp;|&nbsp;
                                        Slides: {pdfMeta.totalSlides} &nbsp;|&nbsp;
                                        Text: {pdfMeta.totalTextChars?.toLocaleString()} chars &nbsp;|&nbsp;
                                        Chunks: {pdfMeta.chunksProcessed} &nbsp;|&nbsp;
                                        Strategy: <strong>{pdfMeta.strategy}</strong>
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : (
                        <>
                            <TextField fullWidth label="Subject Name *" margin="normal" required
                                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            <TextField fullWidth label="Domain / Category *" margin="normal" required
                                value={form.domainCategory} onChange={e => setForm({ ...form, domainCategory: e.target.value })}
                                helperText="e.g. Computer Science, Mathematics, Biology" />
                            <TextField fullWidth label="Description / Context" margin="normal" multiline rows={2}
                                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            <TextField fullWidth label="Learning Outcomes (one per line) *" margin="normal" multiline rows={3}
                                value={form.learningOutcomes} onChange={e => setForm({ ...form, learningOutcomes: e.target.value })} />
                        </>
                    )}

                    {user?.role === 'admin' && (
                        <Box mt={1.5}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={bypassValidation}
                                    onChange={e => setBypassValidation(e.target.checked)} />
                                <Typography variant="body2">Admin: Bypass AI Validation</Typography>
                            </label>
                        </Box>
                    )}

                    {validationResult && (
                        <Box mt={2} p={2} borderRadius={2}
                            sx={{ bgcolor: validationResult.isValid ? 'success.light' : 'warning.light' }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                AI Validation {validationResult.isValid ? '✅ Passed' : '⚠️ Review Needed'}
                            </Typography>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {validationResult.feedback?.map((item, i) => (
                                    <li key={i}><Typography variant="body2">{item}</Typography></li>
                                ))}
                            </ul>
                            {validationResult.suggestedLevel && (
                                <Typography variant="body2" mt={1} color="text.secondary">
                                    Suggested Level: {validationResult.suggestedLevel}
                                </Typography>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeModal} disabled={saving || validating || parsingPdf || parsingPpt}>Cancel</Button>

                    {createMode === 'manual' && (
                        <>
                            {(!validationResult || (!validationResult.isValid && !bypassValidation)) && (
                                <Button variant="outlined" onClick={handleValidate}
                                    disabled={validating || !form.name || !form.domainCategory}>
                                    {validating ? <CircularProgress size={18} /> : 'Validate with AI'}
                                </Button>
                            )}
                            {(validationResult?.isValid || bypassValidation || isEditing) && (
                                <Button variant="contained" onClick={handleSubmit}
                                    disabled={saving || !form.name || !form.domainCategory}>
                                    {saving ? <CircularProgress size={18} color="inherit" /> : isEditing ? 'Save Changes' : 'Publish Subject'}
                                </Button>
                            )}
                        </>
                    )}
                </DialogActions>
            </Dialog>

            {/* ═══════════ RENAME CATEGORY DIALOG ═══════════ */}
            <Dialog open={renameDialog.open} onClose={() => !catBusy && setRenameDialog(d => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
                <DialogTitle>Rename Category</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Renaming <strong>"{renameDialog.cat}"</strong> will update all subjects in it.
                    </Typography>
                    <TextField fullWidth label="New Category Name" value={renameDialog.newName} autoFocus
                        onChange={e => setRenameDialog(d => ({ ...d, newName: e.target.value }))} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setRenameDialog(d => ({ ...d, open: false }))} disabled={catBusy}>Cancel</Button>
                    <Button variant="contained" onClick={doRename}
                        disabled={catBusy || !renameDialog.newName.trim() || renameDialog.newName === renameDialog.cat}>
                        {catBusy ? <CircularProgress size={18} color="inherit" /> : 'Rename'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ═══════════ DELETE CATEGORY DIALOG ═══════════ */}
            <Dialog open={deleteCatDialog.open}
                onClose={() => !catBusy && setDeleteCatDialog(d => ({ ...d, open: false }))} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ color: 'error.main' }}>🗑️ Delete Category</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <strong>"{deleteCatDialog.cat}"</strong> has {deleteCatDialog.count} subject{deleteCatDialog.count !== 1 ? 's' : ''}.
                        Choose what happens to them:
                    </Alert>
                    <FormControl component="fieldset">
                        <RadioGroup value={deleteCatDialog.mode}
                            onChange={e => setDeleteCatDialog(d => ({ ...d, mode: e.target.value }))}>
                            <FormControlLabel value="delete" control={<Radio color="error" />}
                                label="Delete all subjects in this category" />
                            <FormControlLabel value="reassign" control={<Radio />}
                                label="Move subjects to another category" />
                        </RadioGroup>
                    </FormControl>
                    {deleteCatDialog.mode === 'reassign' && (
                        <TextField fullWidth label="Target Category Name" sx={{ mt: 2 }}
                            value={deleteCatDialog.reassignTo}
                            onChange={e => setDeleteCatDialog(d => ({ ...d, reassignTo: e.target.value }))}
                            helperText="Type an existing or new category name" />
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDeleteCatDialog(d => ({ ...d, open: false }))} disabled={catBusy}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={doDeleteCat}
                        disabled={catBusy || (deleteCatDialog.mode === 'reassign' && !deleteCatDialog.reassignTo.trim())}>
                        {catBusy ? <CircularProgress size={18} color="inherit" /> :
                            deleteCatDialog.mode === 'reassign' ? 'Move & Remove Category' : 'Delete Category & Subjects'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default SubjectCatalog;
```

## File: `Frontend\src\pages\SyllabusBuilder.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Select, MenuItem, Button, TextField, IconButton, Card, CardContent, CircularProgress } from '@mui/material';
import { Delete, Add, Save } from '@mui/icons-material';
import { apiFetch } from '../api/client';
import { motion } from 'framer-motion';

const SyllabusBuilder = () => {
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [syllabus, setSyllabus] = useState({ modules: [] });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiFetch('/api/subjects').then(setSubjects).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedSubject) {
            setLoading(true);
            apiFetch(`/api/syllabus/${selectedSubject}`)
                .then(data => {
                    setSyllabus(data?.modules ? data : { modules: [] });
                })
                .catch(() => setSyllabus({ modules: [] }))
                .finally(() => setLoading(false));
        } else {
            setSyllabus({ modules: [] });
        }
    }, [selectedSubject]);

    const handleSave = async () => {
        if (!selectedSubject) return;
        setSaving(true);
        try {
            await apiFetch('/api/syllabus', {
                method: 'POST',
                body: { subjectId: selectedSubject, modules: syllabus.modules }
            });
            alert('Syllabus saved successfully.');
        } catch (e) {
            alert('Failed to save syllabus: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const addModule = () => {
        setSyllabus({ ...syllabus, modules: [...syllabus.modules, { title: '', description: '', topics: [] }] });
    };

    const updateModule = (mIdx, field, value) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx][field] = value;
        setSyllabus({ ...syllabus, modules: newModules });
    };

    const removeModule = (mIdx) => {
        setSyllabus({ ...syllabus, modules: syllabus.modules.filter((_, i) => i !== mIdx) });
    };

    const addTopic = (mIdx) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx].topics.push({ title: '', description: '' });
        setSyllabus({ ...syllabus, modules: newModules });
    };

    const updateTopic = (mIdx, tIdx, field, value) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx].topics[tIdx][field] = value;
        setSyllabus({ ...syllabus, modules: newModules });
    };

    const removeTopic = (mIdx, tIdx) => {
        const newModules = [...syllabus.modules];
        newModules[mIdx].topics = newModules[mIdx].topics.filter((_, i) => i !== tIdx);
        setSyllabus({ ...syllabus, modules: newModules });
    };

    return (
        <Container className="mt-4 pb-12 overflow-y-auto max-h-screen">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h4" fontWeight="bold" color="primary">
                    Syllabus Builder
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
                    disabled={!selectedSubject || saving || loading}
                    onClick={handleSave}
                >
                    Save Syllabus
                </Button>
            </Box>

            <Card sx={{ mb: 4, p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" mb={1}>Select Subject</Typography>
                <Select
                    fullWidth
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    displayEmpty
                >
                    <MenuItem value="" disabled>-- Select a Subject --</MenuItem>
                    {subjects.map(s => (
                        <MenuItem key={s._id} value={s._id}>{s.name} ({s.domainCategory})</MenuItem>
                    ))}
                </Select>
            </Card>

            {loading ? (
                <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
            ) : selectedSubject && (
                <Box>
                    {syllabus.modules.map((mod, mIdx) => (
                        <motion.div key={mIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <Card sx={{ mb: 3, borderLeft: '4px solid #1976d2' }}>
                                <CardContent>
                                    <Box display="flex" justifyContent="space-between" mb={2}>
                                        <Typography variant="h6" fontWeight="bold">Module {mIdx + 1}</Typography>
                                        <IconButton color="error" onClick={() => removeModule(mIdx)}><Delete /></IconButton>
                                    </Box>
                                    <TextField
                                        fullWidth label="Module Title" size="small" sx={{ mb: 2 }}
                                        value={mod.title} onChange={e => updateModule(mIdx, 'title', e.target.value)}
                                    />
                                    <TextField
                                        fullWidth label="Module Description" size="small" multiline rows={2} sx={{ mb: 3 }}
                                        value={mod.description} onChange={e => updateModule(mIdx, 'description', e.target.value)}
                                    />

                                    <Typography variant="subtitle2" fontWeight="bold" color="textSecondary" mb={1} sx={{ pl: 2 }}>
                                        Topics in this Module
                                    </Typography>

                                    <Box pl={2} mb={2}>
                                        {mod.topics.map((topic, tIdx) => (
                                            <Box key={tIdx} display="flex" alignItems="center" gap={2} mb={2} p={2} bgcolor="#f8f9fa" borderRadius={2}>
                                                <Box flex={1}>
                                                    <TextField
                                                        fullWidth label="Topic Title" size="small" sx={{ mb: 1 }}
                                                        value={topic.title} onChange={e => updateTopic(mIdx, tIdx, 'title', e.target.value)}
                                                    />
                                                    <TextField
                                                        fullWidth label="Topic Description" size="small"
                                                        value={topic.description} onChange={e => updateTopic(mIdx, tIdx, 'description', e.target.value)}
                                                    />
                                                </Box>
                                                <IconButton size="small" color="error" onClick={() => removeTopic(mIdx, tIdx)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        ))}
                                        <Button size="small" startIcon={<Add />} onClick={() => addTopic(mIdx)}>
                                            Add Topic
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}

                    <Button variant="outlined" startIcon={<Add />} onClick={addModule} fullWidth sx={{ py: 1.5, borderStyle: 'dashed' }}>
                        Add New Module
                    </Button>
                </Box>
            )}
        </Container>
    );
};

export default SyllabusBuilder;
```

## File: `Frontend\src\pages\UserPreferences.jsx`

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, BookOpen, SlidersHorizontal, Bell, User, Check, Plus, Minus, Save, Loader2, ChevronDown } from 'lucide-react';
import { useAdaptify } from '../context/AdaptifyContext';
import { useQuiz } from '../context/QuizContext';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '') + '/api';

function getAuthHeaders() {
    try {
        const token = localStorage.getItem('adiptify_token');
        if (token) {
            return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        }
    } catch (e) { /* ignore */ }
    return { 'Content-Type': 'application/json' };
}

const SUBJECT_ICONS = {
    '🤖': 'bg-emerald-500',
    '🧠': 'bg-purple-500',
    '💬': 'bg-sky-500',
    '📊': 'bg-amber-500',
    '🌐': 'bg-blue-500',
    '🐍': 'bg-yellow-500',
    '🏗️': 'bg-indigo-500',
    '📐': 'bg-rose-500',
    '⚛️': 'bg-teal-500',
    '📚': 'bg-slate-500',
};

const COLOR_MAP = {
    emerald: 'bg-emerald-500 border-emerald-400',
    purple: 'bg-purple-500 border-purple-400',
    sky: 'bg-sky-500 border-sky-400',
    amber: 'bg-amber-500 border-amber-400',
    blue: 'bg-blue-500 border-blue-400',
    yellow: 'bg-yellow-500 border-yellow-400',
    indigo: 'bg-indigo-500 border-indigo-400',
    rose: 'bg-rose-500 border-rose-400',
    teal: 'bg-teal-500 border-teal-400',
};

const QUIZ_MODES = [
    { value: 'mixed', label: 'Mixed', desc: 'All question types' },
    { value: 'mcq', label: 'MCQ', desc: 'Multiple choice only' },
    { value: 'fill_blank', label: 'Fill in the Blank', desc: 'Type your answer' },
    { value: 'short_answer', label: 'Short Answer', desc: 'Free text responses' },
];

const DIFFICULTIES = [
    { value: 'adaptive', label: 'Adaptive', desc: 'AI adjusts difficulty' },
    { value: 'easy', label: 'Easy', desc: 'Beginner level' },
    { value: 'medium', label: 'Medium', desc: 'Intermediate level' },
    { value: 'hard', label: 'Hard', desc: 'Advanced problems' },
];

export default function UserPreferences() {
    const { fetchEnrolledSubjects, fetchConcepts } = useAdaptify();
    const { refreshSubjects } = useQuiz();

    const [allSubjects, setAllSubjects] = useState([]);
    const [enrolledIds, setEnrolledIds] = useState(new Set());
    const [preferences, setPreferences] = useState({
        quizMode: 'mixed',
        difficulty: 'adaptive',
        dailyGoal: 5,
        notifications: true,
    });
    const [themePreference, setThemePreference] = useState('system');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [activeSection, setActiveSection] = useState('subjects');

    // Fetch subjects & user data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all available subjects
                const subjectsRes = await fetch(`${API_BASE}/subjects`);
                if (subjectsRes.ok) {
                    const subjects = await subjectsRes.json();
                    setAllSubjects(subjects);
                }

                // Fetch user profile with enrolled subjects
                const userRes = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
                if (userRes.ok) {
                    const user = await userRes.json();
                    const enrolled = (user.enrolledSubjects || []).map(s => s._id || s);
                    setEnrolledIds(new Set(enrolled));

                    if (user.preferences) {
                        setPreferences(prev => ({ ...prev, ...user.preferences }));
                    }
                    if (user.themePreference) {
                        setThemePreference(user.themePreference);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch settings data:', e);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    // Toggle subject enrollment
    const toggleSubject = useCallback(async (subjectId) => {
        try {
            const res = await fetch(`${API_BASE}/subjects/enroll/toggle`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ subjectId }),
            });
            if (res.ok) {
                const enrolled = await res.json();
                setEnrolledIds(new Set(enrolled.map(s => s._id)));
                
                // Trigger context refresh to sync state globally across components
                await fetchEnrolledSubjects();
                await fetchConcepts();
                await refreshSubjects();
            }
        } catch (e) {
            console.warn('Failed to toggle enrollment:', e);
        }
    }, [fetchEnrolledSubjects, fetchConcepts, refreshSubjects]);

    // Save preferences
    const savePreferences = useCallback(async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/auth/preferences`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ ...preferences, themePreference }),
            });
            if (res.ok) {
                setSaveMessage('Saved!');
                setTimeout(() => setSaveMessage(''), 2000);
            }
        } catch (e) {
            setSaveMessage('Failed to save');
        }
        setSaving(false);
    }, [preferences, themePreference]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader2 className="w-8 h-8 animate-spin text-adiptify-gold" />
            </div>
        );
    }

    const sections = [
        { id: 'subjects', label: 'Subjects', icon: BookOpen },
        { id: 'learning', label: 'Learning', icon: SlidersHorizontal },
        { id: 'notifications', label: 'Notifications', icon: Bell },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <header className="px-8 py-8 border-b border-slate-200/60 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-adiptify-navy dark:text-white tracking-tight flex items-center gap-3">
                            <Settings className="w-8 h-8 text-adiptify-gold" />
                            Settings
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Customize your learning experience.</p>
                    </div>
                    <button
                        onClick={savePreferences}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-adiptify-gold text-adiptify-navy font-semibold rounded-xl hover:bg-adiptify-gold/90 transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saveMessage || 'Save Changes'}
                    </button>
                </div>

                {/* Section tabs */}
                <div className="flex gap-1 mt-5 bg-slate-200/50 dark:bg-slate-800 rounded-xl p-1">
                    {sections.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeSection === s.id
                                ? 'bg-white dark:bg-slate-700 text-adiptify-navy dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <s.icon size={16} />
                            {s.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="p-8">
                <AnimatePresence mode="wait">
                    {/* ═══ Subjects Section ═══ */}
                    {activeSection === 'subjects' && (
                        <motion.div
                            key="subjects"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                Select the subjects you want to study. Your dashboard, quizzes, and analytics will adapt based on your selections.
                            </p>

                            {/* Group subjects by category */}
                            {Object.entries(
                                allSubjects.reduce((acc, s) => {
                                    if (!acc[s.category]) acc[s.category] = [];
                                    acc[s.category].push(s);
                                    return acc;
                                }, {})
                            ).map(([category, subjects]) => (
                                <div key={category} className="mb-8">
                                    <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                                        {category}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {subjects.map(subject => {
                                            const isEnrolled = enrolledIds.has(subject._id);
                                            return (
                                                <motion.button
                                                    key={subject._id}
                                                    whileHover={{ y: -2 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => toggleSubject(subject._id)}
                                                    className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${isEnrolled
                                                        ? 'border-adiptify-gold bg-adiptify-gold/5 dark:bg-adiptify-gold/10 shadow-md'
                                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                                                        }`}
                                                >
                                                    {/* Enrolled check */}
                                                    {isEnrolled && (
                                                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-adiptify-gold flex items-center justify-center">
                                                            <Check size={14} className="text-white" />
                                                        </div>
                                                    )}

                                                    <div className="flex items-start gap-3">
                                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${COLOR_MAP[subject.color] || 'bg-slate-500'
                                                            } bg-opacity-20`}>
                                                            {subject.icon}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-adiptify-navy dark:text-white">
                                                                {subject.name}
                                                            </h4>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                                {subject.description}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                                    {subject.topics?.length || 0} topics
                                                                </span>
                                                                {subject.isDefault && (
                                                                    <span className="text-[10px] font-medium text-adiptify-olive bg-adiptify-olive/10 px-2 py-0.5 rounded-full">
                                                                        Default
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {allSubjects.length === 0 && (
                                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>No subjects available. Run the seed script to add defaults.</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ═══ Learning Preferences ═══ */}
                    {activeSection === 'learning' && (
                        <motion.div
                            key="learning"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >

                            {/* Daily Goal */}
                            <div>
                                <h3 className="text-lg font-bold text-adiptify-navy dark:text-white mb-1">Daily Goal</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    How many concepts do you want to study each day?
                                </p>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setPreferences(p => ({ ...p, dailyGoal: Math.max(1, p.dailyGoal - 1) }))}
                                        className="w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:border-adiptify-gold transition-colors"
                                    >
                                        <Minus size={16} className="text-slate-500" />
                                    </button>
                                    <div className="w-20 text-center">
                                        <span className="text-3xl font-bold text-adiptify-navy dark:text-white">{preferences.dailyGoal}</span>
                                        <p className="text-xs text-slate-400 mt-0.5">per day</p>
                                    </div>
                                    <button
                                        onClick={() => setPreferences(p => ({ ...p, dailyGoal: Math.min(50, p.dailyGoal + 1) }))}
                                        className="w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:border-adiptify-gold transition-colors"
                                    >
                                        <Plus size={16} className="text-slate-500" />
                                    </button>
                                    {/* Slider */}
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        value={preferences.dailyGoal}
                                        onChange={(e) => setPreferences(p => ({ ...p, dailyGoal: parseInt(e.target.value) }))}
                                        className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-adiptify-gold"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ═══ Notifications ═══ */}
                    {activeSection === 'notifications' && (
                        <motion.div
                            key="notifications"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-adiptify-navy dark:text-white">Study Reminders</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Get reminded when you have concepts due for review.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setPreferences(p => ({ ...p, notifications: !p.notifications }))}
                                        className={`w-14 h-7 rounded-full transition-all duration-200 relative ${preferences.notifications ? 'bg-adiptify-gold' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all duration-200 ${preferences.notifications ? 'left-8' : 'left-1'
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    💡 Tip: Regular spaced reviews help you retain 80%+ of what you learn. We recommend keeping reminders on.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
```

## File: `Frontend\src\services\llmService.js`

```js
import { apiFetch } from '../api/client';

export const getAIResponse = async (topic, pathContext = "", subjectId = null) => {
  try {
    if (subjectId && !pathContext) {
      // First, try loading the cached graph for the subject
      try {
        const graphData = await apiFetch(`/api/graph/subject/${subjectId}`);
        if (graphData && graphData.root) {
          return graphData;
        }
      } catch (cacheErr) {
        console.warn("Cached graph unretrievable, falling back to live generation:", cacheErr);
      }
    }

    const data = await apiFetch('/api/graph/generate', {
      method: 'POST',
      body: { topic, pathContext }
    });
    return data;
  } catch (error) {
    console.error("Graph Service Error:", error);
    const isInitial = !pathContext;
    return isInitial ? { root: { id: 'root', label: topic, desc: 'Error generating graph' }, children: [] } : { nodes: [] };
  }
};
```

