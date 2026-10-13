"use client";

import React, { useState, useMemo } from "react";
import { Grid, ShieldAlert, BookOpen, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Aggregate {
  description: string;
  severity: string;
  count: number;
}

interface MitreClientProps {
  orgId: string;
  aggregates: Aggregate[];
}

interface Technique {
  id: string;
  name: string;
  description: string;
  remediation: string;
  mappedCategories: string[];
}

interface Tactic {
  name: string;
  techniques: Technique[];
}

const ATTACK_MATRIX: Tactic[] = [
  {
    name: "Initial Access",
    techniques: [
      {
        id: "T1190",
        name: "Exploit Public-Facing Application",
        description: "Adversaries may attempt to exploit a weakness in an Internet-facing host or application to gain initial access to system networks.",
        remediation: "Implement strict WAF rules, validate all HTTP input, and keep internet-facing frameworks patched.",
        mappedCategories: ["SQL_INJECTION", "XSS"]
      },
      {
        id: "T1566",
        name: "Phishing",
        description: "Adversaries may send phishing messages to gain access to credentials or execute malicious software on internal systems.",
        remediation: "Deploy email security gateways, enable DMARC/SPF, and conduct regular security awareness training.",
        mappedCategories: []
      },
      {
        id: "T1133",
        name: "External Remote Services",
        description: "Adversaries may leverage external-facing remote access services (e.g. VPN, RDP) to gain entry into corporate networks.",
        remediation: "Enforce MFA on all VPN/remote portals and place them behind Zero-Trust Network Access (ZTNA).",
        mappedCategories: []
      }
    ]
  },
  {
    name: "Execution",
    techniques: [
      {
        id: "T1059",
        name: "Command and Scripting Interpreter",
        description: "Adversaries may abuse command and scripting interpreters (shell, powershell, python) to execute commands, templates, or programs.",
        remediation: "Enable command-line logging, restrict shell execution permissions, and sanitize server-side subprocess arguments.",
        mappedCategories: ["COMMAND_INJECTION"]
      },
      {
        id: "T1203",
        name: "Exploitation for Client Execution",
        description: "Adversaries may exploit vulnerabilities in client applications to execute code when a user interacts with malicious content.",
        remediation: "Enforce sandbox policies on file executions and disable macros/scripting inside standard office suites.",
        mappedCategories: []
      }
    ]
  },
  {
    name: "Credential Access",
    techniques: [
      {
        id: "T1110",
        name: "Brute Force",
        description: "Adversaries may use brute force attacks (spraying, guessing, stuffing) to gain access to legitimate accounts.",
        remediation: "Enforce strong lock-out thresholds, implement rate-limiting rules on auth routes, and require multi-factor authentication.",
        mappedCategories: ["BRUTE_FORCE"]
      },
      {
        id: "T1552",
        name: "Unsecured Credentials",
        description: "Adversaries may search for private keys, cleartext passwords, or environment secrets stored in standard directories or source repositories.",
        remediation: "Deploy secret-scanning tools (e.g., git-secrets) and store credentials securely using HashiCorp Vault or Neon KMS.",
        mappedCategories: []
      }
    ]
  },
  {
    name: "Discovery",
    techniques: [
      {
        id: "T1083",
        name: "File and Directory Discovery",
        description: "Adversaries may enumerate directories, path structures, and critical configuration files to map the target environment.",
        remediation: "Implement strict path checks (prevent traversal), enforce directory index restrictions on web services, and audit process reads.",
        mappedCategories: ["DIRECTORY_TRAVERSAL"]
      },
      {
        id: "T1046",
        name: "Network Service Discovery",
        description: "Adversaries may scan network ports or probe services to discover open network pathways and software versions.",
        remediation: "Deploy intrusion prevention systems (IPS) to detect port-scanning signatures, and configure internal firewalls.",
        mappedCategories: []
      }
    ]
  },
  {
    name: "Impact",
    techniques: [
      {
        id: "T1498",
        name: "Network Denial of Service",
        description: "Adversaries may flood network services with garbage packets or heavy application requests to exhaust operational resources.",
        remediation: "Configure edge Cloudflare/AWS Shield DDoS protections and restrict ingress rates via specialized rate limiters.",
        mappedCategories: ["DDoS", "RATE_LIMIT_VIOLATION"]
      },
      {
        id: "T1486",
        name: "Data Encrypted for Impact",
        description: "Adversaries may encrypt data on target systems to interrupt availability and demand ransom.",
        remediation: "Maintain offline, immutable, versioned backups (e.g., Neon point-in-time recovery) and audit write velocity anomalies.",
        mappedCategories: []
      }
    ]
  }
];

export default function MitreClient({ aggregates }: MitreClientProps) {
  const router = useRouter();
  const [selectedTech, setSelectedTech] = useState<Technique | null>(ATTACK_MATRIX[0].techniques[0]);

  // Aggregate counts mapped to technique IDs
  const techniqueMetrics = useMemo(() => {
    const metrics: Record<string, { total: number; critical: number; high: number; medium: number }> = {};
    
    // Initialize
    ATTACK_MATRIX.forEach(tactic => {
      tactic.techniques.forEach(tech => {
        metrics[tech.id] = { total: 0, critical: 0, high: 0, medium: 0 };
      });
    });

    // Populate from database aggregates
    aggregates.forEach(agg => {
      ATTACK_MATRIX.forEach(tactic => {
        tactic.techniques.forEach(tech => {
          if (tech.mappedCategories.includes(agg.description)) {
            metrics[tech.id].total += agg.count;
            if (agg.severity === "CRITICAL") metrics[tech.id].critical += agg.count;
            else if (agg.severity === "HIGH") metrics[tech.id].high += agg.count;
            else metrics[tech.id].medium += agg.count;
          }
        });
      });
    });

    return metrics;
  }, [aggregates]);

  const handleRefresh = () => {
    router.refresh();
  };

  const getHeatStyle = (techId: string) => {
    const data = techniqueMetrics[techId];
    if (!data || data.total === 0) {
      return "bg-[#0f0923]/40 border-white/5 text-muted-foreground/60 hover:bg-[#1b103c]/30 hover:border-white/10";
    }
    
    if (data.critical > 0) {
      return "bg-cyber-red/10 border-cyber-red/30 text-cyber-red shadow-[0_0_15px_rgba(239,68,68,0.08)] hover:bg-cyber-red/20";
    }
    if (data.high > 0) {
      return "bg-cyber-orange/10 border-cyber-orange/30 text-cyber-orange shadow-[0_0_15px_rgba(249,115,22,0.08)] hover:bg-cyber-orange/20";
    }
    return "bg-cyber-yellow/10 border-cyber-yellow/30 text-cyber-yellow shadow-[0_0_15px_rgba(234,179,8,0.05)] hover:bg-cyber-yellow/20";
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <Grid className="w-6 h-6 text-cyber-blue" />
            MITRE ATT&CK Matrix Heatmap
          </h1>
          <p className="text-xs text-muted-foreground">
            Operational mapping of threat signatures against enterprise tactical vectors.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="h-9 border-border bg-card/40 flex items-center gap-2 hover:bg-secondary/40 font-mono text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          REFRESH AGGREGATES
        </Button>
      </div>

      {/* Heatmap Grid & details panel */}
      <div className="grid xl:grid-cols-4 gap-6">
        
        {/* Heatmap Matrix */}
        <div className="xl:col-span-3 overflow-x-auto">
          <div className="min-w-[700px] grid grid-cols-5 gap-3">
            {ATTACK_MATRIX.map((tactic) => (
              <div key={tactic.name} className="space-y-3 flex flex-col">
                {/* Tactic Header */}
                <div className="p-3 bg-secondary/50 border border-border rounded-lg text-center shrink-0">
                  <h3 className="font-semibold text-xs tracking-wider uppercase text-muted-foreground font-mono">
                    {tactic.name}
                  </h3>
                  <span className="text-[9px] text-white/50 block font-mono mt-0.5">
                    {tactic.techniques.length} Techniques
                  </span>
                </div>

                {/* Technique Cards */}
                <div className="space-y-2.5 flex-1">
                  {tactic.techniques.map((tech) => {
                    const count = techniqueMetrics[tech.id]?.total || 0;
                    const isSelected = selectedTech?.id === tech.id;
                    const heatStyle = getHeatStyle(tech.id);

                    return (
                      <div
                        key={tech.id}
                        onClick={() => setSelectedTech(tech)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${heatStyle} ${
                          isSelected ? "ring-1 ring-cyber-blue border-cyber-blue" : ""
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-[9px] font-mono font-bold bg-black/30 px-1 py-0.5 rounded text-white/60">
                            {tech.id}
                          </span>
                          {count > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 h-4 border-0 font-mono bg-black/40 text-inherit font-bold">
                              {count} Events
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold mt-2 leading-tight">
                          {tech.name}
                        </h4>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Technique Detail Sidebar */}
        <div className="xl:col-span-1">
          {selectedTech ? (
            <Card className="border-border bg-card/60 backdrop-blur-sm sticky top-20">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-cyber-blue/10 text-cyber-blue px-2 py-0.5 border border-cyber-blue/20 rounded">
                    {selectedTech.id}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono border-white/5 bg-white/5">
                    HEAT: {techniqueMetrics[selectedTech.id]?.total || 0} ALARMS
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold mt-2">
                  {selectedTech.name}
                </CardTitle>
                <CardDescription className="text-[10px]">MITRE Enterprise Matrix Tactic.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                {/* Description */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    Technique Description
                  </h4>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    {selectedTech.description}
                  </p>
                </div>

                {/* Alarm Aggregates */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Active Alarm Tally
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="bg-cyber-red/5 border border-cyber-red/10 rounded p-1.5">
                      <div className="text-[10px] text-cyber-red">CRIT</div>
                      <div className="text-xs font-extrabold text-white mt-0.5">{techniqueMetrics[selectedTech.id]?.critical || 0}</div>
                    </div>
                    <div className="bg-cyber-orange/5 border border-cyber-orange/10 rounded p-1.5">
                      <div className="text-[10px] text-cyber-orange">HIGH</div>
                      <div className="text-xs font-extrabold text-white mt-0.5">{techniqueMetrics[selectedTech.id]?.high || 0}</div>
                    </div>
                    <div className="bg-cyber-yellow/5 border border-cyber-yellow/10 rounded p-1.5">
                      <div className="text-[10px] text-cyber-yellow">MED</div>
                      <div className="text-xs font-extrabold text-white mt-0.5">{techniqueMetrics[selectedTech.id]?.medium || 0}</div>
                    </div>
                  </div>
                </div>

                {/* Mapped Categories */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Mapped Ingest Categories
                  </h4>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                    {selectedTech.mappedCategories.length > 0 ? (
                      selectedTech.mappedCategories.map(cat => (
                        <span key={cat} className="bg-black/30 border border-white/5 text-white/70 px-2 py-0.5 rounded">
                          {cat}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-[10px]">No active telemetry rules mapped.</span>
                    )}
                  </div>
                </div>

                {/* Remediation Guide */}
                <div className="space-y-1.5 bg-cyber-blue/5 border border-cyber-blue/20 rounded-lg p-3">
                  <h4 className="text-[10px] uppercase font-mono tracking-wider text-cyber-blue flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Security Remediation Plan
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                    {selectedTech.remediation}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-center text-xs p-6 font-mono">
              SELECT A TECHNIQUE CARD TO DRILL DOWN INTEL
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
