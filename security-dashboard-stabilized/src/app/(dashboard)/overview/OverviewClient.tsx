"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, ShieldCheck, 
  Activity, Globe, RefreshCw, Network
} from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CyberPanel } from "@/components/ui/CyberPanel";
import ThreatGlobe from "@/components/soc/ThreatGlobe";
import { TelemetryStream } from "@/components/ui/TelemetryStream";
import NetworkTopology from "@/components/soc/NetworkTopology";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  ResponsiveContainer, Tooltip, CartesianGrid, Cell
} from "recharts";

interface OverviewClientProps {
  totalThreats: number;
  criticalThreats: number;
  openIncidents: number;
  complianceScore: number;
  totalLogSources: number;
  recentThreats: {
    id: string;
    sourceIp: string;
    target: string;
    severity: string;
    description: string;
    createdAt: Date | string;
  }[];
  chartVelocityData: { time: string; attacks: number }[];
  chartCategoryData: { name: string; count: number; fill: string }[];
}

export default function OverviewClient({
  totalThreats,
  criticalThreats,
  openIncidents,
  complianceScore,
  chartVelocityData,
  chartCategoryData,
}: OverviewClientProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6 relative">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-widest font-heading bg-gradient-to-r from-foreground via-foreground/90 to-cyber-blue bg-clip-text text-transparent uppercase">
            SOC Operations Terminal
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono uppercase">
            OPERATIONAL BOUNDARY: <span className="text-cyber-green font-semibold">SECURE ISOLATION ACTIVE</span> {"// TELEMETRY LINKED"}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="h-9 border-cyber-blue/30 bg-cyber-blue/5 text-cyber-blue font-mono hover:bg-cyber-blue/15 hover:text-white transition-all shadow-[0_0_15px_rgba(0,229,255,0.05)] text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          REFRESH SYSTEMS
        </Button>
      </div>

      {/* Centerpiece Globe Console row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Globe centerpiece (Left 2 Columns) */}
        <div className="lg:col-span-2 relative min-h-[420px] flex items-center justify-center border border-white/5 bg-[#07111f]/30 backdrop-blur-md rounded-xl overflow-hidden p-6 group">
          {/* Conic Radar Sweep background */}
          <div className="radar-sweep-effect absolute top-[-50%] left-[-50%]" />
          <div className="absolute inset-0 cyber-grid-dots pointer-events-none opacity-50" />
          
          {/* 3D Threat Globe (hidden on mobile, replaced with fallback) */}
          <div className="hidden md:block relative z-10 w-full h-full">
            <ThreatGlobe />
          </div>
          
          {/* Mobile Fallback */}
          <div className="md:hidden flex flex-col items-center justify-center text-center p-4 relative z-10">
            <Globe className="w-16 h-16 text-cyber-blue animate-pulse mb-3" />
            <p className="text-xs font-mono uppercase text-cyber-blue font-bold tracking-wider">3D TELEMETRY CONSOLE DEACTIVATED</p>
            <p className="text-[9px] text-muted-foreground uppercase mt-1">Mobile simplified viewport active</p>
          </div>

          {/* Floating Overlays around the globe */}
          {/* Overlay 1: Threat Sources */}
          <div className="absolute top-4 left-4 z-20 animate-float-slow hidden xl:block w-40 bg-[#07111f]/90 border border-cyber-blue/20 backdrop-blur-md p-3 rounded-lg text-[9px] font-mono shadow-[0_0_15px_rgba(0,229,255,0.05)]">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest block border-b border-white/5 pb-1 mb-1.5">THREAT_SOURCES</span>
            <div className="space-y-1">
              <div className="flex justify-between"><span>US (EXTERNAL)</span><span className="text-cyber-red font-semibold">1,248</span></div>
              <div className="flex justify-between"><span>CN (PROXY)</span><span className="text-cyber-orange">942</span></div>
              <div className="flex justify-between"><span>RU (COMMAND)</span><span className="text-cyber-orange">819</span></div>
            </div>
          </div>

          {/* Overlay 2: MITRE Coverage */}
          <div className="absolute top-4 right-4 z-20 animate-float-fast hidden xl:block w-40 bg-[#07111f]/90 border border-cyber-green/20 backdrop-blur-md p-3 rounded-lg text-[9px] font-mono shadow-[0_0_15px_rgba(0,255,136,0.05)]">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest block border-b border-white/5 pb-1 mb-1.5">MITRE_ATT&CK</span>
            <div className="space-y-1">
              <div className="flex justify-between"><span>TACTICS_MATCHED</span><span className="text-cyber-green">14/14</span></div>
              <div className="flex justify-between"><span>RULE_COVERAGE</span><span className="text-cyber-green">94.8%</span></div>
              <div className="w-full bg-white/5 rounded-full h-1 mt-1.5 overflow-hidden">
                <div className="bg-cyber-green h-full rounded-full" style={{ width: "94.8%" }} />
              </div>
            </div>
          </div>

          {/* Overlay 3: Compromised Assets */}
          <div className="absolute bottom-4 left-4 z-20 animate-float-delayed hidden xl:block w-40 bg-[#07111f]/90 border border-cyber-red/20 backdrop-blur-md p-3 rounded-lg text-[9px] font-mono shadow-[0_0_15px_rgba(255,77,109,0.05)]">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest block border-b border-white/5 pb-1 mb-1.5">COMPROMISED_ASSETS</span>
            <div className="space-y-1">
              <div className="flex justify-between"><span>K8S_CONTAINER</span><span className="text-cyber-red">1 WARNING</span></div>
              <div className="flex justify-between"><span>DB_CLUSTERS</span><span className="text-cyber-green">0 SECURE</span></div>
            </div>
          </div>

          {/* Overlay 4: Cloud Regions */}
          <div className="absolute bottom-4 right-4 z-20 animate-float-slow hidden xl:block w-40 bg-[#07111f]/90 border border-cyber-purple/20 backdrop-blur-md p-3 rounded-lg text-[9px] font-mono shadow-[0_0_15px_rgba(139,92,246,0.05)]">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest block border-b border-white/5 pb-1 mb-1.5">CLOUD_REGIONS</span>
            <div className="space-y-1">
              <div className="flex justify-between"><span>AWS_US_EAST_1</span><span className="text-cyber-green">ACTIVE</span></div>
              <div className="flex justify-between"><span>GCP_EU_WEST_4</span><span className="text-cyber-green">ACTIVE</span></div>
            </div>
          </div>
        </div>

        {/* Ingest stream console (Column 3) */}
        <CyberPanel glowColor="cyber-blue" className="flex flex-col h-[420px]">
          <div className="p-4 border-b border-border shrink-0 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">MISSION CONTROL FEED</h3>
              <p className="text-[9px] text-muted-foreground/80 mt-0.5 font-mono uppercase">Live event ingest and playbook automation logs.</p>
            </div>
          </div>
          <div className="flex-1 p-3 bg-black/40 min-h-0">
            <TelemetryStream />
          </div>
        </CyberPanel>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Threats */}
        <CyberPanel glowColor="cyber-orange" className="transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Threats Logged</CardTitle>
            <div className="p-1 rounded-full bg-cyber-orange/10 border border-cyber-orange/20">
              <ShieldAlert className="w-4 h-4 text-cyber-orange" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-orange drop-shadow-[0_0_10px_rgba(255,138,0,0.15)]">{totalThreats}</div>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">
              Captured network events
            </p>
          </CardContent>
        </CyberPanel>

        {/* Critical Threats */}
        <CyberPanel glowColor="cyber-red" className="transition-all hover:-translate-y-0.5 border-cyber-red/20 bg-cyber-red/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-widest uppercase text-cyber-red">Critical Intrusion</CardTitle>
            <div className="p-1 rounded-full bg-cyber-red/20 border border-cyber-red/30 animate-pulse">
              <ShieldAlert className="w-4 h-4 text-cyber-red" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-red drop-shadow-[0_0_10px_rgba(255,77,109,0.2)]">{criticalThreats}</div>
            <p className="text-[10px] text-muted-foreground font-mono mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-red animate-ping" />
              IMMEDIATE TRIAGE PROTOCOL
            </p>
          </CardContent>
        </CyberPanel>

        {/* Open Incidents */}
        <CyberPanel glowColor="cyber-blue" className="transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-widest uppercase text-cyber-blue">Active Cases</CardTitle>
            <div className="p-1 rounded-full bg-cyber-blue/10 border border-cyber-blue/20">
              <Activity className="w-4 h-4 text-cyber-blue animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-blue drop-shadow-[0_0_10px_rgba(0,229,255,0.15)]">{openIncidents}</div>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">
              Assigned response tickets
            </p>
          </CardContent>
        </CyberPanel>

        {/* Compliance Posture */}
        <CyberPanel glowColor="cyber-green" className="transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-widest uppercase text-cyber-green">Compliance Framework</CardTitle>
            <div className="p-1 rounded-full bg-cyber-green/10 border border-cyber-green/20">
              <ShieldCheck className="w-4 h-4 text-cyber-green" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-green drop-shadow-[0_0_10px_rgba(0,255,136,0.15)]">{complianceScore.toFixed(1)}%</div>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">
              Audited framework posture
            </p>
          </CardContent>
        </CyberPanel>
      </div>

      {/* Network Topology Visualizer */}
      <CyberPanel glowColor="cyber-blue" className="p-4 flex flex-col">
        <div className="border-b border-border pb-3 mb-4 shrink-0 flex flex-row items-center justify-between">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
              <Network className="w-4 h-4 text-cyber-blue" />
              SOC NETWORK PROPAGATION INTERFACE
            </h3>
            <p className="text-[9px] text-muted-foreground font-mono uppercase">Interactive topology mappings and threat propagation testing channels.</p>
          </div>
        </div>
        <NetworkTopology />
      </CyberPanel>

      {/* Analytics Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Line/Area Chart for threat volumes */}
        <CyberPanel glowColor="cyber-blue">
          <CardHeader>
            <CardTitle className="text-sm font-semibold font-heading tracking-wider">MALICIOUS SPEED VELOCITY (24H)</CardTitle>
            <CardDescription className="text-[11px] font-mono">Malicious indicators mapped over 4-hour ingestion buckets.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {totalThreats > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartVelocityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--cyber-blue)" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="var(--cyber-blue)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} className="font-mono" />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} className="font-mono" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#07111f", borderColor: "rgba(0, 229, 255, 0.2)", color: "#f5f5f5", borderRadius: "8px", fontSize: "10px", fontFamily: "monospace" }}
                    itemStyle={{ color: "var(--cyber-blue)" }}
                  />
                  <Area type="monotone" dataKey="attacks" stroke="var(--cyber-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorAttacks)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/60 text-xs font-mono">
                NO VELOCITY TELEMETRY DETECTED
              </div>
            )}
          </CardContent>
        </CyberPanel>

        {/* Bar Chart for Incident Categories */}
        <CyberPanel glowColor="cyber-blue">
          <CardHeader>
            <CardTitle className="text-sm font-semibold font-heading tracking-wider">THREAT VECTORS DISTRIBUTION</CardTitle>
            <CardDescription className="text-[11px] font-mono">Breakdown of ingested attack vectors categorized on DB-side.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {chartCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartCategoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={8} tickLine={false} className="font-mono" />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} className="font-mono" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#07111f", borderColor: "rgba(0, 229, 255, 0.2)", color: "#f5f5f5", borderRadius: "8px", fontSize: "10px", fontFamily: "monospace" }}
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartCategoryData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fill || "var(--cyber-blue)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/60 text-xs font-mono">
                NO CATEGORY TELEMETRY REGISTERED
              </div>
            )}
          </CardContent>
        </CyberPanel>
      </div>
    </div>
  );
}

