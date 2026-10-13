"use client";

import React, { useState } from "react";
import { Server, Database, Shield, Globe, Terminal, Cpu, Activity, AlertTriangle, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


interface Node {
  id: string;
  name: string;
  ip: string;
  status: "SECURE" | "WARNING" | "ATTACKED";
  cpu: string;
  x: number;
  y: number;
  icon: React.ComponentType<any>;
  neighbors: string[];
}

const INITIAL_NODES: Node[] = [
  { id: "ingress", name: "API Ingress Gateway", ip: "192.168.10.1", status: "SECURE", cpu: "12%", x: 100, y: 70, icon: Globe, neighbors: ["core", "endpoints"] },
  { id: "core", name: "SOC Core Firewall", ip: "10.0.0.1", status: "WARNING", cpu: "28%", x: 260, y: 130, icon: Shield, neighbors: ["kubernetes", "database", "cloud"] },
  { id: "endpoints", name: "User Endpoints", ip: "192.168.100.80", status: "SECURE", cpu: "8%", x: 100, y: 200, icon: Terminal, neighbors: ["core"] },
  { id: "kubernetes", name: "K8s Microservices", ip: "10.1.0.12", status: "ATTACKED", cpu: "84%", x: 420, y: 50, icon: Cpu, neighbors: ["cloud", "database"] },
  { id: "database", name: "Postgres Storage Cluster", ip: "10.2.0.40", status: "SECURE", cpu: "18%", x: 420, y: 210, icon: Database, neighbors: ["cloud"] },
  { id: "cloud", name: "Cloud Assets AWS/GCP", ip: "172.16.89.5", status: "SECURE", cpu: "5%", x: 580, y: 130, icon: Server, neighbors: [] },
];

export default function NetworkTopology() {
  const nodes = INITIAL_NODES;
  const [selectedNode, setSelectedNode] = useState<Node>(INITIAL_NODES[1]); // Default Core
  const [pulsePath, setPulsePath] = useState<{ from: string; to: string }[]>([]);

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    
    // Simulate propagation pulses along connection routes
    const newPulses = node.neighbors.map(n => ({
      from: node.id,
      to: n
    }));
    setPulsePath(newPulses);
    
    // Reset pulses after 1.5s
    setTimeout(() => {
      setPulsePath([]);
    }, 1500);
  };

  const getStatusColor = (status: Node["status"]) => {
    if (status === "SECURE") return "text-cyber-green stroke-cyber-green";
    if (status === "WARNING") return "text-cyber-orange stroke-cyber-orange";
    return "text-cyber-red stroke-cyber-red";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full h-full min-h-[300px]">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash-pulse {
          0% {
            stroke-dashoffset: 40;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .anim-telemetry-path {
          stroke-dasharray: 8, 4;
          animation: dash-pulse 1.2s linear infinite;
        }
      `}} />

      {/* SVG Topology Graph (Left 3 Columns) */}
      <div className="md:col-span-3 border border-white/5 bg-black/35 rounded-lg p-3 relative flex items-center justify-center overflow-hidden min-h-[280px]">
        <div className="absolute top-2.5 left-3 flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground uppercase pointer-events-none z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-pulse" />
          <span>Interactive Asset Grid // PING_FREQ: 1.2HZ</span>
        </div>

        <svg viewBox="0 0 680 280" className="w-full h-full p-2 relative z-10 select-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.1)" />
            </marker>
            <marker id="arrow-pulse" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cyber-red)" />
            </marker>
          </defs>

          {/* Links (Topology Connections) */}
          {nodes.map(n => 
            n.neighbors.map(nbId => {
              const target = nodes.find(o => o.id === nbId);
              if (!target) return null;

              const isPulseActive = pulsePath.some(p => p.from === n.id && p.to === target.id);
              return (
                <g key={`${n.id}-${nbId}`}>
                  {/* Background shadow line */}
                  <line
                    x1={n.x}
                    y1={n.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeWidth={3}
                  />
                  {/* Foreground active line */}
                  <motion.line
                    x1={n.x}
                    y1={n.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={isPulseActive ? "var(--cyber-red)" : "rgba(0, 229, 255, 0.15)"}
                    strokeWidth={isPulseActive ? 2 : 1}
                    className="anim-telemetry-path"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    markerEnd={`url(#${isPulseActive ? "arrow-pulse" : "arrow"})`}
                  />
                </g>
              );
            })
          )}

          {/* Node Graphic Groups */}
          {nodes.map((n, index) => {
            const Icon = n.icon;
            const isSelected = selectedNode.id === n.id;
            return (
              <motion.g 
                key={n.id} 
                transform={`translate(${n.x - 20}, ${n.y - 20})`}
                onClick={() => handleNodeClick(n)}
                className="cursor-pointer group"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.08, type: "spring", stiffness: 120 }}
                whileHover={{ scale: 1.08 }}
              >
                {/* Outer ring */}
                <circle 
                  cx="20" 
                  cy="20" 
                  r={isSelected ? 24 : 20} 
                  fill="#07111f" 
                  stroke={isSelected ? "var(--cyber-blue)" : "rgba(255,255,255,0.08)"}
                  strokeWidth={isSelected ? 2 : 1}
                  className="transition-all duration-300"
                />

                {/* Selected Node Halo */}
                {isSelected && (
                  <circle
                    cx="20"
                    cy="20"
                    r={30}
                    fill="none"
                    stroke="var(--cyber-blue)"
                    strokeWidth={0.5}
                    className="animate-pulse opacity-45"
                  />
                )}

                {/* Pulsing warning node ring */}
                {(n.status === "ATTACKED" || n.status === "WARNING") && (
                  <circle 
                    cx="20" 
                    cy="20" 
                    r={26} 
                    fill="none" 
                    stroke={n.status === "ATTACKED" ? "var(--cyber-red)" : "var(--cyber-orange)"} 
                    strokeWidth={1}
                    className="animate-ping"
                    style={{ animationDuration: "2s" }}
                    opacity={0.4}
                  />
                )}

                {/* Status indicator dot */}
                <circle
                  cx="32"
                  cy="8"
                  r="3.5"
                  className={`${
                    n.status === "SECURE" ? "fill-cyber-green" :
                    n.status === "WARNING" ? "fill-cyber-orange" : "fill-cyber-red"
                  }`}
                />

                {/* Node icon */}
                <g transform="translate(11, 11)" className={getStatusColor(n.status)}>
                  <Icon className="w-4.5 h-4.5" />
                </g>

                {/* Text Label */}
                <text 
                  x="20" 
                  y="52" 
                  textAnchor="middle" 
                  className={`text-[8px] font-mono transition-colors uppercase ${
                    isSelected ? "fill-cyber-blue font-bold" : "fill-muted-foreground group-hover:fill-foreground"
                  }`}
                >
                  {n.id}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* Selected Node Details Floating Command Module (Right 1 Column) */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={selectedNode.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="border border-white/5 bg-card/45 backdrop-blur-md rounded-lg p-4 flex flex-col justify-between font-mono text-[9px] relative overflow-hidden"
        >
          <div className="absolute top-[-50%] left-[-50%] radar-sweep-effect opacity-15 pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="border-b border-white/5 pb-2">
              <span className="uppercase text-[7px] text-muted-foreground flex items-center gap-1">
                <Wifi className="w-3 h-3 text-cyber-blue" /> ASSET_CLASS:
              </span>
              <h4 className="text-xs font-bold text-white uppercase mt-0.5">{selectedNode.name}</h4>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[7px] text-muted-foreground uppercase">NODE_IP:</span>
                <p className="text-foreground font-semibold mt-0.5">{selectedNode.ip}</p>
              </div>
              <div>
                <span className="text-[7px] text-muted-foreground uppercase">STATUS:</span>
                <p className={`font-semibold mt-0.5 flex items-center gap-1 ${
                  selectedNode.status === "SECURE" ? "text-cyber-green" :
                  selectedNode.status === "WARNING" ? "text-cyber-orange" : "text-cyber-red"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedNode.status === "SECURE" ? "bg-cyber-green" :
                    selectedNode.status === "WARNING" ? "bg-cyber-orange" : "bg-cyber-red animate-ping"
                  }`} />
                  {selectedNode.status}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[7px] text-muted-foreground uppercase flex items-center justify-between">
                <span>CPU_LOAD:</span>
                <span>{selectedNode.cpu}</span>
              </span>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <motion.div 
                  className={`h-full rounded-full ${
                    selectedNode.status === "SECURE" ? "bg-cyber-green" :
                    selectedNode.status === "WARNING" ? "bg-cyber-orange" : "bg-cyber-red"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: selectedNode.cpu }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {selectedNode.status === "ATTACKED" && (
              <div className="p-2 border border-cyber-red/20 bg-cyber-red/5 rounded-lg flex items-center gap-2 text-cyber-red animate-pulse">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-[8px] uppercase font-bold tracking-wider leading-none">Intrusion Attempt Blocked by SOAR agent</span>
              </div>
            )}
          </div>

          <div className="border-t border-white/5 pt-2.5 mt-4 flex items-center justify-between text-[7px] text-muted-foreground uppercase relative z-10">
            <span className="flex items-center gap-1 text-cyber-green">
              <Activity className="w-3 h-3 animate-pulse" />
              TELEMETRY_LINK: SECURE
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
