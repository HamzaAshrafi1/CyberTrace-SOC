"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, User } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CyberPanel } from "@/components/ui/CyberPanel";

interface SecurityIncident {
  id: string;
  title: string;
  status: string;
  assignedTo: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface IncidentsClientProps {
  incidents: SecurityIncident[];
  currentUserEmail: string;
}

export default function IncidentsClient({
  incidents,
}: IncidentsClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wider font-heading bg-gradient-to-r from-foreground via-foreground/90 to-cyber-red bg-clip-text text-transparent uppercase">
            Incidents Response Center
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            SECURITY QUEUE: <span className="text-cyber-red font-semibold">TRIAGE ESCALATION PROTOCOL</span> {"// CORRELATED ALARM GROUPS"}
          </p>
        </div>
      </div>

      {/* Queue Table */}
      <CyberPanel glowColor="cyber-red" className="overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-cyber-red animate-pulse" />
              <CardTitle className="text-sm font-semibold font-heading tracking-wider">INCIDENT ESCALATION QUEUE</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] border-cyber-red/30 text-cyber-red bg-cyber-red/5">
              {incidents.length} ACTIVE INCIDENTS
            </Badge>
          </div>
          <CardDescription className="text-[11px] font-mono">System-wide incident alerts classified by operational severity.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-background/40">
                <TableRow className="border-b border-white/5">
                  <TableHead className="w-28 text-xs font-mono tracking-widest text-muted-foreground uppercase">Incident ID</TableHead>
                  <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Incident Summary</TableHead>
                  <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Status</TableHead>
                  <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Assignee</TableHead>
                  <TableHead className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Created At</TableHead>
                  <TableHead className="text-right text-xs font-mono tracking-widest text-muted-foreground uppercase">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.length > 0 ? (
                  incidents.map((incident) => (
                    <TableRow key={incident.id} className="border-b border-white/5 hover:bg-cyber-red/5 transition-colors font-mono text-xs">
                      <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">{incident.id}</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground/90 font-sans">{incident.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] capitalize font-mono ${
                          incident.status === "open" || incident.status === "open"
                            ? "border-cyber-red/30 text-cyber-red bg-cyber-red/5" 
                            : incident.status === "investigating"
                              ? "border-cyber-orange/30 text-cyber-orange bg-cyber-orange/5 animate-pulse"
                              : incident.status === "contained"
                                ? "border-cyber-blue/30 text-cyber-blue bg-cyber-blue/5"
                                : "border-cyber-green/30 text-cyber-green bg-cyber-green/5"
                        }`}>
                          {incident.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-cyber-blue" />
                          {incident.assignedTo === "Unassigned" ? (
                            <span className="text-muted-foreground/45 italic">unassigned</span>
                          ) : (
                            incident.assignedTo.split("@")[0]
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(incident.createdAt).toUTCString().replace("GMT", "UTC")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-8 border-white/5 text-foreground hover:bg-cyber-red/10 hover:text-cyber-red hover:border-cyber-red/30"
                          onClick={() => router.push(`/incidents/${incident.id}`)}
                        >
                          Triage Ticket
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-xs text-muted-foreground font-mono">
                      NO ACTIVE SECURITY INCIDENTS REGISTERED
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </CyberPanel>
    </div>
  );
}
