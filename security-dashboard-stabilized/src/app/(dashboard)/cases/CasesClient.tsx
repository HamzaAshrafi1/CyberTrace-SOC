"use client";

import React, { useState, useTransition } from "react";
import { 
  Briefcase, Plus, FolderOpen, Calendar, 
  User, AlertTriangle, Paperclip, 
  FileSpreadsheet, Trash2, Link as LinkIcon
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { createCaseAction, updateCaseStatusAction, linkIncidentToCaseAction } from "./actions";

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
}

interface Evidence {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  createdAt: string;
}

interface Case {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  incidents: Incident[];
  evidence: Evidence[];
}

interface UnassignedIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
}

interface CasesClientProps {
  orgId: string;
  initialCases: Case[];
  unassignedIncidents: UnassignedIncident[];
}

export default function CasesClient({ initialCases, unassignedIncidents }: CasesClientProps) {
  const [cases, setCases] = useState<Case[]>(initialCases);
  const [unassignedInc, setUnassignedInc] = useState<UnassignedIncident[]>(unassignedIncidents);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCases[0]?.id || null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Selected case object
  const selectedCase = cases.find(c => c.id === selectedCaseId);

  // Link Incident Form State
  const [incidentToLink, setIncidentToLink] = useState<string>("");

  // Create Case Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [assignedTo, setAssignedTo] = useState("Unassigned");

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    
    startTransition(async () => {
      try {
        const newCase = await createCaseAction({ title, description, severity, assignedTo });
        
        // Update local state
        const mappedCase: Case = {
          id: newCase.id,
          title: newCase.title,
          description: newCase.description,
          status: newCase.status,
          severity: newCase.severity,
          assignedTo: newCase.assignedTo,
          createdAt: newCase.createdAt.toISOString(),
          updatedAt: newCase.updatedAt.toISOString(),
          incidents: [],
          evidence: []
        };
        setCases(prev => [mappedCase, ...prev]);
        setSelectedCaseId(mappedCase.id);
        setIsOpen(false);
        
        // Reset form
        setTitle("");
        setDescription("");
        setSeverity("MEDIUM");
        setAssignedTo("Unassigned");
      } catch (err) {
        console.error("Error creating case:", err);
      }
    });
  };

  const handleStatusChange = (caseId: string, newStatus: string) => {
    startTransition(async () => {
      try {
        await updateCaseStatusAction(caseId, newStatus);
        setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus } : c));
      } catch (err) {
        console.error("Error updating status:", err);
      }
    });
  };

  const handleLinkIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !incidentToLink) return;

    const incObj = unassignedInc.find(i => i.id === incidentToLink);
    if (!incObj) return;

    startTransition(async () => {
      try {
        await linkIncidentToCaseAction(incidentToLink, selectedCaseId);
        
        // Update local cases state
        setCases(prev => prev.map(c => {
          if (c.id === selectedCaseId) {
            return {
              ...c,
              incidents: [...c.incidents, {
                id: incObj.id,
                title: incObj.title,
                severity: incObj.severity,
                status: incObj.status
              }]
            };
          }
          return c;
        }));

        // Remove from unassignedInc
        setUnassignedInc(prev => prev.filter(i => i.id !== incidentToLink));
        setIncidentToLink("");
      } catch (err) {
        console.error("Error linking incident:", err);
      }
    });
  };

  const handleUnlinkIncident = (incidentId: string) => {
    if (!selectedCaseId) return;

    startTransition(async () => {
      try {
        await linkIncidentToCaseAction(incidentId, null);
        
        // Update local cases state
        setCases(prev => prev.map(c => {
          if (c.id === selectedCaseId) {
            // Find incident to add back to unassigned list
            const unlinked = c.incidents.find(i => i.id === incidentId);
            if (unlinked) {
              setUnassignedInc(prevUn => [
                {
                  id: unlinked.id,
                  title: unlinked.title,
                  severity: unlinked.severity,
                  status: unlinked.status,
                  createdAt: new Date().toISOString()
                },
                ...prevUn
              ]);
            }
            return {
              ...c,
              incidents: c.incidents.filter(i => i.id !== incidentId)
            };
          }
          return c;
        }));
      } catch (err) {
        console.error("Error unlinking incident:", err);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-cyber-blue" />
            Case Management Workspace
          </h1>
          <p className="text-xs text-muted-foreground">
            Aggregate related security incidents, manage evidence checklists, and assign response priorities.
          </p>
        </div>

        {/* Create Case Button & Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="bg-cyber-blue text-black hover:bg-cyber-blue/80 flex items-center gap-1.5 font-mono text-xs">
                <Plus className="w-4 h-4" /> CREATE CASE
              </Button>
            }
          />
          <DialogContent className="bg-card border-border p-6 rounded-xl max-w-md w-full">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">Initiate Operational Case</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Open a B2B incident response ticket cluster.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCase} className="space-y-4 text-xs mt-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Case Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Host Compromise Cluster 01"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Description & Bounds</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide detailed logs or vectors relating to this case group..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Severity Level</label>
                  <select
                    value={severity}
                    onChange={e => setSeverity(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Assigned Lead</label>
                  <input
                    type="text"
                    placeholder="Analyst Name / Unassigned"
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <DialogClose render={<Button variant="outline" type="button" size="sm" />}>Cancel</DialogClose>
                <Button type="submit" disabled={isPending} className="bg-cyber-blue text-black hover:bg-cyber-blue/80" size="sm">
                  {isPending ? "CREATING..." : "CONFIRM CASE"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Grid: Cases List (Left) & Detail Panel (Right) */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Cases List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-cyber-blue" /> Active Cases
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 font-mono text-[10px] text-muted-foreground">
                      <th className="p-3">Case ID / Title</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Assigned Lead</th>
                      <th className="p-3">Alarms Linked</th>
                      <th className="p-3">Date Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {cases.length > 0 ? (
                      cases.map((c) => (
                        <tr 
                          key={c.id} 
                          onClick={() => setSelectedCaseId(c.id)}
                          className={`cursor-pointer transition-colors ${
                            selectedCaseId === c.id 
                              ? "bg-cyber-blue/5 border-l-2 border-l-cyber-blue" 
                              : "hover:bg-muted/10"
                          }`}
                        >
                          <td className="p-3 font-semibold text-foreground/90 font-sans text-xs max-w-[200px] truncate">
                            {c.title}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={`text-[9px] font-mono leading-none ${
                              c.severity === "CRITICAL"
                                ? "bg-cyber-red/10 text-cyber-red border-cyber-red/30"
                                : c.severity === "HIGH"
                                  ? "bg-cyber-orange/10 text-cyber-orange border-cyber-orange/30"
                                  : "bg-cyber-yellow/10 text-cyber-yellow border-cyber-yellow/30"
                            }`}>
                              {c.severity}
                            </Badge>
                          </td>
                          <td className="p-3 text-[10px] uppercase font-bold">
                            <span className={
                              c.status === "closed" 
                                ? "text-cyber-green" 
                                : c.status === "investigating" 
                                  ? "text-cyber-blue" 
                                  : "text-cyber-orange"
                            }>
                              {c.status}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground font-sans">{c.assignedTo}</td>
                          <td className="p-3 text-center">{c.incidents.length}</td>
                          <td className="p-3 text-muted-foreground" suppressHydrationWarning>
                            {new Date(c.createdAt).toISOString().split('T')[0]}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground text-[11px] font-sans">
                          No active cases in database. Click + Create Case to register a ticket.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Case Details View Panel (Right side) */}
        <div className="lg:col-span-1">
          {selectedCase ? (
            <Card className="border-border bg-card/60 backdrop-blur-sm sticky top-20 flex flex-col max-h-[650px] overflow-y-auto">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground bg-white/5 border-white/5">
                    CASE DETAILS
                  </Badge>
                  <div className="flex gap-1">
                    <Button 
                      size="icon-sm" 
                      variant="outline" 
                      onClick={() => handleStatusChange(selectedCase.id, "investigating")}
                      className={`text-[9px] font-mono ${selectedCase.status === "investigating" ? "border-cyber-blue text-cyber-blue bg-cyber-blue/5" : "text-muted-foreground"}`}
                      title="Set Investigating"
                    >
                      INV
                    </Button>
                    <Button 
                      size="icon-sm" 
                      variant="outline" 
                      onClick={() => handleStatusChange(selectedCase.id, "closed")}
                      className={`text-[9px] font-mono ${selectedCase.status === "closed" ? "border-cyber-green text-cyber-green bg-cyber-green/5" : "text-muted-foreground"}`}
                      title="Close Case"
                    >
                      CLO
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base font-bold mt-2">{selectedCase.title}</CardTitle>
                <CardDescription className="text-[10px] font-mono text-muted-foreground">ID: {selectedCase.id}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-5 text-xs">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3 bg-muted/20 border border-white/5 p-3 rounded-lg font-mono text-[10px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground" suppressHydrationWarning>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Created: {new Date(selectedCase.createdAt).toISOString().split('T')[0]}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span>Lead: {selectedCase.assignedTo}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Description</h4>
                  <p className="text-white/80 leading-relaxed font-sans text-xs">{selectedCase.description}</p>
                </div>

                {/* Linked Incidents List */}
                <div className="space-y-2 border-t border-border/40 pt-4">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Attached Incidents ({selectedCase.incidents.length})</span>
                    <Badge variant="secondary" className="text-[8px] font-mono">B2B Scope</Badge>
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedCase.incidents.length > 0 ? (
                      selectedCase.incidents.map(inc => (
                        <div key={inc.id} className="flex items-center justify-between bg-black/30 border border-white/5 p-2 rounded hover:border-white/10 transition-all font-mono text-[10px]">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-cyber-orange shrink-0" />
                            <span className="truncate text-white/80 font-sans text-xs">{inc.title}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            onClick={() => handleUnlinkIncident(inc.id)}
                            className="text-muted-foreground hover:text-cyber-red"
                            title="Unlink incident"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 border border-dashed border-white/5 rounded text-[10px] text-muted-foreground font-sans">
                        No incidents linked. Link threat alerts below.
                      </div>
                    )}
                  </div>
                </div>

                {/* Link New Incident Form */}
                <form onSubmit={handleLinkIncident} className="space-y-2 pt-2 border-t border-border/40">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                    <LinkIcon className="w-3.5 h-3.5 text-cyber-blue" /> Link Ingested Incident
                  </h4>
                  <div className="flex gap-2">
                    <select
                      value={incidentToLink}
                      onChange={e => setIncidentToLink(e.target.value)}
                      className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-cyber-blue"
                    >
                      <option value="">-- Select Incident --</option>
                      {unassignedInc.map(i => (
                        <option key={i.id} value={i.id}>
                          [{i.severity}] {i.title.slice(0, 30)}...
                        </option>
                      ))}
                    </select>
                    <Button 
                      type="submit" 
                      disabled={!incidentToLink || isPending}
                      className="bg-cyber-blue text-black hover:bg-cyber-blue/80 h-8 font-mono text-[10px]"
                    >
                      LINK
                    </Button>
                  </div>
                </form>

                {/* Linked Evidence Files */}
                <div className="space-y-2 border-t border-border/40 pt-4">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" /> Evidence Vault Attachments
                  </h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedCase.evidence.length > 0 ? (
                      selectedCase.evidence.map(file => (
                        <div key={file.id} className="flex items-center gap-2 bg-muted/30 border border-white/5 p-2 rounded text-[10px] font-mono">
                          <FileSpreadsheet className="w-4 h-4 text-cyber-blue" />
                          <div className="flex-1 truncate">
                            <div className="truncate text-white">{file.fileName}</div>
                            <div className="text-[8px] text-muted-foreground">{file.fileSize} - {file.fileType}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 border border-dashed border-white/5 rounded text-[10px] text-muted-foreground font-sans">
                        No files in vault for this case. Upload files in the Vault tab.
                      </div>
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>
          ) : (
            <div className="h-full border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-center text-xs p-6 font-mono">
              SELECT A SECURITY CASE TICKET TO SHOW INVESTIGATION DESK
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
