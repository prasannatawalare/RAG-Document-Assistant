# RDA: Frontend Client Architecture & Implementation

This document provides a deep dive into the frontend client of the **RAG Document Assistant (RDA)** project, explaining its React components, state orchestration, UI design, API integration, and user views.

---

## 🎨 Technology Stack & libraries

The frontend is a single-page application (SPA) built using a highly optimized modern React setup:

* **Vite**: The build tool and development server, chosen for native ES modules support and fast Hot Module Replacement (HMR).
* **React 19 & TypeScript**: Provides component-based UI orchestration with compile-time type-safety and static type analysis.
* **Tailwind CSS**: A utility-first CSS framework for custom responsive styling.
* **Radix UI**: Unstyled, accessible React primitives (collapsible blocks, scroll areas, and slots) which are styled locally using Tailwind utility classes.
* **Lucide React**: Clean, lightweight svg icon assets.
* **Axios**: HTTP client configured with request/response interceptors to manage network states.
* **React Markdown & Remark GFM**: Renders structured Markdown replies from the LLM, supporting tables, bold text, code blocks, lists, and citations.
* **Recharts**: Responsive SVG charting library to render bar, line, pie, and area charts for tabular data.
* **Sonner**: Sleek toast notifications.

---

## 📂 React Codebase Organization

The frontend codebase is organized inside the `RDA-frontend/src/` folder:

```
RDA-frontend/src/
├── api/
│   └── index.ts          # Axios Client, Auth, Ingest, & Agent endpoints
├── assets/               # Static image assets
├── components/
│   ├── Auth/
│   │   └── Auth.tsx      # Login and Registration pages
│   ├── Chat/
│   │   └── Chat.tsx      # SSE Streaming RAG chat and citations
│   ├── CSVChart/
│   │   └── CSVChart.tsx  # Responsive Recharts charts component
│   ├── CSVViewer/
│   │   └── CSVViewer.tsx # Interactive paginated data grid for sheets
│   ├── ui/               # Radix UI wrapper nodes (Button, Input, Table...)
│   ├── AgentStudio.tsx   # Custom Agent persona creator
│   ├── Dashboard.tsx     # System metric widgets
│   ├── Home.tsx          # System welcome guide
│   ├── KnowledgeBase.tsx # File drag & drop, upload list, and deletes
│   ├── PDFViewer.tsx     # Slide-out context-scoped document browser
│   ├── SandboxPage.tsx   # Tabular query interface and data visualizer
│   └── Sidebar.tsx       # Sidebar navigation menu
├── constant/
│   └── index.ts          # Global static variables (API Base URL)
├── types/
│   └── index.ts          # TS interfaces (UploadedFile, ChatMessage, CSVStats...)
├── App.css               # App-wide custom override rules
├── index.css             # Tailwind imports & CSS theme variables
├── main.tsx              # React mounting root
└── App.tsx               # Main state orchestrator & view router
```

---

## 🔄 App.tsx: The Main State Orchestrator

The main coordinator of the client application is [`App.tsx`](file:///d:/RAG/RDA-frontend/src/App.tsx). Since the app runs as a Single-Page Application (SPA), it avoids complex router engines (like React Router) in favor of a clean, responsive state-driven layout:

### 1. Core Global States
* **`token`**: The active JWT string. Stored in `localStorage`. If empty, the app renders the `<Auth />` component, blocking access.
* **`activeTab`**: Determines which view is currently mounted in the viewport (`'home' | 'dashboard' | 'knowledge' | 'chat' | 'sandbox' | 'agents'`).
* **`selectedDocumentIds`**: An array of document UUID strings representing the current search scope. Users check/uncheck documents in the chat sidebar to narrow or expand the AI's search.
* **`activeSource`**: Stores the metadata of a clicked citation (filename, file path, page number). If populated, it slides out the `<PDFViewer />` panel.
* **`activeAgent`**: The custom system prompt agent profile currently active in the chat.
* **`uploadedDocuments`**: The array of ingested documents loaded from the backend database.
* **`hasCSV` / `hasExcel`**: Boolean flags indicating if the user has uploaded spreadsheets (triggers spreadsheet-related options in the sidebar).

### 2. Startup Synchronization Hook
On mount or login, a React `useEffect` validates the stored token by calling `/api/auth/me`. If successful, it fetches the document repository list and spreadsheet metrics to configure the dashboard workspace.

---

## 📡 API Integration & Axios Interceptors

All API communication is centralized in [`src/api/index.ts`](file:///d:/RAG/RDA-frontend/src/api/index.ts). It exports a pre-configured Axios instance (`API_CLIENT`) equipped with two interceptors:

### 1. JWT Bearer Request Interceptor
Before Axios transmits any HTTP request, this interceptor fetches the JWT token from local storage and appends it to the headers:
```typescript
API_CLIENT.interceptors.request.use((config) => {
  const token = localStorage.getItem('rag_jwt_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 2. 401 Unauthorized Response Interceptor
If a request fails with an HTTP `401 Unauthorized` status (meaning the token expired, was modified, or deleted on the database), the interceptor catches this error, purges the stored token, and refreshes the browser, forcing the user back to the login screen:
```typescript
API_CLIENT.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('rag_jwt_token');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 🖥️ Deep-Dive into Core UI Component Pages

### 1. Ingestion Interface (`KnowledgeBase.tsx`)
This page handles document ingestion and repository cleanup:
* **Drag-and-Drop / Click Ingestion**: Implements an interactive drop zone. When files are added, it makes a multipart upload request to `/api/documents/upload` using Axios's `onUploadProgress` to render real-time progress bars.
* **Workspace Cleanups**: Allows deleting specific files or executing a full system reset. Triggering a reset prompts a warning dialog asking the user to confirm database purge.

### 2. Multi-Source Ingestion Chat (`Chat.tsx`)
This is the workspace chat assistant, featuring three sub-areas:
* **Document Scope Selector (Left Panel)**: Lists all uploaded files (PDF, Word, Slides, CSV) with checkboxes. Checking a file updates the global `selectedDocumentIds` array, restricting vector searches to only those files.
* **Chat Stream (Middle)**: Implements **Server-Sent Events (SSE)** streaming. When a user asks a question, the client establishes an SSE stream. It parses chunks of text in real-time, scrolling the screen down.
* **Citations & Sources**: Responses display citations (e.g., `[Document.pdf, Page 4]`). Clicking a citation updates `activeSource`, triggering the PDF slide-out viewer.

### 3. Spreadsheet Sandbox (`SandboxPage.tsx`)
Optimized for tabular query runs and data visualization:
* **Spreadsheet Selector**: Displays tabs for active CSV and Excel files.
* **Data Grid (`CSVViewer.tsx`)**: Renders a paginated, scrollable HTML table containing the rows and columns. Column headers display icon badges matching their types (`abc` for strings, `#` for numbers, calendar for dates).
* **Column Metrics Summary**: Lists statistical summaries (sums, means, unique values, missing rows) computed for each column.
* **Tabular Assistant**: Features a text bar to run natural-language questions over sheet data. If the answer includes a visual representation, it displays a responsive chart (bar, line, pie, area) built with Recharts (`CSVChart.tsx`).

### 4. Custom System Prompt Studio (`AgentStudio.tsx`)
Lets users customize LLM behaviors:
* **Agent CRUD**: Renders forms to define new agents (Agent Name, Description, System Prompt guidelines, and Temperature slider).
* **System Prompt Injections**: Selecting an agent updates `activeAgent` in the chat, telling the backend RAG service to swap the standard Gemini guidelines with the custom agent system prompt.
