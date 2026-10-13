import React from "react";
import { RefreshCw } from "lucide-react";

export default function ComplianceLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <RefreshCw className="w-8 h-8 text-cyber-blue animate-spin" />
      <div className="space-y-1 text-center">
        <p className="text-sm font-semibold tracking-wider font-mono text-foreground uppercase animate-pulse">
          Decrypting Secure Stream
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          Syncing with Neon cluster...
        </p>
      </div>
    </div>
  );
}
