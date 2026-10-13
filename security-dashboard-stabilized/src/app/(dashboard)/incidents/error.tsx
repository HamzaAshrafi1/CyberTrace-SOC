"use client";

import React, { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IncidentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6 text-center">
      <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded-full text-cyber-red">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h2 className="text-base font-bold font-mono text-cyber-red uppercase">
          SECURE PROTOCOL FAILURE
        </h2>
        <p className="text-xs text-muted-foreground">
          An error occurred while communicating with the database layer. Make sure Neon credentials are valid.
        </p>
        {error.message && (
          <p className="text-[10px] bg-black/40 border border-border p-2 rounded font-mono text-cyber-orange text-left overflow-x-auto max-w-full">
            {error.message}
          </p>
        )}
      </div>
      <Button 
        variant="outline" 
        onClick={() => reset()} 
        className="text-xs border-border h-9 hover:bg-secondary"
      >
        Retry Protocol
      </Button>
    </div>
  );
}
