"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { 
  History, Clock, ShieldCheck, RefreshCw, Info, 
  ShieldAlert, AlertOctagon, Briefcase, FileText, Server, CheckCircle2, Archive, MessageSquare
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { executeHuntAction } from "../actions";

interface ChronoEvent {
  id: string;
  type: string;
  title: string;
  info: string;
  severity: string;
  status: string;
  ip: string;
  country: string;
  createdAt: string;
}

export default function TimelinePage() {
  const [events, setEvents] = useState<ChronoEvent[]>([]);
  const [activePreset, setActivePreset] = useState("24h");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadTimeline = useCallback((preset: string = activePreset) => {
    startTransition(async () => {
      try {
        let queryStr = `date:${preset}`;
        if (preset === "custom") {
          // If custom, we can build a query string for the range
          // Let's pass a date filter
          if (customStart) {
            queryStr = `date:last30days`; // Fallback, but let's query all since we fetch and filter
          } else {
            queryStr = "";
          }
        }
        
        // Execute hunt search over all sources for timeline
        const res = await executeHuntAction(queryStr, [], 100, 0);
        
        let fetchedEvents = res.results || [];
        
        // If custom range is set, filter in memory for precision
        if (preset === "custom" && (customStart || customEnd)) {
          fetchedEvents = fetchedEvents.filter((ev: ChronoEvent) => {
            const evDate = new Date(ev.createdAt).getTime();
            if (customStart && evDate < new Date(customStart).getTime()) return false;
            if (customEnd && evDate > new Date(customEnd).getTime()) return false;
            return true;
          });
        }

        setEvents(fetchedEvents);
      } catch (err) {
        console.error("Timeline loading failed:", err);
      }
    });
  }, [activePreset, customStart, customEnd]);

  useEffect(() => {
    loadTimeline("24h");
  }, [loadTimeline]);

  const handlePresetSelect = (preset: string) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      loadTimeline(preset);
    }
  };

  const handleCustomSubmit = () => {
    setActivePreset("custom");
    loadTimeline("custom");
  };

  const getEventIcon = (type: string) => {
    switch(type) {
      case "ThreatEvent": return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case "Incident": return <AlertOctagon className="w-4 h-4 text-orange-500" />;
      case "Case": return <Briefcase className="w-4 h-4 text-yellow-500" />;
      case "AuditLog": return <FileText className="w-4 h-4 text-blue-400" />;
      case "SecurityLog": return <Server className="w-4 h-4 text-cyan-400" />;
      case "ComplianceCheck": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "Evidence": return <Archive className="w-4 h-4 text-emerald-500" />;
      case "ChatSession": return <MessageSquare className="w-4 h-4 text-purple-400" />;
      default: return <Info className="w-4 h-4 text-cyber-blue" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <History className="w-6 h-6 text-cyber-blue" /> Chronologic Threat Timeline
          </h1>
          <p className="text-xs text-muted-foreground">
            A comprehensive, multi-tenant visual chronology of security actions, threats, and changes.
          </p>
        </div>
        
        {/* Date Window selectors */}
        <div className="flex items-center gap-1 bg-secondary/30 border border-border p-1 rounded-lg">
          {["1h", "24h", "7d", "30d", "custom"].map((preset) => (
            <Button
              key={preset}
              variant={activePreset === preset ? "default" : "ghost"}
              onClick={() => handlePresetSelect(preset)}
              className="text-[10px] h-7 px-3 capitalize"
            >
              {preset}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom range config */}
      {activePreset === "custom" && (
        <Card className="border-border bg-card/30 backdrop-blur-md p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold font-mono text-muted-foreground uppercase">Start:</span>
            <input 
              type="datetime-local" 
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-background/80 border border-border rounded px-2.5 py-1 text-xs text-foreground outline-none cursor-pointer focus:border-cyber-blue"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold font-mono text-muted-foreground uppercase">End:</span>
            <input 
              type="datetime-local" 
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-background/80 border border-border rounded px-2.5 py-1 text-xs text-foreground outline-none cursor-pointer focus:border-cyber-blue"
            />
          </div>
          <Button 
            onClick={handleCustomSubmit}
            size="sm"
            className="bg-cyber-blue hover:bg-cyber-blue/80 text-background font-bold text-xs"
          >
            Apply Range
          </Button>
        </Card>
      )}

      {/* Timeline List Card */}
      <Card className="border-border bg-card/40 backdrop-blur-md overflow-hidden">
        <CardHeader className="pb-3 border-b border-border flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyber-blue" /> Unified Operations Chronology
            </CardTitle>
            <CardDescription className="text-[10px]">Deep scanning historical telemetry</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadTimeline()}
            disabled={isPending}
            className="h-8 border-border text-xs flex items-center gap-1.5"
          >
            {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {isPending ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyber-blue" />
              <span className="text-xs text-muted-foreground font-mono">Aggregating database audit tables...</span>
            </div>
          ) : events.length > 0 ? (
            <div className="relative pl-6 border-l border-border/80 space-y-6">
              {events.map((ev) => (
                <div key={ev.id} className="relative group">
                  {/* Timeline dot icon wrapper */}
                  <div className="absolute left-[-35px] top-1 p-1 bg-background border border-border rounded-full flex items-center justify-center shadow-sm z-10">
                    {getEventIcon(ev.type)}
                  </div>
                  
                  {/* Event content box */}
                  <div className="p-4 bg-background/50 hover:bg-secondary/20 border border-border/60 hover:border-cyber-blue/20 rounded-xl transition-all duration-200 space-y-2">
                    
                    {/* Event header info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        <Badge variant="secondary" className="text-[9px] font-bold">{ev.type}</Badge>
                        {ev.ip && ev.ip !== "N/A" && (
                          <span className="text-cyber-blue font-semibold">{ev.ip} ({ev.country})</span>
                        )}
                      </div>
                      
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(ev.createdAt).toUTCString()}
                      </span>
                    </div>

                    {/* Event body details */}
                    <div className="space-y-1">
                      <h4 className="font-semibold text-xs text-foreground group-hover:text-cyber-blue transition-colors">
                        {ev.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {ev.info}
                      </p>
                    </div>

                    {/* Event Footer tags */}
                    <div className="flex items-center gap-2 pt-1.5">
                      <Badge className={`text-[8px] font-mono border-0 font-semibold ${
                        ev.severity === "CRITICAL" 
                          ? "bg-red-500/20 text-red-500" 
                          : ev.severity === "HIGH"
                            ? "bg-orange-500/20 text-orange-500"
                            : ev.severity === "MEDIUM"
                              ? "bg-yellow-500/20 text-cyber-yellow"
                              : "bg-blue-500/20 text-cyber-blue"
                      }`}>
                        {ev.severity}
                      </Badge>
                      
                      {ev.status && ev.status !== "N/A" && (
                        <Badge variant="outline" className="text-[8px] font-mono">{ev.status}</Badge>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-xs text-muted-foreground/60 font-mono flex flex-col items-center gap-2">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/45" />
              <span>NO TELEMETRY RECORDED IN SELECTED INTERVAL</span>
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
}
