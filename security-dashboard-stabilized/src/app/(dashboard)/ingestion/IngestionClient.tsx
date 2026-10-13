"use client";

import React, { useState, useRef } from "react";
import { 
  UploadCloud, FileText, Database, Sparkles, 
  Trash2, Play, Table as TableIcon, History, RefreshCw, 
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { processIngestionStreamAction } from "./actions";

interface HistoryItem {
  id: string;
  fileName: string;
  fileSize: string;
  eventsCount: number;
  threatsCount: number;
  incidentsCount: number;
  status: string;
  createdAt: string;
}

interface ParsedEvent {
  ip: string;
  message: string;
  source: string;
}

interface IngestionClientProps {
  initialHistory: HistoryItem[];
}

export default function IngestionClient({
  initialHistory,
}: IngestionClientProps) {
  // UI and history states
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview");
  
  // Input states
  const [pasteContent, setPasteContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);

  // Processing & Loading states
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result metrics state
  const [results, setResults] = useState<{
    eventsCount: number;
    threatsCount: number;
    incidentsCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Extract first IPv4 from text
  const extractIp = (text: string): string => {
    const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/;
    const match = text.match(ipRegex);
    return match ? match[0] : "127.0.0.1";
  };

  // Helper: Format bytes to human readable string
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Parser: Read and parse log contents
  const parseLogContent = (name: string, sizeStr: string, text: string) => {
    setErrorMessage(null);
    setResults(null);
    
    try {
      const extension = name.split(".").pop()?.toLowerCase();
      let events: ParsedEvent[] = [];

      if (extension === "json") {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            events = parsed.map((item: any) => ({
              ip: item.ip || item.sourceIp || extractIp(item.message || JSON.stringify(item)),
              message: item.message || item.log || JSON.stringify(item),
              source: item.source || item.target || "manual-json",
            }));
          } else {
            // Assume single JSON object
            events = [{
              ip: parsed.ip || parsed.sourceIp || extractIp(parsed.message || JSON.stringify(parsed)),
              message: parsed.message || parsed.log || JSON.stringify(parsed),
              source: parsed.source || parsed.target || "manual-json",
            }];
          }
        } catch {
          // If JSON.parse fails, try parsing JSON-Lines (one JSON per line)
          const lines = text.split("\n").filter(l => l.trim() !== "");
          events = lines.map(line => {
            const item = JSON.parse(line);
            return {
              ip: item.ip || item.sourceIp || extractIp(item.message || JSON.stringify(item)),
              message: item.message || item.log || JSON.stringify(item),
              source: item.source || item.target || "manual-json-lines",
            };
          });
        }
      } else if (extension === "csv") {
        const lines = text.split("\n").filter(l => l.trim() !== "");
        if (lines.length > 0) {
          const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
          const ipIndex = headers.indexOf("ip");
          const msgIndex = headers.indexOf("message") !== -1 ? headers.indexOf("message") : headers.indexOf("log");
          const srcIndex = headers.indexOf("source") !== -1 ? headers.indexOf("source") : headers.indexOf("target");

          const rows = lines.slice(1);
          events = rows.map(row => {
            const cols = row.split(",");
            const message = msgIndex !== -1 && cols[msgIndex] ? cols[msgIndex].replace(/^["']|["']$/g, "") : row;
            return {
              ip: ipIndex !== -1 && cols[ipIndex] ? cols[ipIndex].trim() : extractIp(message),
              message: message,
              source: srcIndex !== -1 && cols[srcIndex] ? cols[srcIndex].trim() : "manual-csv",
            };
          });
        }
      } else {
        // Fallback for .log and .txt
        const lines = text.split("\n").filter(l => l.trim() !== "");
        events = lines.map(line => ({
          ip: extractIp(line),
          message: line.trim(),
          source: "manual-log",
        }));
      }

      if (events.length === 0) {
        throw new Error("No events found in file.");
      }

      setFileName(name);
      setFileSize(sizeStr);
      setParsedEvents(events);
      setActiveTab("preview");
    } catch (err: any) {
      console.error("Parser failure:", err);
      setErrorMessage(`Failed to parse file: ${err.message || "Invalid format structure."}`);
    }
  };

  // Drag-and-drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setErrorMessage(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    const validExtensions = ["log", "json", "csv", "txt"];
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!ext || !validExtensions.includes(ext)) {
      setErrorMessage("Unsupported file type. Please upload a .log, .json, .csv, or .txt file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseLogContent(file.name, formatBytes(file.size), text);
    };
    reader.readAsText(file);
  };

  // Raw paste ingest trigger
  const handlePasteProcess = () => {
    if (!pasteContent.trim()) return;
    parseLogContent("Raw Text Ingestion", formatBytes(new Blob([pasteContent]).size), pasteContent);
  };

  const handleClear = () => {
    setFileName(null);
    setFileSize(null);
    setParsedEvents([]);
    setPasteContent("");
    setResults(null);
    setErrorMessage(null);
  };

  // Process stream action trigger
  const handleIngestStream = async () => {
    if (parsedEvents.length === 0) return;
    
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const summary = await processIngestionStreamAction(
        fileName || "Pasted Stream",
        fileSize || "N/A",
        parsedEvents
      );

      setResults(summary);
      
      // Update historical audit logs
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(7),
        fileName: fileName || "Pasted Stream",
        fileSize: fileSize || "N/A",
        eventsCount: summary.eventsCount,
        threatsCount: summary.threatsCount,
        incidentsCount: summary.incidentsCount,
        status: "success",
        createdAt: new Date().toISOString(),
      };
      setHistory(prev => [newItem, ...prev]);
    } catch (err: any) {
      console.error("Ingestion action failed:", err);
      setErrorMessage(err.message || "Inability to contact SOC threat engine.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
          SOC Log Ingestion Terminal
        </h1>
        <p className="text-xs text-muted-foreground">
          Import firewall audit streams and raw server security payloads. Detections resolve under isolated tenant policies.
        </p>
      </div>

      {/* Row 1: Upload Dropzone + Raw Paste editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Dropzone */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-all duration-200 relative ${
            isDragActive 
              ? "border-cyber-blue bg-cyber-blue/5 shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
              : "border-border bg-card/40 hover:bg-secondary/20 hover:border-border/80"
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".log,.json,.csv,.txt"
            className="hidden"
          />
          <div className="p-3 bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue rounded-full">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Drag and drop log files here</p>
            <p className="text-xs text-muted-foreground">Supports .log, .json, .csv, .txt (Max 50KB)</p>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase font-mono">
            Tenant Isolated
          </Badge>
        </div>

        {/* Text Paste Editor */}
        <Card className="border-border bg-card/40 flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-border/60">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyber-blue" /> Paste Raw Security Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col gap-3">
            <textarea 
              placeholder="Paste log lines here (e.g. 192.168.1.104 authentication failed; user=root)..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="flex-1 w-full bg-background/50 border border-border rounded-lg p-3 font-mono text-[10px] text-cyber-orange focus:outline-none focus:ring-1 focus:ring-cyber-blue/60 min-h-32 resize-none"
            />
            <Button 
              size="sm"
              onClick={handlePasteProcess}
              disabled={!pasteContent.trim()}
              className="self-end bg-primary hover:opacity-90 text-xs flex items-center gap-1.5 h-8 px-4"
            >
              <Play className="w-3.5 h-3.5" /> Parse Text Ingestion
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-cyber-red/5 border border-cyber-red/20 rounded-xl flex items-center gap-2 text-xs text-cyber-red">
          <AlertTriangle className="w-4 h-4" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Controls Bar & Threat Detection Summary Card */}
      {parsedEvents.length > 0 && (
        <div className="flex flex-col md:flex-row gap-6 items-stretch">
          
          {/* Action trigger controls */}
          <div className="flex flex-col justify-center gap-3 bg-card/40 border border-border p-4 rounded-xl flex-1 md:max-w-md">
            <div className="flex items-center justify-between text-xs border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Active Ingestion Name:</span>
              <span className="font-semibold text-foreground font-mono">{fileName || "Text stream"}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Log Stream Size:</span>
              <span className="font-semibold text-foreground font-mono">{fileSize || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Events Parsed:</span>
              <span className="font-semibold text-cyber-blue font-mono">{parsedEvents.length} rows</span>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button 
                onClick={handleIngestStream}
                disabled={isProcessing}
                className="flex-1 bg-cyber-blue text-background font-semibold hover:bg-cyber-blue/80 text-xs flex items-center justify-center gap-2 h-9"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Ingesting payload...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Process Ingestion Stream
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleClear}
                disabled={isProcessing}
                className="border-border text-muted-foreground hover:text-foreground h-9 px-3"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Threat Detection Summary Card */}
          {results && (
            <Card className="border-cyber-blue/30 bg-cyber-blue/5 backdrop-blur-md relative overflow-hidden flex-1 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-blue/10 rounded-full blur-2xl pointer-events-none" />
              <CardHeader className="py-3 px-4 border-b border-cyber-blue/15 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-mono uppercase text-cyber-blue flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyber-blue animate-pulse" /> Threat Detection Summary
                  </CardTitle>
                </div>
                {results.threatsCount > 0 ? (
                  <Badge className="bg-cyber-red/20 text-cyber-red border-0 text-[9px] animate-pulse">
                    Vulnerabilities Flagged
                  </Badge>
                ) : (
                  <Badge className="bg-cyber-green/20 text-cyber-green border-0 text-[9px]">
                    Stream Clean
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Ingested Events</p>
                    <p className="text-3xl font-extrabold font-mono text-foreground">{results.eventsCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Threats Detected</p>
                    <p className={`text-3xl font-extrabold font-mono ${results.threatsCount > 0 ? "text-cyber-orange animate-bounce" : "text-foreground"}`}>
                      {results.threatsCount}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Incidents Created</p>
                    <p className={`text-3xl font-extrabold font-mono ${results.incidentsCount > 0 ? "text-cyber-red" : "text-foreground"}`}>
                      {results.incidentsCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {/* Row 3: Tab selectors & tables */}
      <TabsContainer 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        parsedEvents={parsedEvents}
        history={history}
      />
    </div>
  );
}

// Inner Component: Tabs container for Parsed Previews vs Historical Archives
function TabsContainer({
  activeTab,
  setActiveTab,
  parsedEvents,
  history,
}: {
  activeTab: "preview" | "history";
  setActiveTab: (tab: "preview" | "history") => void;
  parsedEvents: ParsedEvent[];
  history: HistoryItem[];
}) {
  return (
    <div className="space-y-4">
      {/* Tab selectors */}
      <div className="flex gap-2 border-b border-border/80 pb-px no-print">
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "preview" 
              ? "border-cyber-blue text-cyber-blue font-bold" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" /> Parsed Preview Queue ({parsedEvents.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "history" 
              ? "border-cyber-blue text-cyber-blue font-bold" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-3.5 h-3.5" /> Ingestion Archives History ({history.length})
        </button>
      </div>

      {/* Preview Content */}
      {activeTab === "preview" && (
        <Card className="border-border bg-card/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader className="bg-background/40 sticky top-0 z-10">
                  <TableRow className="border-b border-border">
                    <TableHead className="w-16 text-xs font-mono text-center">Row</TableHead>
                    <TableHead className="w-44 text-xs">Source IP</TableHead>
                    <TableHead className="w-56 text-xs">Source Node</TableHead>
                    <TableHead className="text-xs">Log Message Payload Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedEvents.length > 0 ? (
                    parsedEvents.map((evt, idx) => (
                      <TableRow key={idx} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                        <TableCell className="text-xs font-mono text-muted-foreground text-center">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-mono font-semibold text-cyber-blue">{evt.ip}</TableCell>
                        <TableCell className="text-xs font-mono text-foreground">{evt.source}</TableCell>
                        <TableCell className="text-[11px] font-mono text-muted-foreground truncate max-w-lg">{evt.message}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-xs text-muted-foreground font-mono">
                        NO LOG PAYLOADS LOADED. PASTE LOGS OR UPLOAD A FILE ABOVE.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Content */}
      {activeTab === "history" && (
        <Card className="border-border bg-card/50 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-background/40">
                <TableRow className="border-b border-border">
                  <TableHead className="text-xs">Date Ingested (UTC)</TableHead>
                  <TableHead className="text-xs">File Source Name</TableHead>
                  <TableHead className="text-xs">File Size</TableHead>
                  <TableHead className="text-xs text-center font-mono">Total Logs</TableHead>
                  <TableHead className="text-xs text-center font-mono">Threats Detected</TableHead>
                  <TableHead className="text-xs text-center font-mono">Incidents Generated</TableHead>
                  <TableHead className="text-right text-xs">Ingestion Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length > 0 ? (
                  history.map((item) => (
                    <TableRow key={item.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {new Date(item.createdAt).toUTCString().replace("GMT", "UTC")}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{item.fileName}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{item.fileSize}</TableCell>
                      <TableCell className="text-xs font-mono text-center font-semibold text-cyber-blue">{item.eventsCount}</TableCell>
                      <TableCell className="text-xs font-mono text-center font-semibold text-cyber-orange">{item.threatsCount}</TableCell>
                      <TableCell className="text-xs font-mono text-center font-semibold text-cyber-red">{item.incidentsCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`text-[9px] capitalize font-mono ${
                          item.status === "success" 
                            ? "border-cyber-green/30 text-cyber-green bg-cyber-green/5" 
                            : "border-cyber-red/30 text-cyber-red bg-cyber-red/5"
                        }`}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-muted-foreground font-mono">
                      NO INGESTION HISTORY LOGGED FOR THIS TENANT.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
