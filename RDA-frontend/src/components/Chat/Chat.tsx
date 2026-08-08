import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  History,
  Plus,
  Trash2,
  MessageSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CSVChart } from "@/components/CSVChart";
import type { ChatMessage, SourceDocument, UploadedDocument } from "@/types";
import { cn } from "@/lib/utils";

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

type DataSource = 'pdf' | 'csv' | 'excel' | 'both' | 'none';

interface ChatProps {
  documentsReady?: boolean;
  dataSource?: DataSource;
  onSourceClick?: (source: SourceDocument) => void;
  selectedDocumentIds?: string[];
  onToggleSelect?: (id: string) => void;
  uploadedDocuments?: UploadedDocument[];
  selectedAgentId?: string | null;
}

const generateId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const recordQueryTelemetry = (latencyMs: number) => {
  try {
    const saved = localStorage.getItem('rag_query_telemetry');
    let telemetry = [];
    if (saved) {
      telemetry = JSON.parse(saved);
    } else {
      telemetry = [
        { date: 'Mon', queries: 0, latency: 0 },
        { date: 'Tue', queries: 0, latency: 0 },
        { date: 'Wed', queries: 0, latency: 0 },
        { date: 'Thu', queries: 0, latency: 0 },
        { date: 'Fri', queries: 0, latency: 0 },
        { date: 'Sat', queries: 0, latency: 0 },
        { date: 'Sun', queries: 0, latency: 0 },
      ];
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDay = days[new Date().getDay()];

    telemetry = telemetry.map((t: any) => {
      if (t.date === currentDay) {
        const oldQueries = t.queries || 0;
        const oldLatency = t.latency || 0;
        const newQueries = oldQueries + 1;
        const newLatency = Math.round((oldLatency * oldQueries + latencyMs) / newQueries);
        return { ...t, queries: newQueries, latency: newLatency };
      }
      return t;
    });

    localStorage.setItem('rag_query_telemetry', JSON.stringify(telemetry));
    localStorage.setItem('rag_query_telemetry_actual', 'true');
  } catch (e) {
    console.error('Failed to record query telemetry', e);
  }
};

const PDF_SUGGESTIONS = [
  "What is this document about?",
  "Summarize the key points",
  "What are the main findings?",
];

const CSV_SUGGESTIONS = [
  "What columns are in this data?",
  "Summarize the key statistics",
  "What are the top values?",
];

export const Chat = ({ 
  documentsReady = false, 
  dataSource = 'none', 
  onSourceClick, 
  selectedDocumentIds = [], 
  onToggleSelect,
  uploadedDocuments = [],
  selectedAgentId = null 
}: ChatProps) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('rag_chat_sessions');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse sessions', e);
    }
    return [{ id: generateId(), title: 'New Chat', messages: [], timestamp: Date.now() }];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('rag_current_session_id');
    if (saved) return saved;
    return sessions.length > 0 ? sessions[0].id : '';
  });

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [showScopeSelector, setShowScopeSelector] = useState(false);

  useEffect(() => {
    localStorage.setItem('rag_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('rag_current_session_id', currentSessionId);
    }
  }, [currentSessionId]);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];
  const activeSessionId = currentSession?.id;

  useEffect(() => {
    if (sessions.length === 0) {
      const newId = generateId();
      setSessions([{ id: newId, title: 'New Chat', messages: [], timestamp: Date.now() }]);
      setCurrentSessionId(newId);
    }
  }, [sessions]);

  const setMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions(prev => prev.map(session => {
      // Use the resolved activeSessionId instead of currentSessionId which could be a dead reference
      if (session.id === activeSessionId) {
        const newMessages = typeof updater === 'function' ? updater(session.messages) : updater;

        let newTitle = session.title;
        if (session.messages.length === 0 && newMessages.length > 0) {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            newTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
        }

        return { ...session, messages: newMessages, title: newTitle };
      }
      return session;
    }));
  };

  const createNewSession = () => {
    const newId = generateId();
    setSessions(prev => [{ id: newId, title: 'New Chat', messages: [], timestamp: Date.now() }, ...prev]);
    setCurrentSessionId(newId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowHistory(false);
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast('Delete this chat session?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: () => {
          setSessions(prev => {
            const nextSessions = prev.filter(s => s.id !== id);
            if (nextSessions.length === 0) {
              const newId = generateId();
              setCurrentSessionId(newId);
              return [{ id: newId, title: 'New Chat', messages: [], timestamp: Date.now() }];
            }
            if (id === currentSessionId) {
              setCurrentSessionId(nextSessions[0].id);
            }
            return nextSessions;
          });
          toast.success('Session deleted');
        }
      },
      cancel: { label: 'Cancel', onClick: () => { } }
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get unique document names from sources
  const getUniqueDocuments = (sources: SourceDocument[]): string[] => {
    const uniqueNames = new Set(sources.map((s) => s.metadata.source));
    return Array.from(uniqueNames);
  };

  const toggleSourceExpanded = (messageId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !documentsReady || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      content: content.trim(),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    const startTime = Date.now();
    const assistantMessageId = generateId();

    try {
      let answer = "";

      const historyPayload = messages
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Use the unified streaming query endpoint for all active document data sources
      if (dataSource === 'pdf' || dataSource === 'both' || dataSource === 'csv' || dataSource === 'excel') {
        
        // Add placeholder message for streaming text
        const placeholderMessage: ChatMessage = {
          id: assistantMessageId,
          content: "",
          role: "assistant",
          timestamp: new Date(),
          sources: undefined,
        };
        setMessages((prev) => [...prev, placeholderMessage]);

        const jwtToken = localStorage.getItem('rag_jwt_token');
        const retrievalMode = localStorage.getItem('rag_retrieval_mode') || 'hybrid';
        const topK = Number(localStorage.getItem('rag_top_k')) || 6;
        const useReranking = localStorage.getItem('rag_use_reranking') !== 'false';

        const fetchResponse = await fetch('/api/chat/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify({
            question: content.trim(),
            history: historyPayload,
            selectedDocumentIds,
            agentId: selectedAgentId,
            stream: true,
            retrievalMode,
            topK,
            useReranking
          })
        });

        if (!fetchResponse.ok) {
          const errBody = await fetchResponse.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || `API error! Status: ${fetchResponse.status}`);
        }

        const reader = fetchResponse.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let streamBuffer = '';

        if (!reader) {
          throw new Error("Failed to initialize stream reader");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n\n');
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data: ')) {
              const dataStr = cleanLine.slice(6);
              if (dataStr === '[DONE]') continue;

              let parseError: Error | null = null;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'metadata') {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, sources: parsed.sourceDocuments }
                        : msg
                    )
                  );
                } else if (parsed.type === 'content') {
                  answer += parsed.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: answer }
                        : msg
                    )
                  );
                } else if (parsed.type === 'error') {
                  parseError = new Error(parsed.message);
                }
              } catch (e) {
                console.error("Failed to parse stream chunk:", e);
              }
              if (parseError) {
                throw parseError;
              }
            }
          }
        }
        recordQueryTelemetry(Date.now() - startTime);
      } else {
        throw new Error("No data source available");
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      
      setMessages((prev) => {
        // If we added a placeholder message, replace its content with the error description
        const hasPlaceholder = prev.some(m => m.id === assistantMessageId);
        if (hasPlaceholder) {
          return prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: "Sorry, I encountered an error processing your request. Please try again." } 
              : m
          );
        } else {
          // Otherwise, append a new error message
          const errorMessage: ChatMessage = {
            id: generateId(),
            content: "Sorry, I encountered an error processing your request. Please try again.",
            role: "assistant",
            timestamp: new Date(),
          };
          return [...prev, errorMessage];
        }
      });

      toast.error("Query failed", {
        description: error.message || "There was an error processing your question. Please try again.",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isLoading || !inputValue.trim()) return;
    sendMessage(inputValue);
  };

  const selectSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <Card className="bg-card border-none shadow-none flex flex-col h-full overflow-hidden relative">
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        {/* Sidebar for History */}
        {showHistory && (
          <div className="w-64 border-r border-border bg-muted/10 flex flex-col h-full flex-shrink-0 absolute md:relative z-20 md:z-auto shadow-lg md:shadow-none bg-background md:bg-muted/10">
            <div className="p-3 border-b border-border flex items-center justify-between bg-background">
              <span className="font-semibold text-sm flex items-center gap-2"><History className="w-4 h-4" /> Chat History</span>
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} className="h-8 w-8 hover:bg-muted">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-2 border-b border-border">
              <Button onClick={createNewSession} className="w-full gap-2 shadow-sm" size="sm">
                <Plus className="w-4 h-4" /> New Chat
              </Button>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => { setCurrentSessionId(session.id); if (typeof window !== 'undefined' && window.innerWidth < 768) setShowHistory(false); }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors group w-full",
                      currentSessionId === session.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate block leading-tight">{session.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive shrink-0 disabled:opacity-50 transition-opacity"
                      onClick={(e) => deleteSession(session.id, e)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <CardContent className="p-0 flex flex-col h-full overflow-hidden min-h-0 min-w-0 flex-1 relative">
          {/* Topbar for toggle history and display title */}
          <div className="p-2 border-b border-border bg-background flex items-center justify-between gap-2 flex-shrink-0 relative z-10 w-full shadow-sm">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowHistory(prev => !prev)} className="gap-2 shadow-sm text-muted-foreground mr-1 h-8 shrink-0 relative">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
                <span className="absolute -top-1 -right-1 flex h-3 w-3 bg-primary rounded-full items-center justify-center text-[8px] text-primary-foreground font-bold border border-background">{sessions.length}</span>
              </Button>
            </div>

            <div className="flex-1 text-center font-medium text-sm truncate px-2 text-foreground">
              {currentSession?.title || 'New Chat'}
            </div>

            <div className="flex items-center gap-2">
              {/* Query Scope Selector */}
              {uploadedDocuments.length > 0 && (
                <div className="relative">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowScopeSelector(prev => !prev)} 
                    className="gap-2 shadow-sm text-muted-foreground mr-1 h-8 shrink-0 font-medium"
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs">
                      {selectedDocumentIds.length === 0 
                        ? 'Scope: Entire Library' 
                        : `Scope: ${selectedDocumentIds.length} ${selectedDocumentIds.length === 1 ? 'File' : 'Files'}`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>

                  {showScopeSelector && (
                    <>
                      {/* Click outside overlay */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowScopeSelector(false)}></div>
                      
                      <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 max-h-80 flex flex-col">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2 flex-shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Query Scope</span>
                          {selectedDocumentIds.length > 0 && (
                            <button 
                              onClick={() => {
                                // Clear all selections to reset to all
                                selectedDocumentIds.forEach(id => onToggleSelect?.(id));
                              }}
                              className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-500 bg-transparent border-0 cursor-pointer"
                            >
                              Reset to All
                            </button>
                          )}
                        </div>
                        <ScrollArea className="flex-grow overflow-y-auto max-h-[180px]">
                          <div className="space-y-1.5 pr-2">
                            <label className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-medium w-full select-none">
                              <input 
                                type="checkbox"
                                checked={selectedDocumentIds.length === 0}
                                onChange={() => {
                                  // If there are selections, clear them to make it Entire Library
                                  if (selectedDocumentIds.length > 0) {
                                    selectedDocumentIds.forEach(id => onToggleSelect?.(id));
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 accent-indigo-600"
                              />
                              <span className={cn(selectedDocumentIds.length === 0 ? "font-bold text-indigo-600" : "text-slate-600")}>
                                Entire Library ({uploadedDocuments.length} files)
                              </span>
                            </label>
                            <div className="border-t border-slate-100 my-1"></div>
                            {uploadedDocuments.map((doc) => {
                              const isChecked = selectedDocumentIds.includes(doc.id);
                              return (
                                <label key={doc.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs w-full select-none">
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => onToggleSelect?.(doc.id)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 accent-indigo-600"
                                  />
                                  <span className={cn("truncate flex-1 text-left", isChecked ? "font-semibold text-slate-900" : "text-slate-500")}>
                                    {doc.originalFileName}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={createNewSession} className="gap-1 px-2 h-8 shrink-0">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span>
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 min-h-0 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="p-4 bg-primary/5 rounded-full mb-4">
                  <Bot className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Ask questions about your documents
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-6">
                  {documentsReady
                    ? dataSource === 'csv' || dataSource === 'excel'
                      ? "I'm ready to help! Ask me anything about your spreadsheet data."
                      : "I'm ready to help! Ask me anything about the documents you've uploaded."
                    : "Upload a document first, then you can start asking questions."}
                </p>

                {/* Suggestions */}
                {documentsReady && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {(dataSource === 'csv' || dataSource === 'excel' ? CSV_SUGGESTIONS : PDF_SUGGESTIONS).map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        className="bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-input disabled:opacity-50"
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 w-full max-w-full overflow-hidden pb-4">
                {messages.map((message) => {
                  // Skip rendering placeholder assistant message while it has no content, chart, or sources
                  if (
                    message.role === "assistant" &&
                    !message.content.trim() &&
                    !message.chartData &&
                    (!message.sources || message.sources.length === 0)
                  ) {
                    return null;
                  }

                  return (
                    <div
                      key={message.id}
                      className={cn(
                      "flex gap-4 min-w-0",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {/* Avatar for assistant */}
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[85%] min-w-0 rounded-2xl p-4 shadow-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted/50 text-foreground border border-border/50 rounded-tl-sm"
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm prose prose-sm max-w-none break-words overflow-wrap-anywhere prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:font-semibold",
                          message.role === "user" ? "prose-invert text-white" : "text-foreground"
                        )}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>

                      {/* Chart */}
                      {message.chartData && (
                        <div className="mt-4 bg-card rounded-lg p-2 border border-border">
                          <CSVChart
                            type={message.chartData.type}
                            labels={message.chartData.labels}
                            datasets={message.chartData.datasets}
                          />
                        </div>
                      )}

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/20">
                          {/* Source badges */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {getUniqueDocuments(message.sources).map(
                              (docName, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="bg-background/50 hover:bg-background text-xs max-w-full border-0"
                                >
                                  <FileText className="w-3 h-3 mr-1 flex-shrink-0" />
                                  <span className="truncate">{docName}</span>
                                </Badge>
                              )
                            )}
                          </div>

                          {/* Collapsible source details */}
                          <Collapsible
                            open={expandedSources[message.id]}
                            onOpenChange={() => toggleSourceExpanded(message.id)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-between hover:bg-background/20 opacity-70 hover:opacity-100 p-0 h-auto"
                              >
                                <span className="text-xs">
                                  View {message.sources.length} source
                                  {message.sources.length > 1 ? "s" : ""}
                                </span>
                                {expandedSources[message.id] ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 space-y-2">
                              {message.sources.map((source, index) => (
                                <div
                                  key={index}
                                  className="bg-background/50 rounded p-2 text-xs overflow-hidden border border-border/10 cursor-pointer hover:bg-background/80 transition"
                                  onClick={() => onSourceClick?.(source)}
                                >
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="font-medium truncate min-w-0 flex-1">
                                      {source.metadata.source}
                                      {source.metadata.pageNumber !== undefined &&
                                        ` - Page ${source.metadata.pageNumber}`}
                                    </span>
                                  </div>
                                  <p className="opacity-80 line-clamp-3 break-words">
                                    {source.pageContent}
                                  </p>
                                </div>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </div>

                    {/* Avatar for user */}
                    {message.role === "user" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                )})}

                {/* Loading indicator */}
                {isLoading && (!messages.length || messages[messages.length - 1].role !== "assistant" || !messages[messages.length - 1].content.trim()) && (
                  <div className="flex gap-4 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted/50 rounded-2xl p-4 border border-border/50 rounded-tl-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-border bg-background">
            <form onSubmit={handleSubmit} className="flex gap-2 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  documentsReady
                    ? dataSource === 'csv' || dataSource === 'excel'
                      ? "Ask a question about your spreadsheet data..."
                      : "Ask a question about your documents..."
                    : "Upload a document first..."
                }
                disabled={!documentsReady || isLoading}
                className={cn(
                  "flex-1 bg-muted/30 border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary shadow-sm",
                  isLoading && "opacity-60 cursor-not-allowed bg-slate-100"
                )}
              />
              <Button
                type="submit"
                disabled={!documentsReady || isLoading || !inputValue.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default Chat;
