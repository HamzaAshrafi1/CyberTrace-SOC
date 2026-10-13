"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Bot, Send, User, Sparkles, Database, Trash2, Plus, 
  UploadCloud, FileText, ChevronRight, AlertTriangle, 
  RefreshCw, Terminal, FileCheck, Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CyberPanel } from "@/components/ui/CyberPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  createChatSessionAction, 
  deleteChatSessionAction, 
  getChatMessagesAction, 
  sendChatMessageAction, 
  uploadDocumentAction 
} from "./actions";

interface ChatSession {
  id: string;
  title: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface DocumentItem {
  id: string;
  name: string;
  fileType: string;
  fileSize: string;
  createdAt: string | Date;
}

interface Citation {
  document_name: string;
  page_number?: number;
  snippet: string;
}

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  sources?: Citation[];
  diagnostics?: {
    retrievedChunks: number;
    latencyMs: number;
    sourceDocsCount: number;
  };
}

interface ChatClientProps {
  initialSessions: ChatSession[];
  initialDocuments: DocumentItem[];
}

const SUGGESTIONS = [
  { label: "Active Incidents", text: "What critical incidents are currently active?" },
  { label: "Compliance Gaps", text: "What compliance gaps currently exist?" },
  { label: "Recent SQL Attacks", text: "Explain recent SQL injection attacks." },
  { label: "Security Summary", text: "Generate an executive security summary." },
];

export default function ChatClient({
  initialSessions,
  initialDocuments,
}: ChatClientProps) {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialSessions.length > 0 ? initialSessions[0].id : null
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(true); // Default debug telemetry to ON for mission console look
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chat messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      setErrorMessage(null);
      getChatMessagesAction(activeSessionId)
        .then((msgs) => {
          setMessages(
            msgs.map((m) => {
              let parsedSources: Citation[] = [];
              let parsedDiag = undefined;
              try {
                if (m.sources) parsedSources = JSON.parse(m.sources);
                if (m.diagnostics) parsedDiag = JSON.parse(m.diagnostics);
              } catch (e) {
                console.error("Failed parsing message JSON fields", e);
              }
              return {
                id: m.id,
                sender: m.sender as "user" | "bot",
                text: m.text,
                timestamp: new Date(m.createdAt).toLocaleTimeString(),
                sources: parsedSources,
                diagnostics: parsedDiag,
              };
            })
          );
        })
        .catch((err) => {
          setErrorMessage("Failed to load chat history. Please refresh.");
          console.error(err);
        });
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Create new session
  const handleNewSession = async () => {
    try {
      setErrorMessage(null);
      const title = `Security Session #${sessions.length + 1}`;
      const newSession = await createChatSessionAction(title);
      const mappedSession: ChatSession = {
        id: newSession.id,
        title: newSession.title,
        createdAt: newSession.createdAt.toISOString(),
        updatedAt: newSession.updatedAt.toISOString(),
      };
      setSessions((prev) => [mappedSession, ...prev]);
      setActiveSessionId(newSession.id);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create session.");
    }
  };

  // Delete session
  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      setErrorMessage(null);
      await deleteChatSessionAction(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete session.");
    }
  };

  // Send message
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !activeSessionId) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setIsTyping(true);
    setErrorMessage(null);

    try {
      const reply = await sendChatMessageAction(activeSessionId, textToSend);
      let parsedSources: Citation[] = [];
      let parsedDiag = undefined;
      try {
        if (reply.sources) parsedSources = JSON.parse(reply.sources);
        if (reply.diagnostics) parsedDiag = JSON.parse(reply.diagnostics);
      } catch (e) {
        console.error("Failed to parse response JSON fields", e);
      }

      const botMsg: Message = {
        id: reply.id,
        sender: "bot",
        text: reply.text,
        timestamp: new Date(reply.createdAt).toLocaleTimeString(),
        sources: parsedSources,
        diagnostics: parsedDiag,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setErrorMessage("Error communicating with threat engine.");
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputVal);
  };

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "text/plain", 
      "application/pdf", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    
    const isDocx = file.name.endsWith(".docx");
    if (!validTypes.includes(file.type) && !isDocx) {
      setErrorMessage("Unsupported file type. Please upload a .txt, .pdf, or .docx file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("File exceeds 2MB limit. Please upload a smaller document.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Data = (event.target?.result as string).split(",")[1];
        const resultDoc = await uploadDocumentAction(
          file.name,
          file.name.split(".").pop() || "txt",
          (file.size / 1024).toFixed(1) + " KB",
          base64Data
        );

        const newDoc: DocumentItem = {
          id: resultDoc.id,
          name: resultDoc.name,
          fileType: resultDoc.fileType,
          fileSize: resultDoc.fileSize,
          createdAt: resultDoc.createdAt.toISOString(),
        };

        setDocuments((prev) => [newDoc, ...prev]);
        setErrorMessage(null);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to process and index document.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-8.5rem)] relative">
      
      {/* Sidebar panel (Sessions & Documents) */}
      <div className="xl:col-span-1 flex flex-col gap-5 h-full min-w-0">
        
        {/* Sessions list */}
        <CyberPanel glowColor="cyber-blue" className="flex-1 flex flex-col overflow-hidden">
          <div className="py-2.5 px-4 border-b border-border flex flex-row items-center justify-between shrink-0">
            <span className="text-xs uppercase font-mono tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyber-blue" />
              SESSION_LOGS
            </span>
            <Button 
              id="new-session-btn"
              size="icon" 
              variant="outline" 
              onClick={handleNewSession}
              className="h-6 w-6 border-border hover:bg-secondary/40 text-cyber-blue"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="p-2 flex-1 overflow-y-auto space-y-1 scrollbar-thin">
            {sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-all border text-xs font-semibold ${
                    isActive
                      ? "bg-cyber-blue/10 border-cyber-blue/20 text-cyber-blue shadow-[0_0_10px_rgba(0,229,255,0.05)]"
                      : "border-transparent text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
                  }`}
                >
                  <span className="truncate max-w-[140px] font-mono">{s.title.toUpperCase()}</span>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="p-1 hover:text-cyber-red rounded text-muted-foreground/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {sessions.length === 0 && (
              <div className="text-center py-8 text-[10px] font-mono text-muted-foreground uppercase">
                No active chat sessions
              </div>
            )}
          </div>
        </CyberPanel>

        {/* Documents inventory */}
        <CyberPanel glowColor="cyber-blue" className="h-[180px] flex flex-col overflow-hidden">
          <div className="py-2.5 px-4 border-b border-border flex flex-row items-center justify-between shrink-0">
            <span className="text-xs uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1.5 font-bold">
              <FileCheck className="w-3.5 h-3.5 text-cyber-blue" /> VECTOR_DB_SLICES
            </span>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pdf,.txt,.docx"
              className="hidden" 
            />
            <Button 
              size="icon" 
              variant="outline"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-6 w-6 border-border hover:bg-secondary/40 text-cyber-blue"
            >
              {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <div className="p-2 flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2 bg-background/40 border border-border/40 rounded-lg text-[10px]">
                <FileText className="w-3.5 h-3.5 text-cyber-blue shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-foreground font-mono">{d.name}</p>
                  <p className="text-[8px] text-muted-foreground font-mono uppercase">{d.fileType} • {d.fileSize}</p>
                </div>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="text-center py-6 text-[10px] font-mono text-muted-foreground uppercase">
                No indexed files
              </div>
            )}
          </div>
        </CyberPanel>

        {/* AI Cognitive Dashboard specs */}
        <CyberPanel glowColor="cyber-blue" className="p-3 font-mono text-[9px] space-y-3 shrink-0 relative overflow-hidden">
          <div className="absolute top-[-50%] left-[-50%] radar-sweep-effect opacity-10 pointer-events-none" />
          <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyber-blue animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-white">COGNITIVE_COCKPIT_STATS</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div className="p-1.5 bg-black/25 border border-white/5 rounded">
              <span>INDEX_DB:</span>
              <span className="text-cyber-green block font-bold mt-0.5">CHROMADB</span>
            </div>
            <div className="p-1.5 bg-black/25 border border-white/5 rounded">
              <span>CONFIDENCE:</span>
              <span className="text-cyber-green block font-bold mt-0.5">N/A</span>
            </div>
            <div className="p-1.5 bg-black/25 border border-white/5 rounded">
              <span>MODEL:</span>
              <span className="text-white block font-bold truncate mt-0.5">BACKEND CONFIG</span>
            </div>
            <div className="p-1.5 bg-black/25 border border-white/5 rounded">
              <span>DIMENSIONS:</span>
              <span className="text-cyber-purple block font-bold mt-0.5">1536 VECTOR</span>
            </div>
          </div>
          {/* Mock Latency chart dots */}
          <div className="space-y-1">
            <div className="flex justify-between text-[8px] text-muted-foreground">
              <span>RAG_LATENCY_INDEX:</span>
              <span>120MS</span>
            </div>
            <div className="flex gap-1 items-end h-5 bg-black/40 border border-white/5 rounded p-1">
              {[8, 14, 11, 15, 6, 9, 12, 16, 10, 13, 8, 12].map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-cyber-blue/60 rounded-t-xs hover:bg-cyber-blue transition-colors" 
                  style={{ height: `${h * 5}%` }} 
                />
              ))}
            </div>
          </div>
        </CyberPanel>

      </div>

      {/* Main AI Operations Mission Console */}
      <div className="xl:col-span-3 flex flex-col h-full bg-[#07111f]/35 border border-white/5 rounded-xl overflow-hidden relative backdrop-blur-md">
        
        {/* Header toolbar */}
        <div className="px-4 py-3 border-b border-white/5 bg-card/45 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-mono uppercase tracking-wider">Aegis AI Copilot Command Console</p>
              <p className="text-[9px] text-muted-foreground font-mono uppercase">Retrieval Augmented Generation logs // vector space indexes</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Active connection pulse */}
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-cyber-green bg-cyber-green/5 border border-cyber-green/20 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-ping" />
              COGNITIVE_ACTIVE
            </div>
            
            {/* Debug checkbox */}
            <div className="flex items-center gap-2 font-mono text-[9px]">
              <span className="text-muted-foreground uppercase">Triage Logs:</span>
              <button
                onClick={() => setIsDebugMode(!isDebugMode)}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-1 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDebugMode ? "bg-cyber-blue" : "bg-white/10"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                    isDebugMode ? "translate-x-3" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin relative z-10 bg-black/10">
          
          {/* Default instructions on empty session */}
          {messages.length === 0 && (
            <div className="max-w-xl mx-auto py-6 space-y-5 animate-fadeIn">
              <div className="text-center space-y-2">
                <Badge variant="outline" className="border-cyber-blue/30 text-cyber-blue bg-cyber-blue/5 text-[9px] uppercase font-mono tracking-wider">
                  COGNITIVE RETRIEVAL STAGE
                </Badge>
                <h3 className="text-sm font-bold text-white font-mono uppercase">System Diagnostic Queries</h3>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">
                  Ask framework compliance directives or list database intrusion traces.
                </p>
              </div>

              {/* Suggestions grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    disabled={!activeSessionId}
                    onClick={() => handleSendMessage(sug.text)}
                    className="p-3 text-left bg-card/45 border border-white/5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-cyber-blue/5 hover:border-cyber-blue/30 transition-all flex items-start gap-2 group cursor-pointer font-mono"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-cyber-blue shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                    <span className="leading-normal">{sug.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages list */}
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id} 
                className={`flex gap-3.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {msg.sender === "bot" && (
                  <div className="w-7 h-7 rounded bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className="max-w-[85%] space-y-2.5">
                  <div className={`rounded-xl p-3.5 text-xs leading-relaxed space-y-2.5 font-mono ${
                    msg.sender === "user" 
                      ? "bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/30 shadow-[0_4px_15px_rgba(6,182,212,0.05)]" 
                      : "bg-[#0b1727]/60 border border-white/5 text-foreground/90 backdrop-blur-xs"
                  }`}>
                    <div className="prose prose-invert prose-xs whitespace-pre-wrap text-inherit font-sans">
                      {msg.text}
                    </div>
                  </div>

                  {/* Sources Slices */}
                  {msg.sender === "bot" && msg.sources && msg.sources.length > 0 && (
                    <div className="space-y-1.5 font-mono">
                      <p className="text-[8px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Database className="w-3 h-3 text-cyber-blue" /> VEC_RESOURCES:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {msg.sources.map((src, i) => (
                          <CyberPanel key={i} glowColor="cyber-blue" className="p-2.5 space-y-1">
                            <div className="flex items-center justify-between text-[7px] font-mono text-muted-foreground uppercase border-b border-white/5 pb-0.5">
                              <span className="truncate max-w-[120px] font-bold text-cyber-blue">{src.document_name}</span>
                              <span>Slice {src.page_number || 1}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground leading-relaxed italic bg-background/20 p-1.5 rounded truncate font-mono">
                              "{src.snippet}"
                            </p>
                          </CyberPanel>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debug Diagnostics */}
                  {msg.sender === "bot" && isDebugMode && msg.diagnostics && (
                    <div className="p-3 bg-black/30 border border-white/5 rounded-lg space-y-2 font-mono text-[8px] tracking-wider">
                      <div className="flex items-center gap-1.5 text-cyber-orange border-b border-white/5 pb-1">
                        <Cpu className="w-3.5 h-3.5 animate-pulse" />
                        <span className="uppercase font-bold">RAG_DIAGNOSTICS_TAPE</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-muted-foreground">
                        <div className="bg-[#0b1727]/40 border border-white/5 p-1 rounded">
                          <p className="uppercase text-[6px]">Latency</p>
                          <p className="text-foreground font-bold text-[10px] mt-0.5">{msg.diagnostics.latencyMs}ms</p>
                        </div>
                        <div className="bg-[#0b1727]/40 border border-white/5 p-1 rounded">
                          <p className="uppercase text-[6px]">Match Chunks</p>
                          <p className="text-foreground font-bold text-[10px] mt-0.5">{msg.diagnostics.retrievedChunks} nodes</p>
                        </div>
                        <div className="bg-[#0b1727]/40 border border-white/5 p-1 rounded">
                          <p className="uppercase text-[6px]">Index Source</p>
                          <p className="text-foreground font-bold text-[10px] mt-0.5">{msg.diagnostics.sourceDocsCount} docs</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {msg.sender === "user" && (
                  <div className="w-7 h-7 rounded bg-secondary border border-white/5 flex items-center justify-center text-foreground shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.02)]">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Thinking Indicator */}
          {isTyping && (
            <div className="flex gap-3 justify-start animate-pulse">
              <div className="w-7 h-7 rounded bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-[#0b1727]/60 border border-white/5 rounded-xl p-3.5 text-xs text-muted-foreground flex items-center gap-2 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-cyber-blue animate-spin" />
                <span>[SCANNING_VECTORS] parsing log slices / comparing compliance benchmarks...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Error Notification Banners */}
        {errorMessage && (
          <div className="p-3 mx-4 mb-2 bg-cyber-red/5 border border-cyber-red/20 rounded-lg flex items-center gap-2 text-xs text-cyber-red shrink-0 font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="flex-1 truncate uppercase">{errorMessage}</p>
          </div>
        )}

        {/* Suggestions Command Ribbon at bottom */}
        {activeSessionId && messages.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 bg-black/20 flex gap-2 overflow-x-auto shrink-0 select-none scrollbar-thin">
            {SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(sug.text)}
                className="px-2.5 py-1 bg-[#0b1727]/80 hover:bg-cyber-blue/10 hover:text-cyber-blue border border-white/5 hover:border-cyber-blue/30 rounded text-[9px] font-mono text-muted-foreground whitespace-nowrap transition-all uppercase flex items-center gap-1"
              >
                <Terminal className="w-3 h-3" />
                {sug.label}
              </button>
            ))}
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleFormSubmit} className="p-3 border-t border-white/5 bg-[#030712]/40 flex items-center gap-2 shrink-0 relative z-10">
          <Input 
            placeholder={
              !activeSessionId
                ? "INITIALIZE OR SELECT SECURITY COGNITIVE SESSION..."
                : "QUERY THREAT METRICS (E.G. EXPLAIN COMPLIANCE BENCHMARKS)..."
            }
            className="flex-1 bg-background/50 border-white/5 text-foreground text-xs focus-visible:ring-cyber-blue/40 font-mono"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isTyping || !activeSessionId}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isTyping || !inputVal.trim() || !activeSessionId}
            className="h-9 w-9 bg-primary text-primary-foreground border border-cyber-blue/20 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>

      </div>
    </div>
  );
}
