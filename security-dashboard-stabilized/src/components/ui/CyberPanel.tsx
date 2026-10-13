import React from "react";
import { cn } from "@/lib/utils";

interface CyberPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: "cyber-blue" | "cyber-green" | "cyber-red" | "cyber-purple" | "cyber-orange";
  children: React.ReactNode;
}

export function CyberPanel({
  className,
  glowColor = "cyber-blue",
  children,
  ...props
}: CyberPanelProps) {
  const glowShadow = {
    "cyber-blue": "hover:shadow-[0_0_20px_rgba(0,229,255,0.08)] hover:border-cyber-blue/30",
    "cyber-green": "hover:shadow-[0_0_20px_rgba(0,255,136,0.08)] hover:border-cyber-green/30",
    "cyber-red": "hover:shadow-[0_0_20px_rgba(255,77,109,0.08)] hover:border-cyber-red/30",
    "cyber-purple": "hover:shadow-[0_0_20px_rgba(139,92,246,0.08)] hover:border-cyber-purple/30",
    "cyber-orange": "hover:shadow-[0_0_20px_rgba(255,138,0,0.08)] hover:border-cyber-orange/30",
  }[glowColor];

  const borderAccent = {
    "cyber-blue": "group-hover:bg-cyber-blue",
    "cyber-green": "group-hover:bg-cyber-green",
    "cyber-red": "group-hover:bg-cyber-red",
    "cyber-purple": "group-hover:bg-cyber-purple",
    "cyber-orange": "group-hover:bg-cyber-orange",
  }[glowColor];

  return (
    <div
      className={cn(
        "bg-[#07111f]/40 backdrop-blur-md border border-white/5 rounded-xl shadow-[inset_0_0_15px_rgba(255,255,255,0.01)] transition-all duration-300 relative overflow-hidden group",
        glowShadow,
        className
      )}
      {...props}
    >
      {/* Corner telemetry dots */}
      <div className={cn("absolute top-1.5 left-1.5 w-1 h-1 bg-white/10 rounded-full opacity-60 transition-all", borderAccent)} />
      <div className={cn("absolute top-1.5 right-1.5 w-1 h-1 bg-white/10 rounded-full opacity-60 transition-all", borderAccent)} />
      <div className={cn("absolute bottom-1.5 left-1.5 w-1 h-1 bg-white/10 rounded-full opacity-60 transition-all", borderAccent)} />
      <div className={cn("absolute bottom-1.5 right-1.5 w-1 h-1 bg-white/10 rounded-full opacity-60 transition-all", borderAccent)} />
      
      {children}
    </div>
  );
}
