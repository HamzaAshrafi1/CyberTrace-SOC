"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";
import { 
  Globe, Filter, Terminal
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CyberPanel } from "@/components/ui/CyberPanel";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

interface ThreatMapClientProps {
  orgId: string;
  initialThreats: Threat[];
  initialIncidents: Incident[];
}

export interface AttackPath {
  id: string;
  fromName: string;
  from: [number, number]; // [lng, lat]
  toName: string;
  to: [number, number];   // [lng, lat]
  severity: string;
  sourceIp: string;
  target: string;
  description: string;
  timestamp: string;
}

const GLOBAL_COORDINATES = [
  { name: "United States (US)", coordinates: [-95.7129, 37.0902] as [number, number] },
  { name: "China (CN)", coordinates: [104.1954, 35.8617] as [number, number] },
  { name: "Russia (RU)", coordinates: [105.3188, 61.524] as [number, number] },
  { name: "United Kingdom (UK)", coordinates: [-3.436, 55.3781] as [number, number] },
  { name: "Germany (DE)", coordinates: [10.4515, 51.1657] as [number, number] },
  { name: "Brazil (BR)", coordinates: [-51.9253, -14.235] as [number, number] },
  { name: "India (IN)", coordinates: [78.9629, 20.5937] as [number, number] },
  { name: "Australia (AU)", coordinates: [133.7751, -25.2744] as [number, number] },
  { name: "South Africa (ZA)", coordinates: [25.0839, -29.0852] as [number, number] },
  { name: "Ukraine (UA)", coordinates: [31.1656, 48.3794] as [number, number] },
  { name: "North Korea (KP)", coordinates: [127.5101, 40.3399] as [number, number] },
  { name: "Iran (IR)", coordinates: [53.688, 32.4279] as [number, number] },
];

const TARGET_HUBS = [
  { name: "New York HQ", coordinates: [-74.006, 40.7128] as [number, number] },
  { name: "London SOC", coordinates: [-0.1278, 51.5074] as [number, number] },
  { name: "Tokyo SOC", coordinates: [139.6917, 35.6895] as [number, number] },
  { name: "Singapore SOC", coordinates: [103.8519, 1.3521] as [number, number] },
];

// Helper to determine threat severity color
function getSeverityColor(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "#ef4444"; // Red
    case "HIGH":
      return "#f97316"; // Orange
    case "MEDIUM":
      return "#eab308"; // Yellow
    default:
      return "#06b6d4"; // Cyber Blue
  }
}

export default function ThreatMapClient({ orgId, initialThreats }: ThreatMapClientProps) {
  const [mounted, setMounted] = useState(false);
  const [threats, setThreats] = useState<Threat[]>(initialThreats);
  const [attacks, setAttacks] = useState<AttackPath[]>([]);
  const [selectedAttack, setSelectedAttack] = useState<AttackPath | null>(null);
  const [filterSeverity, setFilterSeverity] = useState({
    CRITICAL: true,
    HIGH: true,
    MEDIUM: true,
    LOW: true,
  });

  const [mapLogs, setMapLogs] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setMapLogs([`[SYSTEM] Real-time geographical map engine initialized.`]);
  }, []);

  // Map historical threats to paths on load
  useEffect(() => {
    if (!mounted) return;
    const paths: AttackPath[] = threats
      .slice(0, 10)
      .map(t => {
        const origin = GLOBAL_COORDINATES[Math.floor(Math.random() * GLOBAL_COORDINATES.length)];
        const targetHub = TARGET_HUBS[Math.floor(Math.random() * TARGET_HUBS.length)];
        return {
          id: t.id,
          fromName: origin.name,
          from: origin.coordinates,
          toName: targetHub.name,
          to: targetHub.coordinates,
          severity: t.severity,
          sourceIp: t.sourceIp,
          target: t.target,
          description: t.description,
          timestamp: new Date(t.createdAt).toLocaleTimeString(),
        };
      });
    setAttacks(paths);
  }, [threats, mounted]);

  // Connect to live updates
  useRealtimeEvents(orgId, (type, payload) => {
    const timestamp = new Date().toLocaleTimeString();
    if (type === "threat") {
      setThreats(prev => [payload, ...prev].slice(0, 50));
      
      const origin = GLOBAL_COORDINATES[Math.floor(Math.random() * GLOBAL_COORDINATES.length)];
      const targetHub = TARGET_HUBS[Math.floor(Math.random() * TARGET_HUBS.length)];

      const newAttack: AttackPath = {
        id: payload.id || Math.random().toString(),
        fromName: origin.name,
        from: origin.coordinates,
        toName: targetHub.name,
        to: targetHub.coordinates,
        severity: payload.severity,
        sourceIp: payload.sourceIp,
        target: payload.target,
        description: payload.description,
        timestamp,
      };

      setAttacks(prev => [newAttack, ...prev].slice(0, 15));
      setMapLogs(prev => [
        `[${timestamp}] [INGRESS] Intrusion detected from ${payload.sourceIp} (${origin.name}) -> ${targetHub.name} [${payload.severity}]`,
        ...prev
      ].slice(0, 50));
    }
  });

  // Filters computed attacks based on selected levels
  const filteredAttacks = useMemo(() => {
    return attacks.filter(a => {
      const sev = a.severity.toUpperCase();
      if (sev === "CRITICAL" && !filterSeverity.CRITICAL) return false;
      if (sev === "HIGH" && !filterSeverity.HIGH) return false;
      if (sev === "MEDIUM" && !filterSeverity.MEDIUM) return false;
      if ((sev === "LOW" || sev === "INFO") && !filterSeverity.LOW) return false;
      return true;
    });
  }, [attacks, filterSeverity]);

  // Country Risk Index metrics based on active threat distribution
  const countryRisks = useMemo(() => {
    const counts: Record<string, number> = {};
    threats.forEach(() => {
      const country = GLOBAL_COORDINATES[Math.floor(Math.random() * GLOBAL_COORDINATES.length)].name;
      counts[country] = (counts[country] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        riskScore: Math.min(99, Math.floor((count / (threats.length || 1)) * 100 + 40)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [threats]);

  const toggleSeverity = (level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") => {
    setFilterSeverity(prev => ({
      ...prev,
      [level]: !prev[level],
    }));
  };

  if (!mounted) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-background rounded-xl border border-white/5 animate-pulse">
        <span className="text-muted-foreground text-sm font-mono tracking-widest">BOOTING GLOBAL THREAT MAP SYSTEM...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p role="note" className="text-xs text-amber-400 p-2">Demo visualization: coordinates, actor/CVE examples and decorative counters are illustrative, not verified telemetry.</p>
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-widest font-heading bg-gradient-to-r from-foreground via-foreground/90 to-cyber-blue bg-clip-text text-transparent uppercase">
          Geographical Threat Console
        </h1>
        <p className="text-[10px] text-muted-foreground font-mono uppercase">
          SYS_STATUS: <span className="text-cyber-green font-semibold">ONLINE</span> {"// MAPPED THREATS: "}{threats.length}{" // ACTIVE ATTACK VECTORS: "}{filteredAttacks.length}
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Controls & Country Dossiers */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Filters Card */}
          <CyberPanel glowColor="cyber-blue" className="p-4 space-y-4">
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Filter className="w-3.5 h-3.5 text-cyber-blue" />
              MAP FILTERS
            </h3>
            
            <div className="space-y-2.5">
              <button 
                onClick={() => toggleSeverity("CRITICAL")}
                className="flex items-center justify-between w-full p-2 bg-black/20 hover:bg-black/30 border border-white/5 rounded-lg text-xs font-mono transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className={filterSeverity.CRITICAL ? "text-white" : "text-muted-foreground/60 line-through"}>CRITICAL</span>
                </div>
                {filterSeverity.CRITICAL ? <Badge className="bg-red-500/20 text-red-500 border border-red-500/30 font-mono text-[9px] py-0">ON</Badge> : <Badge variant="outline" className="text-[9px] text-muted-foreground/50">OFF</Badge>}
              </button>

              <button 
                onClick={() => toggleSeverity("HIGH")}
                className="flex items-center justify-between w-full p-2 bg-black/20 hover:bg-black/30 border border-white/5 rounded-lg text-xs font-mono transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className={filterSeverity.HIGH ? "text-white" : "text-muted-foreground/60 line-through"}>HIGH</span>
                </div>
                {filterSeverity.HIGH ? <Badge className="bg-orange-500/20 text-orange-500 border border-orange-500/30 font-mono text-[9px] py-0">ON</Badge> : <Badge variant="outline" className="text-[9px] text-muted-foreground/50">OFF</Badge>}
              </button>

              <button 
                onClick={() => toggleSeverity("MEDIUM")}
                className="flex items-center justify-between w-full p-2 bg-black/20 hover:bg-black/30 border border-white/5 rounded-lg text-xs font-mono transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className={filterSeverity.MEDIUM ? "text-white" : "text-muted-foreground/60 line-through"}>MEDIUM</span>
                </div>
                {filterSeverity.MEDIUM ? <Badge className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-mono text-[9px] py-0">ON</Badge> : <Badge variant="outline" className="text-[9px] text-muted-foreground/50">OFF</Badge>}
              </button>

              <button 
                onClick={() => toggleSeverity("LOW")}
                className="flex items-center justify-between w-full p-2 bg-black/20 hover:bg-black/30 border border-white/5 rounded-lg text-xs font-mono transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className={filterSeverity.LOW ? "text-white" : "text-muted-foreground/60 line-through"}>LOW / INFO</span>
                </div>
                {filterSeverity.LOW ? <Badge className="bg-cyan-500/20 text-cyan-500 border border-cyan-500/30 font-mono text-[9px] py-0">ON</Badge> : <Badge variant="outline" className="text-[9px] text-muted-foreground/50">OFF</Badge>}
              </button>
            </div>
          </CyberPanel>

          {/* Country Risk Index Rankings */}
          <CyberPanel glowColor="cyber-blue" className="p-4 space-y-4 flex-1">
            <div>
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border-b border-white/5 pb-2">
                <Globe className="w-3.5 h-3.5 text-cyber-blue" />
                COUNTRY RISK DOSSIER
              </h3>
              <p className="text-[8px] text-muted-foreground font-mono uppercase mt-1">Weighted hazard percentages based on logs.</p>
            </div>

            <div className="space-y-4">
              {countryRisks.map((risk, index) => (
                <div key={risk.name} className="space-y-1.5 font-mono text-[10px]">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-semibold text-foreground/80">{index + 1}. {risk.name.split(" ")[0]}</span>
                    <span className={risk.riskScore > 75 ? "text-cyber-red" : risk.riskScore > 50 ? "text-cyber-orange" : "text-cyber-blue"}>
                      {risk.riskScore}% HAZARD
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        risk.riskScore > 75 ? "bg-cyber-red" : risk.riskScore > 50 ? "bg-cyber-orange" : "bg-cyber-blue"
                      }`}
                      style={{ width: `${risk.riskScore}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CyberPanel>
        </div>

        {/* Center Section: Main geographical interactive map (Span 3 columns) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative w-full h-[550px] bg-[#070214]/60 backdrop-blur-md rounded-xl border border-white/5 overflow-hidden shadow-[inset_0_0_40px_rgba(6,182,212,0.05)]">
            {/* Map Header Overlay */}
            <div className="absolute top-4 left-4 z-10 font-mono text-xs text-muted-foreground pointer-events-none bg-[#0c0520]/80 backdrop-blur-md px-3 py-1.5 border border-white/5 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-ping" />
                <span className="text-white font-semibold">WORLD ATTACK VECTOR TOPOLOGY</span>
              </div>
              <div className="text-[9px]">Ingested from Active Tenant collectors</div>
            </div>

            <style jsx global>{`
              @keyframes dash {
                to {
                  stroke-dashoffset: -40;
                }
              }
              .map-vector-path {
                stroke-dasharray: 8 4;
                animation: dash 2s linear infinite;
              }
              .ping-marker {
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              }
            `}</style>

            <ComposableMap
              projectionConfig={{
                scale: 145,
                center: [20, 10],
              }}
              width={800}
              height={500}
              className="w-full h-full"
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#0f0729"
                      stroke="#1f114c"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#150b38", outline: "none" },
                        pressed: { fill: "#0f0729", outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Dynamic Attack Vector Lines */}
              {filteredAttacks.map((attack) => (
                <g 
                  key={attack.id} 
                  className="cursor-pointer" 
                  onClick={() => setSelectedAttack(attack)}
                >
                  <Line
                    from={attack.from}
                    to={attack.to}
                    stroke={getSeverityColor(attack.severity)}
                    strokeWidth={attack.severity.toUpperCase() === "CRITICAL" ? 2.5 : 1.5}
                    strokeLinecap="round"
                    className="map-vector-path"
                  />
                  {/* Origin Indicator */}
                  <Marker coordinates={attack.from}>
                    <circle r={3} fill={getSeverityColor(attack.severity)} />
                    <circle
                      r={7}
                      fill="none"
                      stroke={getSeverityColor(attack.severity)}
                      strokeWidth={1}
                      className="ping-marker"
                      opacity={0.6}
                    />
                  </Marker>
                </g>
              ))}

              {/* Target SOC Hubs */}
              {TARGET_HUBS.map((hub) => (
                <Marker key={hub.name} coordinates={hub.coordinates}>
                  <g transform="translate(-8, -8)" className="cursor-pointer">
                    <circle cx="8" cy="8" r="4" fill="#06b6d4" />
                    <circle
                      cx="8"
                      cy="8"
                      r="10"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      className="ping-marker"
                      opacity={0.5}
                    />
                    <title>{hub.name}</title>
                  </g>
                </Marker>
              ))}
            </ComposableMap>

            {/* Selected Attack Detail Overlay Card (Bottom Center) */}
            {selectedAttack && (
              <div className="absolute bottom-4 left-4 right-4 z-20 bg-[#0c0520]/90 backdrop-blur-md border border-cyber-blue/30 rounded-lg p-3 text-xs font-mono animate-fadeIn flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge style={{ backgroundColor: `${getSeverityColor(selectedAttack.severity)}20`, color: getSeverityColor(selectedAttack.severity), borderColor: `${getSeverityColor(selectedAttack.severity)}40` }} variant="outline" className="font-mono text-[9px]">
                      {selectedAttack.severity.toUpperCase()}
                    </Badge>
                    <span className="text-white font-bold">{selectedAttack.description}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    ORIGIN: <span className="text-foreground">{selectedAttack.sourceIp} ({selectedAttack.fromName})</span> {"// TARGET: "}<span className="text-foreground">{selectedAttack.target} ({selectedAttack.toName})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{selectedAttack.timestamp}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedAttack(null)}
                    className="h-6 px-1.5 text-muted-foreground hover:text-white"
                  >
                    DISMISS
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Ingress Telemetry Stream */}
      <CyberPanel glowColor="cyber-blue" className="p-4 flex flex-col">
        <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border-b border-white/5 pb-2 mb-3">
          <Terminal className="w-3.5 h-3.5 text-cyber-blue animate-pulse" />
          ACTIVE INGRESS GEOLOCATION STREAM
        </h3>
        <div className="h-44 bg-black/60 rounded-lg p-3 font-mono text-[10px] text-cyber-green overflow-y-auto space-y-1.5">
          {mapLogs.map((log, index) => (
            <div key={index} className="truncate">
              {log.includes("[CRITICAL]") ? (
                <span className="text-cyber-red">{log}</span>
              ) : log.includes("[HIGH]") ? (
                <span className="text-cyber-orange">{log}</span>
              ) : log.includes("[MEDIUM]") ? (
                <span className="text-cyber-yellow">{log}</span>
              ) : (
                <span>{log}</span>
              )}
            </div>
          ))}
        </div>
      </CyberPanel>
    </div>
  );
}
