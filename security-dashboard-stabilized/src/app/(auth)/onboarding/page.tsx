"use client";

import { OrganizationList, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shield } from "lucide-react";

export default function OnboardingPage() {
  const { orgId, isLoaded } = useAuth();
  const router = useRouter();

  // If the user already has an active organization, redirect directly to dashboard overview
  useEffect(() => {
    if (isLoaded && orgId) {
      router.push("/overview");
    }
  }, [isLoaded, orgId, router]);

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-[10%] right-[5%] w-[40rem] h-[40rem] bg-cyber-blue/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Brand Logo Header */}
      <div className="flex items-center gap-2 mb-6 relative z-10">
        <div className="p-1.5 rounded-lg bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue shadow-[0_0_12px_rgba(6,182,212,0.15)]">
          <Shield className="w-5 h-5" />
        </div>
        <span className="font-semibold text-lg tracking-wider text-foreground">
          AEGIS<span className="text-cyber-blue">SOC</span>
        </span>
      </div>

      <div className="relative z-10 text-center space-y-4 max-w-lg">
        <div className="space-y-1.5 mb-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">
            Initialize Security Tenant
          </h2>
          <p className="text-xs text-muted-foreground">
            Aegis SOC requires an Organization workspace to isolate logs, event feeds, and compliance reports.
          </p>
        </div>

        {/* Clerk OrganizationList component */}
        <OrganizationList 
          hidePersonal={true}
          afterCreateOrganizationUrl="/overview"
          afterSelectOrganizationUrl="/overview"
          appearance={{
            variables: {
              colorPrimary: "oklch(0.7 0.19 200)",
              colorBackground: "oklch(0.13 0.018 240)",
              colorText: "oklch(0.93 0.01 240)",
              colorTextSecondary: "oklch(0.65 0.02 240)",
              colorInputBackground: "oklch(0.11 0.015 240)",
              colorInputBorder: "oklch(0.18 0.02 240 / 70%)",
            },
            elements: {
              card: "border border-border/80 shadow-2xl bg-card/60 backdrop-blur-md mx-auto",
              organizationListTrigger: "bg-background border-border text-foreground hover:bg-secondary/40",
              formFieldLabel: "text-muted-foreground",
              formButtonPrimary: "bg-primary text-primary-foreground hover:opacity-90 transition-opacity",
              organizationSwitcherTrigger: "bg-background border-border text-foreground hover:bg-secondary/40",
              rootBox: "mx-auto",
              createOrganizationTrigger: "bg-background border border-border text-foreground hover:bg-secondary/40 text-xs",
            }
          }}
        />
      </div>
    </div>
  );
}
