# SOFTWARE COPYRIGHT REGISTRATION DOCUMENTATION

---

**Document Type:** Copyright Registration Support Document
**Jurisdiction:** India — Copyright Act, 1957
**Applicable Form:** Form XIV — Registration of Copyright (Computer Software / Literary Work)
**Portal:** copyright.gov.in
**Date of Document Preparation:** 28 April 2026

---

## 1. COVER INFORMATION

| Field | Details |
|---|---|
| **Software Title** | Adiptify |
| **Version** | v0.13 |
| **Category of Work** | Literary Work — Computer Software / AI-Integrated Adaptive Learning Web Application |
| **Author Name** | Kumar Aditya |
| **Copyright Claimant** | Kumar Aditya |
| **Nature of Authorship** | Sole Author — Original computer program, source code, user interface design, AI/ML integration logic, and technical documentation |
| **Date of Creation** | 2025 |
| **Publication Status** | Unpublished |
| **Filing Jurisdiction** | India — Copyright Act, 1957; Section 2(o) (Literary Work); Section 13 (Works in which copyright subsists) |
| **Registration Portal** | copyright.gov.in — Form XIV (Application for Registration of Copyright) |
| **Contact / Correspondence Address** | *(To be filled by the applicant at the time of formal filing)* |

---

## 2. DECLARATION OF AUTHORSHIP

I, Kumar Aditya, hereby solemnly declare that I am the sole and exclusive author of the computer software titled **Adiptify**, version 0.13, hereinafter referred to as "the Work." The Work, comprising its complete source code, system architecture, user interface design, artificial intelligence and machine learning integration logic, database schema, API design, and all associated technical documentation, constitutes an original literary work within the meaning of Section 2(o) read with Section 13 of the Copyright Act, 1957. The Work has been independently created by me through my own intellectual effort, skill, and judgment, and has not been copied or reproduced, in whole or in part, from any pre-existing work. All artificial intelligence and machine learning components integrated within the Work, including but not limited to the adaptive learning engine, spaced repetition service, knowledge graph generation logic, and AI inference pipelines interfacing with locally hosted large language models, represent original expressions of my authorship and have been independently designed, developed, and implemented. I further declare that no portion of the Work infringes upon the copyright of any third party, and that any open-source libraries or frameworks utilised in the Work are properly disclosed herein and are used strictly in accordance with their respective licence terms.

---

## 3. DESCRIPTION OF THE SOFTWARE WORK

**Adiptify** is an AI-driven Adaptive Learning Platform engineered to deliver dynamic, personalised educational experiences by leveraging large language models (LLMs), knowledge graph architectures, and intelligent content processing pipelines. The platform is designed for students, self-learners, and educational institutions seeking to supplement or replace static, linear study programmes with a system that continuously adapts to the learner's evolving knowledge state and cognitive performance.

The system operates across three tightly integrated subsystems. The **Frontend** subsystem provides a modern, responsive web-based user interface built upon React 19 and Vite, enabling learners to navigate enrolled subjects, generate personalised study modules, engage with AI-constructed knowledge graphs, and review their learning analytics through interactive data visualisations. The **Backend** subsystem constitutes a robust Node.js server built upon the Express.js framework, which orchestrates all API interactions, database operations, user authentication flows, and AI inference requests. The **AI Graph System** is a dedicated visualisation environment that communicates directly with locally hosted LLMs via the Ollama runtime to dynamically generate concept nodes, directional edges, and contextual relationships for any uploaded or specified subject matter.

The platform ingests learning materials in multiple formats — including PDF documents, PowerPoint presentations, and plain text — extracts and structures conceptual knowledge therefrom, and subsequently constructs personalised study pathways calibrated to each learner's demonstrated mastery levels. Gamification elements, including a real-time leaderboard and comprehensive analytics dashboard, further incentivise continued engagement. The Spaced Repetition System (SRS) engine embedded within the platform algorithmically schedules concept reviews to maximise long-term knowledge retention based on established cognitive science principles. Adiptify is architected to run entirely on-premises, with the LLM inference layer powered by Ollama, thereby ensuring data privacy by design.

---

## 4. TECHNICAL COMPONENTS AND ORIGINAL AUTHORSHIP

| Component | Description | Original / Third-Party |
|---|---|---|
| **Frontend Application** | React 19 single-page application (SPA) built with Vite 7; includes all pages, routing logic (React Router DOM v7), context/state management, and interactive UI components such as the Mastery Dashboard, Analytics Dashboard, Subject Catalog, Spaced Review interface, and AI Graph visualisation | **Original** |
| **UI/UX Design & Visual System** | Custom design system utilising Tailwind CSS v4, Material-UI (MUI v7), Framer Motion animations, Lucide React icon set, and all custom SVG visualisations (MasteryProgressionChart, BarChart, RadarChart, RetentionGauge) authored entirely by the applicant | **Original** |
| **Backend API Server** | Express.js REST API server (`app.js` and all route handlers) governing authentication, subject management, concept generation, analytics, leaderboard, file ingestion, and AI inference endpoints | **Original** |
| **Adaptive Learning Engine** | `adaptiveLearningService.js` — original service logic implementing personalised learning pathway generation, concept sequencing, and difficulty calibration based on mastery scores | **Original** |
| **AI/ML Inference Layer** | `ollamaService.js` — original prompt engineering, structured output parsing, inference pipeline, and integration logic interfacing with Ollama-hosted LLMs (e.g., Llama, Mistral family models); includes all custom system prompts and JSON schema extraction logic | **Original** |
| **Concept Generation Service** | `generateConceptsService.js` — original orchestration pipeline for extracting, structuring, and persisting knowledge concepts from uploaded learning materials using LLM inference | **Original** |
| **Spaced Repetition System** | `spacedRepetitionService.js` — original algorithm for scheduling concept review sessions based on recall quality signals, implementing a variant of Spaced Repetition System (SRS) principles | **Original** |
| **Analytics Service** | `analyticsService.js` — original computation logic for deriving mastery scores, learning velocity, retention rates, completion rates, and radar/chart data aggregations | **Original** |
| **Assessment & Grading Service** | `assessmentService.js`, `gradingService.js` — original logic for quiz generation, answer evaluation, and performance scoring | **Original** |
| **Behaviour & Settings Engines** | `behaviorEngine.js`, `settingsEngine.js` — original rule engines governing adaptive system behaviour and per-user configuration personalisation | **Original** |
| **Leaderboard Service** | `leaderboardService.js` — original ranking algorithm and gamification logic for real-time competitive leaderboards | **Original** |
| **Database Schema & Models** | MongoDB/Mongoose schema definitions for all domain entities (Users, Subjects, Concepts, Sessions, Analytics, Leaderboard, UserSettings) — original data model design | **Original** |
| **File Processing Pipeline** | Custom ingestion pipeline integrating `pdf-parse` and `pptxtojson` for extraction of structured learning content from PDF and PPTX files; all orchestration, chunking, and normalisation logic is original | **Original** |
| **AI Graph Visualisation System** | Standalone React/Vite application (`ai-graph-system/`) generating interactive knowledge graphs using React Flow and Dagre layout algorithms; all node/edge generation logic and LLM integration is original | **Original** |
| **Prompt Engineering Assets** | All system prompts, user prompt templates, and JSON schema definitions stored within the `prompts/` directory — original intellectual compositions | **Original** |
| **Deployment & Configuration Scripts** | `app.js` server bootstrap, `scripts/seed.js`, environment configuration (`config/`), middleware chain (`middleware/`) — original authorship | **Original** |
| **Express.js Framework** | Web application framework for Node.js | Third-Party (MIT Licence) |
| **React & React DOM** | UI rendering library | Third-Party (MIT Licence) |
| **Vite** | Frontend build tool and dev server | Third-Party (MIT Licence) |
| **MongoDB / Mongoose** | Database and ODM layer | Third-Party (MIT/Apache 2.0 Licences) |
| **Ollama Node.js SDK** | Client library for communicating with locally hosted LLMs | Third-Party (MIT Licence) |
| **React Flow** | Graph visualisation library | Third-Party (MIT Licence) |
| **Dagre** | Graph layout algorithm library | Third-Party (MIT Licence) |
| **Other Open-Source Libraries** | As disclosed in Section 7 | Third-Party (Various Open-Source Licences) |

---

## 5. AI/ML ORIGINALITY STATEMENT

The artificial intelligence and machine learning integration within Adiptify constitutes a substantial and wholly original component of the Work. The applicant has independently designed and implemented all aspects of the AI inference pipeline, including the architecture of service modules, prompt engineering strategies, structured output extraction mechanisms, and the orchestration of LLM inference calls via the Ollama runtime. The `ollamaService.js` module embodies original authorship in its design of multi-turn context management, JSON schema-constrained output parsing, error recovery logic, and domain-specific prompt templates crafted for educational knowledge extraction. The `generateConceptsService.js` implements an original multi-stage pipeline that transforms raw educational materials into structured conceptual knowledge graphs without reliance on any proprietary or pre-built AI pipeline framework. The adaptive learning logic within `adaptiveLearningService.js` and the spaced repetition algorithm within `spacedRepetitionService.js` represent original algorithmic expressions, independently reasoned and implemented by the applicant. No pre-trained model weights, proprietary AI architectures, or third-party AI model APIs are incorporated within the Work; all LLM inference is performed against locally hosted, publicly available open-weight models via the Ollama interface. The applicant expressly confirms that copyright is claimed solely over the original source code, prompt expressions, integration logic, and system design constituting the AI/ML components — and not over any underlying open-weight model weights or the Ollama runtime itself.

---

## 6. SCOPE OF COPYRIGHT CLAIMED

### 6.1 Source Code

Copyright is claimed over the following categories of original source code comprising the Work:

- All React component files (`.jsx`) constituting the Frontend application, including pages, UI components, context providers, hooks, and routing configuration
- All backend Node.js/JavaScript modules (`.js`) comprising the Express.js API server, service layer, middleware, route handlers, database models, utility functions, and configuration modules
- All source files within the `ai-graph-system/` standalone application, including graph rendering logic, LLM integration, and layout computation
- All custom system prompt templates and structured output schema definitions within the `prompts/` directory
- Database seeding scripts, server bootstrap scripts, and deployment configuration files
- All build configuration files authored by the applicant (`vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`)

### 6.2 User Interface and Visual Design

Copyright is claimed over the following original UI/UX design elements:

- The overall visual design language, colour system, typographic hierarchy, and layout structure of the Adiptify web application
- All custom SVG-based data visualisation components, including the Mastery Progression Chart, Retention Gauge, Skill Radar Chart, and Mastery by Category bar charts
- The design and layout of the Mastery Dashboard, Analytics Dashboard, Subject Catalog, Spaced Review interface, Leaderboard view, and AI Graph System interface
- All interactive animation sequences, hover state transitions, and motion design implemented via Framer Motion
- The Adiptify brand identity as expressed within the software, including the application's name typography, colour palette (adiptify-navy, adiptify-gold, adiptify-olive, adiptify-terracotta), and visual design tokens

### 6.3 Technical Documentation

Copyright is claimed over the following original documentation:

- The `Readme.md` file at the project root, describing the system architecture, feature set, and installation procedures
- The `Frontend/README.md` file describing frontend setup and conventions
- All inline code comments, JSDoc annotations, and architectural notes embedded within the source code
- This Copyright Registration Support Document in its entirety

---

## 7. THIRD-PARTY AND OPEN-SOURCE DISCLOSURES

The applicant expressly acknowledges the use of the following open-source libraries and frameworks within the Work. **Copyright is NOT claimed over any of these third-party components.** All such components are used strictly in accordance with their respective licence terms.

| Library / Framework | Version Used | Licence | Usage in Adiptify |
|---|---|---|---|
| React | ^19.2.0 | MIT | Frontend UI rendering library |
| React DOM | ^19.2.0 | MIT | DOM rendering for React |
| React Router DOM | ^7.13.1 | MIT | Client-side routing and navigation |
| Vite | ^7.3.1 | MIT | Frontend build tool and development server |
| Tailwind CSS | ^4.2.1 | MIT | Utility-first CSS styling framework |
| Material-UI (MUI) | ^7.3.9 | MIT | UI component library (icons and components) |
| @emotion/react & @emotion/styled | ^11.14.x | MIT | CSS-in-JS engine for MUI components |
| Framer Motion | ^12.34.3 | MIT | Animation and motion design library |
| React Flow (reactflow) | ^11.11.4 | MIT | Interactive node-graph visualisation |
| Dagre | ^0.8.5 | MIT | Directed graph layout algorithm |
| Lucide React | ^0.575.0 | ISC | SVG icon library |
| React Markdown | ^10.1.0 | MIT | Markdown rendering within React |
| Zod | ^4.3.6 | MIT | Runtime schema validation and type inference |
| zod-to-json-schema | ^3.25.1 | MIT | JSON Schema generation from Zod schemas |
| Clsx | ^2.1.1 | MIT | Conditional className utility |
| Tailwind Merge | ^3.5.0 | MIT | Tailwind class conflict resolution utility |
| Express.js | ^4.18.2 | MIT | Node.js web application framework (backend) |
| Mongoose | ^7.8.0 | MIT | MongoDB Object Document Mapper (ODM) |
| Ollama (Node SDK) | ^0.6.2 | MIT | Node.js client for Ollama LLM runtime |
| JSON Web Token (jsonwebtoken) | ^9.0.2 | MIT | JWT generation and verification for authentication |
| Bcrypt | ^5.1.1 | MIT | Password hashing library |
| Multer | ^2.1.1 | MIT | Multipart/form-data file upload middleware |
| pdf-parse | ^1.1.1 | MIT | PDF text extraction library |
| pptxtojson | ^1.12.1 | MIT | PowerPoint (.pptx) to JSON parser |
| JSZip | ^3.10.1 | MIT | ZIP file reading/writing library |
| Axios | ^1.7.7 | MIT | HTTP client for API communication |
| node-fetch | ^3.3.2 | MIT | Fetch API implementation for Node.js |
| Marked | ^12.0.2 | MIT | Markdown parsing and rendering |
| Morgan | ^1.10.0 | MIT | HTTP request logger middleware |
| dotenv | ^16.4.5 | BSD-2-Clause | Environment variable management |
| CORS | ^2.8.5 | MIT | Cross-Origin Resource Sharing middleware |
| Nodemon | ^3.1.14 | MIT | Development auto-restart utility (dev dependency) |
| PostCSS | ^8.5.6 | MIT | CSS transformation tool (dev dependency) |
| Autoprefixer | ^10.4.27 | MIT | CSS vendor prefix automation (dev dependency) |
| ESLint | ^9.39.1 | MIT | JavaScript/JSX static analysis linter (dev dependency) |

> **Note:** The MongoDB database engine is used as an external data store and is subject to the Server Side Public License (SSPL). The Ollama LLM runtime is an external locally-hosted service subject to its own MIT licence. Neither is incorporated into the Work's source code as a distributed component.

---

## 8. COPYRIGHT NOTICE

The following copyright notice shall be embedded in the source code, documentation, and any distributed artefacts of the Work:

```
Copyright (c) 2025 Kumar Aditya. All Rights Reserved.

Software Title:  Adiptify — AI-Driven Adaptive Learning Platform
Version:         0.13

This software and its source code, including all associated documentation,
user interface designs, artificial intelligence integration logic, and
technical assets, are the exclusive intellectual property of Kumar Aditya
and are protected under the Copyright Act, 1957 (India) and applicable
international copyright treaties.

Unauthorised reproduction, distribution, modification, reverse engineering,
or use of this software, in whole or in part, without the prior written
consent of the copyright holder is strictly prohibited and may result in
civil and criminal liability under applicable law.

For licensing enquiries, please contact the copyright holder directly.
```

---

## 9. FILING CHECKLIST

The following checklist enumerates the standard requirements for software copyright registration with the Indian Copyright Office under the Copyright Act, 1957, via the copyright.gov.in portal (Form XIV).

| # | Item | Document / Action Required | Status |
|---|---|---|---|
| 1 | **Completed Application Form** | Form XIV — Application for Registration of Copyright, duly completed in all particulars | ☐ Pending |
| 2 | **Statement of Particulars** | Form XIV — Statement of Particulars (Part B), describing the nature of the work, authorship, and year of creation | ☐ Pending |
| 3 | **Statement of Further Particulars** | Form XIV — Statement of Further Particulars (Part C), applicable for computer programmes under Section 2(ffc) | ☐ Pending |
| 4 | **Proof of Authorship / Identity** | Government-issued photo identity document of the author (e.g., Aadhaar Card, Passport, PAN Card) | ☐ Pending |
| 5 | **Proof of Address** | Valid address proof of the author/applicant | ☐ Pending |
| 6 | **Copies of the Work (Source Code)** | Two copies of the source code on physical media (CD/DVD/USB) or as per the Copyright Office's current digital submission guidelines | ☐ Pending |
| 7 | **Copyright Notice Confirmation** | Evidence of copyright notice embedded within the software or documentation | ☐ Pending |
| 8 | **No Objection Certificate (if applicable)** | NOC from any co-author or employer if the work was created in the course of employment or as a collaborative work; declare "Not Applicable" if sole and independent authorship | ☐ Not Applicable |
| 9 | **Power of Attorney (if applicable)** | Notarised Power of Attorney if filing is made through an authorised agent or legal representative | ☐ Not Applicable (self-filing) |
| 10 | **Prescribed Filing Fee** | As per the Copyright Rules, 2013 (Schedule of Fees); current fee for computer software registration to be verified on copyright.gov.in at time of filing | ☐ Pending |
| 11 | **Diary Number / Acknowledgement** | Obtain Diary Number upon successful submission; retain for correspondence and tracking of the registration application | ☐ Pending — to be obtained post-filing |

> **Important Note:** The Copyright Office may issue a mandatory waiting period (typically 30 days) after diary number issuance, during which objections may be filed by third parties. The applicant must monitor correspondence from the Copyright Office and respond to any objections within the stipulated time. Final registration certificate (Form XV) will be issued upon successful completion of all formalities.

---

## 10. AUTHOR SIGNATURE BLOCK

I, the undersigned, hereby affirm that all information contained in this document is true and correct to the best of my knowledge and belief, and that the Work described herein is an original creation in which copyright subsists and vests exclusively in me as the sole author and copyright holder.

---

| Field | Details |
|---|---|
| **Full Name of Author / Applicant** | Kumar Aditya |
| **Designation / Capacity** | Individual Author and Sole Copyright Holder |
| **Software Title** | Adiptify — AI-Driven Adaptive Learning Platform |
| **Version** | v0.13 |
| **Date** | 28 April 2026 |
| **Place** | India |
| **Signature** | _________________________ |

---

*This document has been prepared solely for the purpose of supporting a copyright registration application with the Indian Copyright Office under the Copyright Act, 1957. It does not constitute legal advice. The applicant is advised to consult a qualified Intellectual Property attorney or registered Copyright Agent for guidance specific to their individual circumstances.*

---

## APPENDIX A — PROJECT README (Reproduced for Record)

```markdown
# Adiptify

An AI-driven Adaptive Learning Platform that leverages large language models
(via Ollama) and knowledge graphs to create dynamic, personalised learning pathways.

## Features
- Adaptive Learning Paths: Generates personalised study modules based on individual
  progress and syllabus content.
- Mastery Dashboard: Track knowledge acquisition and conceptual mastery.
- AI Graph System: Visualises learning concepts and their relationships using
  React Flow and Dagre.
- Intelligent Content Processing: Extracts and structures learning materials
  from PDFs, PPTs, and text.
- Leaderboards & Analytics: Gamified learning experience with real-time analytics.

## System Architecture

### 1. Frontend
React + Vite SPA. UI Frameworks: Tailwind CSS, MUI, Emotion, Framer Motion,
React Flow, Lucide React. Routing: React Router DOM.

### 2. Backend
Node.js / Express.js REST API. Database: MongoDB (Mongoose).
Auth: JWT + Bcrypt. AI Integration: Ollama.
File Processing: Multer, pdf-parse, pptxtojson, jszip.

### 3. AI Graph System
Standalone React/Vite app. Directly integrated with Ollama for
node/edge generation. Layout: React Flow + Dagre.

## Developer Information
- Developer: Kumar Aditya
- Project Name: Adiptify
- Version: 0.13
```

---

## APPENDIX B — ORIGINAL SOURCE CODE EXCERPTS

> The following excerpts constitute the original literary expression of the author
> and are submitted as evidence of original authorship for copyright registration
> purposes. The complete source code resides in the project repository.

---

### B.1 — Backend Entry Point (`backend/app.js`)

```javascript
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { config } from "./config/index.js";

// Route imports
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import adaptiveLearningRoutes from "./routes/adaptiveLearning.js";
import analyticsRoutes from "./routes/analytics.js";
import spacedRepetitionRoutes from "./routes/spacedRepetition.js";
import subjectsRoutes from "./routes/subjects.js";
import graphRoutes from "./routes/graph.js";
import syllabusRoutes from "./routes/syllabus.js";
import leaderboardRoutes from "./routes/leaderboard.js";
// ... (additional route imports)

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/api/ping", (req, res) => {
    res.json({
        ok: true,
        message: "Adiptify API is running",
        db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/adaptive", adaptiveLearningRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/sr", spacedRepetitionRoutes);
app.use("/api/subjects", subjectsRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
// ... (additional route registrations)

mongoose.connect(config.mongoUri, {
    dbName: config.mongoDb,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
}).then(() => {
    console.log(`✅ MongoDB Atlas connected → db: ${config.mongoDb}`);
    import('./services/leaderboardService.js').then(({ initLeaderboardListeners }) => {
        initLeaderboardListeners();
    });
}).catch((err) => {
    console.error("❌ MongoDB connection FAILED:", err.message);
    process.exit(1);
});

app.listen(config.port, () => {
    console.log(`🚀 Adiptify API listening on port ${config.port}`);
});
```

---

### B.2 — Adaptive Learning Engine (`backend/services/adaptiveLearningService.js`)

**Algorithm design:** Composite mastery scored as the geometric mean (cube root)
of concept accuracy, application score, and retention score. Difficulty adapts
automatically based on configurable thresholds from the behaviour engine.

```javascript
/**
 * Calculate cognitive load from performance signals.
 * CL = (time_taken × error_rate) + hint_usage
 */
export function calculateCognitiveLoad(timeTakenMs, errorRate, hintUsage) {
    const timeFactor = timeTakenMs / 60000; // normalise to minutes
    const cl = (timeFactor * errorRate) + (hintUsage * 0.1);
    return Math.round(cl * 1000) / 1000;
}

/**
 * Calculate composite mastery score (0–1).
 * Uses geometric mean: Mastery = cbrt(accuracy × application × retention)
 */
export function calculateMasteryScore(conceptAccuracy, applicationScore, retentionScore) {
    const ca = Math.max(0, Math.min(1, conceptAccuracy));
    const as = Math.max(0, Math.min(1, applicationScore));
    const rs = Math.max(0, Math.min(1, retentionScore));
    return Math.round(Math.cbrt(ca * as * rs) * 1000) / 1000;
}

/**
 * Get the adaptive learning path for a user — priority-scored concept ordering.
 * Priority = (1 - mastery) × 50 + dueBonus(30) + pipelineBonus(20)
 * Prerequisites not met → priority × 0.3 (deprioritised)
 */
export async function getAdaptivePath(userId) {
    const concepts = await Concept.find({}).lean();
    const progressRecords = await UserProgress.find({ userId }).lean();
    const reviews = await Review.find({ userId }).lean();

    const progressMap = Object.fromEntries(progressRecords.map(p => [p.conceptId, p]));
    const reviewMap   = Object.fromEntries(reviews.map(r => [r.conceptId, r]));

    const scored = concepts.map((concept) => {
        const progress = progressMap[concept.conceptId] || {};
        const review   = reviewMap[concept.conceptId]  || {};
        const mastery  = progress.mastery_score || 0;
        const isDue    = review.next_review
            ? new Date(review.next_review) <= new Date() : true;

        let priority = (1 - mastery) * 50;
        if (isDue) priority += 30;
        if (!progress.pipeline_completed) priority += 20;

        const prereqsMet = (concept.prerequisites || []).every(id =>
            (progressMap[id]?.mastery_score || 0) >= 0.5
        );

        return {
            ...concept,
            mastery_score: mastery,
            isDue,
            prereqsMet,
            priority: prereqsMet ? priority : priority * 0.3,
        };
    });

    return scored.sort((a, b) => b.priority - a.priority);
}

/**
 * Submit performance → update mastery → adapt difficulty.
 */
export async function submitPerformance(userId, conceptId, performanceData) {
    const { correct=0, total=1, timeTakenMs=0, hintUsage=0,
            applicationScore=0, pipelineStage=0 } = performanceData;

    const errorRate   = total > 0 ? (total - correct) / total : 0;
    const cl          = calculateCognitiveLoad(timeTakenMs, errorRate, hintUsage);

    let progress = await UserProgress.findOne({ userId, conceptId })
                ?? new UserProgress({ userId, conceptId });

    progress.total_correct    += correct;
    progress.total_questions  += total;
    progress.attempt_count    += 1;
    progress.accuracy_rate     = progress.total_correct / progress.total_questions;
    progress.application_score = Math.max(progress.application_score, applicationScore);
    progress.cognitive_load    = cl;
    progress.pipeline_stage    = Math.max(progress.pipeline_stage, pipelineStage);
    progress.pipeline_completed = progress.pipeline_stage >= 4;
    progress.mastery_score     = calculateMasteryScore(
        progress.accuracy_rate, progress.application_score,
        progress.retention_score || 0.1
    );

    // Adaptive difficulty — thresholds from behaviour engine (falls back to defaults)
    const { downThreshold=0.4, upThreshold=0.8, minLevel=1, maxLevel=5 }
        = await import('./behaviorEngine.js')
            .then(m => m.getDifficultyParams(userId)).catch(() => ({}));

    if (progress.mastery_score < downThreshold)
        progress.recommended_difficulty = Math.max(minLevel, (progress.recommended_difficulty||2) - 1);
    else if (progress.mastery_score > upThreshold)
        progress.recommended_difficulty = Math.min(maxLevel, (progress.recommended_difficulty||2) + 1);

    await progress.save();
    return { ...progress.toObject(), needsRemediation: cl > 2.0 };
}
```

---

### B.3 — Spaced Repetition System (`backend/services/spacedRepetitionService.js`)

**Algorithm:** SuperMemo SM-2. Easiness factor updated per recall quality (0–5).
Intervals reset on failed recall (quality < 3); multiplied by EF on success.
User-specific interval multipliers applied from the settings/behaviour engine.

```javascript
/**
 * Pure SM-2 algorithm.
 * @param {number} ef           - current easiness factor (min 1.3)
 * @param {number} rep          - repetition count
 * @param {number} prevInterval - previous interval in days
 * @param {number} quality      - recall quality 0–5
 */
export function calculateSM2(ef, rep, prevInterval, quality) {
    let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < 1.3) newEF = 1.3;

    let newRep, newInterval;
    if (quality >= 3) {
        newRep = rep + 1;
        if      (newRep === 1) newInterval = 1;
        else if (newRep === 2) newInterval = 6;
        else                   newInterval = Math.round(prevInterval * newEF);
    } else {
        newRep = 0; newInterval = 1; // failed recall — reset
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);
    return { ef: Math.round(newEF * 100) / 100, rep: newRep,
             interval: newInterval, nextReview };
}

export async function submitReview(userId, conceptId, quality) {
    quality = Math.max(0, Math.min(5, Math.round(quality)));
    let review = await Review.findOne({ userId, conceptId })
              ?? new Review({ userId, conceptId });

    const result = calculateSM2(
        review.easiness_factor, review.repetition, review.interval, quality
    );

    const adjustedInterval = await applyUserIntervalMultiplier(userId, result.interval);
    review.easiness_factor = result.ef;
    review.repetition      = result.rep;
    review.interval        = adjustedInterval;
    review.quality_score   = quality;
    review.next_review     = new Date(Date.now() + adjustedInterval * 86400000);
    review.last_review     = new Date();
    review.history.push({ quality, date: new Date(), interval: result.interval });

    await review.save();

    // Update retention score in UserProgress
    await UserProgress.findOneAndUpdate(
        { userId, conceptId },
        { next_review_date: result.nextReview, last_review_date: new Date(),
          retention_score: quality >= 3
              ? Math.min(1, (review.repetition / 10) + 0.5)
              : Math.max(0,  review.repetition / 10) },
        { upsert: true, new: true }
    );
    return review;
}
```

---

### B.4 — AI Inference Layer (`backend/services/ollamaService.js`) — Key Logic

**Design:** All LLM calls routed through `callOllama()`. Structured JSON output
enforced via Ollama's `format: 'json'` flag. Batch processing (3 chunks at a time)
with 90-second per-call timeout. Graceful mock fallback when Ollama is offline.

```javascript
// Core LLM call wrapper
async function callOllama(systemPrompt, userPrompt, options = {}) {
    const ollama = new Ollama({ host: config.ollamaBaseUrl || 'http://127.0.0.1:11434' });
    try {
        const response = await ollama.chat({
            model: options.model || config.ollamaModel || 'llama3',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user",   content: userPrompt   },
            ],
            stream: false,
            format: options.format || undefined,
        });
        return response.message?.content || "";
    } catch (err) {
        console.warn("Ollama unreachable — returning mock response:", err.message);
        return buildMockResponse(systemPrompt); // graceful degradation
    }
}

// JSON extraction — strips markdown code fences from LLM output
function parseJsonResponse(text) {
    let cleaned = text.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    return JSON.parse(cleaned);
}

// Production pipeline: batch-processes document chunks (3 at a time, 90s timeout)
export async function parseSyllabusPipeline(chunkSource, onProgress = null) {
    const chunks = [];
    for await (const chunk of chunkSource) { if (chunk?.trim()) chunks.push(chunk); }

    const partials = [];
    for (let i = 0; i < chunks.length; i += 3) {
        const batch = chunks.slice(i, i + 3).map((chunk, bi) =>
            callOllamaWithTimeout(PARSE_SYLLABUS_CHUNK_SYSTEM,
                parseSyllabusChunkUser(chunk, i + bi, chunks.length), 90000)
            .then(raw => parseJsonResponse(raw)).catch(() => null)
        );
        const results = await Promise.all(batch);
        partials.push(...results.filter(Boolean));
        if (onProgress) onProgress(Math.min(i + 3, chunks.length), chunks.length);
    }

    const { mergeSyllabusPartials } = await import('../utils/syllabusAggregator.js');
    return mergeSyllabusPartials(partials);
}

// Iterative topic deduplication — merges topics into Map, filters noise
export async function parseSyllabusIterative(chunkGenerator) {
    const topicMap = new Map();
    for await (const chunk of chunkGenerator) {
        const data = await callOllama(PERFECT_PARSER_CHUNK_SYSTEM,
            perfectParserChunkUser(chunk), { format: 'json' }).then(JSON.parse);
        for (const topic of (data.topics || [])) {
            if (!topic.name || !shouldKeepTopic(topic.name)) continue;
            const key = topic.name.toLowerCase().trim();
            if (!topicMap.has(key)) topicMap.set(key, { name: topic.name, keywords: [] });
            else {
                const ex = topicMap.get(key);
                ex.keywords = [...new Set([...ex.keywords, ...(topic.keywords||[])])];
            }
        }
    }
    return Array.from(topicMap.values());
}
```

---

### B.5 — Analytics Engine (`backend/services/analyticsService.js`)

**Metrics computed:** Overall mastery (mean of all mastery scores), retention rate
(successful recalls / total review events), learning velocity (concepts updated
in last 7 days), completion rate (pipeline-completed / studied), due review count,
per-category mastery breakdown, time-per-topic, skill radar, and mastery history
grouped by calendar day.

```javascript
export async function getDashboardMetrics(userId) {
    const subjectNames  = await getEnrolledSubjectNames(userId);
    const allConcepts   = await Concept.find({ category: { $in: subjectNames } }).lean();
    const conceptIds    = allConcepts.map(c => c.conceptId);
    const allProgress   = await UserProgress.find({ userId, conceptId: { $in: conceptIds } }).lean();
    const allReviews    = await Review.find    ({ userId, conceptId: { $in: conceptIds } }).lean();

    // Overall mastery
    const overallMastery = allProgress.length
        ? Math.round(allProgress.reduce((s,p) => s + (p.mastery_score||0), 0)
                     / allProgress.length * 100) : 0;

    // Retention rate
    const totalEvents = allReviews.reduce((s,r) => s + (r.history?.length||0), 0);
    const goodEvents  = allReviews.reduce((s,r) =>
        s + (r.history||[]).filter(h => h.quality >= 3).length, 0);
    const retentionRate = totalEvents ? Math.round(goodEvents / totalEvents * 100) : 0;

    // Learning velocity (concepts progressed in last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const learningVelocity = allProgress.filter(p => new Date(p.updatedAt) >= weekAgo).length;

    // Completion rate
    const completionRate = allProgress.length
        ? Math.round(allProgress.filter(p => p.pipeline_completed).length
                     / allProgress.length * 100) : 0;

    // Mastery by category + radar data
    const categoryMastery = {};
    for (const p of allProgress) {
        const cat = allConcepts.find(c => c.conceptId === p.conceptId)?.category || "General";
        if (!categoryMastery[cat]) categoryMastery[cat] = { total: 0, count: 0 };
        categoryMastery[cat].total += p.mastery_score || 0;
        categoryMastery[cat].count += 1;
    }
    const masteryByCategory = Object.entries(categoryMastery).map(([category, d]) => ({
        category, mastery: Math.round(d.total / d.count * 100),
    }));
    const radarData = masteryByCategory.map(mc => ({ axis: mc.category, value: mc.mastery/100 }));

    return { overallMastery, totalConcepts: allConcepts.length,
             studiedConcepts: allProgress.length, completionRate,
             retentionRate, learningVelocity, radarData, masteryByCategory,
             dueReviewCount: allReviews.filter(r => new Date(r.next_review) <= new Date()).length,
             timePerTopic: allProgress.map(p => ({
                 title: allConcepts.find(c => c.conceptId === p.conceptId)?.title || p.conceptId,
                 timeSpent: Math.round((p.total_time_spent||0) / 60000),
             })).sort((a,b) => b.timeSpent - a.timeSpent).slice(0,10) };
}
```

---

### B.6 — Concept Generation Pipeline (`backend/services/generateConceptsService.js`)

**Logic:** For each enrolled subject, topics are sourced from the Syllabus model
(preferred), then subject topics array, then learning outcomes as fallback.
Concepts are deduplicated by `conceptId` before persistence. Each concept includes
a full 5-stage learning pipeline (explanation → demonstration → practice questions
→ application task → evaluation criteria). Spaced repetition Review records are
initialised at concept creation time.

```javascript
// System prompt enforces exactly 8 concepts per topic with full pipeline data
const CONCEPT_GENERATOR_SYSTEM = `You are an expert curriculum designer.
Generate EXACTLY 8 study concepts for the provided topic. Each concept must be
a granular, distinct learning unit covering ~15-20 minutes of study.
Output MUST be valid JSON: { "concepts": [ { "title", "description",
"difficulty_level" (1-5), "prerequisites", "tags", "pipeline": {
"explanation", "demonstration", "practiceQuestions" (exactly 3),
"applicationTask", "evaluationCriteria" } } ] }`;

export async function generateAllConceptsForUser(userId, onProgress = null) {
    const user = await User.findById(userId).populate("enrolledSubjects").lean();
    const stats = { generated: 0, cached: 0, total: 0 };

    for (const subject of user.enrolledSubjects) {
        // Topic resolution hierarchy: Syllabus → subject.topics → learningOutcomes
        let topicList = [];
        const syllabus = await Syllabus.findOne({ subjectId: subject._id }).lean();
        if (syllabus?.modules?.length) {
            syllabus.modules.forEach(mod => mod.topics?.length
                ? mod.topics.forEach(t => topicList.push({ ...t, moduleName: mod.title }))
                : topicList.push({ title: mod.title, description: mod.description||"",
                                   moduleName: mod.title }));
        } else if (subject.topics?.length) {
            topicList = subject.topics.map(t => typeof t === "string"
                ? { title: t, description: "" } : t);
        } else {
            topicList = (subject.learningOutcomes||[]).map(lo => ({ title: lo, description: lo }));
        }

        for (const topic of topicList) {
            // Skip if >= 8 concepts already exist for this topic
            const existing = await Concept.countDocuments({
                category: subject.name,
                tags: { $in: [topic.title.toLowerCase()] }
            });
            if (existing >= 8) { stats.cached += existing; continue; }

            const rawConcepts = await generateConceptsForTopic(
                subject.name, topic, subject.learningOutcomes);

            for (const concept of rawConcepts) {
                const conceptId = `${subject.name}_${concept.title}`
                    .toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 80);

                if (await Concept.findOne({ conceptId })) { stats.cached++; continue; }

                await Concept.create({ conceptId, ...concept, category: subject.name });

                // Initialise SRS review record at concept creation
                await Review.findOneAndUpdate(
                    { userId, conceptId },
                    { $setOnInsert: { userId, conceptId, easiness_factor: 2.5,
                      interval: 0, repetition: 0, next_review: new Date() } },
                    { upsert: true }
                );
                stats.generated++;
            }
        }
    }
    return stats;
}
```

---

*The source code excerpts in Appendix B are faithful representations of the
original work. Complete source files are available on physical media submitted
alongside this application.*

---

*This document has been prepared solely for the purpose of supporting a copyright
registration application with the Indian Copyright Office under the Copyright Act,
1957. It does not constitute legal advice. The applicant is advised to consult a
qualified Intellectual Property attorney or registered Copyright Agent for guidance
specific to their individual circumstances.*

---

**— END OF DOCUMENT —**
