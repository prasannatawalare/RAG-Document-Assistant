# RDA: Project Documentation Index

Welcome to the documentation suite for the **RAG Document Assistant (RDA)** final year project. This folder contains all the technical sheets, workflows, mathematical layouts, and layman guides needed to present and defend the project.

---

## 📂 Documentation Directory

To navigate the project explanation, select the document that fits your target audience:

### 1. For Non-Technical Evaluators (High-Level / Layman)
* **[layman_non_technical_guide.md](file:///d:/RAG/docs/layman_non_technical_guide.md)**: 
  * Explains the project from scratch using everyday analogies (e.g., "The Open-Book Exam" for RAG).
  * Outlines the business value, core features, and simple system definitions.
  * *Use this to prepare your introductory speech and explain the project conceptually.*

### 2. For Technical Examiners (In-Depth / Engineering)
* **[file_structure_explanation.md](file:///d:/RAG/docs/file_structure_explanation.md)**:
  * Maps out the React frontend and Node.js backend files.
  * Shows how data flows when uploading files or asking questions.
  * Contains a visual **Mermaid Architecture Flowchart**.
* **[frontend_explanation.md](file:///d:/RAG/docs/frontend_explanation.md)**:
  * Details the React frontend components, folder structures, libraries, and layout styles.
  * Explains single-page workspace state orchestration (token authentication, navigation tabs, file selection scopes, active custom agent).
  * Details the Axios API client configuration, request interceptors (token injection), and response interceptors (401 auto-logout redirects).
* **[technical_explanation.md](file:///d:/RAG/docs/technical_explanation.md)**:
  * Details the frameworks used (Vite, React, Express, Prisma, SQLite, Gemini, Hugging Face).
  * Explains NPM, local binaries execution via **NPX**, and visual database inspection using **Prisma Studio**.
  * Breaks down network port allocations (5173, 5000, 5555) and their logic.
  * Breaks down security details: JWT stateless authentication headers and BCrypt password hashing.
* **[rag_and_semantic_search.md](file:///d:/RAG/docs/rag_and_semantic_search.md)**:
  * Details the RAG pipeline.
  * Details the chunking strategy (`2500` characters, `300` overlap) and vectors (`gemini-embedding-001`).
  * Explains Multi-Channel Hybrid Search (Semantic Vector + Keyword fuzzy match).
  * Explains CPU-based local Cross-Encoder reranking (`ms-marco-MiniLM-L-6-v2`) and diversity summary filters.
* **[tabular_sandbox_and_ml.md](file:///d:/RAG/docs/tabular_sandbox_and_ml.md)**:
  * Details the V8 Virtual Machine context runner sandbox (`vm` module) for executing code-generated tabular scripts.
  * Outlines the mathematical formulas for the local **pure JavaScript Machine Learning Models** (Multiple Linear Regression solvers, Gaussian PDFs for Naive Bayes, and clustering distance iterations).

### 3. Workflow Scenarios & Testing
* **[workflow_cases.md](file:///d:/RAG/docs/workflow_cases.md)**:
  * Outlines step-by-step logic paths for standard ingestion, spreadsheet parsing, chat queries, and agent creations.

### 4. Exam Preparation (Q&A Defense)
* **[viva_prep_questions.md](file:///d:/RAG/docs/viva_prep_questions.md)**:
  * Prepares you with 15 anticipated exam questions and professional answers regarding RAG, databases, math equations, port allocations, and sandbox security.

---

## 🚀 Quick Boot Instructions (Local Servers)

For reference, the commands to launch all components of this project are:

### 1. Ingest/Backend Service
Navigate to the `backend/` directory and run:
```bash
# Install dependencies
npm install

# Run database setup
npx prisma db push

# Start Nodemon dev server
npm run dev
```

### 2. Client Interface (React UI)
Navigate to the `RDA-frontend/` directory and run:
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

### 3. Database GUI Viewer (Prisma Studio)
In the `backend/` directory, run:
```bash
npx prisma studio
```
Open `http://localhost:5555` to inspect your user accounts, files, and chat messages visually.
