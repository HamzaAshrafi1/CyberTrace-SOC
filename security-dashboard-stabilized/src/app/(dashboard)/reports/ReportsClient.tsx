"use client";

import React, { useState } from "react";
import { 
  FileText, Calendar, 
  FileSignature, RefreshCw, 
  Trash2, Printer, AlertTriangle, Play
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateSecurityReportAction, deleteReportAction } from "./actions";
import ReportPreview from "./ReportPreview";

interface ReportItem {
  id: string;
  type: string;
  title: string;
  generatedBy: string;
  createdAt: string;
  metadata: string;
}

interface ReportsClientProps {
  initialHistory: ReportItem[];
}

export default function ReportsClient({
  initialHistory,
}: ReportsClientProps) {
  const [history, setHistory] = useState<ReportItem[]>(initialHistory);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    initialHistory.length > 0 ? initialHistory[0].id : null
  );

  // Generate form states
  const [reportType, setReportType] = useState<string>("executive_summary");
  const [reportTitle, setReportTitle] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeReport = history.find((r) => r.id === selectedReportId);

  // Trigger report compilation
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompiling(true);
    setErrorMessage(null);

    const defaultTitles: Record<string, string> = {
      threat_intel: "Threat Intelligence & Signatures Audit Digest",
      incident_response: "Incident Response and Ticket Resolution Audit Log",
      compliance: "Framework Compliance Posture Audit Report",
      executive_summary: "Autonomous SOC CISO Executive Security Summary",
    };

    const finalTitle = reportTitle.trim() || defaultTitles[reportType] || "SOC Security Audit Summary";

    try {
      const newReport = await generateSecurityReportAction(reportType, finalTitle);
      
      const mappedReport: ReportItem = {
        id: newReport.id,
        type: newReport.type,
        title: newReport.title,
        generatedBy: newReport.generatedBy,
        createdAt: newReport.createdAt.toISOString(),
        metadata: newReport.metadata,
      };

      setHistory((prev) => [mappedReport, ...prev]);
      setSelectedReportId(newReport.id);
      setReportTitle("");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to compile security report.");
    } finally {
      setIsCompiling(false);
    }
  };

  // Delete report
  const handleDeleteReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      setErrorMessage(null);
      await deleteReportAction(id);
      setHistory((prev) => prev.filter((r) => r.id !== id));
      if (selectedReportId === id) {
        const remaining = history.filter((r) => r.id !== id);
        setSelectedReportId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete report.");
    }
  };

  // Print trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
            Executive Security Reports
          </h1>
          <p className="text-xs text-muted-foreground">
            Compile, preview, and download CISO-ready security summaries, incident audits, and compliance metrics.
          </p>
        </div>
      </div>

      {/* Row 1: Generate Control Form Panel */}
      <Card className="border-border bg-card/45 no-print">
        <CardHeader className="py-3 px-4 border-b border-border/60">
          <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
            <FileSignature className="w-4 h-4 text-cyber-blue" /> Configure Live Report Compilation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form onSubmit={handleGenerateReport} className="flex flex-col md:flex-row gap-4 items-end">
            
            {/* Category selection */}
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Report Category Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-9 bg-background/50 border border-border rounded-lg px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyber-blue/60"
              >
                <option value="executive_summary">Executive Security Summary (AI-generated)</option>
                <option value="threat_intel">Threat Intelligence Audit Digest</option>
                <option value="incident_response">Incident Response & MRT Log</option>
                <option value="compliance">Framework Compliance Posture</option>
              </select>
            </div>

            {/* Custom title input */}
            <div className="flex-[1.5] space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Custom Document Title (Optional)</label>
              <input
                type="text"
                placeholder="Defaults to standard CISO classification titles..."
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full h-9 bg-background/50 border border-border rounded-lg px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyber-blue/60"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isCompiling}
              className="bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity h-9 px-6 border border-primary/20 flex items-center gap-1.5"
            >
              {isCompiling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Compiling Data...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Generate Audit Report
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error displays */}
      {errorMessage && (
        <div className="p-3 bg-cyber-red/5 border border-cyber-red/20 rounded-xl flex items-center gap-2 text-xs text-cyber-red no-print">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Row 2: Archives and Previews */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Col: Historical Archives list */}
        <div className="lg:col-span-2 space-y-4 no-print">
          <Card className="border-border bg-card/40 flex flex-col h-[500px] overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4 text-cyber-blue" /> Report Archives
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
              {history.map((rep) => {
                const isActive = rep.id === selectedReportId;
                const formattedDate = new Date(rep.createdAt).toISOString().split('T')[0];
                const typeLabels: Record<string, string> = {
                  threat_intel: "Threat Intel",
                  incident_response: "Incident MRT",
                  compliance: "Compliance",
                  executive_summary: "Executive",
                };
                
                return (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedReportId(rep.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer border text-xs transition-all ${
                      isActive
                        ? "bg-cyber-blue/10 border-cyber-blue/20 text-cyber-blue"
                        : "border-transparent text-muted-foreground hover:bg-secondary/25 hover:text-foreground"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-semibold truncate text-foreground">{rep.title}</p>
                      <p className="text-[8px] font-mono text-muted-foreground uppercase mt-0.5" suppressHydrationWarning>
                        {typeLabels[rep.type] || "Audit"} • {formattedDate}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDeleteReport(e, rep.id)}
                        className="p-1 text-muted-foreground/60 hover:text-cyber-red rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {history.length === 0 && (
                <div className="text-center py-12 text-xs text-muted-foreground font-mono uppercase">
                  No generated reports found. Use compiler above to build reports.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Active Report Preview workspace */}
        <div className="lg:col-span-3 space-y-4">
          {activeReport ? (
            <div className="space-y-4">
              
              {/* Preview controls bar */}
              <div className="flex justify-end gap-2.5 no-print">
                <Button
                  onClick={handlePrint}
                  className="bg-cyber-blue text-background font-semibold hover:bg-cyber-blue/80 text-xs h-9 flex items-center gap-1.5 px-4"
                >
                  <Printer className="w-4 h-4" /> Export / Print PDF
                </Button>
              </div>

              {/* Printable sheet */}
              <ReportPreview report={activeReport} />

            </div>
          ) : (
            <Card className="border-border bg-card/25 border-dashed h-[500px] flex flex-col items-center justify-center text-center p-6 no-print">
              <FileText className="w-10 h-10 text-muted-foreground/40 mb-3 animate-pulse" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-widest font-mono">No Report Selected</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-normal">
                Select a compiled report from the archives list or generate a new one to preview.
              </p>
            </Card>
          )}
        </div>

      </div>

    </div>
  );
}
