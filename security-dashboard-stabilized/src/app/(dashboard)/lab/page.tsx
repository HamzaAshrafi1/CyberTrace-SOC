"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  ShieldAlert, Play, Sparkles, History, CheckCircle2, XCircle,
  Network, Flame, RefreshCw
} from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CyberPanel } from "@/components/ui/CyberPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  getSimulationHistoryAction, 
  launchSimulationAction, 
  generateAiAttackAction 
} from "./actions";

interface AttackItem {
  id: string;
  name: string;
  description: string;
  severity: string;
  mitre: string;
  rule: string;
}

interface SimulationRun {
  id: string;
  attackType: string;
  severity: string;
  status: string;
  eventsGenerated: number;
  incidentsGenerated: number;
  startedAt: string;
  completedAt: string | null;
}

export default function LabPage() {
  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [activeRun, setActiveRun] = useState<SimulationRun | null>(null);
  
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [isGeneratingLogs, setIsGeneratingLogs] = useState(false);
  
  const [isLaunching, startLaunchTransition] = useTransition();

  // Attack Catalog Definition
  const ATTACK_CATALOG: AttackItem[] = [
    { id: "SQL_INJECTION", name: "SQL Injection (SQLi)", description: "Arbitrary database access attempts using SQL operators.", severity: "CRITICAL", mitre: "T1190 - Exploit Public-Facing Application", rule: "SQL signature heuristics" },
    { id: "XSS", name: "Cross Site Scripting (XSS)", description: "Malicious javascript injections targeting client pages.", severity: "HIGH", mitre: "T1059 - Command and Scripting Interpreter", rule: "XSS script match rules" },
    { id: "COMMAND_INJECTION", name: "Command Injection", description: "Direct execution of host operating system commands.", severity: "CRITICAL", mitre: "T1203 - Client Exploitation", rule: "OS execution commands" },
    { id: "DIRECTORY_TRAVERSAL", name: "Directory Traversal", description: "Navigating directory paths to read restricted files.", severity: "HIGH", mitre: "T1083 - File Discovery", rule: "Path traversal heuristics" },
    { id: "BRUTE_FORCE", name: "Web Brute Force", description: "High-volume credential guessing attempts on login portals.", severity: "HIGH", mitre: "T1110 - Brute Force", rule: "Volumetric failed credentials" },
    { id: "SSH_BRUTE_FORCE", name: "SSH Brute Force", description: "Password guessing attacks targeting SSH port 22 gateways.", severity: "HIGH", mitre: "T1110.001 - Password Guessing", rule: "Port 22 SSH audit anomalies" },
    { id: "DDOS", name: "DDoS Volumetrics", description: "Overwhelming system resources with packet floods.", severity: "HIGH", mitre: "T1498 - Network Denial of Service", rule: "Volumetric rate spikes" },
    { id: "MALICIOUS_FILE_UPLOAD", name: "Malicious File Upload", description: "Uploading double extension web shell scripts.", severity: "CRITICAL", mitre: "T1505.003 - Web Shell", rule: "Double extension uploads" },
    { id: "PRIVILEGE_ESCALATION", name: "Privilege Escalation", description: "Exploiting local bugs to add apache user to sudoers.", severity: "CRITICAL", mitre: "T1068 - Privilege Escalation", rule: "Privileged shell spawns" },
    { id: "SUSPICIOUS_POWERSHELL", name: "Suspicious PowerShell", description: "Execution of obfuscated bypass commands.", severity: "HIGH", mitre: "T1059.001 - PowerShell", rule: "Obfuscated shell invocation" }
  ];

  const loadHistory = () => {
    getSimulationHistoryAction()
      .then(setHistory)
      .catch(err => console.error("Failed to load lab history:", err));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleLaunchSimulation = (attackId: string) => {
    startLaunchTransition(async () => {
      try {
        const run = await launchSimulationAction(attackId);
        setActiveRun(run);
        // Refresh history
        loadHistory();
      } catch (err) {
        console.error("Simulation failed:", err);
        alert(err instanceof Error ? err.message : "Failed to run simulation");
      }
    });
  };

  const handleGenerateAiLogs = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingLogs(true);
    setAiLogs([]);
    try {
      const logs = await generateAiAttackAction(aiPrompt);
      setAiLogs(logs);
    } catch (err) {
      console.error("AI Log generation failed:", err);
      alert("Failed to generate AI logs.");
    } finally {
      setIsGeneratingLogs(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-wider font-heading bg-gradient-to-r from-foreground via-foreground/90 to-cyber-red bg-clip-text text-transparent flex items-center gap-2 uppercase">
          <Flame className="w-6 h-6 text-cyber-red animate-pulse" /> Attack Simulation Lab
        </h1>
        <p className="text-xs text-muted-foreground font-mono">
          CYBER RANGE BOUNDARY: <span className="text-cyber-orange font-semibold">SECURE SANDBOX ACTIVE</span> {"// RUN COMPATIBILITY TEST ACTIONS"}
        </p>
      </div>

      {/* Main Grid: Top catalogs and scorecards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ====================================================
            1. ATTACK CATALOG (Left / Center)
            ==================================================== */}
        <div className="lg:col-span-8 space-y-6">
          <CyberPanel glowColor="cyber-blue">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 font-heading tracking-wider">
                <ShieldAlert className="w-4 h-4 text-cyber-blue" /> Attack Catalog
              </CardTitle>
              <CardDescription className="text-[10px] font-mono">Select an attack vector to launch in the sandboxed cyber range</CardDescription>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {ATTACK_CATALOG.map((attack) => (
                <div 
                  key={attack.id}
                  className="p-4 bg-background/50 hover:bg-cyber-blue/5 border border-white/5 rounded-xl flex flex-col justify-between space-y-3 transition-all duration-200"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-foreground font-heading">{attack.name}</h4>
                      <Badge className={`text-[8px] font-mono border-0 ${
                        attack.severity === "CRITICAL" 
                          ? "bg-cyber-red/20 text-cyber-red" 
                          : "bg-cyber-orange/20 text-cyber-orange"
                      }`}>
                        {attack.severity}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed font-sans">{attack.description}</p>
                    <div className="pt-2 space-y-0.5 font-mono text-[9px] text-muted-foreground">
                      <div><span className="text-cyber-blue font-semibold">MITRE:</span> {attack.mitre}</div>
                      <div><span className="text-cyber-orange font-semibold">RULE:</span> {attack.rule}</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleLaunchSimulation(attack.id)}
                    disabled={isLaunching}
                    className="w-full bg-cyber-blue/10 hover:bg-cyber-blue text-cyber-blue hover:text-background border border-cyber-blue/20 text-[10px] h-7.5 flex items-center justify-center gap-1 font-mono font-bold"
                  >
                    <Play className="w-3 h-3" /> LAUNCH SIMULATION
                  </Button>
                </div>
              ))}
            </CardContent>
          </CyberPanel>

          {/* ====================================================
              2. EXECUTION HISTORY (Bottom Left)
              ==================================================== */}
          <CyberPanel glowColor="cyber-blue">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 font-heading tracking-wider">
                  <History className="w-4 h-4 text-cyber-blue" /> Execution History
                </CardTitle>
                <CardDescription className="text-[10px] font-mono">Telemetry log of previous simulation runs</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadHistory}
                className="h-8 border-white/5 text-xs flex items-center gap-1.5 font-mono"
              >
                <RefreshCw className="w-3.5 h-3.5" /> REFRESH
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-background/40">
                  <TableRow className="border-b border-white/5">
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Attack Type</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase w-16">Severity</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase w-20">Status</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase w-28 text-center">Threats Ingested</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase w-28 text-center">Incidents Raised</TableHead>
                    <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase w-36">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length > 0 ? (
                    history.map((run) => (
                      <TableRow 
                        key={run.id}
                        onClick={() => setActiveRun(run)}
                        className={`cursor-pointer hover:bg-cyber-blue/5 transition-colors border-b border-white/5 font-mono text-xs ${
                          activeRun?.id === run.id ? "bg-cyber-blue/5 border-l-2 border-l-cyber-blue" : ""
                        }`}
                      >
                        <TableCell className="font-semibold text-xs text-foreground font-sans">{run.attackType}</TableCell>
                        <TableCell>
                          <Badge className={`text-[8px] font-mono border-0 ${
                            run.severity === "CRITICAL" ? "bg-cyber-red/20 text-cyber-red" : "bg-cyber-orange/20 text-cyber-orange"
                          }`}>
                            {run.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[8px] font-mono ${
                            run.status === "Completed" ? "border-cyber-green/30 text-cyber-green bg-cyber-green/5" : "border-cyber-orange/30 text-cyber-orange bg-cyber-orange/5 animate-pulse"
                          }`}>
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-cyber-blue">{run.eventsGenerated}</TableCell>
                        <TableCell className="text-center font-mono text-xs text-cyber-orange">{run.incidentsGenerated}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                          {new Date(run.startedAt).toUTCString().replace("GMT", "UTC")}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-xs text-muted-foreground font-mono">
                        NO SIMULATIONS RUN YET
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </CyberPanel>
        </div>

        {/* ====================================================
            RIGHT PANEL: SCORECARD + RED VS BLUE TIMELINE + AI
            ==================================================== */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* DETECTION SCORECARD */}
          {activeRun && (
            <CyberPanel glowColor="cyber-green">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 font-heading tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-cyber-green animate-pulse" /> Detection Scorecard
                </CardTitle>
                <CardDescription className="text-[10px] font-mono">Verification checklist for run {activeRun.id.slice(0,8)}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Attack Type:</span>
                  <span className="font-semibold text-foreground">{activeRun.attackType}</span>
                </div>
                
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Threat Ingested:</span>
                  <Badge className="bg-cyber-green/10 text-cyber-green border-0 flex items-center gap-1 text-[9px] font-semibold py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> {activeRun.eventsGenerated} Logs
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Rule Matches:</span>
                  <Badge className="bg-cyber-green/10 text-cyber-green border-0 flex items-center gap-1 text-[9px] font-semibold py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Ingestion Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Incident Created:</span>
                  {activeRun.incidentsGenerated > 0 ? (
                    <Badge className="bg-cyber-orange/10 text-cyber-orange border-0 flex items-center gap-1 text-[9px] font-semibold py-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Incident Raised
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-white/5 text-muted-foreground text-[9px]">
                      <XCircle className="w-3 h-3" /> None
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] uppercase text-muted-foreground">SOAR Playbooks:</span>
                  {activeRun.severity === "CRITICAL" ? (
                    <Badge className="bg-cyber-green/10 text-cyber-green border-0 flex items-center gap-1 text-[9px] font-semibold py-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Executed
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">None triggered</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground">MITRE Mapped:</span>
                  <Badge className="bg-cyber-green/10 text-cyber-green border-0 flex items-center gap-1 text-[9px] font-semibold py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Mapped
                  </Badge>
                </div>
              </CardContent>
            </CyberPanel>
          )}

          {/* RED TEAM VS BLUE TEAM TIMELINE */}
          {activeRun && (
            <CyberPanel glowColor="cyber-orange">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 font-heading tracking-wider">
                  <Network className="w-4 h-4 text-cyber-blue" /> Red vs Blue Timeline
                </CardTitle>
                <CardDescription className="text-[10px] font-mono">Complete detection → response chronology</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                
                <div className="relative pl-5 border-l border-white/10 space-y-4 text-[11px]">
                  
                  {/* Step 1 */}
                  <div className="relative">
                    <div className="absolute left-[-26px] top-0.5 w-3 h-3 rounded-full bg-cyber-red ring-4 ring-cyber-red/10" />
                    <div className="font-semibold text-cyber-red flex items-center gap-1 font-mono uppercase text-[9px]">
                      [Red Team Activity]
                    </div>
                    <p className="font-bold text-foreground mt-0.5 font-sans">Attack Simulation Launched</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Started: {new Date(activeRun.startedAt).toLocaleTimeString()}</p>
                  </div>

                  {/* Step 2 */}
                  <div className="relative">
                    <div className="absolute left-[-26px] top-0.5 w-3 h-3 rounded-full bg-cyber-blue ring-4 ring-cyber-blue/10" />
                    <div className="font-semibold text-cyber-blue flex items-center gap-1 font-mono uppercase text-[9px]">
                      [Blue Team Ingest]
                    </div>
                    <p className="font-bold text-foreground mt-0.5 font-sans">ThreatEvent Captured</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 font-mono">
                      Ingested {activeRun.eventsGenerated} payloads targeting node endpoints.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="relative">
                    <div className="absolute left-[-26px] top-0.5 w-3 h-3 rounded-full bg-cyber-orange ring-4 ring-cyber-orange/10" />
                    <div className="font-semibold text-cyber-orange flex items-center gap-1 font-mono uppercase text-[9px]">
                      [Triage Pipeline]
                    </div>
                    <p className="font-bold text-foreground mt-0.5 font-sans">SOC Incident Raised</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 font-mono">
                      {activeRun.incidentsGenerated > 0 
                        ? `Auto-created incident ticket categorized under ${activeRun.attackType}.`
                        : "Heuristics logs completed. Event logged under Threat Feed."}
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="relative">
                    <div className="absolute left-[-26px] top-0.5 w-3 h-3 rounded-full bg-cyber-green ring-4 ring-cyber-green/10" />
                    <div className="font-semibold text-cyber-green flex items-center gap-1 font-mono uppercase text-[9px]">
                      [SOAR Automation]
                    </div>
                    <p className="font-bold text-foreground mt-0.5 font-sans">Playbook Response Executed</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 font-mono">
                      Forwarded slack webhook alerting and registered notifications.
                    </p>
                  </div>

                </div>

              </CardContent>
            </CyberPanel>
          )}

          {/* AI ATTACK GENERATOR */}
          <CyberPanel glowColor="cyber-purple">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5 font-heading tracking-wider">
                <Sparkles className="w-4 h-4 text-cyber-purple" /> AI Attack Generator
              </CardTitle>
              <CardDescription className="text-[10px] font-mono">Create custom attack log signatures with AI</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4 font-mono">
              <div className="flex gap-2">
                <Input 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Obfuscated Base64 PowerShell execution..."
                  className="bg-background/40 border-white/5 text-xs focus-visible:ring-cyber-purple/50 font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter") handleGenerateAiLogs(); }}
                />
                <Button 
                  onClick={handleGenerateAiLogs}
                  disabled={isGeneratingLogs || !aiPrompt.trim()}
                  className="bg-cyber-purple/20 hover:bg-cyber-purple/35 border border-cyber-purple/30 text-cyber-purple text-xs px-3.5 font-mono"
                >
                  {isGeneratingLogs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "GENERATE"}
                </Button>
              </div>

              {aiLogs.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest font-mono">Generated Synthetic Logs</p>
                  <div className="p-3 bg-black/60 border border-white/5 rounded-lg max-h-48 overflow-y-auto space-y-1.5">
                    {aiLogs.map((log, index) => (
                      <pre key={index} className="text-[10px] font-mono text-purple-300 whitespace-pre-wrap break-all leading-normal">
                        {log}
                      </pre>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CyberPanel>

        </div>

      </div>

    </div>
  );
}
