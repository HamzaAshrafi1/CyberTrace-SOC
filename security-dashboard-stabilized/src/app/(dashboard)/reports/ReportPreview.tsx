"use client";

import React from "react";
import { Shield, User, Calendar, Database, Clock, Award, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ReportPreviewProps {
  report: {
    id: string;
    type: string;
    title: string;
    generatedBy: string;
    createdAt: string | Date;
    metadata: string;
  };
}

export default function ReportPreview({
  report,
}: ReportPreviewProps) {
  let meta: any = {};
  try {
    meta = JSON.parse(report.metadata);
  } catch (e) {
    console.error("Failed to parse report metadata JSON", e);
  }

  const generatedDate = new Date(report.createdAt).toUTCString().replace("GMT", "UTC");

  return (
    <div id="report-preview-sheet" className="bg-card border border-border rounded-xl p-8 max-w-4xl mx-auto shadow-lg relative print-report-container">
      
      {/* Print Style Config */}
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
            margin: 0 !important;
          }
          .print-report-container {
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            position: absolute;
            left: 0;
            top: 0;
          }
          .card, table, tr, td, th {
            border: 1px solid #ddd !important;
            background: transparent !important;
            color: black !important;
            box-shadow: none !important;
          }
          span, p, h1, h2, h3, div, td, th {
            color: black !important;
          }
          .recharts-responsive-container {
            width: 100% !important;
            height: 250px !important;
          }
        }
      `}</style>

      {/* Header Branding Row */}
      <div className="flex justify-between items-start border-b border-border/80 pb-6 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue rounded-lg print:border-black print:text-black">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase">Aegis SOC</h2>
            <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest">Enterprise SaaS Portal</p>
          </div>
        </div>

        <div className="text-right text-[10px] font-mono text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5 justify-end">
            <Calendar className="w-3.5 h-3.5" /> Date: {generatedDate}
          </p>
          <p className="flex items-center gap-1.5 justify-end">
            <User className="w-3.5 h-3.5" /> Compiler: {report.generatedBy}
          </p>
          <p className="flex items-center gap-1.5 justify-end">
            <Database className="w-3.5 h-3.5" /> ID: {report.id}
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2 mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground print:text-black">
          {report.title}
        </h1>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
          Security Classification: Internal Use Only
        </p>
      </div>

      {/* Report Category Previews */}
      
      {/* 1. THREAT INTEL */}
      {report.type === "threat_intel" && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Total Blocked</span>
              <p className="text-2xl font-extrabold font-mono text-cyber-blue mt-1">{meta.totalThreats}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Critical Alarms</span>
              <p className="text-2xl font-extrabold font-mono text-cyber-red mt-1">{meta.severityBreakdown?.CRITICAL || 0}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">High Severity</span>
              <p className="text-2xl font-extrabold font-mono text-cyber-orange mt-1">{meta.severityBreakdown?.HIGH || 0}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Clean Events</span>
              <p className="text-2xl font-extrabold font-mono text-cyber-green mt-1">{meta.typeBreakdown?.CLEAN || 0}</p>
            </div>
          </div>

          {/* Recharts Threat Trend Bar */}
          {meta.trendData && meta.trendData.length > 0 && (
            <div className="bg-background/40 border border-border p-4 rounded-xl print:border-gray-300">
              <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Threat Activities Timeline</h3>
              <div className="h-60 w-full font-mono text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={meta.trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" stroke="#888" fontSize={9} />
                    <YAxis stroke="#888" fontSize={9} />
                    <Tooltip contentStyle={{ background: "#222", border: "1px solid #444", fontSize: 9 }} />
                    <Bar dataKey="count" fill="oklch(0.7 0.19 200)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sources and Targets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Source IPs */}
            <Card className="border-border bg-background/20 print:border-gray-300">
              <CardHeader className="py-2.5 px-4 border-b border-border bg-secondary/10 print:border-gray-300">
                <CardTitle className="text-[10px] font-mono uppercase text-muted-foreground">Top Attacking Source IPs</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border print:border-gray-300">
                    <TableHead className="text-xs">IP Address</TableHead>
                    <TableHead className="text-xs text-right font-mono">Incident count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meta.topSources?.map((src: any, i: number) => (
                    <TableRow key={i} className="border-b border-border/60 print:border-gray-300">
                      <TableCell className="text-xs font-mono text-cyber-blue">{src.ip}</TableCell>
                      <TableCell className="text-xs font-mono text-right">{src.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Top Targets */}
            <Card className="border-border bg-background/20 print:border-gray-300">
              <CardHeader className="py-2.5 px-4 border-b border-border bg-secondary/10 print:border-gray-300">
                <CardTitle className="text-[10px] font-mono uppercase text-muted-foreground">Top Targeted Gateways</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border print:border-gray-300">
                    <TableHead className="text-xs">Target Node</TableHead>
                    <TableHead className="text-xs text-right font-mono">Incident count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meta.topTargets?.map((tgt: any, i: number) => (
                    <TableRow key={i} className="border-b border-border/60 print:border-gray-300">
                      <TableCell className="text-xs font-semibold">{tgt.target}</TableCell>
                      <TableCell className="text-xs font-mono text-right">{tgt.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      )}

      {/* 2. INCIDENT RESPONSE */}
      {report.type === "incident_response" && (
        <div className="space-y-6">
          {/* KPI Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Logged Tickets</span>
              <p className="text-2xl font-extrabold font-mono text-foreground mt-1">{meta.totalIncidents}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Unresolved status</span>
              <p className="text-2xl font-extrabold font-mono text-cyber-red mt-1">{meta.openIncidents}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Resolved tickets</span>
              <p className="text-2xl font-extrabold font-mono text-cyber-green mt-1">{meta.resolvedIncidents}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">MRT Mean Time</span>
              <p className="text-2xl font-extrabold font-mono text-cyber-blue mt-1 flex items-center justify-center gap-1">
                {meta.meanResolutionTimeHr} <span className="text-xs text-muted-foreground font-sans">hr</span>
              </p>
            </div>
          </div>

          {/* Timeline Table */}
          <Card className="border-border bg-background/20 print:border-gray-300">
            <CardHeader className="py-2.5 px-4 border-b border-border bg-secondary/10 print:border-gray-300">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4 text-cyber-blue" /> Historical Incident Triage Timeline
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader className="bg-background/40">
                <TableRow className="border-b border-border print:border-gray-300">
                  <TableHead className="text-xs">Date Logged</TableHead>
                  <TableHead className="text-xs">Incident Ticket Title</TableHead>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-right text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta.timeline && meta.timeline.length > 0 ? (
                  meta.timeline.map((item: any, i: number) => (
                    <TableRow key={i} className="border-b border-border/60 print:border-gray-300 text-xs">
                      <TableCell className="font-mono text-muted-foreground">{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString()}</TableCell>
                      <TableCell className="font-semibold text-foreground">{item.title}</TableCell>
                      <TableCell className="font-semibold">
                        <span className={item.severity === "CRITICAL" ? "text-cyber-red" : item.severity === "HIGH" ? "text-cyber-orange" : "text-foreground"}>
                          {item.severity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right capitalize font-mono">{item.status}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">No incident history logged.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* 3. COMPLIANCE */}
      {report.type === "compliance" && (
        <div className="space-y-6">
          {/* overall score */}
          <div className="flex items-center gap-4 bg-secondary/15 border border-border p-5 rounded-xl print:border-gray-300">
            <Award className="w-10 h-10 text-cyber-blue shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-mono">Overall Compliance Health</p>
              <h3 className="text-2xl font-bold font-mono text-cyber-green">{meta.overallScore}% Rating</h3>
            </div>
          </div>

          {/* Scores breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meta.frameworkScores?.map((fw: any, i: number) => (
              <div key={i} className="p-4 bg-background/40 border border-border rounded-xl flex items-center justify-between print:border-gray-300">
                <span className="text-xs font-semibold">{fw.framework}</span>
                <span className="text-sm font-bold font-mono text-cyber-blue">{fw.score}% Score</span>
              </div>
            ))}
          </div>

          {/* Deficiencies Checklist */}
          <Card className="border-border bg-background/20 print:border-gray-300">
            <CardHeader className="py-2.5 px-4 border-b border-border bg-secondary/10 print:border-gray-300">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-cyber-orange" /> Warnings and Failed Control Checkpoints
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border print:border-gray-300">
                  <TableHead className="text-xs">Objective Control</TableHead>
                  <TableHead className="text-xs">Objective Description</TableHead>
                  <TableHead className="text-xs">Action Remediation Checklist</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta.failedControls && meta.failedControls.length > 0 ? (
                  meta.failedControls.map((fc: any, i: number) => {
                    const rem = meta.remediations?.[i]?.advise || "Inspect configurations.";
                    return (
                      <TableRow key={i} className="border-b border-border/60 print:border-gray-300 text-xs">
                        <TableCell className="font-semibold text-cyber-orange">{fc.framework}</TableCell>
                        <TableCell className="text-muted-foreground">{fc.description}</TableCell>
                        <TableCell className="italic text-foreground">{rem}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-xs text-cyber-green font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4.5 h-4.5" /> All control checks satisfying compliant parameters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* 4. EXECUTIVE SUMMARY */}
      {report.type === "executive_summary" && (
        <div className="space-y-6">
          {/* Key KPI summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Blocked Threats</span>
              <p className="text-xl font-extrabold font-mono text-cyber-blue mt-1">{meta.totalThreats}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Active Incidents</span>
              <p className="text-xl font-extrabold font-mono text-cyber-red mt-1">{meta.openIncidents}</p>
            </div>
            <div className="bg-background/40 border border-border p-4 rounded-xl text-center print:border-gray-300">
              <span className="text-[9px] text-muted-foreground font-mono uppercase">Compliance Rating</span>
              <p className="text-xl font-extrabold font-mono text-cyber-green mt-1">{meta.overallComplianceScore}%</p>
            </div>
          </div>

          {/* AI generated Summary block */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase text-cyber-blue flex items-center gap-1">
              <FileText className="w-4 h-4" /> CISO Executive Briefing
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground bg-secondary/5 border border-border p-4 rounded-xl print:border-gray-300">
              {meta.aiSummary}
            </p>
          </div>

          {/* AI Risk Assessment */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase text-cyber-orange flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Infrastructure Risk Assessment
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground bg-secondary/5 border border-border p-4 rounded-xl print:border-gray-300">
              {meta.riskAssessment}
            </p>
          </div>

          {/* Recommendations checklist */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase text-cyber-green flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Recommended Actions Checklist
            </h3>
            <div className="bg-secondary/5 border border-border p-4 rounded-xl space-y-2 print:border-gray-300">
              {meta.recommendations?.map((rec: string, i: number) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-cyber-green font-bold shrink-0">{i+1}.</span>
                  <p>{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Classification and Sign-off */}
      <div className="border-t border-border/80 pt-6 mt-8 flex justify-between items-center text-[8px] font-mono text-muted-foreground uppercase">
        <span>Aegis SOC Security Operations Workspace • Confidential Summary</span>
        <span>Generated by operator {report.generatedBy}</span>
      </div>

    </div>
  );
}
