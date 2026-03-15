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
import { queryDocuments, queryCSV, queryExcel } from "@/api";
import { CSVChart } from "@/components/CSVChart";
import type { ChatMessage, SourceDocument, ChartData } from "@/types";
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
}

const generateId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

export const Chat = ({ documentsReady = false, dataSource = 'none' }: ChatProps) => {
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

    try {
      let answer = "";
      let sources: SourceDocument[] = [];
      let chartData: ChartData | undefined;

      // Choose the appropriate query endpoint based on data source
      if (dataSource === 'csv') {
        // CSV only - use CSV query endpoint
        const response = await queryCSV(content.trim());
        answer = response.answer;
        if (response.chartData) {
          chartData = response.chartData;
        }
      } else if (dataSource === 'excel') {
        // Excel only - use Excel query endpoint
        const response = await queryExcel(content.trim());
        answer = response.answer;
        if (response.chartData) {
          chartData = response.chartData;
        }
      } else if (dataSource === 'pdf' || dataSource === 'both') {
        // PDF/DOCX/PPTX available - use RAG query endpoint
        const response = await queryDocuments(content.trim());
        answer = response.answer;
        sources = response.sourceDocuments;
      } else {
        throw new Error("No data source available");
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        content: answer,
        role: "assistant",
        timestamp: new Date(),
        sources: sources.length > 0 ? sources : undefined,
        chartData,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: generateId(),
        content:
          "Sorry, I encountered an error processing your request. Please try again.",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error("Query failed", {
        description:
          "There was an error processing your question. Please try again.",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
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
                        className="bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-input"
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
                {messages.map((message) => (
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
                      <div className="text-sm prose prose-sm max-w-none break-words overflow-wrap-anywhere prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:font-semibold">
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
                                  className="bg-background/50 rounded p-2 text-xs overflow-hidden border border-border/10"
                                >
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="font-medium truncate min-w-0 flex-1">
                                      {source.metadata.source}
                                      {source.metadata.chunkIndex !== undefined &&
                                        ` - Chunk ${source.metadata.chunkIndex}`}
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
                ))}

                {/* Loading indicator */}
                {isLoading && (
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
                className="flex-1 bg-muted/30 border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary shadow-sm"
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
