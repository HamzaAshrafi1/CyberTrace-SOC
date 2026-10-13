"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  ShieldAlert, Search, ExternalLink, User, Sparkles, RefreshCw, 
  AlertTriangle, History, AlertCircle, Globe, Shield, Activity
} from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CyberPanel } from "@/components/ui/CyberPanel";
import { 
  updateThreatStatusAction, 
  updateThreatAssigneeAction, 
  generateThreatAiSummaryAction, 
  getRelatedThreatEventsAction 
} from "./actions";

interface ThreatEvent {
  id: string;
  createdAt: Date | string;
  sourceIp: string;
  target: string;
  severity: string;
  description: string;
  rawPayload: string;
  status: string;
  assignedTo: string;
  aiSummary: string | null;
  incident: { id: string; title: string } | null;
  organization: string;
}

interface ThreatsClientProps {
  threats: ThreatEvent[];
  searchQuery: string;
  selectedSeverity: string;
  selectedStatus: string;
  startDate: string;
  endDate: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  organizationUsers: string[];
}

function getSeverityColor(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "#ef4444"; // Red
    case "HIGH":
      return "#f97316"; // Orange
    case "MEDIUM":
      return "#eab308"; // Yellow
    default:
      return "#06b6d4"; // Cyber Blue
  }
}

export default function ThreatsClient({
  threats,
  searchQuery,
  selectedSeverity,
  selectedStatus,
  currentPage,
  totalPages,
  totalCount,
  organizationUsers,
}: ThreatsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for active threat lists (allows immediate UI feedback on status/assignee updates)
  const [localThreats, setLocalThreats] = useState<ThreatEvent[]>(threats);
  const [selectedThreat, setSelectedThreat] = useState<ThreatEvent | null>(null);

  // Dynamic related threat events state
  const [relatedEvents, setRelatedEvents] = useState<{
    ipThreats: { id: string; createdAt: Date | string; severity: string; description: string }[];
    targetThreats: { id: string; createdAt: Date | string; severity: string; description: string }[];
  }>({ ipThreats: [], targetThreats: [] });
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // AI summary states
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [selectedActorName, setSelectedActorName] = useState<string>("APT28 (Fancy Bear)");

  // Sync state with props when page changes or filters reload
  useEffect(() => {
    setLocalThreats(threats);
  }, [threats]);

  // Fetch related events and load AI summary when a threat is selected
  useEffect(() => {
    if (selectedThreat) {
      setIsLoadingRelated(true);
      setAiSummary(selectedThreat.aiSummary);

      getRelatedThreatEventsAction(selectedThreat.id, selectedThreat.sourceIp, selectedThreat.target)
        .then(data => {
          setRelatedEvents(data);
        })
        .catch(err => {
          console.error("Failed to load historical timeline context:", err);
        })
        .finally(() => {
          setIsLoadingRelated(false);
        });
    } else {
      setRelatedEvents({ ipThreats: [], targetThreats: [] });
    }
  }, [selectedThreat]);

  const updateParam = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    
    // Reset page index if filters change
    if (["q", "severity", "status", "startDate", "endDate"].includes(name)) {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParam("q", e.target.value);
  };

  const handleSeveritySelect = (sev: string) => {
    updateParam("severity", sev === "all" ? "" : sev);
  };

  const handleStatusSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParam("status", e.target.value === "all" ? "" : e.target.value);
  };

  const handleDatePreset = (preset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    
    if (preset === "all") {
      params.delete("startDate");
      params.delete("endDate");
    } else {
      let hours = 24;
      if (preset === "7d") hours = 7 * 24;
      if (preset === "30d") hours = 30 * 24;
      
      const start = new Date(Date.now() - hours * 60 * 60 * 1000);
      params.set("startDate", start.toISOString().slice(0, 10));
      params.delete("endDate"); // Empty end date means up to now
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    updateParam("page", newPage.toString());
  };

  // Mutator workflows
  const handleThreatStatusUpdate = async (threatId: string, nextStatus: string) => {
    try {
      await updateThreatStatusAction(threatId, nextStatus);
      
      // Update locally
      const updated = localThreats.map(t => t.id === threatId ? { ...t, status: nextStatus } : t);
      setLocalThreats(updated);
      if (selectedThreat?.id === threatId) {
        setSelectedThreat(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to transition threat status.");
    }
  };

  const handleThreatAssigneeUpdate = async (threatId: string, nextAssignee: string) => {
    try {
      await updateThreatAssigneeAction(threatId, nextAssignee);
      
      // Update locally
      const updated = localThreats.map(t => t.id === threatId ? { ...t, assignedTo: nextAssignee } : t);
      setLocalThreats(updated);
      if (selectedThreat?.id === threatId) {
        setSelectedThreat(prev => prev ? { ...prev, assignedTo: nextAssignee } : null);
      }
    } catch (error) {
      console.error("Failed to assign operator:", error);
      alert("Failed to assign analyst.");
    }
  };

  const triggerAiSummaryGeneration = async () => {
    if (!selectedThreat) return;
    setIsGeneratingAi(true);
    try {
      const summaryResult = await generateThreatAiSummaryAction(selectedThreat.id);
      setAiSummary(summaryResult);
      
      // Update locally
      const updated = localThreats.map(t => t.id === selectedThreat.id ? { ...t, aiSummary: summaryResult } : t);
      setLocalThreats(updated);
    } catch (error) {
      console.error("AI summarizer failed:", error);
      alert("Failed to query openrouter agent endpoints.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Merge database users with clerk current session parameters
  const analystList = Array.from(new Set(["Unassigned", "analyst@alphasec.com", ...organizationUsers]));

  const [activeTab, setActiveTab] = useState<"feed" | "intel">("feed");

  const mockActors = [
    {
      name: "APT28 (Fancy Bear)",
      origin: "Russia",
      target: "Government, Defense",
      status: "ACTIVE",
      threatLevel: "CRITICAL",
      description: "Highly sophisticated state-sponsored group focused on cyber espionage against defense, governmental, and energy sectors globally.",
      firstSeen: "2004",
      vectors: ["Spear-phishing", "OAuth Abuse", "Zero-day exploits"],
      cves: ["CVE-2026-0618", "CVE-2024-38077"]
    },
    {
      name: "Lazarus Group",
      origin: "North Korea",
      target: "Financial, Crypto",
      status: "ACTIVE",
      threatLevel: "CRITICAL",
      description: "State-backed group infamous for high-profile financial thefts, cryptocurrency laundering, and destructive malware operations.",
      firstSeen: "2009",
      vectors: ["Watering Hole attacks", "Spear-phishing via LinkedIn", "Trojanized applications"],
      cves: ["CVE-2024-38077", "CVE-2026-9904"]
    },
    {
      name: "APT29 (Cozy Bear)",
      origin: "Russia",
      target: "Diplomatic, Think Tanks",
      status: "DORMANT",
      threatLevel: "HIGH",
      description: "Espionage group known for stealthy, persistent operations targeting diplomatic entities, political organizations, and think tanks.",
      firstSeen: "2008",
      vectors: ["Supply chain compromise", "Cloud service hijacking", "Spear-phishing"],
      cves: ["CVE-2026-1209"]
    },
    {
      name: "Sandworm",
      origin: "Russia",
      target: "Energy Grid, ICS",
      status: "ACTIVE",
      threatLevel: "CRITICAL",
      description: "Highly destructive cyber warfare unit specializing in industrial control systems (ICS) attacks, power grid disruptions, and wiper malware.",
      firstSeen: "2012",
      vectors: ["Wiper payloads", "Firmware modification", "Vulnerability exploitation"],
      cves: ["CVE-2026-0618", "CVE-2026-1209"]
    },
    {
      name: "APT41 (Double Dragon)",
      origin: "China",
      target: "Healthcare, Tech",
      status: "ACTIVE",
      threatLevel: "HIGH",
      description: "Dual-purpose group engaging in both state-sponsored espionage and financially motivated cybercrime, targeting healthcare, tech, and gaming sectors.",
      firstSeen: "2012",
      vectors: ["SQL injection", "Supply chain compromise", "Software updates tampering"],
      cves: ["CVE-2026-9904", "CVE-2026-1209"]
    }
  ];

  const mockCves = [
    { id: "CVE-2026-0618", name: "Next.js Image Handler RCE", severity: "9.8 CRITICAL", status: "EXPLOITED" },
    { id: "CVE-2026-1209", name: "Prisma Schema Injection", severity: "8.6 HIGH", status: "MITIGATED" },
    { id: "CVE-2026-9904", name: "FastAPI Route Parameter Splitting", severity: "7.5 HIGH", status: "WARNING" }
  ];

  return (
    <div className="space-y-6">
      <p role="note" className="text-xs text-amber-400 p-2">Demo visualization: coordinates, actor/CVE examples and decorative counters are illustrative, not verified telemetry.</p>
      {/* Page Title & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-widest font-heading bg-gradient-to-r from-foreground via-foreground/90 to-cyber-blue bg-clip-text text-transparent uppercase">
            Threat Intelligence Console
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono uppercase">
            LOG_INGRESS: <span className="text-cyber-green font-semibold">FEED ACTIVE</span> {"// IOC_ENRICHMENT: UNAVAILABLE"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setActiveTab("feed")}
            className={`font-mono text-xs h-9 ${activeTab === "feed" ? "bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue" : "border-white/5"}`}
          >
            ACTIVE LOG FEED
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setActiveTab("intel")}
            className={`font-mono text-xs h-9 ${activeTab === "intel" ? "bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue" : "border-white/5"}`}
          >
            THREAT INTEL DOSSIER
          </Button>
        </div>
      </div>

      {activeTab === "feed" ? (
        <>
          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search IPs, payloads, desc..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-9 bg-card border-white/5 font-mono text-xs h-9"
              />
            </div>

            {/* Severity badges */}
            <div className="flex items-center gap-1.5 bg-card/40 border border-white/5 rounded-lg px-2 h-9">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mr-1">SEV:</span>
              {["all", "CRITICAL", "HIGH", "MEDIUM"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => handleSeveritySelect(sev)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
                    (selectedSeverity || "all") === sev 
                      ? "bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30 font-bold" 
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            {/* Status Select */}
            <select
              value={selectedStatus || "all"}
              onChange={handleStatusSelect}
              className="bg-card border border-white/5 text-foreground text-xs rounded-lg px-3 h-9 focus:outline-none focus:ring-1 focus:ring-cyber-blue font-mono cursor-pointer"
            >
              <option value="all">ALL TRIAGE STATUS</option>
              <option value="New">New</option>
              <option value="Investigating">Investigating</option>
              <option value="Resolved">Resolved</option>
            </select>

            {/* Time Preset filters */}
            <div className="flex items-center gap-1 bg-card/40 border border-white/5 rounded-lg px-2 h-9 justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">TIME:</span>
              <div className="flex gap-1">
                {[{ label: "24H", value: "24h" }, { label: "7D", value: "7d" }, { label: "ALL", value: "all" }].map(p => (
                  <button
                    key={p.value}
                    onClick={() => handleDatePreset(p.value)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono hover:text-white text-muted-foreground"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Threats Table Panel */}
          <CyberPanel glowColor="cyber-blue" className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold font-heading tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-cyber-blue animate-pulse" />
                  THREAT LOGS QUEUE
                </CardTitle>
                <CardDescription className="text-[10px] font-mono">Real-time indicators captured from edge proxy collectors.</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[9px] border-cyber-blue/30 text-cyber-blue bg-cyber-blue/5">
                {totalCount} THREAT EVENTS
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-background/40">
                    <TableRow className="border-b border-white/5">
                      <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Severity</TableHead>
                      <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Origin IP</TableHead>
                      <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Target Socket</TableHead>
                      <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Description</TableHead>
                      <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Triage</TableHead>
                      <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Assignee</TableHead>
                      <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Time</TableHead>
                      <TableHead className="text-right text-xs font-mono tracking-widest text-muted-foreground uppercase">Triage Panel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localThreats.length > 0 ? (
                      localThreats.map((threat) => (
                        <TableRow key={threat.id} className="border-b border-white/5 hover:bg-cyber-blue/5 transition-colors font-mono text-xs">
                          <TableCell>
                            <Badge variant="outline" style={{ backgroundColor: `${getSeverityColor(threat.severity)}15`, color: getSeverityColor(threat.severity), borderColor: `${getSeverityColor(threat.severity)}30` }} className="text-[9px] font-bold">
                              {threat.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-foreground font-semibold font-mono">{threat.sourceIp}</TableCell>
                          <TableCell className="text-muted-foreground font-mono">{threat.target}</TableCell>
                          <TableCell className="text-xs font-sans text-foreground/90 max-w-xs truncate">{threat.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[9px] capitalize ${
                              threat.status === "New" 
                                ? "border-cyber-blue/30 text-cyber-blue bg-cyber-blue/5" 
                                : threat.status === "Investigating"
                                  ? "border-cyber-orange/30 text-cyber-orange bg-cyber-orange/5 animate-pulse"
                                  : "border-cyber-green/30 text-cyber-green bg-cyber-green/5"
                            }`}>
                              {threat.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {threat.assignedTo === "Unassigned" ? (
                              <span className="text-muted-foreground/45 italic">unassigned</span>
                            ) : (
                              threat.assignedTo.split("@")[0]
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[10px]" suppressHydrationWarning>
                            {new Date(threat.createdAt).toISOString().slice(11, 19)} UTC
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog open={selectedThreat?.id === threat.id} onOpenChange={(open) => { if (!open) setSelectedThreat(null); }}>
                              <DialogTrigger
                                render={
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setSelectedThreat(threat)}
                                    className="text-[10px] h-7 border-white/5 hover:text-cyber-blue"
                                  >
                                    Triage Log
                                  </Button>
                                }
                              />
                              <DialogContent className="max-w-4xl bg-card border-border text-foreground">
                                <DialogHeader>
                                  <DialogTitle className="text-sm font-semibold font-heading tracking-wider flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-cyber-blue" />
                                    TRIAGE TELEMETRY DETAIL: {selectedThreat?.id}
                                  </DialogTitle>
                                  <DialogDescription className="text-[10px] font-mono uppercase">
                                    Ingested from edge collector at {selectedThreat ? new Date(selectedThreat.createdAt).toLocaleString() : ""}
                                  </DialogDescription>
                                </DialogHeader>

                                {selectedThreat && (
                                  <div className="grid lg:grid-cols-12 gap-6 pt-4">
                                    {/* Left Column: Core Fields */}
                                    <div className="lg:col-span-5 space-y-4">
                                      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                        <div className="p-2 bg-black/25 border border-white/5 rounded-lg">
                                          <span className="text-[9px] text-muted-foreground uppercase block">Source IP</span>
                                          <span className="text-foreground font-semibold">{selectedThreat.sourceIp}</span>
                                        </div>
                                        <div className="p-2 bg-black/25 border border-white/5 rounded-lg">
                                          <span className="text-[9px] text-muted-foreground uppercase block">Target Socket</span>
                                          <span className="text-foreground font-semibold">{selectedThreat.target}</span>
                                        </div>
                                        <div className="p-2 bg-black/25 border border-white/5 rounded-lg">
                                          <span className="text-[9px] text-muted-foreground uppercase block">Severity Index</span>
                                          <Badge style={{ backgroundColor: `${getSeverityColor(selectedThreat.severity)}15`, color: getSeverityColor(selectedThreat.severity), borderColor: `${getSeverityColor(selectedThreat.severity)}30` }} variant="outline" className="text-[9px]">
                                            {selectedThreat.severity}
                                          </Badge>
                                        </div>
                                        <div className="p-2 bg-black/25 border border-white/5 rounded-lg">
                                          <span className="text-[9px] text-muted-foreground uppercase block">Origin Tenant</span>
                                          <span className="text-foreground truncate block">{selectedThreat.organization}</span>
                                        </div>
                                      </div>

                                      <div className="space-y-1.5 font-mono">
                                        <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                                          <AlertTriangle className="w-3.5 h-3.5 text-cyber-orange" /> Incident Escalation Ticket
                                        </label>
                                        {selectedThreat.incident ? (
                                          <Link
                                            href={`/incidents/${selectedThreat.incident.id}`}
                                            className="flex items-center justify-between w-full p-2.5 bg-cyber-red/5 border border-cyber-red/20 text-cyber-red text-xs rounded-lg hover:bg-cyber-red/10 transition-colors font-sans group"
                                          >
                                            <span>{selectedThreat.incident.title}</span>
                                            <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                                          </Link>
                                        ) : (
                                          <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/60" />
                                            No active case raised (low risk)
                                          </div>
                                        )}
                                      </div>

                                      {/* Assignment Workflow */}
                                      <div className="space-y-1.5 font-mono">
                                        <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                                          <User className="w-3.5 h-3.5 text-cyber-blue" /> Assign Operations Analyst
                                        </label>
                                        <select
                                          value={selectedThreat.assignedTo}
                                          onChange={(e) => handleThreatAssigneeUpdate(selectedThreat.id, e.target.value)}
                                          className="w-full bg-[#0b1727] border border-white/10 text-foreground text-xs rounded-lg px-3 h-9 focus:outline-none focus:ring-1 focus:ring-cyber-blue cursor-pointer"
                                        >
                                          {analystList.map((analyst) => (
                                            <option key={analyst} value={analyst}>
                                              {analyst === "Unassigned" ? "Unassigned" : analyst}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Status Workflow */}
                                      <div className="space-y-2 font-mono">
                                        <label className="text-[10px] text-muted-foreground uppercase">Triage Status Actions</label>
                                        <div className="flex gap-2">
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleThreatStatusUpdate(selectedThreat.id, "New")}
                                            className={`flex-1 text-[10px] h-8 ${selectedThreat.status === "New" ? "bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue" : "border-white/5"}`}
                                          >
                                            New
                                          </Button>
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleThreatStatusUpdate(selectedThreat.id, "Investigating")}
                                            className={`flex-1 text-[10px] h-8 ${selectedThreat.status === "Investigating" ? "bg-cyber-orange/10 border-cyber-orange/30 text-cyber-orange" : "border-white/5"}`}
                                          >
                                            Investigate
                                          </Button>
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleThreatStatusUpdate(selectedThreat.id, "Resolved")}
                                            className={`flex-1 text-[10px] h-8 ${selectedThreat.status === "Resolved" ? "bg-cyber-green/10 border-cyber-green/30 text-cyber-green" : "border-white/5"}`}
                                          >
                                            Resolve
                                          </Button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right Column: Payload, AI & Timeline */}
                                    <div className="lg:col-span-7 space-y-4">
                                      {/* Raw Payload */}
                                      <div className="space-y-1.5 font-mono">
                                        <p className="text-[10px] text-muted-foreground uppercase">Raw Firewall Ingested Stream Payload</p>
                                        <pre className="p-3 bg-black/60 border border-white/5 rounded-lg font-mono text-[10px] text-cyber-orange leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-40">
                                          {selectedThreat.rawPayload}
                                        </pre>
                                      </div>

                                      {/* AI Summary Section */}
                                      <div className="space-y-2 p-3.5 border border-cyber-blue/20 bg-cyber-blue/5 rounded-lg">
                                        <div className="flex items-center justify-between">
                                          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-heading tracking-wider">
                                            <Sparkles className="w-4 h-4 text-cyber-blue animate-pulse" />
                                            AEGIS CO-PILOT ANALYSIS
                                          </h4>
                                          {!aiSummary && !isGeneratingAi && (
                                            <Button 
                                              variant="default" 
                                              size="sm" 
                                              onClick={triggerAiSummaryGeneration}
                                              className="text-[10px] h-6 px-2 bg-cyber-blue text-background hover:bg-cyber-blue/90 shadow-[0_0_10px_rgba(6,182,212,0.15)] flex items-center gap-1 font-mono font-bold"
                                            >
                                              Audit Log Analysis
                                            </Button>
                                          )}
                                        </div>

                                        {isGeneratingAi && (
                                          <div className="py-4 flex flex-col items-center justify-center gap-2 text-center font-mono">
                                            <RefreshCw className="w-4 h-4 text-cyber-blue animate-spin" />
                                            <p className="text-[10px] text-muted-foreground">Synthesizing log fields and matching vectors...</p>
                                          </div>
                                        )}

                                        {aiSummary && !isGeneratingAi && (
                                          <div className="prose prose-invert prose-xs max-w-none text-muted-foreground/90 leading-relaxed text-[11px] whitespace-pre-wrap bg-black/35 p-2.5 rounded border border-white/5 font-sans max-h-48 overflow-y-auto">
                                            {aiSummary}
                                          </div>
                                        )}
                                      </div>

                                      {/* Historical Context Timeline */}
                                      <div className="space-y-2 border border-white/5 bg-background/25 p-3 rounded-lg font-mono">
                                        <h4 className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5">
                                          <History className="w-3.5 h-3.5 text-cyber-blue" /> System Correlation Timeline (Matches)
                                        </h4>
                                        
                                        {isLoadingRelated ? (
                                          <div className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                            <RefreshCw className="w-3 h-3 animate-spin text-cyber-blue" />
                                            Processing log correlates...
                                          </div>
                                        ) : (
                                          <div className="grid grid-cols-2 gap-4 text-[10px] max-h-36 overflow-y-auto">
                                            
                                            {/* IP Timeline */}
                                            <div className="space-y-1.5 border-r border-white/5 pr-2">
                                              <p className="font-semibold text-foreground/80 border-b border-white/5 pb-0.5">Threats from {selectedThreat.sourceIp}</p>
                                              {relatedEvents.ipThreats.length > 0 ? (
                                                relatedEvents.ipThreats.map(t => (
                                                  <div key={t.id} className="p-1.5 bg-background/30 rounded border border-white/5 space-y-0.5">
                                                    <div className="flex justify-between">
                                                      <span className="text-cyber-red font-semibold">{t.severity}</span>
                                                      <span className="text-[8px] text-muted-foreground" suppressHydrationWarning>{new Date(t.createdAt).toISOString().split('T')[0]}</span>
                                                    </div>
                                                    <p className="truncate text-muted-foreground">{t.description}</p>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="text-muted-foreground/50 italic">No historical traces</p>
                                              )}
                                            </div>

                                            {/* Target Timeline */}
                                            <div className="space-y-1.5 pl-1">
                                              <p className="font-semibold text-foreground/80 border-b border-white/5 pb-0.5">Threats against {selectedThreat.target}</p>
                                              {relatedEvents.targetThreats.length > 0 ? (
                                                relatedEvents.targetThreats.map(t => (
                                                  <div key={t.id} className="p-1.5 bg-background/30 rounded border border-white/5 space-y-0.5">
                                                    <div className="flex justify-between">
                                                      <span className="text-cyber-red font-semibold">{t.severity}</span>
                                                      <span className="text-[8px] text-muted-foreground" suppressHydrationWarning>{new Date(t.createdAt).toISOString().split('T')[0]}</span>
                                                    </div>
                                                    <p className="truncate text-muted-foreground">{t.description}</p>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="text-muted-foreground/50 italic">No historical traces</p>
                                              )}
                                            </div>

                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-xs text-muted-foreground font-mono">
                          NO LOG MATCHES REGISTERED WITH ACTIVE CRITERIA
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                    PAGE {currentPage} OF {totalPages} {"// MATCH COUNT: "}{totalCount}
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="text-xs h-8 border-white/5 hover:text-cyber-blue"
                    >
                      PREV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="text-xs h-8 border-white/5 hover:text-cyber-blue"
                    >
                      NEXT
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </CyberPanel>
        </>
      ) : (
        /* Threats Intelligence Tab Content - World-Class Command Center Redesign */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Interactive Relationship Graph & Actor List (Span 8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* SVG Relationship Graph */}
            <CyberPanel glowColor="cyber-blue" className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Activity className="w-3.5 h-3.5 text-cyber-blue animate-pulse" />
                  ADVERSARY RELATIONSHIP TOPOLOGY
                </h3>
                <CardDescription className="text-[10px] font-mono">Dynamic connection vectors mapping selected APT actors to targeted sectors and exploit paths.</CardDescription>
              </div>

              {/* SVG Graph Drawing */}
              <div className="h-[200px] border border-white/5 bg-black/40 rounded-lg relative flex items-center justify-center overflow-hidden">
                <div className="absolute top-2 left-2 font-mono text-[8px] text-muted-foreground uppercase pointer-events-none">
                  <span>ACTIVE RELATION: {selectedActorName.toUpperCase()}</span>
                </div>
                
                <svg viewBox="0 0 600 180" className="w-full h-full p-3 select-none">
                  {/* Define marker glows */}
                  <defs>
                    <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Draw connections based on selected actor */}
                  {mockActors.map((actor) => {
                    const isSelected = actor.name === selectedActorName;
                    if (!isSelected) return null;
                    
                    return (
                      <g key={actor.name}>
                        {/* Target connections */}
                        <line x1="80" y1="90" x2="300" y2="45" stroke="var(--cyber-blue)" strokeWidth={1.5} opacity={0.65} filter="url(#glow-neon)" />
                        <line x1="80" y1="90" x2="300" y2="135" stroke="var(--cyber-blue)" strokeWidth={1.5} opacity={0.65} filter="url(#glow-neon)" />
                        
                        {/* CVE connections */}
                        <line x1="300" y1="45" x2="520" y2="35" stroke="var(--cyber-orange)" strokeWidth={1} opacity={0.5} />
                        <line x1="300" y1="135" x2="520" y2="90" stroke="var(--cyber-orange)" strokeWidth={1} opacity={0.5} />
                        <line x1="300" y1="135" x2="520" y2="145" stroke="var(--cyber-orange)" strokeWidth={1} opacity={0.5} />
                      </g>
                    );
                  })}

                  {/* Nodes list */}
                  {/* Left Column: selected actor */}
                  <circle cx="80" cy="90" r="14" fill="#07111f" stroke="var(--cyber-blue)" strokeWidth={2} filter="url(#glow-neon)" />
                  <text x="80" y="115" textAnchor="middle" fill="white" className="text-[7px] font-mono uppercase font-bold">APT_ACTOR</text>

                  {/* Middle Column: Targeted sectors */}
                  <circle cx="300" cy="45" r="12" fill="#07111f" stroke="#8b5cf6" strokeWidth={1.5} />
                  <text x="300" y="68" textAnchor="middle" fill="#8b5cf6" className="text-[7px] font-mono uppercase">GOVT/DEFENSE</text>

                  <circle cx="300" cy="135" r="12" fill="#07111f" stroke="#8b5cf6" strokeWidth={1.5} />
                  <text x="300" y="158" textAnchor="middle" fill="#8b5cf6" className="text-[7px] font-mono uppercase">FIN/TECH</text>

                  {/* Right Column: CVE Nodes */}
                  <circle cx="520" cy="35" r="8" fill="#07111f" stroke="var(--cyber-orange)" strokeWidth={1} />
                  <text x="520" y="52" textAnchor="middle" fill="var(--cyber-orange)" className="text-[6px] font-mono">CVE-229</text>

                  <circle cx="520" cy="90" r="8" fill="#07111f" stroke="var(--cyber-orange)" strokeWidth={1} />
                  <text x="520" y="107" textAnchor="middle" fill="var(--cyber-orange)" className="text-[6px] font-mono">CVE-120</text>

                  <circle cx="520" cy="145" r="8" fill="#07111f" stroke="var(--cyber-orange)" strokeWidth={1} />
                  <text x="520" y="162" textAnchor="middle" fill="var(--cyber-orange)" className="text-[6px] font-mono">CVE-904</text>
                </svg>
              </div>
            </CyberPanel>

            {/* Actors List Selector */}
            <CyberPanel glowColor="cyber-blue" className="p-4 space-y-3">
              <div>
                <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Shield className="w-3.5 h-3.5 text-cyber-blue" />
                  ACTIVE THREAT DIRECTORY
                </h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {mockActors.map((actor) => {
                  const isSelected = actor.name === selectedActorName;
                  return (
                    <div 
                      key={actor.name} 
                      onClick={() => setSelectedActorName(actor.name)}
                      className={`p-3 bg-black/25 border rounded-lg space-y-2 font-mono text-[10px] cursor-pointer transition-all ${
                        isSelected 
                          ? "border-cyber-blue/30 bg-cyber-blue/5 shadow-[0_0_10px_rgba(0,229,255,0.05)] text-white" 
                          : "border-white/5 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{actor.name.split(" ")[0]}</span>
                        <span className={`text-[8px] font-bold ${actor.threatLevel === "CRITICAL" ? "text-cyber-red" : "text-cyber-orange"}`}>{actor.threatLevel}</span>
                      </div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground/80">
                        ORIGIN: <span className="text-foreground">{actor.origin}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CyberPanel>

          </div>

          {/* Actor Profile & CVE index (Span 4 columns) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Dynamic Dossier Profile card */}
            {(() => {
              const activeActor = mockActors.find(a => a.name === selectedActorName) || mockActors[0];
              return (
                <CyberPanel glowColor="cyber-purple" className="p-4 space-y-4">
                  <div className="border-b border-white/5 pb-2">
                    <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-widest block">TACTICAL_DOSSIER:</span>
                    <h4 className="text-sm font-bold text-white uppercase mt-0.5">{activeActor.name}</h4>
                  </div>

                  <div className="space-y-3 font-mono text-[9px] text-muted-foreground">
                    <div className="p-2 bg-black/35 border border-white/5 rounded leading-relaxed text-foreground/95">
                      {activeActor.description}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-black/25 border border-white/5 p-2 rounded">
                        <span>FIRST_SEEN:</span>
                        <p className="text-foreground font-bold mt-0.5">{activeActor.firstSeen}</p>
                      </div>
                      <div className="bg-black/25 border border-white/5 p-2 rounded">
                        <span>THREAT_LEVEL:</span>
                        <p className="text-cyber-red font-bold mt-0.5">{activeActor.threatLevel}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span>INTRUSION_VECTORS:</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {activeActor.vectors.map(v => (
                          <Badge key={v} variant="outline" className="text-[8px] py-0 border-white/10 uppercase bg-white/5 text-muted-foreground font-mono">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span>EXPL_VULNERABILITIES:</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {activeActor.cves.map(c => (
                          <Badge key={c} variant="outline" className="text-[8px] py-0 border-cyber-orange/30 text-cyber-orange bg-cyber-orange/5 font-mono">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CyberPanel>
              );
            })()}

            {/* CVE intelligence cards */}
            <CyberPanel glowColor="cyber-orange" className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <AlertCircle className="w-3.5 h-3.5 text-cyber-orange animate-pulse" />
                  CVE EXPLOIT INDEX
                </h3>
              </div>

              <div className="space-y-3 font-mono text-[9px]">
                {mockCves.map((cve) => (
                  <div key={cve.id} className="p-2.5 bg-black/25 border border-white/5 rounded flex justify-between items-center gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-cyber-orange font-bold">{cve.id}</span>
                      <p className="text-[8px] text-muted-foreground truncate">{cve.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-cyber-red font-bold">{cve.severity.split(" ")[0]}</span>
                      <Badge variant="outline" className="text-[7px] py-0 block uppercase mt-0.5 border-white/10 bg-white/5 text-muted-foreground">{cve.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CyberPanel>

            {/* Country Risk posture */}
            <CyberPanel glowColor="cyber-blue" className="p-4 space-y-3.5">
              <div>
                <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Globe className="w-3.5 h-3.5 text-cyber-blue" />
                  GLOBAL RISK RADAR
                </h3>
              </div>

              <div className="space-y-2.5 font-mono text-[9px]">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>1. Russian Fed. (RU)</span>
                    <span className="text-cyber-red">94%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div className="bg-cyber-red h-full rounded-full" style={{ width: "94%" }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>2. China (CN)</span>
                    <span className="text-cyber-orange">86%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div className="bg-cyber-orange h-full rounded-full" style={{ width: "86%" }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>3. North Korea (KP)</span>
                    <span className="text-cyber-orange">79%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div className="bg-cyber-orange h-full rounded-full" style={{ width: "79%" }} />
                  </div>
                </div>
              </div>
            </CyberPanel>
          </div>
          
        </div>
      )}
    </div>
  );
}
