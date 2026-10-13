"use client";

import React from "react";
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Network, Play, ShieldCheck, 
  AlertTriangle, ArrowRight, RefreshCw, Terminal as TerminalIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Metrics {
  totalPlaybooks: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  automatedIncidents: number;
  automatedCases: number;
  successRate: number;
  chartData: Array<{ date: string; success: number; failed: number }>;
}

interface AutomationClientProps {
  metrics: Metrics;
}

export default function AutomationClient({ metrics }: AutomationClientProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  const volumeDistribution = [
    { name: "Incident Tickets", Created: metrics.automatedIncidents },
    { name: "Operational Cases", Created: metrics.automatedCases }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <Network className="w-6 h-6 text-cyber-blue" />
            SOAR Control Center
          </h1>
          <p className="text-xs text-muted-foreground">
            Security Orchestration, Automation and Response diagnostics console.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/playbooks">
            <Button size="sm" className="bg-cyber-blue text-black hover:bg-cyber-blue/80 font-mono text-xs">
              PLAYBOOK MANAGER
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="h-9 border-border bg-card/40 flex items-center gap-2 hover:bg-secondary/40 font-mono text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            REFRESH METRICS
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Playbooks */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">Active Playbooks</CardTitle>
            <Network className="w-4 h-4 text-cyber-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-blue">
              {metrics.totalPlaybooks}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Registered automation flows.
            </p>
          </CardContent>
        </Card>

        {/* Total Executions */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">Rule Runs</CardTitle>
            <Play className="w-4 h-4 text-cyber-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-orange">
              {metrics.totalExecutions}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Trigger matches registered.
            </p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="border-border bg-card/60 backdrop-blur-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">Success Rate</CardTitle>
            <ShieldCheck className="w-4 h-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-green">
              {metrics.successRate}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Percentage of fully completed action nodes.
            </p>
          </CardContent>
        </Card>

        {/* Failed Executions */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">Failed Runs</CardTitle>
            <AlertTriangle className="w-4 h-4 text-cyber-red" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-cyber-red">
              {metrics.failedExecutions}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Action block errors logged.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Trend Area Chart (Left 2 Columns) */}
        <Card className="lg:col-span-2 border-border bg-card/60 backdrop-blur-sm flex flex-col h-[400px]">
          <CardHeader className="pb-3 border-b border-border shrink-0">
            <CardTitle className="text-sm font-semibold">SOAR Execution Telemetry</CardTitle>
            <CardDescription className="text-[10px]">Daily success rate comparison for matching trigger rule flows.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-4 bg-black/10 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cyber-green)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--cyber-green)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cyber-red)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--cyber-red)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#120a2a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }} />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Area type="monotone" dataKey="success" name="Successful Executions" stroke="var(--cyber-green)" fillOpacity={1} fill="url(#colorSuccess)" strokeWidth={2} />
                <Area type="monotone" dataKey="failed" name="Failed Executions" stroke="var(--cyber-red)" fillOpacity={1} fill="url(#colorFailed)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume Bar Chart (Right 1 Column) */}
        <Card className="border-border bg-card/60 backdrop-blur-sm flex flex-col h-[400px]">
          <CardHeader className="pb-3 border-b border-border shrink-0">
            <CardTitle className="text-sm font-semibold">Automated Provisioning Volume</CardTitle>
            <CardDescription className="text-[10px]">Tally of incidents and case clusters generated automatically.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-4 bg-black/10 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#120a2a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }} />
                <Legend verticalAlign="top" height={36} iconType="rect" wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Created" name="Automated Provision" fill="var(--cyber-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* Navigation shortcuts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/automation/logs" className="block">
          <div className="p-4 rounded-lg border border-border bg-card/40 hover:bg-card/70 hover:border-cyber-blue/30 transition-all flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <TerminalIcon className="w-5 h-5 text-cyber-blue" />
              <div>
                <h4 className="text-xs font-semibold">Audit Execution Logs</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Drill down into step logs, failures, and latency metrics.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
        <Link href="/playbooks" className="block">
          <div className="p-4 rounded-lg border border-border bg-card/40 hover:bg-card/70 hover:border-cyber-blue/30 transition-all flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-cyber-blue" />
              <div>
                <h4 className="text-xs font-semibold">Playbook Visual Builder</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Wire React Flow nodes to deploy automated rules instantly.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      </div>

    </div>
  );
}
