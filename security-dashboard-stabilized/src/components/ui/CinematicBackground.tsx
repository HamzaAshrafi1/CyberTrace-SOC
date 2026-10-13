"use client";

import React from "react";
import { ParticleField } from "./ParticleField";

export function CinematicBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* Layer 1: Animated Tactical Grid */}
      <div className="absolute inset-0 cyber-grid-dots opacity-40" />
      
      {/* Layer 2: Particle Field */}
      <ParticleField />
      
      {/* Layer 3: Ambient Glow System */}
      <div className="absolute top-[-10%] left-[-10%] w-[50rem] h-[50rem] bg-gradient-to-tr from-cyber-blue/5 to-cyber-purple/5 rounded-full blur-[140px] opacity-70" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45rem] h-[45rem] bg-gradient-to-bl from-cyber-orange/3 to-cyber-blue/5 rounded-full blur-[120px] opacity-50" />
      <div className="absolute top-[35%] left-[35%] w-[30rem] h-[30rem] bg-cyber-red/2 rounded-full blur-[110px] opacity-30 animate-pulse" style={{ animationDuration: "8s" }} />

      {/* Layer 4: Moving Scan Lines */}
      <div className="scanlines opacity-50" />

      {/* Layer 5: Depth Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#030712_95%)]" />
    </div>
  );
}
