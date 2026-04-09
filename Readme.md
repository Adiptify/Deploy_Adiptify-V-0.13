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
