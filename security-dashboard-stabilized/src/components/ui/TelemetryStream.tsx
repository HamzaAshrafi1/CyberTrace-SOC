"use client";

import React, { useEffect, useState, useRef } from "react";

interface LogMessage {
  time: string;
  type: "THREAT" | "SOAR" | "INCIDENT" | "HUNT" | "SYS";
  message: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
}

const TEMPLATE_LOGS: Omit<LogMessage, "time">[] = [
  { type: "THREAT", message: "SQL Injection attack signature blocked from 198.51.100.45", severity: "CRITICAL" },
  { type: "SOAR", message: "Automated playbook isolation trigger initiated for host-kubernetes-nodes-09", severity: "HIGH" },
  { type: "SYS", message: "Ingestion gateway rate limiter synchronized across API nodes", severity: "INFO" },
  { type: "HUNT", message: "Threat hunt query 'SELECT * FROM ThreatEvent WHERE severity = CRITICAL' executed", severity: "INFO" },
  { type: "INCIDENT", message: "Incident #INC-9204 assigned to security response team (triage mode)", severity: "HIGH" },
  { type: "THREAT", message: "Brute-force credential guesser detected on staging admin router (45 attempts/m)", severity: "HIGH" },
  { type: "SOAR", message: "Security credentials rotated automatically for AWS IAM node keys", severity: "INFO" },
  { type: "THREAT", message: "Suspicious PowerShell base64 execution blocked in user-endpoint-042", severity: "CRITICAL" },
  { type: "SYS", message: "SSE Realtime Gateway handshake successful (isolation enabled)", severity: "INFO" },
  { type: "HUNT", message: "Anomaly scan complete: 0 new malware paths resolved", severity: "INFO" },
  { type: "INCIDENT", message: "Containment confirmed for incident #INC-9189 (Playbook #PB-09 completed)", severity: "MEDIUM" },
];

export function TelemetryStream() {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Seed initial logs
    const now = new Date();
    const initialLogs = Array.from({ length: 8 }).map((_, idx) => {
      const time = new Date(now.getTime() - (8 - idx) * 3000).toLocaleTimeString();
      const template = TEMPLATE_LOGS[idx % TEMPLATE_LOGS.length];
      return { ...template, time };
    });
    setLogs(initialLogs);

    // Dynamic feed intervals
    const interval = setInterval(() => {
      const time = new Date().toLocaleTimeString();
      const template = TEMPLATE_LOGS[Math.floor(Math.random() * TEMPLATE_LOGS.length)];
      
      setLogs(prev => [...prev.slice(-40), { ...template, time }]); // keep last 40 logs
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColors = (log: LogMessage) => {
    if (log.type === "SYS") return "text-cyber-green";
    if (log.type === "SOAR") return "text-cyber-blue";
    if (log.type === "HUNT") return "text-cyber-purple";
    if (log.severity === "CRITICAL") return "text-cyber-red font-semibold";
    if (log.severity === "HIGH") return "text-cyber-orange";
    return "text-muted-foreground";
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 p-3 bg-black/40 overflow-y-auto font-mono text-[9px] space-y-2 scrollbar-none h-full border border-white/5 rounded-lg max-h-[360px]"
    >
      {logs.map((log, index) => (
        <div key={index} className="flex gap-2 items-start tracking-tight border-b border-white/[0.02] pb-1">
          <span className="text-muted-foreground/60 select-none">[{log.time}]</span>
          <span className={`px-1 py-0.5 rounded text-[8px] bg-secondary leading-none uppercase shrink-0 ${
            log.type === "THREAT" ? "text-cyber-red" :
            log.type === "SOAR" ? "text-cyber-blue" :
            log.type === "INCIDENT" ? "text-cyber-orange" : "text-cyber-purple"
          }`}>
            {log.type}
          </span>
          <span className={`flex-1 break-all ${getLogColors(log)}`}>
            {log.message}
          </span>
        </div>
      ))}
    </div>
  );
}
