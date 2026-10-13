"use client";

import React, { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";

// Standard CDN for world atlas
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export interface AttackPath {
  id: string;
  from: [number, number]; // [lng, lat]
  to: [number, number];   // [lng, lat]
  severity: string;
  sourceIp: string;
  target: string;
}

interface ThreatMapProps {
  attacks: AttackPath[];
}

const SOC_HUBS = [
  { name: "New York HQ", coordinates: [-74.006, 40.7128] as [number, number] },
  { name: "London SOC", coordinates: [-0.1278, 51.5074] as [number, number] },
  { name: "Tokyo SOC", coordinates: [139.6917, 35.6895] as [number, number] },
  { name: "Singapore SOC", coordinates: [103.8519, 1.3521] as [number, number] },
];

export default function ThreatMap({ attacks }: ThreatMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center bg-[#070214] rounded-xl border border-white/5 animate-pulse">
        <span className="text-muted-foreground text-sm font-mono">INITIALIZING GLOBAL ATTACK VECTOR GRAPH...</span>
      </div>
    );
  }

  function getStrokeColor(severity: string) {
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        return "#ef4444"; // Red
      case "HIGH":
        return "#f97316"; // Orange
      case "MEDIUM":
        return "#eab308"; // Yellow
      default:
        return "#06b6d4"; // Cyber blue
    }
  }

  return (
    <div className="relative w-full h-[500px] bg-[#070214] rounded-xl border border-white/5 overflow-hidden shadow-[inset_0_0_30px_rgba(6,182,212,0.05)]">
      {/* Map Header Overlay */}
      <div className="absolute top-4 left-4 z-10 font-mono text-xs text-muted-foreground pointer-events-none bg-[#0c0520]/80 backdrop-blur-md px-3 py-1.5 border border-white/5 rounded-lg space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyber-blue animate-ping" />
          <span className="text-white font-semibold">WORLD THREAT GRAPH</span>
        </div>
        <div className="text-[10px]">VECTOR SOURCE: REAL-TIME INGEST</div>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-10 font-mono text-[10px] text-muted-foreground pointer-events-none bg-[#0c0520]/80 backdrop-blur-md px-3 py-2 border border-white/5 rounded-lg space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-1 bg-red-500 rounded" />
          <span>CRITICAL THREAT</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-1 bg-orange-500 rounded" />
          <span>HIGH THREAT</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-1 bg-yellow-500 rounded" />
          <span>MEDIUM THREAT</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-1 bg-cyber-blue rounded" />
          <span>CLEAN LOG / INFO</span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .attack-line-anim {
          stroke-dasharray: 8 4;
          animation: dash 2s linear infinite;
        }
        .ping-circle {
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

        {/* Attack Vector Paths */}
        {attacks.map((attack) => (
          <g key={attack.id}>
            <Line
              from={attack.from}
              to={attack.to}
              stroke={getStrokeColor(attack.severity)}
              strokeWidth={attack.severity === "CRITICAL" ? 2.5 : 1.5}
              strokeLinecap="round"
              className="attack-line-anim"
            />
            {/* Pulsing origin marker */}
            <Marker coordinates={attack.from}>
              <circle r={2.5} fill={getStrokeColor(attack.severity)} />
              <circle
                r={6}
                fill="none"
                stroke={getStrokeColor(attack.severity)}
                strokeWidth={1}
                className="ping-circle"
                opacity={0.7}
              />
            </Marker>
          </g>
        ))}

        {/* SOC Hub Markers */}
        {SOC_HUBS.map((hub) => (
          <Marker key={hub.name} coordinates={hub.coordinates}>
            <g transform="translate(-8, -8)" className="cursor-pointer">
              <circle cx="8" cy="8" r="4" fill="#06b6d4" />
              <circle
                cx="8"
                cy="8"
                r="10"
                fill="none"
                stroke="#06b6d4"
                strokeWidth={1}
                className="ping-circle"
                opacity={0.5}
              />
              <title>{hub.name}</title>
            </g>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
