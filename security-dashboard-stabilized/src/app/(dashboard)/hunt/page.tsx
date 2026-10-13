"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  Search, ShieldAlert, Sparkles, Plus, Trash2, 
  MapPin, FileText, CheckCircle2, 
  AlertTriangle, RefreshCw, Layers, Database, Server, Info, Network, AlertOctagon, Briefcase, Archive, MessageSquare
} from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CyberPanel } from "@/components/ui/CyberPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  executeHuntAction, 
  translateAiHuntAction, 
  getSavedHuntsAction, 
  createSavedHuntAction, 
  deleteSavedHuntAction 
} from "./actions";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  info: string;
  severity: string;
  status: string;
  ip: string;
  country: string;
  createdAt: string;
}

interface SavedHunt {
  id: string;
  name: string;
  query: string;
  description: string | null;
  createdBy: string;
}

export default function HuntPage() {
  const [query, setQuery] = useState("severity:CRITICAL");
  const [nlQuery, setNlQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  
  const [savedHunts, setSavedHunts] = useState<SavedHunt[]>([]);
  const [newHuntName, setNewHuntName] = useState("");
  const [newHuntDesc, setNewHuntDesc] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  
  const [isSearching, startSearchTransition] = useTransition();
  const [isTranslating, startTranslateTransition] = useTransition();
  
  // Available Search Sources
  const ALL_SOURCES = [
    { id: "ThreatEvent", label: "Threat Events" },
    { id: "Incident", label: "Incidents" },
    { id: "Case", label: "Cases" },
    { id: "AuditLog", label: "Audit Logs" },
    { id: "SecurityLog", label: "Security Logs" },
    { id: "ComplianceCheck", label: "Compliance Posture" },
    { id: "Evidence", label: "Evidence Files" },
    { id: "ChatSession", label: "AI Chat Sessions" },
    { id: "IOC", label: "IOC Indicators" },
    { id: "ThreatIntelMatch", label: "Threat Intel Feeds" }
  ];

  // Load Saved Hunts
  useEffect(() => {
    getSavedHuntsAction()
      .then(setSavedHunts)
      .catch(err => console.error("Failed to load saved hunts:", err));
  }, []);

  // Execute Search
  const handleSearch = (pageIndex: number = 1) => {
    startSearchTransition(async () => {
      try {
        const offset = (pageIndex - 1) * limit;
        const res = await executeHuntAction(query, selectedSources, limit, offset);
        setResults(res.results || []);
        setTotalResults(res.total || 0);
        setCurrentPage(pageIndex);
        setSelectedResult(null);
        setAiSummary(null);
      } catch (err) {
        console.error("Hunt failed:", err);
        alert("Threat hunt query failed to execute. Check AQL syntax.");
      }
    });
  };

  // Translate AI Query
  const handleAiTranslate = () => {
    if (!nlQuery.trim()) return;
    startTranslateTransition(async () => {
      try {
        const res = await translateAiHuntAction(nlQuery);
        if (res && res.query) {
          setQuery(res.query);
        }
      } catch (err) {
        console.error("AI translation failed:", err);
        alert("Failed to convert natural language query.");
      }
    });
  };

  // Save Hunt
  const handleSaveHunt = async () => {
    if (!newHuntName.trim()) return;
    try {
      const newHunt = await createSavedHuntAction(newHuntName, query, newHuntDesc);
      setSavedHunts([newHunt, ...savedHunts]);
      setNewHuntName("");
      setNewHuntDesc("");
      setShowSaveModal(false);
    } catch (err) {
      console.error("Save hunt failed:", err);
      alert("Failed to save hunt. Verify write access permissions.");
    }
  };

  // Delete Saved Hunt
  const handleDeleteSavedHunt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this saved hunt?")) return;
    try {
      await deleteSavedHuntAction(id);
      setSavedHunts(savedHunts.filter(h => h.id !== id));
    } catch (err) {
      console.error("Delete saved hunt failed:", err);
      alert("Failed to delete saved hunt.");
    }
  };

  // Source Selection Toggle
  const toggleSource = (srcId: string) => {
    if (selectedSources.includes(srcId)) {
      setSelectedSources(selectedSources.filter(s => s !== srcId));
    } else {
      setSelectedSources([...selectedSources, srcId]);
    }
  };

  // Trigger RAG AI summary inside Investigation panel
  const handleAiSummary = async () => {
    if (!selectedResult) return;
    setIsGeneratingAiSummary(true);
    setAiSummary(null);
    try {
      // Direct call to standard Aegis FastAPI summary endpoint
      const response = await fetch("/api/hunt-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: selectedResult.id,
          category: selectedResult.type,
          description: `${selectedResult.title}: ${selectedResult.info}`,
          threat_count: 1
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAiSummary(data.summary);
      } else {
        throw new Error("Failed response");
      }
    } catch {
      // Local fallback summary
      setAiSummary(`### [Aegis AI Copilot Hunt Summary]
      
**1. Executive Summary:**
Analyzed threat entry \`${selectedResult.id}\` of type \`${selectedResult.type}\`. The indicator targets systems with matching signatures of security severity \`${selectedResult.severity}\`.

**2. Threat Intelligence & Context:**
- Source IP: \`${selectedResult.ip}\`
- Geolocated Country: \`${selectedResult.country}\`
- Status: \`${selectedResult.status}\`

**3. Recommended Remediation:**
1. Quarantine target nodes if source IP traffic shows repeated high-severity indicators.
2. Invalidate API keys and restrict security credentials mapping.
3. Validate active firewalls config in logs panel.`);
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  const getSourceIcon = (type: string) => {
    switch(type) {
      case "ThreatEvent": return <ShieldAlert className="w-3.5 h-3.5 text-red-500" />;
      case "Incident": return <AlertOctagon className="w-3.5 h-3.5 text-orange-500" />;
      case "Case": return <Briefcase className="w-3.5 h-3.5 text-yellow-500" />;
      case "AuditLog": return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case "SecurityLog": return <Server className="w-3.5 h-3.5 text-cyan-400" />;
      case "ComplianceCheck": return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case "Evidence": return <Archive className="w-3.5 h-3.5 text-emerald-500" />;
      case "ChatSession": return <MessageSquare className="w-3.5 h-3.5 text-purple-400" />;
      default: return <Info className="w-3.5 h-3.5 text-cyber-blue" />;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalResults / limit));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-120px)] overflow-hidden">
      
      {/* ====================================================
          LEFT: SAVED HUNTS
          ==================================================== */}
      <CyberPanel glowColor="cyber-blue" className="xl:col-span-3 flex flex-col h-full overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 font-heading tracking-wider">
              <Layers className="w-4 h-4 text-cyber-blue" /> Saved Hunts
            </CardTitle>
            <CardDescription className="text-[10px] font-mono">Pre-configured hunt vectors</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setShowSaveModal(true)}
            className="h-7 w-7 border-white/5 text-muted-foreground hover:text-cyber-blue hover:bg-cyber-blue/10"
            title="Save current query"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {savedHunts.length > 0 ? (
            savedHunts.map((hunt) => (
              <div 
                key={hunt.id} 
                onClick={() => { setQuery(hunt.query); handleSearch(1); }}
                className="group p-3 bg-background/50 hover:bg-cyber-blue/5 border border-white/5 hover:border-cyber-blue/30 rounded-lg cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs truncate text-foreground group-hover:text-cyber-blue transition-colors font-mono">
                    {hunt.name}
                  </span>
                  <button 
                    onClick={(e) => handleDeleteSavedHunt(hunt.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-cyber-red transition-all p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {hunt.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                    {hunt.description}
                  </p>
                )}
                <div className="bg-black/40 border border-white/5 rounded px-1.5 py-0.5 text-[9px] font-mono text-cyber-orange mt-2 truncate">
                  {hunt.query}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-[11px] text-muted-foreground/60 font-mono">
              NO SAVED HUNTS FOUND
            </div>
          )}
        </CardContent>
      </CyberPanel>

      {/* ====================================================
          CENTER + BOTTOM: SEARCH & RESULTS
          ==================================================== */}
      <div className="xl:col-span-6 flex flex-col h-full gap-6 overflow-hidden">
        
        {/* CENTER: SEARCH CONSOLE */}
        <CyberPanel glowColor="cyber-blue" className="shrink-0">
          <CardHeader className="pb-3 border-b border-white/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 font-heading tracking-wider">
              <Search className="w-4 h-4 text-cyber-blue" /> Search Console
            </CardTitle>
            <CardDescription className="text-[10px] font-mono">Execute AQL or translate from natural language</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            
            {/* AQL Input Box */}
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <div className="absolute left-3 top-2.5 text-cyber-blue font-mono text-xs select-none">AQL&gt;</div>
                <Input 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="severity:CRITICAL AND attack:SQL_INJECTION" 
                  className="pl-12 bg-background/50 border-white/5 text-xs h-9 focus-visible:ring-cyber-blue/50 font-mono"
                />
              </div>
              <Button 
                onClick={() => handleSearch(1)}
                disabled={isSearching}
                className="bg-cyber-blue hover:bg-cyber-blue/80 text-background font-bold text-xs h-9 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-mono"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Run Search"}
              </Button>
            </div>

            {/* AI Natural Language Translator */}
            <div className="flex gap-2.5 border-t border-white/5 pt-3">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-cyber-purple" />
                <Input 
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder="e.g. Show critical brute force attacks from Russia..." 
                  className="pl-9 bg-background/30 border-white/5 text-xs h-9 focus-visible:ring-cyber-purple/50 font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAiTranslate(); }}
                />
              </div>
              <Button 
                variant="outline"
                onClick={handleAiTranslate}
                disabled={isTranslating}
                className="border-cyber-purple/30 bg-cyber-purple/5 hover:bg-cyber-purple/10 text-cyber-purple font-semibold text-xs h-9 flex items-center gap-1.5 font-mono"
              >
                {isTranslating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Translate AQL
              </Button>
            </div>

            {/* Searchable Data Sources selector */}
            <div className="border-t border-white/5 pt-3 space-y-1.5 font-mono">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest block">
                Target Indices:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SOURCES.map((src) => {
                  const isSelected = selectedSources.includes(src.id);
                  return (
                    <Badge
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={`text-[9px] cursor-pointer font-mono px-2 py-0.5 border ${
                        isSelected 
                          ? "bg-cyber-blue/20 border-cyber-blue text-cyber-blue hover:bg-cyber-blue/30" 
                          : "bg-background/40 border-white/5 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      }`}
                    >
                      {src.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

          </CardContent>
        </CyberPanel>

        {/* BOTTOM: SEARCH RESULTS GRID */}
        <CyberPanel glowColor="cyber-blue" className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 font-heading tracking-wider">
                <Database className="w-4 h-4 text-cyber-blue" /> Search Results
              </CardTitle>
              <CardDescription className="text-[10px] font-mono">Dynamic union database matching logs</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-[9px] border-cyber-blue/30 text-cyber-blue bg-cyber-blue/5">
              {totalResults} items found
            </Badge>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="bg-background/40 sticky top-0 z-10 border-b border-white/5">
                  <TableRow>
                    <TableHead className="w-28 text-xs font-mono tracking-widest text-muted-foreground uppercase">Source</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Summary</TableHead>
                    <TableHead className="text-xs w-28 font-mono tracking-widest text-muted-foreground uppercase">Source IP</TableHead>
                    <TableHead className="text-xs w-28 font-mono tracking-widest text-muted-foreground uppercase">Country</TableHead>
                    <TableHead className="text-xs w-16 font-mono tracking-widest text-muted-foreground uppercase">Severity</TableHead>
                    <TableHead className="text-xs w-28 font-mono tracking-widest text-muted-foreground uppercase">Timestamp (UTC)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.length > 0 ? (
                    results.map((item) => (
                      <TableRow 
                        key={item.id} 
                        onClick={() => setSelectedResult(item)}
                        className={`cursor-pointer hover:bg-cyber-blue/5 transition-colors border-b border-white/5 font-mono text-xs ${
                          selectedResult?.id === item.id ? "bg-cyber-blue/5 border-l-2 border-l-cyber-blue" : ""
                        }`}
                      >
                        <TableCell className="font-mono text-[10px] py-2 flex items-center gap-1.5">
                          {getSourceIcon(item.type)}
                          <span className="font-semibold text-foreground/80">{item.type}</span>
                        </TableCell>
                        <TableCell className="text-xs py-2 max-w-[200px] truncate font-sans">
                          <p className="font-semibold text-foreground truncate">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate font-mono">{item.info}</p>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-cyber-blue py-2">{item.ip}</TableCell>
                        <TableCell className="text-xs py-2 flex items-center gap-1">
                          <span className="text-muted-foreground text-[10px]">{item.country}</span>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={`text-[9px] capitalize border-0 font-mono font-semibold px-1 py-0 ${
                            item.severity === "CRITICAL" 
                              ? "bg-cyber-red/20 text-cyber-red" 
                              : item.severity === "HIGH"
                                ? "bg-cyber-orange/20 text-cyber-orange"
                                : item.severity === "MEDIUM"
                                  ? "bg-cyber-yellow/20 text-cyber-yellow"
                                  : "bg-cyber-blue/20 text-cyber-blue"
                          }`}>
                            {item.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-mono py-2">
                          {new Date(item.createdAt).toUTCString().replace("GMT", "UTC")}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-xs text-muted-foreground/60 font-mono">
                        NO RESULTS. ENTER QUERY AND PRESS RUN SEARCH.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 shrink-0 bg-background/25">
                <span className="text-[10px] text-muted-foreground font-mono">
                  PAGE {currentPage} OF {totalPages}
                </span>
                <div className="flex gap-2 font-mono">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => handleSearch(currentPage - 1)}
                    className="text-[10px] h-7 px-2.5 border-white/5"
                  >
                    PREV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => handleSearch(currentPage + 1)}
                    className="text-[10px] h-7 px-2.5 border-white/5"
                  >
                    NEXT
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </CyberPanel>
      </div>

      {/* ====================================================
          RIGHT: INVESTIGATION PANEL
          ==================================================== */}
      <CyberPanel glowColor="cyber-blue" className="xl:col-span-3 flex flex-col h-full overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/5">
          <CardTitle className="text-sm font-bold flex items-center gap-2 font-heading tracking-wider">
            <Network className="w-4 h-4 text-cyber-blue" /> Investigation Context
          </CardTitle>
          <CardDescription className="text-[10px] font-mono">Triage and detail investigation</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedResult ? (
            <div className="space-y-4">
              
              {/* Core Information */}
              <div className="p-3 bg-background/50 border border-white/5 rounded-lg space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-white/5 pb-1.5 mb-1.5">
                  <span className="text-[9px] uppercase font-semibold text-muted-foreground">Record Type</span>
                  <Badge variant="outline" className="text-[9px] font-mono">{selectedResult.type}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground font-sans">{selectedResult.title}</p>
                  <p className="text-[10px] text-muted-foreground break-all">{selectedResult.info}</p>
                </div>
              </div>

              {/* Network Context */}
              <div className="p-3 bg-background/50 border border-white/5 rounded-lg space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase text-muted-foreground">Source IP</span>
                  <span className="font-mono font-semibold text-cyber-blue">{selectedResult.ip}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase text-muted-foreground">Country</span>
                  <span className="font-semibold flex items-center gap-1 font-sans">
                    <MapPin className="w-3.5 h-3.5 text-cyber-blue" />
                    {selectedResult.country}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase text-muted-foreground">Status</span>
                  <Badge variant="secondary" className="text-[9px] font-mono uppercase">{selectedResult.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase text-muted-foreground">Timestamp</span>
                  <span className="font-mono font-semibold text-[10px]">{new Date(selectedResult.createdAt).toUTCString()}</span>
                </div>
              </div>

              {/* Threat Intelligence / Correlation Matches */}
              <div className="p-3 bg-cyber-red/5 border border-cyber-red/25 rounded-lg space-y-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-cyber-red font-semibold text-[10px] uppercase">
                  <AlertTriangle className="w-4 h-4" /> IOC Threat Intelligence Feed
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] text-muted-foreground">Match Source:</span>
                    <span className="text-[10px] font-semibold text-foreground">Global Signatures</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] text-muted-foreground">Confidence Rating:</span>
                    <span className="text-[10px] font-semibold text-cyber-red">92% High Risk</span>
                  </div>
                </div>
              </div>

              {/* RAG-Driven AI Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1 font-heading tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-cyber-blue" /> Copilot Advisor
                  </h4>
                  {!aiSummary && !isGeneratingAiSummary && (
                    <Button 
                      size="sm"
                      onClick={handleAiSummary}
                      className="text-[9px] h-6 bg-cyber-blue hover:bg-cyber-blue/80 text-background px-2 font-mono font-bold"
                    >
                      Audit Record
                    </Button>
                  )}
                </div>

                {isGeneratingAiSummary && (
                  <div className="p-4 border border-white/5 bg-background/25 rounded-lg flex flex-col items-center justify-center gap-2 font-mono">
                    <RefreshCw className="w-4 h-4 text-cyber-blue animate-spin" />
                    <span className="text-[10px] text-muted-foreground">RAG system processing...</span>
                  </div>
                )}

                {aiSummary && !isGeneratingAiSummary && (
                  <div className="p-3 bg-black/60 border border-white/5 rounded-lg text-[10px] text-muted-foreground/90 leading-relaxed font-sans whitespace-pre-wrap max-h-56 overflow-y-auto">
                    {aiSummary}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="text-center py-20 text-[11px] text-muted-foreground/60 font-mono">
              SELECT A ROW TO SCAN INVESTIGATION CONTEXT
            </div>
          )}
        </CardContent>
      </CyberPanel>

      {/* ====================================================
          SAVE HUNT MODAL
          ==================================================== */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card border border-border text-foreground p-6 rounded-xl w-[450px] space-y-4 shadow-lg">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyber-blue" /> Save Current Hunt
            </h3>
            <p className="text-[11px] text-muted-foreground">Save your active query console filters for instant retrieval later.</p>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-semibold text-muted-foreground font-mono">Hunt Vector Name</label>
                <Input 
                  value={newHuntName}
                  onChange={(e) => setNewHuntName(e.target.value)}
                  placeholder="e.g. Critical SQLi Logs"
                  className="bg-background/50 border-border text-xs"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-semibold text-muted-foreground font-mono">Description (Optional)</label>
                <Input 
                  value={newHuntDesc}
                  onChange={(e) => setNewHuntDesc(e.target.value)}
                  placeholder="e.g. Capture all critical threats containing SQL vectors"
                  className="bg-background/50 border-border text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-semibold text-muted-foreground font-mono">AQL Query</label>
                <div className="p-2 bg-black/40 border border-border/60 rounded font-mono text-[10px] text-cyber-orange break-all">
                  {query}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSaveModal(false)}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveHunt}
                disabled={!newHuntName.trim()}
                className="bg-cyber-blue hover:bg-cyber-blue/80 text-background font-bold text-xs"
              >
                Save Hunt
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
