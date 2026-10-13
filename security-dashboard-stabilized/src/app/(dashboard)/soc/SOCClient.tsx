"use client";
import { launchSimulationAction } from "../lab/actions";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Tv, Radio, 
  Terminal as TerminalIcon, Flame, Compass, Send
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ThreatMap, { AttackPath } from "@/components/soc/ThreatMap";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

interface Threat {
  id: string;
  sourceIp: string;
  target: string;
  severity: string;
  description: string;
  rawPayload: string;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
}

interface SOCClientProps {
  orgId: string;
  initialThreats: Threat[];
  initialIncidents: Incident[];
}

const targets: [number, number][] = [
  [-74.006, 40.7128],  // New York
  [-0.1278, 51.5074],  // London
  [139.6917, 35.6895], // Tokyo
  [103.8519, 1.3521]   // Singapore
];

function getRandomCoordinates(): [number, number] {
  const lng = Math.random() * 300 - 150;
  const lat = Math.random() * 120 - 50;
  return [lng, lat];
}

export default function SOCClient({ orgId, initialThreats, initialIncidents }: SOCClientProps) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [attacks, setAttacks] = useState<AttackPath[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Initialize map attacks with initial threats (high & critical ones)
  useEffect(() => {
    const initialPaths: AttackPath[] = initialThreats
      .filter(t => t.severity === "HIGH" || t.severity === "CRITICAL")
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        from: getRandomCoordinates(),
        to: targets[Math.floor(Math.random() * targets.length)],
        severity: t.severity,
        sourceIp: t.sourceIp,
        target: t.target
      }));
    setAttacks(initialPaths);
    setLogs([`[INFO] SOC Command Center initialized with ${initialThreats.length} historical records.`]);
  }, [initialThreats]);

  // Hook into live SSE events
  useRealtimeEvents(orgId, (type, payload) => {
    const timestamp = new Date().toLocaleTimeString();
    if (type === "threat") {
      setLogs(prev => [`[${timestamp}] [THREAT] ${payload.severity} threat detected from ${payload.sourceIp} target ${payload.target}`, ...prev].slice(0, 50));
      
      // Add attack line to map
      const newAttack: AttackPath = {
        id: payload.id || Math.random().toString(),
        from: getRandomCoordinates(),
        to: targets[Math.floor(Math.random() * targets.length)],
        severity: payload.severity,
        sourceIp: payload.sourceIp,
        target: payload.target
      };
      setAttacks(prev => [...prev, newAttack]);
      
      // Prune attack line after 8s
      setTimeout(() => {
        setAttacks(prev => prev.filter(a => a.id !== newAttack.id));
      }, 8000);
    } else if (type === "incident") {
      setIncidents(prev => [payload, ...prev].slice(0, 15));
      setLogs(prev => [`[${timestamp}] [INCIDENT] [${payload.severity}] Ticket created: "${payload.title}"`, ...prev].slice(0, 50));
    } else if (type === "security_log") {
      setLogs(prev => [`[${timestamp}] [SECURITY_LOG] Type: ${payload.eventType} - ${JSON.stringify(payload.details)}`, ...prev].slice(0, 50));
    }
  });

  // Calculate executive security score (0-100)
  const securityScore = useMemo(() => {
    const openCritical = incidents.filter(i => i.status === "open" && i.severity === "CRITICAL").length;
    const openHigh = incidents.filter(i => i.status === "open" && i.severity === "HIGH").length;
    const openMedium = incidents.filter(i => i.status === "open" && i.severity === "MEDIUM").length;
    
    const score = 100 - (openCritical * 18) - (openHigh * 10) - (openMedium * 4);
    return Math.max(0, Math.min(100, score));
  }, [incidents]);

  const scoreColor = useMemo(() => {
    if (securityScore >= 80) return "text-cyber-green border-cyber-green/30 bg-cyber-green/5";
    if (securityScore >= 50) return "text-cyber-orange border-cyber-orange/30 bg-cyber-orange/5";
    return "text-cyber-red border-cyber-red/30 bg-cyber-red/5";
  }, [securityScore]);

  // Attack simulator
  const handleSimulate = async () => {
    setIsSimulating(true);
    setLogs(prev => [`[SYSTEM] Launching synthetic log fixture...`, ...prev]);
    try {
      const attackTypes = ["SQL_INJECTION", "COMMAND_INJECTION", "BRUTE_FORCE", "DIRECTORY_TRAVERSAL"];
      const selectedType = attackTypes[Math.floor(Math.random() * attackTypes.length)];
      
      await launchSimulationAction(selectedType);

      setLogs(prev => [`[SYSTEM] Synthetic fixture ingested successfully.`, ...prev]);
    } catch (err: any) {
      setLogs(prev => [`[ERROR] Simulation failed: ${err.message}. Ensure python-service is active.`, ...prev]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      <p role="note" className="text-xs text-amber-400 p-2">Demo visualization: coordinates, actor/CVE examples and decorative counters are illustrative, not verified telemetry.</p>
      {/* Top SOC Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <Tv className="w-6 h-6 text-cyber-blue" />
            Live Command Center
          </h1>
          <p className="text-xs text-muted-foreground">
            B2B Tenant Isolation ID: <span className="font-mono text-white/70">{orgId}</span> | Connected to live SSE gateway.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulate}
            disabled={isSimulating}
            className="border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/10 flex items-center gap-1.5 font-mono text-xs"
          >
            <Send className="w-3.5 h-3.5" />
            {isSimulating ? "INGESTING..." : "SIMULATE ATTACK"}
          </Button>

          <Badge variant="outline" className="border-cyber-red/30 text-cyber-red bg-cyber-red/5 flex items-center gap-1.5 animate-pulse font-mono text-[10px]">
            <Radio className="w-3 h-3" /> STREAM ACTIVE
          </Badge>
        </div>
      </div>

      {/* Live Map & Log Terminal */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <ThreatMap attacks={attacks} />
        </div>

        {/* Live Terminal Log Stream */}
        <Card className="border-border bg-card/60 backdrop-blur-sm flex flex-col h-[500px]">
          <CardHeader className="border-b border-border pb-3 shrink-0 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-cyber-blue" />
                Live Ingest Stream
              </CardTitle>
              <CardDescription className="text-[10px]">Asynchronous SSE log buffer.</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-[9px] border-white/10 text-white/60">
              {logs.length} Buffered
            </Badge>
          </CardHeader>
          <CardContent className="flex-1 p-3 bg-black/40 overflow-y-auto font-mono text-[10px] space-y-2.5 scrollbar-thin">
            {logs.length > 0 ? (
              logs.map((log, index) => {
                let colorClass = "text-muted-foreground";
                if (log.includes("[THREAT]")) {
                  if (log.includes("CRITICAL") || log.includes("HIGH")) {
                    colorClass = "text-cyber-red font-semibold";
                  } else {
                    colorClass = "text-cyber-orange";
                  }
                } else if (log.includes("[INCIDENT]")) {
                  colorClass = "text-cyber-blue";
                } else if (log.includes("[SECURITY_LOG]")) {
                  colorClass = "text-cyber-yellow";
                } else if (log.includes("[SYSTEM]")) {
                  colorClass = "text-cyber-green";
                }

                return (
                  <div key={index} className={`border-b border-white/5 pb-1.5 ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-[11px] animate-pulse">
                WAITING FOR REAL-TIME EVENT INGESTION...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Posture Gauge & Incidents Feed */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Executive Risk Posture Gauge */}
        <Card className="border-border bg-card/60 backdrop-blur-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyber-blue" />
              Executive Security Posture
            </CardTitle>
            <CardDescription className="text-[10px]">Weighted risk dial calculated dynamically from open incidents.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
            <div className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300 ${scoreColor}`}>
              <span className="text-3xl font-extrabold font-mono">{securityScore}</span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">SCORE</span>
            </div>
            
            <div className="text-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                {securityScore >= 80 ? "EXCELLENT POSTURE" : securityScore >= 50 ? "DEGRADED STATE" : "CRITICAL RISK STATE"}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">
                {securityScore >= 80 
                  ? "Standard operations. No major intrusions detected." 
                  : securityScore >= 50 
                    ? "Active security events require verification." 
                    : "Immediate containment and triage operations mandatory."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Live Active Incident Ingest */}
        <Card className="lg:col-span-2 border-border bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="w-4 h-4 text-cyber-red" />
              Active Operational Incidents
            </CardTitle>
            <CardDescription className="text-[10px]">Real-time tickets requiring analyst assignment.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-mono text-[10px] text-muted-foreground">
                    <th className="p-3">Title</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Assigned To</th>
                    <th className="p-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {incidents.length > 0 ? (
                    incidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-semibold text-foreground/90">{incident.title}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[9px] uppercase font-mono ${
                            incident.severity === "CRITICAL"
                              ? "bg-cyber-red/10 text-cyber-red border-cyber-red/30"
                              : incident.severity === "HIGH"
                                ? "bg-cyber-orange/10 text-cyber-orange border-cyber-orange/30"
                                : "bg-cyber-yellow/10 text-cyber-yellow border-cyber-yellow/30"
                          }`}>
                            {incident.severity}
                          </Badge>
                        </td>
                        <td className="p-3 uppercase font-mono text-[10px]">{incident.status}</td>
                        <td className="p-3 font-mono text-muted-foreground">{incident.assignedTo}</td>
                        <td className="p-3 text-muted-foreground">{new Date(incident.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground text-[11px]">
                        No active incidents registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
