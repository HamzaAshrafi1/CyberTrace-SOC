"use client";

import React, { useState } from "react";
import { 
  Activity, RefreshCw, CheckCircle2, AlertOctagon, 
  ChevronDown, ChevronUp, Terminal as TerminalIcon, Search 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface ExecutionLog {
  id: string;
  playbookName: string;
  eventId: string | null;
  status: string;
  message: string;
  startedAt: string;
  completedAt: string;
}

interface LogsClientProps {
  initialLogs: ExecutionLog[];
}

export default function LogsClient({ initialLogs }: LogsClientProps) {
  const router = useRouter();
  const logs = initialLogs;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRefresh = () => {
    router.refresh();
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // Filter logs based on search term & status
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.playbookName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (log.eventId && log.eventId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "ALL" || 
                          (statusFilter === "SUCCESS" && log.status === "success") ||
                          (statusFilter === "FAILED" && log.status !== "success");

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <TerminalIcon className="w-6 h-6 text-cyber-blue" />
            SOAR Execution Audits
          </h1>
          <p className="text-xs text-muted-foreground">
            Audit logs for active playbook rule executions and step transitions.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="h-9 border-border bg-card/40 flex items-center gap-2 hover:bg-secondary/40 font-mono text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          REFRESH LOGS
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by playbook name or event ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-cyber-blue"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-cyber-blue"
        >
          <option value="ALL">ALL STATUSES</option>
          <option value="SUCCESS">SUCCESS ONLY</option>
          <option value="FAILED">FAILED ONLY</option>
        </select>
      </div>

      {/* Logs Table */}
      <Card className="border-border bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyber-blue" />
            Execution Chronology
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-mono text-[10px] text-muted-foreground">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Playbook Name</th>
                  <th className="p-3">Trigger Event ID</th>
                  <th className="p-3">Outcome</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Executed Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const isExpanded = expandedId === log.id;
                    const durationMs = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime();
                    
                    return (
                      <React.Fragment key={log.id}>
                        <tr 
                          onClick={() => toggleExpand(log.id)}
                          className="hover:bg-muted/10 transition-colors cursor-pointer"
                        >
                          <td className="p-3 text-center">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </td>
                          <td className="p-3 font-semibold text-foreground/90 font-sans text-xs">
                            {log.playbookName}
                          </td>
                          <td className="p-3 text-muted-foreground truncate max-w-[150px]">
                            {log.eventId || "Ingress Node"}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={`text-[9px] font-sans flex items-center gap-1 w-max ${
                              log.status === "success" 
                                ? "bg-cyber-green/10 text-cyber-green border-cyber-green/30" 
                                : "bg-cyber-red/10 text-cyber-red border-cyber-red/30"
                            }`}>
                              {log.status === "success" ? (
                                <><CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS</>
                              ) : (
                                <><AlertOctagon className="w-3.5 h-3.5" /> FAILURE</>
                              )}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {durationMs}ms
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(log.startedAt).toLocaleString()}
                          </td>
                        </tr>

                        {/* Collapsible details row */}
                        {isExpanded && (
                          <tr className="bg-black/20">
                            <td colSpan={6} className="p-4 border-t border-b border-border/40">
                              <div className="space-y-2">
                                <span className="text-[9px] font-mono uppercase text-muted-foreground block">
                                  Action Execution Flow Logs
                                </span>
                                <pre className="bg-[#05010a] border border-white/5 rounded-lg p-3 text-[10px] text-white/80 overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                  {log.message || "No logs captured during execution."}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground text-[11px] font-sans">
                      No playbook execution logs found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
