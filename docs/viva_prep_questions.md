# RDA: Viva (Project Defense) Questions & Answers

This guide compiles potential questions that project guides and external examiners might ask about the **RAG Document Assistant (RDA)** project, along with professional, technically accurate answers.

---

## 🏛️ General & Architectural Questions

### Q1: What is the main objective of this project, and how does it differ from a standard chatbot?
* **Answer**: The main objective is to provide a secure, localized document assistant that can query both unstructured documents (PDFs, Word files, slides) and structured tabular datasets (CSVs, Excel sheets) using Retrieval-Augmented Generation (RAG).
* **Key Difference**: Standard chatbots rely solely on their pre-trained parameters and general knowledge, making them prone to hallucinations and unable to answer questions about private files. Our system retrieves verified passages from user files, injects them into the prompt context, and grounds the generator, providing clickable page-level citations.

### Q2: Explain the architecture of your application. Is it a monolithic or microservices pattern?
* **Answer**: Our application uses a **Decoupled Monorepo Architecture** comprising two separate service boundaries:
  1. **Client Interface**: React SPA compiled with Vite and styled via Tailwind CSS.
  2. **Application API Server**: Express RESTful server running on Node.js.
* It uses a layered design pattern: React UI talks to Express Routes, which delegate to specialized Services (RAG Service, CSV Service, ML Service) that read/write from a local SQLite database using Prisma ORM.

### Q3: Why did you choose SQLite instead of MongoDB or PostgreSQL?
* **Answer**: For a desktop-focused local document assistant, minimizing system requirements and setup friction is critical.
  * **Zero Setup**: SQLite is a serverless, database engine that stores its schema and tables in a single file (`dev.db`). The user does not need to install database servers, credentials, or run background processes.
  * **Relational Support**: We have strict relationships (e.g. Users own Documents, Users own Chat Sessions, Sessions own Messages). SQLite with Prisma provides clean SQL relational integrity and ACID compliance, which NoSQL (MongoDB) doesn't guarantee out-of-the-box.

---

## 🔍 Retrieval & RAG Questions

### Q4: What is your chunk size and overlap, and why did you choose these specific values?
* **Answer**: We use a chunk size of **`2500` characters** and an overlap of **`300` characters** using LangChain's `RecursiveCharacterTextSplitter`.
  * **Why 2500**: Larger chunks (roughly 400-500 words) ensure that paragraphs, complex sentences, and contextual relationships remain intact, which is critical for legal, financial, or academic reports.
  * **Why 300 Overlap**: The 300-character overlap provides a buffer zone. If a key fact is split right at a chunk boundary, the overlap ensures it is captured in both adjacent chunks, avoiding retrieval gaps.

### Q5: How do you perform semantic search? Where do you store vector embeddings?
* **Answer**:
  1. **Vector Generation**: We use Google's cloud-hosted **`gemini-embedding-001`** model via their Node.js SDK to translate chunks into 768-dimensional floating-point vectors.
  2. **Vector Storage**: For local simplicity, we store these vectors as JSON arrays in `MemoryVectorStore` (in RAM). To make indices persistent across restarts, they are stringified to disk under `uploads/indices/<userId>/vectors.json` when files are ingested.

### Q6: What is Hybrid Search, and why is it better than plain vector search?
* **Answer**: Hybrid search combines two different retrieval paradigms:
  1. **Semantic Vector Search**: Finds conceptually similar ideas (e.g., matching *"revenue grew"* with *"earnings increased"*), even if they use different words.
  2. **Fuzzy Keyword Search (`MiniSearch`)**: Matches exact technical terms, serial numbers, abbreviations, or names, even with typos.
* **Benefit**: Combining both (and boosting scores of chunks found in both) ensures we get the conceptual relevance of embeddings alongside the exact matching precision of keyword indexes.

### Q7: What is the role of your reranker? Why run a Cross-Encoder locally?
* **Answer**:
  * **Role**: First-stage vector search (Bi-Encoder) computes similarities of queries and chunks independently to be fast. However, it can miss fine-grained semantic connections. A **Cross-Encoder** feeds both query and document *together* into a transformer network to calculate an exact relevance score.
  * **Why Local**: We run **`ms-marco-MiniLM-L-6-v2`** locally on the CPU using `@huggingface/transformers`. Running this step locally is cost-free, keeps document data private, and guarantees that our final context chunks are highly relevant to the question.

### Q8: What happens if a user uploads a scanned PDF image?
* **Answer**: Our PDF ingestion uses `PDFLoader` which extracts digital text. If a PDF is a scanned image (with no selectable text overlay), the extraction will fail. To handle this in a production version, we would integrate an OCR (Optical Recognition) engine like Tesseract.js.

---

## 🔌 Port Allocation & Networking Questions

### Q9: Why are ports 5173, 5000, and 5555 used in this project? Can you change them?
* **Answer**: These port allocations are assigned to avoid port collisions when running our services concurrently:
  * **Port 5173 (Frontend)**: This is the default port assigned by the Vite build framework. (Vite uses `5173` as a keypad wordplay spelling "VITE").
  * **Port 5000 (Backend API)**: A standard industry convention for hosting development Node.js/Express backend APIs, keeping it distinct from ports like 3000 (standard React) or 8080.
  * **Port 5555 (Prisma Studio)**: Hardcoded default for the Prisma Studio web graphical viewer.
  * **Can they be changed?**: Yes. All ports are configurable. The backend port is set via the `PORT` variable in the `.env` configuration, and the frontend port can be customized inside `RDA-frontend/vite.config.ts`. If changed, the frontend client endpoint URL and backend CORS origins must be updated to match.

### Q10: How does the frontend React app running on port 5173 talk to the backend on port 5000 without hitting CORS security blocks?
* **Answer**: Browsers implement **CORS (Cross-Origin Resource Sharing)** security to prevent scripts on one origin (port 5173) from requesting API data from another origin (port 5000). We resolve this in two ways:
  1. **Development Proxy**: Inside `vite.config.ts`, we set up a dev proxy target `/api` to route to `http://localhost:5000`. The browser thinks it's making requests locally on port 5173, and Vite proxies it behind the scenes.
  2. **CORS Middleware**: On the backend in `app.js`, we use the Express `cors` middleware, specifically white-listing `http://localhost:5173` (from config/index.js) and enabling credentials passing for secure Axios headers.

---

## 📊 Tabular Data & VM Sandbox Questions

### Q11: Why don't you use standard RAG for CSV and Excel files?
* **Answer**: Standard RAG splits files by character limits. If you chunk a spreadsheet like that, rows are cut arbitrarily, and column headers are separated from their cell values. The LLM loses the grid layout and performs inaccurate calculations when guessing numbers.
* **Solution**: Instead, our system uses a **Programmatic Sandbox**. The backend extracts only the column names and a 5-row preview to understand the structure. We ask the LLM to write a JavaScript script to query the spreadsheet programmatically. The script runs inside a secure V8 VM context, returning precise mathematical results.

### Q12: How does your VM sandbox prevent malicious code execution (e.g. infinite loops or system commands)?
* **Answer**: We secure Node's `vm` module using three constraints:
  1. **Context Isolation**: The sandbox context has no access to global objects like `process` or `global`.
  2. **Strict Timeout**: We set `timeout: 5000` (5 seconds). If a generated script contains an infinite loop, the thread is killed.
  3. **Module Control**: We override the global `require` function. The script can only import safe parsers (`fs`, `xlsx`, `csv-parse`), blocking networking (`http`, `net`) and system execution (`child_process`).

---

## 🤖 Machine Learning Questions

### Q13: Why train ML models locally in JavaScript? What are the benefits?
* **Answer**: Traditional ML pipelines require Python environments (Pandas, Scikit-Learn) and APIs. By building the training algorithms in pure JavaScript:
  * **Zero Setup**: The ML runs in the existing Node.js server. The user does not need to install Python, configure pip environments, or run Flask gateways.
  * **Privacy**: Data never leaves the local environment, ensuring compliance with strict privacy policies.

### Q14: Explain your Linear Regression implementation.
* **Answer**: We implemented Multiple Linear Regression ($\mathbf{y} = \mathbf{X}\boldsymbol{\beta}$) using the **Normal Equation** solved with matrix algebra:
  $$\boldsymbol{\beta} = (\mathbf{X}^T\mathbf{X})^{-1}\mathbf{X}^T\mathbf{y}$$
* We built custom matrix helper algorithms:
  * Matrix Transpose ($\mathbf{X}^T$).
  * Matrix Multiplication.
  * Matrix Inversion ($\mathbf{X}^{-1}$) using **Gauss-Jordan Elimination** with row swapping.

### Q15: What happens if features are perfectly correlated in Linear Regression?
* **Answer**: If two features are perfectly correlated, the matrix $\mathbf{X}^T\mathbf{X}$ is singular (its determinant is zero) and cannot be inverted. Our Gauss-Jordan solver checks for zero pivot values (values $< 10^{-10}$) and throws an error, alerting the user to choose different features.
