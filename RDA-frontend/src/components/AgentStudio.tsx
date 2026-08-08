import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAgents, createAgent, deleteAgent, updateAgent } from '@/api';
import type { Agent } from '@/api';
import { 
  UserCircle, 
  Trash2, 
  Plus, 
  Sparkles, 
  TrendingUp, 
  ShieldAlert, 
  Terminal, 
  GraduationCap, 
  Loader2, 
  MessageSquare,
  Sliders,
  Info,
  Pencil,
  X,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

interface AgentStudioProps {
  onAgentSelected?: (agent: Agent | null) => void;
  selectedAgentId?: string | null;
}

const TEMPLATES = [
  {
    name: "Financial Analyst",
    description: "Deep financial analysis, margin calculation, balance sheets, and trends.",
    systemPrompt: "You are a senior financial analyst and investment strategist. Your role is to conduct deep analytical reviews of financial statements, balance sheets, income statements, cash flow statements, and tax disclosures.\n\nWhen answering:\n- Perform precise numerical calculations, compute margins, growth rates, and key financial ratios (liquidity, leverage, profitability).\n- Structure your answers with clear tables comparing historical metrics where applicable.\n- Outline financial trends, audit anomalies, cost-efficiency opportunities, and risk exposures.\n- Always detail the mathematical logic behind your computations to ensure auditing clarity.\n\nAdopt a professional, objective, and analytical tone.",
    temperature: 0.2,
    icon: TrendingUp,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    name: "Scientific Critic",
    description: "Critiques experimental methodology, control groups, and biases.",
    systemPrompt: "You are an esteemed scientific journal editor and peer reviewer. Analyze scientific publications, research designs, and methodologies with strict academic rigor.\n\nWhen answering:\n- Critically evaluate the experiment's control measures, sample sizes, correlation vs. causation limits, and potential selection or confirmation biases.\n- Call out gaps in data, missing control groups, statistical significance claims (p-values), or potential flaws in reasoning.\n- Suggest concrete experimental improvements or future areas of study.\n\nMaintain a highly objective, formal, constructive, and scientifically precise tone.",
    temperature: 0.5,
    icon: GraduationCap,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    name: "Academic Educator",
    description: "Generates step-by-step lessons, study guides, and quizzes.",
    systemPrompt: "You are an experienced university professor and pedagogical specialist. Your goal is to teach complex academic concepts, theories, and frameworks in an engaging, structured, and highly accessible format.\n\nWhen answering:\n- Break down dense topics into digestible sections with clear headings and summaries.\n- Use helpful analogies, metaphors, and step-by-step logic to make theories understandable.\n- When requested, design complete custom lesson plans, comprehensive study guides, and test questions (with detailed explanation of the correct answers).\n\nAdopt an encouraging, clear, educational, and patient tone.",
    temperature: 0.6,
    icon: BookOpen,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    name: "Legal Auditor",
    description: "Contract auditing, liability compliance, risk logs, and revisions.",
    systemPrompt: "You are an expert legal counsel and compliance auditor. Carefully review contracts, agreements, privacy policies, terms of service, and regulatory compliance documents.\n\nWhen answering:\n- Identify liability exposures, missing standard clauses, ambiguous terminology, and regulatory non-compliance points.\n- Structure your feedback cleanly using a risk-level rating system (High Risk, Medium Risk, Low Risk).\n- Suggest precise, revised wording or protective clauses to mitigate identified risks.\n\nAdopt a formal, rigorous, detail-oriented, and highly analytical legal tone.",
    temperature: 0.3,
    icon: ShieldAlert,
    color: "text-red-600 bg-red-50 border-red-200",
  },
  {
    name: "Code Assistant",
    description: "Technical architecture, optimized code blocks, and security auditing.",
    systemPrompt: "You are a principal software architect and technical lead. Your task is to analyze codebase structures, API specifications, technical documentation, and code snippets.\n\nWhen answering:\n- Write highly optimized, clean, and self-documenting code snippets following industry best practices (SOLID, DRY).\n- Explain complex technical concepts step-by-step, including architectural patterns and system design trade-offs.\n- Identify potential security vulnerabilities, performance bottlenecks, race conditions, or edge-case bugs.\n- Include code comments and inline explanations.\n\nAdopt a professional, direct, and technically precise tone.",
    temperature: 0.7,
    icon: Terminal,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    name: "Creative Writer",
    description: "Marketing copy, advertising pitches, and narrative synthesis.",
    systemPrompt: "You are an award-winning creative writer, copywriter, and narrative designer. Your goal is to synthesize data, raw facts, and uploaded document contents into compelling stories, scripts, blog posts, or marketing copy.\n\nWhen answering:\n- Employ vivid descriptions, emotional hooks, and structured narrative arcs.\n- Adapt your style to the requested format (e.g., ad copywriting, speech writing, fictional narrative, educational storytelling).\n- Remain strictly grounded in the factual truths present in the context, avoiding hallucinations while maximizing creative expression.\n\nAdopt an eloquent, persuasive, imaginative, and highly engaging tone.",
    temperature: 1.1,
    icon: Sparkles,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  }
];

export const AgentStudio = ({ onAgentSelected, selectedAgentId }: AgentStudioProps) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const data = await getAgents();
      setAgents(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to retrieve custom agents.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTemplate = async (tpl: typeof TEMPLATES[0]) => {
    setName(tpl.name);
    setDescription(tpl.description);
    setSystemPrompt(tpl.systemPrompt);
    setTemperature(tpl.temperature);
    setEditingAgentId(null); // Reset edit state if deploying fresh blueprint

    // Check if this agent already exists in the database list
    const existingAgent = agents.find(a => a.name.toLowerCase() === tpl.name.toLowerCase());
    
    if (existingAgent) {
      if (onAgentSelected) {
        onAgentSelected(existingAgent);
      }
      toast.success(`"${tpl.name}" preset persona is already deployed and active.`);
      return;
    }

    // Deploy preset to database and set as active
    setIsSaving(true);
    try {
      const res = await createAgent({
        name: tpl.name,
        description: tpl.description,
        systemPrompt: tpl.systemPrompt,
        temperature: tpl.temperature
      });

      if (res.success && res.agent) {
        toast.success(`"${res.agent.name}" template preset deployed and activated!`);
        // Refresh local list
        const updatedAgents = await getAgents();
        setAgents(updatedAgents);
        
        // Select the newly created agent
        const newAgent = updatedAgents.find(a => a.id === res.agent.id);
        if (newAgent && onAgentSelected) {
          onAgentSelected(newAgent);
        }
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error?.message || error.message || 'Failed to deploy template preset';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (agent: Agent) => {
    setEditingAgentId(agent.id);
    setName(agent.name);
    setDescription(agent.description);
    setSystemPrompt(agent.systemPrompt);
    setTemperature(agent.temperature);
    toast.info(`Editing "${agent.name}" persona. Update values below.`);
  };

  const handleCancelEdit = () => {
    setEditingAgentId(null);
    setName('');
    setDescription('');
    setSystemPrompt('');
    setTemperature(0.7);
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a name for the agent.');
      return;
    }
    if (systemPrompt.trim().length < 10) {
      toast.error('System prompt must be at least 10 characters long.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingAgentId) {
        const res = await updateAgent(editingAgentId, {
          name: name.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          temperature
        });

        if (res.success && res.agent) {
          toast.success(`Agent "${res.agent.name}" updated successfully!`);
          handleCancelEdit();
          await fetchAgents();
          
          if (selectedAgentId === res.agent.id && onAgentSelected) {
            onAgentSelected(res.agent);
          }
        }
      } else {
        const res = await createAgent({
          name: name.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          temperature
        });

        if (res.success && res.agent) {
          toast.success(`Agent "${res.agent.name}" created successfully!`);
          setName('');
          setDescription('');
          setSystemPrompt('');
          setTemperature(0.7);
          await fetchAgents();
          
          if (onAgentSelected) {
            onAgentSelected(res.agent);
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error?.message || error.message || 'Failed to save agent';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAgent = async (id: string, agentName: string) => {
    toast(`Delete agent persona "${agentName}"?`, {
      description: 'This will remove the persona and dissociate it from active chat histories.',
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await deleteAgent(id);
            toast.success('Agent persona deleted');
            if (selectedAgentId === id && onAgentSelected) {
              onAgentSelected(null);
            }
            if (editingAgentId === id) {
              handleCancelEdit();
            }
            await fetchAgents();
          } catch (e) {
            console.error(e);
            toast.error('Failed to delete agent persona.');
          }
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} }
    });
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full bg-slate-50 text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          AI Agent Studio
        </h1>
        <p className="text-sm text-slate-500">
          Build specialized personas with custom system constraints. Choose template presets or customize LLM temperatures.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Form & Presets */}
        <div className="xl:col-span-2 space-y-6">
          {/* Templates Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Quick-Start Template Presets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.name}
                    disabled={isSaving}
                    onClick={() => handleApplyTemplate(tpl)}
                    className="flex flex-col text-left p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group outline-none disabled:opacity-60"
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center border mb-3 ${tpl.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {tpl.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {tpl.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900">
                {editingAgentId ? `Edit Agent Persona: ${name}` : 'Agent Details'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {editingAgentId
                  ? 'Update constraints and settings for this custom agent model.'
                  : 'Design system instructions and define constraints for your specialized AI model.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAgent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Agent Name</label>
                    <Input
                      placeholder="e.g., Financial Auditor"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSaving}
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Short Description</label>
                    <Input
                      placeholder="e.g., Performs financial analysis on spreadsheets"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={isSaving}
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">System Instructions (Prompt)</label>
                  <textarea
                    rows={5}
                    placeholder="Provide specific guidelines, e.g., 'You are a professional auditor...'"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                  />
                  <span className="text-[10px] text-slate-400">This instruction is injected globally into RAG search cycles.</span>
                </div>

                {/* Temperature Slider */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      Temperature / Creativity: {temperature}
                    </label>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    disabled={isSaving}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 px-1">
                    <span>Deterministic (0.0)</span>
                    <span>Standard (0.7)</span>
                    <span>Creative (1.5)</span>
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  {editingAgentId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="flex-1 border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4 animate-in fade-in zoom-in-75" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingAgentId ? (
                      <Pencil className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {editingAgentId ? 'Save Changes' : 'Create Agent Persona'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Active List */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="border border-slate-200 shadow-sm bg-white h-full flex flex-col min-h-[400px]">
            <CardHeader className="pb-3 border-b border-slate-100 flex-none">
              <CardTitle className="text-base font-bold text-slate-900">Active Personas</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Choose the active agent persona to interact with in the Chat Assistant.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
              {/* Default Gemini Agent */}
              <div 
                onClick={() => onAgentSelected && onAgentSelected(null)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${!selectedAgentId ? 'border-indigo-500 bg-indigo-50/20 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${!selectedAgentId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <UserCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Standard Gemini</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Standard helper mode (Temp: 0.7)</p>
                    </div>
                  </div>
                  {!selectedAgentId && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full animate-in fade-in duration-200">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Default settings without custom instructions.
                </p>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                  Loading custom agents...
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No custom agents created.
                  <p className="mt-1">Fill the form to create your first specialized agent!</p>
                </div>
              ) : (
                agents.map((agent) => {
                  const isSelected = selectedAgentId === agent.id;
                  return (
                    <div 
                      key={agent.id}
                      onClick={() => onAgentSelected && onAgentSelected(agent)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/20 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 truncate max-w-[140px]">{agent.name}</h4>
                            <p className="text-[10px] text-slate-500 font-medium">Temp: {agent.temperature}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isSelected && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full animate-in fade-in duration-200">
                              Active
                            </span>
                          )}
                          <button
                            onClick={() => handleEditClick(agent)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition"
                            title="Edit agent settings"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(agent.id, agent.name)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50 transition"
                            title="Delete agent"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {agent.description && (
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">
                          {agent.description}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Studio Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-slate-600">
        <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <h5 className="font-bold text-slate-900">How Agents work in RAG</h5>
          <p className="mt-0.5 leading-relaxed">
            Specialized agent prompts constrain how the LLM synthesizes responses. For example, selecting the **Financial Analyst** agent limits hallucinations when dealing with numeric grids and prompts the model to summarize key trends in a financial layout. Selected agents will govern conversations in the **Chat Assistant** tab.
          </p>
        </div>
      </div>
    </div>
  );
};
