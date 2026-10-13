"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  ArrowRight, Shield, Activity, 
  Globe, Cpu, Play, X, ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { CinematicBackground } from "@/components/ui/CinematicBackground";

export default function LandingPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<"map" | "sim" | "copilot">("map");
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "complete">("idle");
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Ticking telemetry headers
  const [threatsPrevented, setThreatsPrevented] = useState(482931);
  const [ingestRate, setIngestRate] = useState(1480);

  useEffect(() => {
    const threatsInterval = setInterval(() => {
      setThreatsPrevented(prev => prev + Math.floor(Math.random() * 2) + 1);
    }, 2000);

    const ingestInterval = setInterval(() => {
      setIngestRate(prev => {
        const diff = Math.floor(Math.random() * 21) - 10;
        return Math.max(1350, Math.min(1600, prev + diff));
      });
    }, 1200);

    return () => {
      clearInterval(threatsInterval);
      clearInterval(ingestInterval);
    };
  }, []);

  // Run mock vulnerability scan sequence
  const startDiagnosticScan = () => {
    if (scanStatus !== "idle") return;
    setScanStatus("running");
    setScanLogs([]);

    const steps = [
      { text: "Initializing Aegis SOC Daemon (v19.4.2)...", delay: 300 },
      { text: "Binding log collector sockets to port 514 [SYSLOG]...", delay: 700 },
      { text: "Matching ingest streams with MITRE ATT&CK Matrix v14...", delay: 1200 },
      { text: "[!] WARNING: Detected potential brute-force attempt from IP 185.220.101.4", delay: 1800 },
      { text: "Triggering Playbook: AUTONOMIC_CONTAIN_SSH_BRUTE...", delay: 2400 },
      { text: "Playbook Action: Blocked IP 185.220.101.4 on Edge Firewall.", delay: 3000 },
      { text: "Evaluating compliance score with SOC2 Framework...", delay: 3600 },
      { text: "[+] Compliance evaluation complete: 94.8% passed.", delay: 4100 },
      { text: "[SUCCESS] SOC operational workspace fully secured. 0 active leaks.", delay: 4700 }
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setScanLogs(prev => [...prev, step.text]);
        if (index === steps.length - 1) {
          setScanStatus("complete");
        }
      }, step.delay);
    });
  };

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [scanLogs]);

  // Removed unused marqueeLogos

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden selection:bg-cyber-blue/30 selection:text-white font-sans cyber-grid-dots">
      {/* Cinematic background systems */}
      <CinematicBackground />

      {/* Global Header */}
      <header className="relative border-b border-border bg-[#030712]/30 backdrop-blur-md z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue shadow-[0_0_15px_rgba(0,229,255,0.1)]">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <span className="font-heading font-bold text-sm tracking-wider uppercase text-white">
              AEGIS<span className="text-cyber-blue">SOC</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-muted-foreground font-mono tracking-wide">
            <Link href="/overview" className="hover:text-cyber-blue transition-colors">DASHBOARD</Link>
            <Link href="/threat-map" className="hover:text-cyber-blue transition-colors">GEOGRAPHIC MAP</Link>
            <Link href="/soc" className="hover:text-cyber-blue transition-colors">SOC COMMAND</Link>
            <Link href="/lab" className="hover:text-cyber-blue transition-colors">CYBER RANGE</Link>
            <Link href="/chat" className="hover:text-cyber-blue transition-colors">COPILOT AI</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link 
              href="/sign-in" 
              className="text-xs font-mono font-semibold hover:text-white transition-colors px-3 py-1.5 text-muted-foreground"
            >
              SIGN_IN
            </Link>
            <Link 
              href="/overview"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-cyber-blue/10 border border-cyber-blue/40 px-5 text-xs font-bold text-cyber-blue shadow-[0_0_20px_rgba(0,229,255,0.05)] hover:bg-cyber-blue/20 transition-all font-mono uppercase tracking-wider"
            >
              LAUNCH COMMAND
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative max-w-7xl mx-auto px-6 pt-20 pb-20 z-20 space-y-24">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.12,
                delayChildren: 0.1
              }
            }
          }}
          className="text-center space-y-8 max-w-5xl mx-auto"
        >
          {/* Cyber Status Badge */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: -10 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyber-blue/5 border border-cyber-blue/20 text-[9px] font-mono font-bold text-cyber-blue tracking-wider uppercase"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-blue opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-blue"></span>
            </span>
            <span>AEGIS PLATFORM V19.5 // DYNAMIC COMMAND LAYER</span>
          </motion.div>

          {/* Large Title */}
          <motion.h1 
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 12 } }
            }}
            className="text-[38px] sm:text-[68px] md:text-[85px] lg:text-[110px] font-heading font-extrabold tracking-tight leading-[0.95] text-white"
          >
            Cyber Operations<br />
            <span className="bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-orange bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(0,229,255,0.08)]">
              Command Center
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0 }
            }}
            className="text-xs sm:text-sm md:text-base text-muted-foreground max-w-3xl mx-auto font-mono uppercase leading-relaxed tracking-wider"
          >
            Transform security telemetry into active protection. Real-time geographical mappings, MITRE attack simulations, and autonomic SOAR playbooks unified in a glassmorphic cockpit.
          </motion.p>

          {/* Active stats display */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1 }
            }}
            className="flex justify-center gap-8 py-3 text-left max-w-lg mx-auto border-y border-white/5 font-mono text-xs"
          >
            <div>
              <span className="text-[9px] text-muted-foreground uppercase block">INGEST SPEED</span>
              <span className="text-lg font-bold text-cyber-blue">{ingestRate} EV/SEC</span>
            </div>
            <div className="border-r border-white/5" />
            <div>
              <span className="text-[9px] text-muted-foreground uppercase block">THREATS DEACTIVATED</span>
              <span className="text-lg font-bold text-cyber-green">{threatsPrevented.toLocaleString("en-US")}</span>
            </div>
            <div className="border-r border-white/5" />
            <div>
              <span className="text-[9px] text-muted-foreground uppercase block">COMPLIANCE STATE</span>
              <span className="text-lg font-bold text-cyber-orange">100% AUDITED</span>
            </div>
          </motion.div>

          {/* Call-to-actions */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0 }
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            <Link 
              href="/overview"
              className="w-full sm:w-auto px-8 py-4 bg-cyber-blue text-background font-bold text-xs rounded-lg shadow-[0_0_30px_rgba(0,229,255,0.2)] hover:shadow-[0_0_40px_rgba(0,229,255,0.4)] transition-all duration-300 hover:scale-[1.01] flex items-center justify-center gap-2 font-mono uppercase tracking-wider"
            >
              LAUNCH SOC WORKSTATION
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button 
              onClick={() => setIsDemoOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-secondary/50 hover:bg-secondary text-white border border-border transition-all duration-300 font-bold text-xs rounded-lg flex items-center justify-center gap-2 font-mono uppercase tracking-wider"
            >
              <Play className="w-4 h-4 fill-white text-white" />
              PLAY SIMULATION
            </button>
          </motion.div>
        </motion.div>

        {/* Interactive Workspace Mockups Showcase */}
        <section className="space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-white">SYSTEM CONSOLE WORKSPACES</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Select a cockpit workstation to preview operational telemetry.</p>
          </div>

          <div className="max-w-5xl mx-auto space-y-4">
            {/* Tabs */}
            <div className="flex justify-center gap-2">
              <button 
                onClick={() => setActiveWorkspace("map")}
                className={`px-4 py-2 border rounded-lg text-xs font-mono transition-all duration-200 ${
                  activeWorkspace === "map" 
                    ? "bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue shadow-[0_0_15px_rgba(0,229,255,0.05)]" 
                    : "border-white/5 text-muted-foreground hover:text-white"
                }`}
              >
                GEOGRAPHICAL THREAT MAP
              </button>
              <button 
                onClick={() => setActiveWorkspace("sim")}
                className={`px-4 py-2 border rounded-lg text-xs font-mono transition-all duration-200 ${
                  activeWorkspace === "sim" 
                    ? "bg-cyber-purple/10 border-cyber-purple/30 text-cyber-purple shadow-[0_0_15px_rgba(139,92,246,0.05)]" 
                    : "border-white/5 text-muted-foreground hover:text-white"
                }`}
              >
                ATTACK RANGE SIMULATOR
              </button>
              <button 
                onClick={() => setActiveWorkspace("copilot")}
                className={`px-4 py-2 border rounded-lg text-xs font-mono transition-all duration-200 ${
                  activeWorkspace === "copilot" 
                    ? "bg-cyber-green/10 border-cyber-green/30 text-cyber-green shadow-[0_0_15px_rgba(0,255,136,0.05)]" 
                    : "border-white/5 text-muted-foreground hover:text-white"
                }`}
              >
                SECURITY COPILOT RAG AI
              </button>
            </div>

            {/* Screen Container */}
            <div className="relative rounded-xl border border-white/5 bg-[#07111f]/40 backdrop-blur-md overflow-hidden min-h-[400px] shadow-2xl p-4 md:p-6 flex flex-col justify-between">
              <div className="radar-sweep-effect absolute top-[-50%] left-[-50%] opacity-40 pointer-events-none" />
              
              {/* Header inside mock */}
              <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4 shrink-0 font-mono text-[9px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyber-blue animate-ping" />
                  <span className="text-white font-bold uppercase">CONSOLE::{activeWorkspace.toUpperCase()}</span>
                </div>
                <span>STATUS: MOCKED SYSTEM LINK</span>
              </div>

              {/* Mock Content */}
              <div className="flex-1 flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {activeWorkspace === "map" && (
                    <motion.div
                      key="map"
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="grid md:grid-cols-4 gap-4 flex-1 items-center text-xs"
                    >
                      {/* Left stats */}
                      <div className="space-y-4 font-mono text-[10px] md:col-span-1 bg-black/30 p-4 border border-white/5 rounded-lg">
                        <span className="text-muted-foreground font-bold tracking-widest block uppercase border-b border-white/5 pb-1 mb-2">GEOLOCATION INDEX</span>
                        <div className="space-y-1">
                          <div className="flex justify-between"><span>RUSSIAN_FEDERATION</span><span className="text-cyber-red">92%</span></div>
                          <div className="flex justify-between"><span>PEOPLES_REP_CHINA</span><span className="text-cyber-orange">84%</span></div>
                          <div className="flex justify-between"><span>NORTH_KOREA</span><span className="text-cyber-orange">78%</span></div>
                          <div className="flex justify-between"><span>UNITED_STATES</span><span className="text-cyber-blue">45%</span></div>
                        </div>
                      </div>

                      {/* Center Map (SVG World map mock) */}
                      <div className="md:col-span-3 h-[240px] flex items-center justify-center relative bg-black/40 border border-white/5 rounded-lg overflow-hidden p-2">
                        <svg viewBox="0 0 600 240" className="w-full h-full text-white/5">
                          <rect width="100%" height="100%" fill="transparent" />
                          {/* Grid vectors */}
                          <path d="M 0,60 L 600,60 M 0,120 L 600,120 M 0,180 L 600,180 M 150,0 L 150,240 M 300,0 L 300,240 M 450,0 L 450,240" stroke="rgba(0, 229, 255, 0.02)" strokeWidth="0.5" />
                          {/* Simulated continents outline */}
                          <path d="M 50,80 Q 80,60 120,70 T 180,90 T 220,130 T 200,180 Z M 320,60 Q 380,40 440,60 T 520,100 T 500,160 T 420,140 Z" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                          
                          {/* Origin -> Target arcs */}
                          <path d="M 100,80 Q 200,30 350,110" fill="none" stroke="var(--cyber-red)" strokeWidth="1.5" strokeDasharray="4,4" />
                          <path d="M 460,90 Q 320,20 120,70" fill="none" stroke="var(--cyber-orange)" strokeWidth="1" />
                          
                          {/* Marker pins */}
                          <circle cx="100" cy="80" r="3" fill="var(--cyber-red)" />
                          <circle cx="350" cy="110" r="4" fill="var(--cyber-blue)" />
                          <circle cx="350" cy="110" r="8" fill="none" stroke="var(--cyber-blue)" strokeWidth="0.5" className="animate-ping" style={{ animationDuration: "2s" }} />
                          <circle cx="460" cy="90" r="3" fill="var(--cyber-orange)" />
                          <circle cx="120" cy="70" r="4" fill="var(--cyber-blue)" />
                        </svg>
                        <div className="absolute bottom-2 right-2 bg-[#0c0520]/90 border border-white/5 rounded px-2 py-0.5 font-mono text-[8px] text-muted-foreground uppercase flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-cyber-red animate-ping" />
                          THREAT_INBOUND: DE_PORT_SCAN
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeWorkspace === "sim" && (
                    <motion.div
                      key="sim"
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="grid md:grid-cols-4 gap-4 flex-1 items-center text-xs"
                    >
                      {/* Left stats */}
                      <div className="space-y-4 font-mono text-[10px] md:col-span-1 bg-black/30 p-4 border border-white/5 rounded-lg">
                        <span className="text-muted-foreground font-bold tracking-widest block uppercase border-b border-white/5 pb-1 mb-2">SIMULATION LAB</span>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyber-red" />
                            <span>APT28_SQL_INJECTION</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyber-orange" />
                            <span>SSH_DICTIONARY_ATTACK</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                            <span>K8S_KUBELET_EXPLOIT</span>
                          </div>
                        </div>
                      </div>

                      {/* Center visual range panel */}
                      <div className="md:col-span-3 h-[240px] flex flex-col justify-between bg-black/40 border border-white/5 rounded-lg p-4 font-mono">
                        <div className="flex justify-between items-center text-[10px] border-b border-white/5 pb-2">
                          <span className="text-cyber-purple font-bold">CYBER_RANGE_STATUS: SIMULATING_APT28</span>
                          <Badge className="bg-cyber-red/10 text-cyber-red border border-cyber-red/30 py-0 text-[8px]">ACTIVE TARGET</Badge>
                        </div>

                        <div className="flex-1 flex flex-col justify-center gap-2 text-[9px] py-2">
                          <div className="text-cyber-red flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3 text-cyber-red" />
                            <span>[ATTACK_INGRESS] INJECT: username=admin&apos; OR &apos;1&apos;=&apos;1 into api/v1/auth</span>
                          </div>
                          <div className="text-cyber-orange flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3 text-cyber-orange" />
                            <span>[DETECTION_ENGINE] Pattern matched: SQL_INJECTION threat rule. Severity: HIGH</span>
                          </div>
                          <div className="text-cyber-green flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3 text-cyber-green" />
                            <span>[SOAR_AUTOMATION] Execution: AUTONOMIC_CONTAIN_SQL_INJECT. IP blocked.</span>
                          </div>
                          <div className="text-muted-foreground flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3 text-white/20" />
                            <span>[AUDIT] Incident ticket INC-9483 generated automatically.</span>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 text-[9px] pt-2 border-t border-white/5">
                          <span className="text-muted-foreground">EVENTS: 247</span>
                          <span className="text-cyber-purple">STATE: THREAT CONVERSION TEST PASS</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeWorkspace === "copilot" && (
                    <motion.div
                      key="copilot"
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="grid md:grid-cols-4 gap-4 flex-1 items-center text-xs"
                    >
                      {/* Left specs */}
                      <div className="space-y-4 font-mono text-[10px] md:col-span-1 bg-black/30 p-4 border border-white/5 rounded-lg">
                        <span className="text-muted-foreground font-bold tracking-widest block uppercase border-b border-white/5 pb-1 mb-2">AI COGNITIVE METRICS</span>
                        <div className="space-y-1">
                          <div className="flex justify-between"><span>VECTORS MATCHED</span><span className="text-cyber-green">1,482</span></div>
                          <div className="flex justify-between"><span>RAG CONTEXT TOKENS</span><span className="text-cyber-blue">8.4k</span></div>
                          <div className="flex justify-between"><span>LLM LATENCY</span><span className="text-cyber-blue">248ms</span></div>
                        </div>
                      </div>

                      {/* Center Chat panel */}
                      <div className="md:col-span-3 h-[240px] flex flex-col justify-between bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[10px] space-y-2">
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {/* User message */}
                          <div className="flex justify-end">
                            <div className="bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue p-2.5 rounded-lg max-w-[85%]">
                              Are we vulnerable to CVE-2024-38077 based on log streams?
                            </div>
                          </div>

                          {/* AI Response */}
                          <div className="flex justify-start">
                            <div className="bg-[#0b1727]/70 border border-white/5 p-2.5 rounded-lg max-w-[85%] space-y-2">
                              <p className="text-foreground">Analysis of ingested log schemas from <span className="text-cyber-blue">k8s-node-cluster</span> shows 0 occurrences of RPC service buffer leaks associated with CVE-2024-38077.</p>
                              <p className="text-cyber-green font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyber-green" />
                                COMPLIANCE CONFIRMED - NO CVE HITS
                              </p>
                              <div className="pt-2 border-t border-white/5 text-[8px] text-muted-foreground flex gap-2">
                                <span>Matched chroma://cve_matrix_v2</span>
                                <span>Audit: log_ingress_k8s.json</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-white/5 shrink-0">
                          <div className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-muted-foreground/50 text-[9px]">
                            Ask Aegis Copilot (e.g. show compliance audit status)...
                          </div>
                          <Button size="sm" className="h-7 px-3 bg-cyber-blue text-background font-bold text-[9px]">SEND</Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom link CTA */}
              <div className="mt-4 border-t border-white/5 pt-3 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground uppercase">TIGHT INTEGRATION WITH CLERK MULTI-TENANCY CORE</span>
                <Link href="/overview" className="text-cyber-blue font-bold flex items-center gap-1 hover:underline">
                  EXPLORE REAL CONSOLES <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Pipeline Architecture flowchart */}
        <section className="space-y-8 max-w-5xl mx-auto">
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-white">THE THREAT INGESTION PIPELINE</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Full end-to-end data lifecycle from collectors to automated resolution.</p>
          </div>

          <div className="grid md:grid-cols-5 gap-4 relative">
            {/* Step 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0 }}
              className="p-4 bg-[#07111f]/30 border border-white/5 rounded-lg font-mono text-[10px] space-y-2 relative"
            >
              <div className="text-cyber-blue font-bold">01 // LOG INGESTION</div>
              <p className="text-[9px] text-muted-foreground">API collectors ingest Docker, Wazuh, Syslog streams under isolated org schemas.</p>
            </motion.div>
            
            {/* Step 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="p-4 bg-[#07111f]/30 border border-white/5 rounded-lg font-mono text-[10px] space-y-2 relative"
            >
              <div className="text-cyber-purple font-bold">02 // DETECT ENGINE</div>
              <p className="text-[9px] text-muted-foreground">Threat events grouped by signature patterns, assigning severity matrix vectors.</p>
            </motion.div>

            {/* Step 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="p-4 bg-[#07111f]/30 border border-white/5 rounded-lg font-mono text-[10px] space-y-2 relative"
            >
              <div className="text-cyber-orange font-bold">03 // MITRE ATT&CK</div>
              <p className="text-[9px] text-muted-foreground">Threats mapped to adversarial tactics. Auto-tagging dossier records.</p>
            </motion.div>

            {/* Step 4 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="p-4 bg-[#07111f]/30 border border-white/5 rounded-lg font-mono text-[10px] space-y-2 relative"
            >
              <div className="text-cyber-red font-bold">04 // SOAR PLAYBOOK</div>
              <p className="text-[9px] text-muted-foreground">Workflows trigger to contain threat. IPs blocked at edge firewall.</p>
            </motion.div>

            {/* Step 5 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="p-4 bg-[#07111f]/30 border border-white/5 rounded-lg font-mono text-[10px] space-y-2 relative"
            >
              <div className="text-cyber-green font-bold">05 // COPILOT INDEX</div>
              <p className="text-[9px] text-muted-foreground">Anomalies indexed in ChromaDB for fast retrieval during AI chats.</p>
            </motion.div>
          </div>
        </section>

        {/* Feature Grid highlighting Core Capabilities */}
        <section className="space-y-10 max-w-5xl mx-auto">
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-white">COMMAND CENTER SPECIFICATIONS</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Designed to support Principal Security Operations Analysts.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1: Threat Hunting */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0 }}
              className="p-5 bg-card/40 rounded-xl border border-white/5 hover:border-cyber-blue/30 transition-all duration-300 shadow-md space-y-3"
            >
              <div className="p-2 bg-cyber-blue/10 rounded-lg text-cyber-blue w-fit">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase">Threat Hunting Workstation</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Full-pane query workstation allowing custom queries, historical timelines, and threat dossiers mapping APT actor groups.
              </p>
            </motion.div>

            {/* Feature 2: Attack Simulation */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="p-5 bg-card/40 rounded-xl border border-white/5 hover:border-cyber-purple/30 transition-all duration-300 shadow-md space-y-3"
            >
              <div className="p-2 bg-cyber-purple/10 rounded-lg text-cyber-purple w-fit">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase">Attack Simulation Lab</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Safely simulate Red-Team intrusions (MITRE Caldera protocols, Atomic Red Team) in a sandbox environment to test detection-to-response cycles.
              </p>
            </motion.div>

            {/* Feature 3: Playbooks & SOAR */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="p-5 bg-card/40 rounded-xl border border-white/5 hover:border-cyber-orange/30 transition-all duration-300 shadow-md space-y-3"
            >
              <div className="p-2 bg-cyber-orange/10 rounded-lg text-cyber-orange w-fit">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase">Autonomous SOAR Playbooks</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Orchestrate node actions using logical flow builders. Implement incident containment immediately without human delay.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Interactive Terminal Call-to-action */}
        <section className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-white">DIAGNOSTIC PORT CHECKS</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Run a simulated threat-hunt test on our virtual tenant core nodes.</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.5 }}
            className="border border-white/10 rounded-xl bg-black/80 overflow-hidden shadow-2xl"
          >
            {/* Bar */}
            <div className="h-9 border-b border-white/10 bg-card/40 px-4 flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyber-red/60" />
                <span className="w-2 h-2 rounded-full bg-cyber-orange/60" />
                <span className="w-2 h-2 rounded-full bg-cyber-green/60" />
              </div>
              <span>aegis_diagnostic_terminal.sh</span>
              <span>DEV_STAGE</span>
            </div>

            {/* Terminal Body */}
            <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] text-cyber-green bg-[#030712] space-y-2">
              <div>{"// Press the button below to initiate diagnostic telemetry trace //"}</div>
              {scanLogs.map((log, index) => (
                <div key={index} className="animate-fadeIn">
                  {log.startsWith("[!]") ? (
                    <span className="text-cyber-red font-semibold">{log}</span>
                  ) : log.startsWith("[+]") || log.startsWith("[SUCCESS]") ? (
                    <span className="text-cyber-green font-semibold">{log}</span>
                  ) : (
                    <span className="text-muted-foreground">{log}</span>
                  )}
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>

            {/* Terminal Controls */}
            <div className="p-3 border-t border-white/10 bg-card/20 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-[9px] font-mono text-muted-foreground uppercase">
                {scanStatus === "idle" && "READY TO TEST GEOLOC COLLECTOR NODES"}
                {scanStatus === "running" && "EXECUTING PLAYBOOK AUTOMATIONS..."}
                {scanStatus === "complete" && "DIAGNOSTIC TRACE PASSED SUCCESSFULLY"}
              </span>
              <div className="flex gap-2">
                {scanStatus === "idle" && (
                  <Button 
                    size="sm"
                    onClick={startDiagnosticScan}
                    className="h-8 px-4 bg-cyber-blue text-background font-bold text-[10px] font-mono tracking-wider"
                  >
                    RUN AEGIS DIAGNOSTIC
                  </Button>
                )}
                {scanStatus === "running" && (
                  <Button 
                    size="sm"
                    disabled
                    className="h-8 px-4 bg-cyber-orange/20 text-cyber-orange border border-cyber-orange/30 font-bold text-[10px] font-mono tracking-wider animate-pulse"
                  >
                    TRACING CYBER VECTORS...
                  </Button>
                )}
                {scanStatus === "complete" && (
                  <Link 
                    href="/overview"
                    className="inline-flex h-8 items-center justify-center rounded px-4 bg-cyber-green text-background font-bold text-[10px] font-mono tracking-wider shadow-[0_0_15px_rgba(0,255,136,0.2)] hover:opacity-90"
                  >
                    ENTER COMMAND PORTAL
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        </section>

        {/* Compliance Certificates Badges Row */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center space-y-4"
        >
          <p className="text-[10px] uppercase font-semibold font-mono tracking-widest text-muted-foreground">Certified SaaS Framework Scopes</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-card/25 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-blue" />
              <span className="font-mono text-[10px] font-bold uppercase text-white">SOC2 TYPE II Compliance</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-card/25 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-green" />
              <span className="font-mono text-[10px] font-bold uppercase text-white">ISO 27001 Certified</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-card/25 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-orange" />
              <span className="font-mono text-[10px] font-bold uppercase text-white">GDPR Privacy Compliant</span>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Watch Demo Modal */}
      {isDemoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#030712]">
              <span className="font-mono text-xs font-bold text-gray-300 uppercase">Aegis SOC Command Center Simulation</span>
              <button 
                onClick={() => setIsDemoOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Video Player */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                autoPlay
                controls
                className="w-full h-full object-cover"
              >
                <source src="https://cdn.pixabay.com/video/2023/10/20/185790-876356614_large.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative border-t border-white/5 bg-card/20 py-8 z-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-wider text-white">AEGIS<span className="text-cyber-blue">SOC</span></span>
            <span>&copy; {new Date().getFullYear()} Aegis Systems Inc.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">PRIVACY_POLICY</a>
            <a href="#" className="hover:text-white transition-colors">TERMS_OF_SERVICE</a>
            <a href="#" className="hover:text-white transition-colors">SYSTEM_STATUS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}


