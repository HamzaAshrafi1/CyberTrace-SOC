"use client";

import React, { useState, useEffect } from "react";
import { 
  BarChart3, RefreshCw, ShieldAlert, Award, Compass, Layers, 
  MapPin, Target, Activity, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from "recharts";
import { getHuntAnalyticsAction } from "../actions";

interface AnalyticsData {
  totalThreats: number;
  criticalThreats: number;
  highThreats: number;
  savedHuntsCount: number;
  successRate: number;
  topAttackTypes: { name: string; value: number }[];
  topCountries: { name: string; value: number }[];
  topTargets: { name: string; value: number }[];
  discoveryTrend: { date: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = () => {
    setIsLoading(true);
    getHuntAnalyticsAction()
      .then(setData)
      .catch(err => console.error("Failed to load analytics:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const COLORS = ["#06b6d4", "#f97316", "#eab308", "#ef4444", "#a855f7", "#10b981"];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyber-blue" /> Threat Hunting Analytics
          </h1>
          <p className="text-xs text-muted-foreground">
            SaaS-wide key operational metrics, trends, and threat actor behavior logs.
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadAnalytics}
          disabled={isLoading}
          className="h-8 border-border text-xs flex items-center gap-1.5"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Reload Metrics
        </Button>
      </div>

      {isLoading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-cyber-blue" />
          <span className="text-xs text-muted-foreground font-mono">Aggregating threat metrics database...</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          
          {/* ====================================================
              ROW 1: SCORECARD STATS
              ==================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono font-semibold text-muted-foreground uppercase">Total Ingested Threats</CardTitle>
                <ShieldAlert className="w-4 h-4 text-cyber-blue" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">{data.totalThreats}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Matched threat signatures</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono font-semibold text-muted-foreground uppercase">Critical/High Alarms</CardTitle>
                <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-red-500">
                  {data.criticalThreats} <span className="text-xs text-muted-foreground font-normal">/ {data.highThreats}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">High severity threat vectors</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono font-semibold text-muted-foreground uppercase">Hunt Success Rate</CardTitle>
                <Award className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-green-500">{data.successRate}%</div>
                <p className="text-[10px] text-muted-foreground mt-1">Percentage of triaged threats</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/45 backdrop-blur-md">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-mono font-semibold text-muted-foreground uppercase">Saved Hunt Rules</CardTitle>
                <Layers className="w-4 h-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-purple-400">{data.savedHuntsCount}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Registered search queries</p>
              </CardContent>
            </Card>

          </div>

          {/* ====================================================
              ROW 2: CHARTS (Discovery Trend & Attack Types)
              ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Discovery Trend Chart */}
            <Card className="border-border bg-card/40 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyber-blue" /> Threat Discovery Trends
                  </CardTitle>
                  <CardDescription className="text-[10px]">Volume of security alerts discovered over time</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64">
                  {data.discoveryTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.discoveryTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a1e5c" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: "#0c0520", borderColor: "#1f114c" }} />
                        <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Threat Volumetrics" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                      NO TREND DATA AVAILABLE
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Attack Types Distribution */}
            <Card className="border-border bg-card/40 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-cyber-blue" /> Top Attack Vectors
                </CardTitle>
                <CardDescription className="text-[10px]">Distribution of captured attack types</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64">
                  {data.topAttackTypes.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.topAttackTypes} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a1e5c" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={90} />
                        <Tooltip contentStyle={{ backgroundColor: "#0c0520", borderColor: "#1f114c" }} />
                        <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} name="Occurrences" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                      NO ATTACK DATA AVAILABLE
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ====================================================
              ROW 3: GEOGRAPHY & TARGETS
              ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Geographical Distribution */}
            <Card className="border-border bg-card/40 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-cyber-blue" /> Source Countries
                </CardTitle>
                <CardDescription className="text-[10px]">Top threat geolocated origins</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="h-56 w-full md:w-1/2">
                  {data.topCountries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.topCountries}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {data.topCountries.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#0c0520", borderColor: "#1f114c" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                      NO GEOLOCATION DATA
                    </div>
                  )}
                </div>
                
                {/* Legend list */}
                <div className="w-full md:w-1/2 space-y-2.5 font-mono text-xs">
                  {data.topCountries.map((c, i) => (
                    <div key={c.name} className="flex justify-between items-center p-2 bg-background/40 border border-border/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-semibold text-foreground/80">{c.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-bold">{c.value} events</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Target Systems */}
            <Card className="border-border bg-card/40 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyber-blue" /> Top Attacked Targets
                </CardTitle>
                <CardDescription className="text-[10px]">Host node and system intrusion counts</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64">
                  {data.topTargets.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.topTargets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a1e5c" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: "#0c0520", borderColor: "#1f114c" }} />
                        <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Alerts Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                      NO TARGET ALERTS RECORDED
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

        </div>
      ) : (
        <div className="text-center py-20 text-xs text-muted-foreground/60 font-mono">
          FAILED TO RENDER THREAT HUNTING METRICS
        </div>
      )}
      
    </div>
  );
}
