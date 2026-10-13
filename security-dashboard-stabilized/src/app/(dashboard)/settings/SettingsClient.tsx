"use client";

import React, { useState } from "react";
import { 
  Copy, Check, Radio, Shield, 
  Server, CreditCard, Trash2, Plus, MessageSquare
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createLogSourceAction, deleteLogSourceAction } from "./actions";
import { updateSlackWebhookAction } from "../playbooks/actions";

interface LogSource {
  id: string;
  name: string;
  apiKey: string;
  createdAt: Date | string;
}

interface SettingsClientProps {
  logSources: LogSource[];
  orgName: string;
  clerkOrgId: string;
  initialSlackWebhookUrl: string;
}

export default function SettingsClient({
  logSources,
  orgName,
  clerkOrgId,
  initialSlackWebhookUrl,
}: SettingsClientProps) {
  const [newSourceName, setNewSourceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(initialSlackWebhookUrl);
  const [isSlackSaving, setIsSlackSaving] = useState(false);
  const [slackStatus, setSlackStatus] = useState<string | null>(null);

  const handleSaveSlackWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSlackSaving(true);
    setSlackStatus(null);
    try {
      await updateSlackWebhookAction(slackWebhookUrl);
      setSlackStatus("Slack Webhook URL saved successfully.");
      setTimeout(() => setSlackStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setSlackStatus("Failed to save Slack Webhook.");
    } finally {
      setIsSlackSaving(false);
    }
  };

  const handleCopy = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    setIsSubmitting(true);
    try {
      await createLogSourceAction(newSourceName);
      setNewSourceName("");
    } catch (err) {
      console.error("Failed to create log source:", err);
      alert("Failed to register log source.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this log source? This will invalidate its API key.")) return;

    try {
      await deleteLogSourceAction(id);
    } catch (err) {
      console.error("Failed to delete log source:", err);
      alert("Failed to delete log source.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
          Platform Settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage your tenant organization credentials, billing preferences, and log ingestion keys.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Org Profile */}
        <Card className="border-border bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4.5 h-4.5 text-cyber-blue" />
              Tenant Organization Profile
            </CardTitle>
            <CardDescription className="text-xs">Configure your B2B SaaS identifier synced with Clerk Org.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 max-w-md">
              <Label htmlFor="org-name" className="text-xs text-muted-foreground">Organization Display Name</Label>
              <Input 
                id="org-name" 
                readOnly
                value={orgName} 
                className="bg-background/50 border-border text-foreground text-xs focus-visible:ring-cyber-blue/40"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">Clerk Tenant ID:</span>
                <span className="font-mono bg-secondary/80 px-2 py-0.5 rounded border border-border">{clerkOrgId}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">Database Pool:</span>
                <span className="text-cyber-green flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyber-green" /> Neon-West-1
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log Ingestion Sources Manager */}
        <Card className="border-border bg-card/60 relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-56 h-56 bg-cyber-blue/5 rounded-full blur-[50px] pointer-events-none" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Radio className="w-4.5 h-4.5 text-cyber-blue animate-pulse" />
                Log Ingestion Sources
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[9px] border-cyber-blue/30 text-cyber-blue bg-cyber-blue/5">
                {logSources.length} Connected
              </Badge>
            </div>
            <CardDescription className="text-xs">Register firewalls and services that push telemetry payloads to the Aegis ingestion API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Create form */}
            <form onSubmit={handleCreate} className="space-y-2 max-w-lg">
              <Label htmlFor="source-name" className="text-xs text-muted-foreground">Register New Log Source</Label>
              <div className="flex gap-2">
                <Input 
                  id="source-name"
                  placeholder="e.g. k8s-gateway-ingress"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-background/80 border-border text-foreground text-xs focus-visible:ring-cyber-blue/50"
                />
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !newSourceName.trim()}
                  className="bg-primary text-primary-foreground text-xs hover:opacity-90 h-9 shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Register
                </Button>
              </div>
            </form>

            {/* List Table */}
            <div className="border border-border rounded-lg overflow-hidden bg-background/30">
              <Table>
                <TableHeader className="bg-background/50">
                  <TableRow className="border-b border-border">
                    <TableHead className="text-xs">Source Name</TableHead>
                    <TableHead className="text-xs">API Ingest Token</TableHead>
                    <TableHead className="text-xs">Created At</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logSources.length > 0 ? (
                    logSources.map((source) => (
                      <TableRow key={source.id} className="border-b border-border hover:bg-secondary/10 transition-colors">
                        <TableCell className="text-xs font-semibold">{source.name}</TableCell>
                        <TableCell className="font-mono text-xs text-cyber-orange flex items-center gap-2">
                          <span>{source.apiKey.slice(0, 10)}...{source.apiKey.slice(-4)}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleCopy(source.id, source.apiKey)}
                            className="h-7 w-7 border-border hover:text-foreground shrink-0"
                          >
                            {copiedKeyId === source.id ? <Check className="w-3 h-3 text-cyber-green" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono" suppressHydrationWarning>
                          {new Date(source.createdAt).toISOString().split('T')[0]}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(source.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-cyber-red hover:bg-cyber-red/5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground font-mono">
                        NO LOG SOURCES REGISTERED
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Code Helper */}
            {logSources.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyber-blue" />
                  cURL Log Ingestion Example:
                </p>
                <pre className="p-3 bg-black/60 border border-border rounded font-mono text-[10px] text-cyber-blue leading-relaxed overflow-x-auto whitespace-pre-wrap">
{`curl -X POST "http://localhost:8000/api/v1/ingest" \\
  -H "Authorization: Bearer ${logSources[0].apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "${logSources[0].name}",
    "ip": "185.220.101.4",
    "message": "SQL Injection attempt: admin OR 1=1"
  }'`}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slack Webhook Alerts Configuration */}
        <Card className="border-border bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4.5 h-4.5 text-cyber-blue" />
              SOAR Slack Integration Webhook
            </CardTitle>
            <CardDescription className="text-xs">Provide a target incoming Slack Webhook URL to dispatch automated playbook threat notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveSlackWebhook} className="space-y-3 max-w-lg">
              <div className="flex gap-2">
                <Input 
                  id="slack-webhook"
                  placeholder="Enter Slack Webhook URL"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  className="bg-background/80 border-border text-foreground text-xs focus-visible:ring-cyber-blue/50"
                />
                <Button 
                  type="submit" 
                  disabled={isSlackSaving}
                  className="bg-primary text-primary-foreground text-xs hover:opacity-90 h-9 shrink-0 flex items-center gap-1"
                >
                  Save URL
                </Button>
              </div>
              {slackStatus && (
                <p className="text-[10px] font-mono text-cyber-green">{slackStatus}</p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Subscription Plan */}
        <Card className="border-border bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4.5 h-4.5 text-cyber-blue" />
              SaaS Subscription Plan
            </CardTitle>
            <CardDescription className="text-xs">View quotas and ingestion capacity constraints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <p className="text-xs font-semibold text-foreground">AI Cyber Agent Tier</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Renews automatically next month.</p>
              </div>
              <Badge className="bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue font-mono text-[10px] hover:bg-cyber-blue/10">
                $799/month
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono">Monthly Ingest Volume</p>
                <p className="font-semibold mt-1">42.8 GB / 250 GB</p>
                <div className="w-full bg-secondary h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-cyber-blue h-full" style={{ width: "17%" }} />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono">Connected Nodes Limit</p>
                <p className="font-semibold mt-1">{logSources.length} / Unlimited</p>
                <div className="w-full bg-secondary h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-cyber-green h-full" style={{ width: logSources.length > 0 ? "50%" : "0%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
