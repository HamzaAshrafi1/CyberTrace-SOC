"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { 
  ArrowLeft, AlertOctagon, User, Clock, FileText, 
  Sparkles, RefreshCw, Send, Printer, ShieldAlert,
  ChevronRight, Calendar, Shield, UserPlus, CheckCircle,
  Activity
} from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CyberPanel } from "@/components/ui/CyberPanel";
import { 
  addIncidentCommentAction, 
  updateIncidentWorkflowAction, 
  generateIncidentAiSummaryAction 
} from "./actions";

interface ThreatEvent {
  id: string;
  createdAt: string;
  sourceIp: string;
  target: string;
  severity: string;
  description: string;
}

interface IncidentComment {
  id: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface IncidentActivityLog {
  id: string;
  activityType: string;
  description: string;
  createdAt: string;
}

interface IncidentDetails {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assignedTo: string;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
  threatEvents: ThreatEvent[];
  comments: IncidentComment[];
  activityLogs: IncidentActivityLog[];
}

interface IncidentDetailsClientProps {
  incident: IncidentDetails;
  organizationUsers: string[];
  currentUserEmail: string;
}

export default function IncidentDetailsClient({
  incident,
  organizationUsers,
  currentUserEmail,
}: IncidentDetailsClientProps) {
  const [commentContent, setCommentContent] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [localAiSummary, setLocalAiSummary] = useState<string | null>(incident.aiSummary);

  const [isPending, startTransition] = useTransition();

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    startTransition(async () => {
      try {
        await addIncidentCommentAction(incident.id, commentContent.trim());
        setCommentContent("");
      } catch (err) {
        console.error("Failed to post comment:", err);
        alert("Failed to submit comment.");
      }
    });
  };

  const handleWorkflowTransition = async (status: string, assignee?: string) => {
    startTransition(async () => {
      try {
        await updateIncidentWorkflowAction(incident.id, status, assignee);
      } catch (err) {
        console.error("Workflow update failed:", err);
        alert("Failed to update incident state.");
      }
    });
  };

  const handleGenerateAiSummary = async () => {
    setIsAiLoading(true);
    try {
      const report = await generateIncidentAiSummaryAction(incident.id);
      setLocalAiSummary(report);
    } catch (err) {
      console.error("AI Generation failed:", err);
      alert("Failed to compile AI summary report.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const analystList = Array.from(new Set(["Unassigned", "analyst@alphasec.com", ...organizationUsers]));

  // Visual helper mapping activity log types to descriptive icons
  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "created":
        return <Shield className="w-4 h-4 text-cyber-blue" />;
      case "assigned":
        return <UserPlus className="w-4 h-4 text-cyber-orange" />;
      case "status_change":
        return <AlertOctagon className="w-4 h-4 text-cyber-yellow" />;
      case "resolved":
        return <CheckCircle className="w-4 h-4 text-cyber-green" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic printer styling overrides */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          aside, header, nav, .no-print, button, form, input, select, textarea {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          #incident-print-area {
            display: block !important;
            width: 100% !important;
            position: absolute;
            left: 0;
            top: 0;
            background: white !important;
            color: black !important;
          }
          .card, .p-4, .p-6, pre {
            border: 1px solid #ccc !important;
            background: transparent !important;
            color: black !important;
            box-shadow: none !important;
          }
          pre {
            white-space: pre-wrap !important;
          }
          badge, span, p {
            color: black !important;
          }
        }
      `}</style>

      {/* Breadcrumbs & Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-2 text-xs">
          <Link href="/incidents" className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Incidents Hub
          </Link>
          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-muted-foreground font-mono truncate max-w-[150px]">{incident.id}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="text-xs h-9 border-border bg-card/60 flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Export Report PDF
          </Button>
        </div>
      </div>

      {/* Main Print Wrapper */}
      <div id="incident-print-area" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Hand: General Stats & Details Workstation */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Details Ticket Card */}
          <CyberPanel glowColor="cyber-red" className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-red/5 rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="border-b border-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-cyber-red animate-pulse" />
                  <div>
                    <CardTitle className="text-base font-bold font-heading tracking-wider">{incident.title}</CardTitle>
                    <span className="text-[10px] text-muted-foreground font-mono">INCIDENT TICKET ID: {incident.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] capitalize font-mono border-0 font-semibold ${
                    incident.severity === "CRITICAL" 
                      ? "bg-cyber-red/20 text-cyber-red" 
                      : incident.severity === "HIGH"
                        ? "bg-cyber-orange/20 text-cyber-orange"
                        : incident.severity === "MEDIUM"
                          ? "bg-cyber-yellow/20 text-cyber-yellow"
                          : "bg-cyber-blue/20 text-cyber-blue"
                  }`}>
                    {incident.severity}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] capitalize font-mono ${
                    incident.status === "open"
                      ? "border-cyber-red/30 text-cyber-red bg-cyber-red/5" 
                      : incident.status === "investigating"
                        ? "border-cyber-orange/30 text-cyber-orange bg-cyber-orange/5"
                        : incident.status === "contained"
                          ? "border-cyber-blue/30 text-cyber-blue bg-cyber-blue/5"
                          : "border-cyber-green/30 text-cyber-green bg-cyber-green/5"
                  }`}>
                    {incident.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Progress Step Bar */}
              <div className="mb-6 grid grid-cols-4 gap-2 font-mono text-[9px] no-print">
                {[
                  { status: "open", label: "1. OPEN STATE", color: "cyber-red" },
                  { status: "investigating", label: "2. TRIAGE & INVESTIGATING", color: "cyber-orange" },
                  { status: "contained", label: "3. ISOLATED & CONTAINED", color: "cyber-blue" },
                  { status: "resolved", label: "4. VERIFIED & RESOLVED", color: "cyber-green" }
                ].map((step, idx) => {
                  const statuses = ["open", "investigating", "contained", "resolved"];
                  const currentIdx = statuses.indexOf(incident.status.toLowerCase());
                  const isCurrent = incident.status.toLowerCase() === step.status;
                  const isPast = currentIdx >= idx;
                  
                  let borderClass = "border-white/5 text-muted-foreground/35";
                  let textClass = "text-muted-foreground/40";
                  let dotClass = "bg-white/10";

                  if (isCurrent) {
                    textClass = "text-foreground font-bold";
                    if (step.color === "cyber-red") { borderClass = "border-cyber-red"; dotClass = "bg-cyber-red animate-pulse"; }
                    if (step.color === "cyber-orange") { borderClass = "border-cyber-orange"; dotClass = "bg-cyber-orange animate-pulse"; }
                    if (step.color === "cyber-blue") { borderClass = "border-cyber-blue"; dotClass = "bg-cyber-blue animate-pulse"; }
                    if (step.color === "cyber-green") { borderClass = "border-cyber-green"; dotClass = "bg-cyber-green animate-pulse"; }
                  } else if (isPast) {
                    textClass = "text-muted-foreground";
                    if (step.color === "cyber-red") { borderClass = "border-cyber-red/40"; dotClass = "bg-cyber-red/50"; }
                    if (step.color === "cyber-orange") { borderClass = "border-cyber-orange/40"; dotClass = "bg-cyber-orange/50"; }
                    if (step.color === "cyber-blue") { borderClass = "border-cyber-blue/40"; dotClass = "bg-cyber-blue/50"; }
                    if (step.color === "cyber-green") { borderClass = "border-cyber-green/40"; dotClass = "bg-cyber-green/50"; }
                  }

                  return (
                    <div 
                      key={step.status} 
                      className={`border-t-2 pt-2 px-1 transition-all duration-300 ${borderClass} ${textClass}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase font-mono tracking-wider">Ticket Description</h3>
                <p className="text-xs text-foreground leading-relaxed bg-background/30 p-3 rounded-lg border border-white/5">
                  {incident.description || "No operational description filed."}
                </p>
              </div>

              {/* Created / Updated */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-2.5 rounded bg-background/50 border border-white/5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyber-blue" />
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-mono">Discovered Time (UTC)</p>
                    <p className="font-semibold mt-0.5">{new Date(incident.createdAt).toUTCString()}</p>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-background/50 border border-white/5 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyber-green" />
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase font-mono">Last Activity Sync (UTC)</p>
                    <p className="font-semibold mt-0.5">{new Date(incident.updatedAt).toUTCString()}</p>
                  </div>
                </div>
              </div>

              {/* Triage Workflow advancement buttons */}
              <div className="space-y-2.5 border-t border-white/5 pt-4 no-print font-mono">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-[10px]">Triage Workflow State Machine</h3>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleWorkflowTransition("open")}
                    className={`text-xs h-8.5 border-white/5 ${incident.status === "open" ? "bg-cyber-red/10 border-cyber-red/30 text-cyber-red" : "hover:bg-secondary/40"}`}
                  >
                    Mark Open
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleWorkflowTransition("investigating")}
                    className={`text-xs h-8.5 border-white/5 ${incident.status === "investigating" ? "bg-cyber-orange/10 border-cyber-orange/30 text-cyber-orange" : "hover:bg-secondary/40"}`}
                  >
                    Mark Investigating
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleWorkflowTransition("contained")}
                    className={`text-xs h-8.5 border-white/5 ${incident.status === "contained" ? "bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue" : "hover:bg-secondary/40"}`}
                  >
                    Mark Contained
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleWorkflowTransition("resolved")}
                    className={`text-xs h-8.5 border-white/5 ${incident.status === "resolved" ? "bg-cyber-green/10 border-cyber-green/30 text-cyber-green" : "hover:bg-secondary/40"}`}
                  >
                    Resolve Incident
                  </Button>
                </div>
              </div>
            </CardContent>
          </CyberPanel>

          {/* Linked Threat Events Table */}
          <CyberPanel glowColor="cyber-blue" className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyber-blue animate-pulse" />
                <CardTitle className="text-sm font-semibold font-heading tracking-wider">CORRELATED INGESTION PACKETS ({incident.threatEvents.length})</CardTitle>
              </div>
              <CardDescription className="text-[11px] font-mono">Individual telemetry packets correlated into this incident ticket.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-background/40">
                  <TableRow className="border-b border-white/5">
                    <TableHead className="w-24 text-xs font-mono tracking-widest text-muted-foreground uppercase">Threat ID</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Source IP</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Target system</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Threat Type</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Severity</TableHead>
                    <TableHead className="text-right text-xs font-mono tracking-widest text-muted-foreground uppercase">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incident.threatEvents.length > 0 ? (
                    incident.threatEvents.map((threat) => (
                      <TableRow key={threat.id} className="border-b border-white/5 hover:bg-cyber-blue/5 transition-colors font-mono text-xs">
                        <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px]">{threat.id}</TableCell>
                        <TableCell className="font-semibold text-cyber-blue">{threat.sourceIp}</TableCell>
                        <TableCell className="text-foreground/80">{threat.target}</TableCell>
                        <TableCell className="text-foreground/90 font-sans">{threat.description}</TableCell>
                        <TableCell>
                          <Badge className={`text-[9px] capitalize font-mono border-0 font-semibold ${
                            threat.severity === "CRITICAL" 
                              ? "bg-cyber-red/20 text-cyber-red" 
                              : threat.severity === "HIGH"
                                ? "bg-cyber-orange/20 text-cyber-orange"
                                : threat.severity === "MEDIUM"
                                  ? "bg-cyber-yellow/20 text-cyber-yellow"
                                  : "bg-cyber-blue/20 text-cyber-blue"
                          }`}>
                            {threat.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/threats?q=${threat.id}`} className="text-cyber-blue text-xs hover:underline no-print font-medium inline-flex items-center gap-0.5 font-mono">
                            INSPECT <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground font-mono">
                        NO LINKED THREAT EVENTS IDENTIFIED
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </CyberPanel>

          {/* AI Summary Section */}
          <CyberPanel glowColor="cyber-blue" className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-cyber-blue/10 bg-cyber-blue/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyber-blue animate-pulse" />
                  <CardTitle className="text-sm font-semibold font-heading tracking-wider">Aegis AI Incident Summary Report</CardTitle>
                </div>
                {!localAiSummary && !isAiLoading && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleGenerateAiSummary}
                    className="text-[10px] h-6 px-2 bg-cyber-blue text-background hover:bg-cyber-blue/90 shadow-[0_0_12px_rgba(6,182,212,0.2)] flex items-center gap-1 no-print font-mono font-bold"
                  >
                    Compile AI Summary
                  </Button>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground/80 font-mono">Executive brief and root cause analysis generated autonomously.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isAiLoading && (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center font-mono">
                  <RefreshCw className="w-6 h-6 text-cyber-blue animate-spin" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Invoking OpenRouter LangChain Agent...</p>
                    <p className="text-[10px] text-muted-foreground">Compiling threat metrics and synthesizing mitigation guidelines...</p>
                  </div>
                </div>
              )}

              {!isAiLoading && localAiSummary && (
                <div className="prose prose-invert prose-xs max-w-none text-muted-foreground/90 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-black/35 p-4 border border-white/5 rounded-lg">
                  {localAiSummary}
                </div>
              )}

              {!isAiLoading && !localAiSummary && (
                <div className="py-8 text-center text-xs text-muted-foreground italic font-mono flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 rounded-lg bg-background/25">
                  NO AI REPORT COMPILED YET
                  <p className="text-[10px] not-italic text-muted-foreground/60">Click compile above to audit this incident ticket.</p>
                </div>
              )}
            </CardContent>
          </CyberPanel>

        </div>

        {/* Right Hand: Operator Assignment, Timeline, Comments */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Operator Assignee Card */}
          <CyberPanel glowColor="cyber-blue" className="p-1">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-cyber-blue" />
                <CardTitle className="text-sm font-semibold font-heading tracking-wider">Incident Operations Team</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              
              <div className="space-y-1.5 font-mono">
                <label className="text-[10px] text-muted-foreground uppercase">Assigned Analyst</label>
                <div className="no-print">
                  <select
                    value={incident.assignedTo}
                    onChange={(e) => handleWorkflowTransition(incident.status, e.target.value)}
                    className="w-full bg-[#0b1727] border border-white/10 text-foreground text-xs rounded-lg px-3 h-9 focus:outline-none focus:ring-1 focus:ring-cyber-blue cursor-pointer"
                  >
                    {analystList.map((analyst) => (
                      <option key={analyst} value={analyst}>
                        {analyst === "Unassigned" ? "Unassigned" : analyst}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden print:block text-xs font-mono font-semibold text-foreground">
                  {incident.assignedTo}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-white/5 pt-3 font-mono">
                <span>Active Operator:</span>
                <span className="font-mono text-cyber-blue font-semibold bg-[#0b1727] px-1.5 py-0.5 rounded border border-white/5">{currentUserEmail.split("@")[0]}</span>
              </div>
            </CardContent>
          </CyberPanel>

          {/* Incident Comments */}
          <CyberPanel glowColor="cyber-blue" className="flex flex-col max-h-[400px]">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 font-heading tracking-wider">
                <FileText className="w-4 h-4 text-cyber-blue" /> Incident Activity Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col flex-1 min-h-0 space-y-4">
              
              {/* Form (Submit) */}
              <form onSubmit={handlePostComment} className="flex gap-2 shrink-0 no-print font-mono">
                <input 
                  placeholder="Post comment details..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  disabled={isPending}
                  className="flex-1 bg-background/80 border border-white/5 text-foreground text-xs rounded-lg px-3 h-8.5 focus:outline-none focus:ring-1 focus:ring-cyber-blue font-mono"
                />
                <Button 
                  type="submit"
                  size="icon"
                  disabled={isPending || !commentContent.trim()}
                  className="h-8.5 w-8.5 shrink-0 bg-cyber-blue hover:bg-cyber-blue/90 text-background"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>

              {/* Scrollable comments history */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-56">
                {incident.comments.length > 0 ? (
                  incident.comments.map((comment) => (
                    <div key={comment.id} className="p-2.5 rounded bg-background/40 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                        <span className="font-semibold text-foreground/80">{comment.userName.split("@")[0]}</span>
                        <span>{new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-foreground/90 font-sans leading-normal whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-xs text-muted-foreground/60 italic font-mono">
                    No comments filed yet.
                  </p>
                )}
              </div>

            </CardContent>
          </CyberPanel>

          {/* Visual Activity Timeline */}
          <CyberPanel glowColor="cyber-blue">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 font-heading tracking-wider">
                <Activity className="w-4 h-4 text-cyber-blue" /> Visual Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {incident.activityLogs.length > 0 ? (
                  incident.activityLogs.map((log, index) => (
                    <div key={log.id} className="flex gap-3 text-xs relative">
                      {/* Timeline Line connector */}
                      {index < incident.activityLogs.length - 1 && (
                        <span className="absolute left-3.5 top-6 bottom-[-16px] w-[1px] bg-white/5" />
                      )}
                      
                      {/* Icon */}
                      <div className="w-7 h-7 rounded-full bg-[#0b1727] border border-white/5 flex items-center justify-center shrink-0 z-10">
                        {getActivityIcon(log.activityType)}
                      </div>

                      {/* Log Details */}
                      <div className="pt-0.5 space-y-0.5 flex-1">
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                          <span className="capitalize font-semibold text-foreground/90">{log.activityType.replace("_", " ")}</span>
                          <span>{new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                          {log.description}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-xs text-muted-foreground/60 italic font-mono">
                    No timeline checkpoints registered.
                  </p>
                )}
              </div>
            </CardContent>
          </CyberPanel>

        </div>

      </div>
    </div>
  );
}
