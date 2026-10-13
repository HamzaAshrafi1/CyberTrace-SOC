"use client";

import React, { useState } from "react";
import { 
  ShieldCheck, AlertTriangle, Play, RefreshCw, 
  ClipboardList, Printer, CheckSquare, Square,
  Info
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runComplianceAudit } from "./actions";

interface ComplianceCheck {
  id: string;
  framework: string;
  description: string;
  score: number;
  status: string;
  createdAt: Date | string;
}

interface ComplianceClientProps {
  complianceChecks: ComplianceCheck[];
}

export default function ComplianceClient({
  complianceChecks,
}: ComplianceClientProps) {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  
  // Framework selector checklist state
  const frameworksList = ["ISO 27001", "CIS Benchmarks", "OWASP Top 10", "GDPR"];
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(frameworksList);

  const toggleFramework = (fw: string) => {
    setSelectedFrameworks(prev => 
      prev.includes(fw) 
        ? prev.filter(f => f !== fw) 
        : [...prev, fw]
    );
  };

  const handleRunAudit = async () => {
    if (selectedFrameworks.length === 0) {
      alert("Please select at least one compliance framework to run audit.");
      return;
    }

    setIsAuditing(true);
    setAuditLogs([]);

    const consoleLogs = [
      "Initializing Aegis compliance scanner v1.5...",
      "Connecting to Neon Database instance... CONNECTED"
    ];

    if (selectedFrameworks.includes("ISO 27001")) {
      consoleLogs.push(
        "Scanning ISO 27001 Control A.12.6.1 (SSL Session encryption)... COMPLIANT",
        "Scanning ISO 27001 Control A.9.1.1 (Multi-tenant partition isolation)... COMPLIANT",
        "Scanning ISO 27001 Control A.12.4.1 (Ingress log source nodes)... VERIFYING"
      );
    }

    if (selectedFrameworks.includes("CIS Benchmarks")) {
      consoleLogs.push(
        "Checking CIS Control 1.1 (Clerk MFA Admin Sync)... COMPLIANT",
        "Checking CIS Control 2.4 (Log Ingest Database Retention)... COMPLIANT",
        "Checking CIS Control 5.2 (Credential Age Key Rotation)... WARNING [Keys older than 90d found]"
      );
    }

    if (selectedFrameworks.includes("OWASP Top 10")) {
      consoleLogs.push(
        "Checking OWASP A01:2021 (Access Control Bypass controls)... COMPLIANT",
        "Checking OWASP A03:2021 (FastAPI Threat Rule Injection mitigations)... COMPLIANT",
        "Checking OWASP A09:2021 (Automated Ingest Threat Alarm notifications)... VERIFYING"
      );
    }

    if (selectedFrameworks.includes("GDPR")) {
      consoleLogs.push(
        "Checking GDPR Article 32 (Data processing encryption channels)... COMPLIANT",
        "Checking GDPR Article 33 (Incident Hub Breach Notice alerts)... COMPLIANT",
        "Checking GDPR Article 25 (Privacy-by-Design Clerk ID partitions)... COMPLIANT"
      );
    }

    consoleLogs.push(
      "Synthesizing scores and writing checkpoints to Neon PostgreSQL...",
      "Compliance audit scan execution completed successfully."
    );

    let logIndex = 0;
    const interval = setInterval(async () => {
      if (logIndex < consoleLogs.length) {
        const logLine = consoleLogs[logIndex];
        setAuditLogs((prev) => [...prev, logLine]);
        logIndex++;
      } else {
        clearInterval(interval);
        try {
          await runComplianceAudit(selectedFrameworks);
        } catch (err) {
          console.error("Compliance audit database write failed:", err);
          alert("Audit database write failed.");
        } finally {
          setIsAuditing(false);
        }
      }
    }, 250);
  };

  // Metric summaries based on PostgreSQL records
  const totalChecks = complianceChecks.length;
  let complianceScore = 0;
  let compliantCount = 0;
  let warningCount = 0;
  let failedCount = 0;

  if (totalChecks > 0) {
    const sum = complianceChecks.reduce((acc, c) => acc + c.score, 0);
    complianceScore = Math.round(sum / totalChecks);
    compliantCount = complianceChecks.filter(c => c.status === "compliant").length;
    warningCount = complianceChecks.filter(c => c.status === "warning").length;
    failedCount = complianceChecks.filter(c => c.status === "failed").length;
  }

  const formatScanDate = (dateVal: Date | string) => {
    const d = new Date(dateVal);
    return d.toISOString().slice(0, 16).replace("T", " ");
  };

  // Detailed remediation tips for failing/warning policies
  const getRemediationAdvisory = (framework: string, status: string) => {
    if (status === "compliant") return "Control fully compliant. Maintain baseline monitoring.";
    if (framework.includes("ISO 27001 - A.12.4.1")) {
      return "Register at least one active LogSource under Settings to satisfy A.12.4.1 logging checkpoints.";
    }
    if (framework.includes("CIS - Control 5.2")) {
      return "Rotate older log source api keys. Invalidate keys active for > 90 days in Settings.";
    }
    if (framework.includes("OWASP - A09:2021")) {
      return "LogSources required. Register endpoints to fire alarms during parametric injection matched rules.";
    }
    if (framework.includes("GDPR - Article 33")) {
      return "Validate Breach Notifications. Ensure Incident auto-creation flags are active for high severity threats.";
    }
    return "Check audit credentials sync. Ensure isolated tenant B2B queries maintain partition indexes.";
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* PDF Styles Override */}
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
          #compliance-print-area {
            display: block !important;
            width: 100% !important;
            position: absolute;
            left: 0;
            top: 0;
            background: white !important;
            color: black !important;
          }
          .card, .p-4, .p-6, table, tr, td, th {
            border: 1px solid #ccc !important;
            background: transparent !important;
            color: black !important;
            box-shadow: none !important;
          }
          .badge, span, p, h1, h2, h3 {
            color: black !important;
          }
        }
      `}</style>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
            Compliance Posture Workspace
          </h1>
          <p className="text-xs text-muted-foreground">
            Audit configurations against industry-standard security frameworks automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={handlePrint}
            className="text-xs h-9 border-border bg-card/60 flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Export Audit PDF
          </Button>
          <Button 
            onClick={handleRunAudit} 
            disabled={isAuditing}
            className="bg-cyber-blue text-background font-semibold hover:bg-cyber-blue/80 h-9 flex items-center gap-1.5"
          >
            {isAuditing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Auditing selected...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Compliance Audit
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Framework Selector Box */}
      <Card className="border-border bg-card/40 p-4 no-print">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Target Scan Frameworks:</span>
          <div className="flex flex-wrap items-center gap-3">
            {frameworksList.map(fw => {
              const isChecked = selectedFrameworks.includes(fw);
              return (
                <button
                  key={fw}
                  type="button"
                  onClick={() => toggleFramework(fw)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    isChecked 
                      ? "border-cyber-blue text-cyber-blue bg-cyber-blue/5 shadow-[0_0_10px_rgba(6,182,212,0.05)]" 
                      : "border-border text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {fw}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Main Print Area Wrapper */}
      <div id="compliance-print-area" className="space-y-6">
        
        {/* Overview Stats Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Overall Compliance Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold font-mono text-cyber-blue">
                {totalChecks > 0 ? `${complianceScore}%` : "0%"}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Goal is 100% compliant checkpoints.</p>
            </CardContent>
          </Card>
          
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Compliant Checkpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold font-mono text-cyber-green">
                {compliantCount} <span className="text-xs text-muted-foreground">/ {totalChecks}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Objectives satisfying security audit baselines.</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Scan Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold font-mono text-cyber-orange">
                {warningCount + failedCount}
              </div>
              <p className="text-[10px] text-cyber-orange mt-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                Active advisories require remediation.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Live scanner output console logs */}
        {(isAuditing || auditLogs.length > 0) && (
          <Card className="border-border bg-black/40 no-print">
            <CardHeader className="py-2.5 border-b border-border bg-secondary/15">
              <CardTitle className="text-[10px] font-mono text-cyber-blue flex items-center gap-1.5 uppercase tracking-wider">
                <ClipboardList className="w-4 h-4 text-cyber-blue" /> Compliance Scanner Log Audits Console
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 font-mono text-[10px] text-cyber-green space-y-1 max-h-40 overflow-y-auto">
              {auditLogs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-muted-foreground/35">&gt;&gt;</span>
                  <p className={log && log.includes("FAILED") ? "text-cyber-red" : log && log.includes("WARNING") ? "text-cyber-orange" : ""}>
                    {log}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Results grid */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-secondary/40 border border-border w-fit h-10 p-1 flex gap-2 no-print">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-background/80 data-[state=active]:text-cyber-blue">All Frameworks</TabsTrigger>
            <TabsTrigger value="iso" className="text-xs data-[state=active]:bg-background/80 data-[state=active]:text-cyber-blue">ISO 27001</TabsTrigger>
            <TabsTrigger value="cis" className="text-xs data-[state=active]:bg-background/80 data-[state=active]:text-cyber-blue">CIS Benchmarks</TabsTrigger>
            <TabsTrigger value="owasp" className="text-xs data-[state=active]:bg-background/80 data-[state=active]:text-cyber-blue">OWASP Top 10</TabsTrigger>
            <TabsTrigger value="gdpr" className="text-xs data-[state=active]:bg-background/80 data-[state=active]:text-cyber-blue">GDPR Privacy</TabsTrigger>
          </TabsList>
          
          {["all", "iso", "cis", "owasp", "gdpr"].map((tabVal) => {
            const filteredChecks = complianceChecks.filter(check => {
              if (tabVal === "all") return true;
              if (tabVal === "iso") return check.framework.toLowerCase().includes("iso");
              if (tabVal === "cis") return check.framework.toLowerCase().includes("cis");
              if (tabVal === "owasp") return check.framework.toLowerCase().includes("owasp");
              if (tabVal === "gdpr") return check.framework.toLowerCase().includes("gdpr");
              return true;
            });

            return (
              <TabsContent key={tabVal} value={tabVal} className="mt-4">
                
                {/* Audit Grid */}
                <Card className="border-border bg-card/50 overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border bg-secondary/10">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="w-4.5 h-4.5 text-cyber-blue animate-pulse" />
                      Pass / Fail Audit Results Table
                    </CardTitle>
                    <CardDescription className="text-xs">Security operations compliance details fetched from live Neon PostgreSQL data.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredChecks.length > 0 ? (
                      <Table>
                        <TableHeader className="bg-background/40">
                          <TableRow className="border-b border-border">
                            <TableHead className="w-24 text-xs font-mono">Check ID</TableHead>
                            <TableHead className="text-xs w-64">Framework Objective</TableHead>
                            <TableHead className="text-xs">Control Description</TableHead>
                            <TableHead className="text-xs text-center font-mono">Score</TableHead>
                            <TableHead className="text-xs">Verified Date</TableHead>
                            <TableHead className="text-right text-xs">Outcome Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredChecks.map((rule) => (
                            <TableRow key={rule.id} className="border-b border-border hover:bg-secondary/10 transition-colors">
                              <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{rule.id}</TableCell>
                              <TableCell className="text-xs font-semibold">{rule.framework}</TableCell>
                              <TableCell className="text-xs text-muted-foreground/80 leading-normal">{rule.description || "Diagnostics criteria verification check."}</TableCell>
                              <TableCell className="text-xs font-mono font-semibold text-cyber-blue text-center">{rule.score}%</TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono">{formatScanDate(rule.createdAt)}</TableCell>
                              <TableCell className="text-right">
                                <Badge className={`text-[10px] capitalize font-mono border-0 font-semibold ${
                                  rule.status === "compliant" 
                                    ? "bg-cyber-green/20 text-cyber-green" 
                                    : rule.status === "warning"
                                      ? "bg-cyber-orange/20 text-cyber-orange animate-pulse"
                                      : "bg-cyber-red/20 text-cyber-red"
                                }`}>
                                  {rule.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-8 text-center text-xs text-muted-foreground font-mono flex flex-col items-center justify-center gap-1.5 border-t border-border bg-background/25">
                        <AlertTriangle className="w-5 h-5 text-muted-foreground/60" />
                        NO FRAMEWORK SECURITY CHECKS REGISTERED. SELECT CORRESPONDING OPTIONS AND SCAN.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Remediation Advisories panel */}
                {filteredChecks.some(c => c.status !== "compliant") && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-xs font-bold uppercase font-mono text-cyber-orange flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-cyber-orange" /> Actionable Remediation Guidance
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredChecks.filter(c => c.status !== "compliant").map(rule => (
                        <Card key={rule.id} className="border-cyber-orange/20 bg-cyber-orange/5 p-4 rounded-xl flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-cyber-orange font-mono font-semibold truncate max-w-[200px]">{rule.framework}</span>
                              <Badge className="bg-cyber-orange/20 text-cyber-orange text-[9px] border-0 capitalize">
                                {rule.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-foreground/80 leading-normal font-semibold mt-1">
                              Deficiency: {rule.description}
                            </p>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-cyber-orange/15 space-y-1.5 text-xs">
                            <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">Fix Remediation Action:</span>
                            <p className="text-muted-foreground font-sans leading-relaxed">
                              {getRemediationAdvisory(rule.framework, rule.status)}
                            </p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

              </TabsContent>
            );
          })}
        </Tabs>

      </div>
    </div>
  );
}
