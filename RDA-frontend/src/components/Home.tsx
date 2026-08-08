import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BookOpen, 
  HelpCircle, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  Database, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  FileText,
  FileSpreadsheet,
  Settings,
  Code
} from 'lucide-react';

export const Home = () => {
  const coreWhyPoints = [
    {
      title: "Local-First Data Privacy",
      description: "Proprietary databases, SQLite tables, and vector indices are stored directly on your disk, ensuring absolute security of documents without leaking data to cloud vector databases.",
      icon: ShieldCheck,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200"
    },
    {
      title: "Hybrid Search (Vector + Keyword)",
      description: "Combines dense semantic vector search (cosine similarity) with sparse keyword matching (MiniSearch BM25) to locate exact serial numbers, figures, or acronyms.",
      icon: Layers,
      color: "text-blue-600 bg-blue-50 border-blue-200"
    },
    {
      title: "CPU-Level MiniLM Reranking",
      description: "Executes a local deep-learning Cross-Encoder model (ms-marco-MiniLM-L-6-v2) on your CPU to re-score candidate text passages, prioritizing the top 6 most relevant contexts.",
      icon: Cpu,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200"
    },
    {
      title: "Sandboxed Local Code Execution",
      description: "Runs generated Javascript data analysis scripts inside a secure V8 Virtual Machine context with standard timeouts, eliminating the risk of arbitrary code injection.",
      icon: Code,
      color: "text-purple-600 bg-purple-50 border-purple-200"
    }
  ];

  const techStack = [
    { name: "React (Vite) & TS", role: "Frontend Client", details: "Renders a modern, responsive Single Page Application using clean light-themed Tailwind CSS, Recharts, and Lucide icons." },
    { name: "Node.js & Express", role: "Backend Server", details: "Coordinates REST API endpoints, parses document uploads, and manages local index configurations." },
    { name: "SQLite & Prisma", role: "Relational Database", details: "Maintains structured local records of active users, custom prompt agents, document statuses, and chat session histories." },
    { name: "MiniSearch Engine", role: "Keyword Indexer", details: "A local, high-performance search index storing BM25 keyword documents directly inside in-memory arrays." },
    { name: "Transformers.js", role: "Local ML Models", details: "Pipes HuggingFace models to run CPU-bound classification and reranking algorithms directly inside the Node environment." },
    { name: "Gemini 2.5 API", role: "LLM & Embeddings", details: "Google's low-latency API used strictly to compute 768-dimension vectors and synthesize the final RAG contextual responses." }
  ];

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full bg-slate-50 text-slate-800">
      {/* Branding Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
        <div className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-96 w-96 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Zap className="w-3 h-3 animate-pulse" /> Final Year BE AI & DS Project
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            RAG Document Assistant: <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              Local-First AI & Data Science Hub
            </span>
          </h1>
          <p className="text-sm md:text-base text-slate-500 leading-relaxed max-w-2xl">
            A comprehensive, locally persisted Retrieval-Augmented Generation (RAG) assistant combined with a sandboxed Data Science sandbox and customized AI persona prompt studio.
          </p>
        </div>
      </div>

      {/* Grid: What is it? */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              What is RAG?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500 leading-relaxed space-y-3">
            <p>
              <strong>Retrieval-Augmented Generation (RAG)</strong> is a design pattern that retrieves facts from an external knowledge repository to anchor large language model responses.
            </p>
            <p>
              In traditional LLM calls, the model operates purely on static pre-trained weights, leading to **hallucinations** and an inability to access private or real-time documents. RAG intercepts your question, searches your indexed repository for relevant paragraphs, and appends those paragraphs as context to guide the model's response.
            </p>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-700">Resolves hallucinations by verifying responses against physical documents.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              Why this Architecture?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500 leading-relaxed space-y-3">
            <p>
              Enterprise databases cannot afford to leak customer data or proprietary documents to public clouds or online vector stores. 
            </p>
            <p>
              Our architecture keeps files, indices, database schemas, and data science calculations **100% local**. By moving keyword generation, vector caching, reranking, and sandbox testing to the server node, the API key is utilized solely to parse raw tokens and embed dimensions, establishing a secure privacy barrier.
            </p>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-700">Combines local indices (MiniSearch) and SQLite registers for offline control.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Why: Core Advantages Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Core Engineering Enhancements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coreWhyPoints.map((pt) => {
            const Icon = pt.icon;
            return (
              <div 
                key={pt.title}
                className="flex gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-350 hover:shadow-md transition-all duration-200"
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${pt.color}`}>
                  <Icon className="w-5.5 h-5.5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{pt.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{pt.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How: RAG Data Flow Pipeline */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">How It Works: Step-by-Step Data Flow</h3>
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center space-y-3 relative z-10">
                <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-sm">
                  1
                </div>
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-slate-900">Ingest & Split</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    User uploads files (PDF/CSV/Excel). Texts are parsed and split into chunks with overlap settings.
                  </p>
                </div>
              </div>

              {/* Arrow 1 */}
              <div className="hidden md:flex absolute top-6 left-[18%] w-[15%] h-0.5 bg-slate-200 items-center justify-end">
                <ArrowRight className="w-3.5 h-3.5 text-slate-350 -mr-1" />
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center space-y-3 relative z-10">
                <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-sm">
                  2
                </div>
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-slate-900">Index & Cache</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Embeddings are calculated and saved to local JSON vectors. Keywords are added to MiniSearch index files.
                  </p>
                </div>
              </div>

              {/* Arrow 2 */}
              <div className="hidden md:flex absolute top-6 left-[43%] w-[15%] h-0.5 bg-slate-200 items-center justify-end">
                <ArrowRight className="w-3.5 h-3.5 text-slate-350 -mr-1" />
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center space-y-3 relative z-10">
                <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-sm">
                  3
                </div>
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-slate-900">Search & Rerank</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Retrieves candidates using hybrid similarity. Local MiniLM reranker picks the top 6 context blocks on the CPU.
                  </p>
                </div>
              </div>

              {/* Arrow 3 */}
              <div className="hidden md:flex absolute top-6 left-[68%] w-[15%] h-0.5 bg-slate-200 items-center justify-end">
                <ArrowRight className="w-3.5 h-3.5 text-slate-350 -mr-1" />
              </div>

              {/* Step 4 */}
              <div className="flex flex-col items-center text-center space-y-3 relative z-10">
                <div className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-600/20">
                  4
                </div>
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-slate-900">Synthesize & Stream</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Context is combined with chat history and agent persona rules. Gemini synthesizes answer tokens streamed via SSE.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tech Stack Table / Viva Cheatsheet */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Project Technology Stack (Viva Reference Sheet)</h3>
        <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-6 w-1/4">Technology Component</th>
                    <th className="py-3.5 px-6 w-1/4">Project Role</th>
                    <th className="py-3.5 px-6 w-1/2">Why We Used It (Technical Rationale)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {techStack.map((tech) => (
                    <tr key={tech.name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-950">{tech.name}</td>
                      <td className="py-4 px-6 font-semibold text-slate-500">{tech.role}</td>
                      <td className="py-4 px-6 text-slate-400 leading-relaxed">{tech.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Pages Features Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Portal Highlights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Database className="w-4.5 h-4.5" />
            </div>
            <h5 className="text-xs font-bold text-slate-950 uppercase tracking-wider">Scoped Knowledge</h5>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Toggles checkbox filters to scope similarity queries to 2 or 3 targeted files out of a library of 100+ documents, reducing query dilution.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <h5 className="text-xs font-bold text-slate-950 uppercase tracking-wider">ML sandbox</h5>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Trains local Regression, Classification (Naive Bayes), and Clustering (K-Means) algorithms from scratch directly inside Node memory scopes.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Settings className="w-4.5 h-4.5" />
            </div>
            <h5 className="text-xs font-bold text-slate-950 uppercase tracking-wider">Agent Builder</h5>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Designs AI agent personas with customized system instructions and temperature configs, persisting data to local SQLite structures.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <h5 className="text-xs font-bold text-slate-950 uppercase tracking-wider">Split-Screen View</h5>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Slides open a native document sidebar viewer linked directly to specific page anchors on citation click, verifying facts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
