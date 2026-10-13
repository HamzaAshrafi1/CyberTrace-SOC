"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Shield, LayoutDashboard, ShieldAlert, AlertOctagon, 
  CheckSquare, FileText, Bot, Settings, Menu, X, 
  Bell, Volume2, VolumeX,
  Database, Users, Tv, Briefcase, Archive, Grid, BarChart3, Network,
  Search, History, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserButton, OrganizationSwitcher, useAuth } from "@clerk/nextjs";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { ParticleField } from "@/components/ui/ParticleField";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string;
  badgeVariant?: "destructive" | "default" | "secondary" | "outline";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [utcTime, setUtcTime] = useState("");
  const [criticalCount, setCriticalCount] = useState(3);
  const [activeThreats, setActiveThreats] = useState(148);
  const [systemHealth, setSystemHealth] = useState(99.8);

  const [mockRole, setMockRole] = useState("Admin");
  const [mockOrg, setMockOrg] = useState("org_playwright_test");
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    const testModeActive = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === "true";
    setIsTestMode(testModeActive);
    if (testModeActive) {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
      };
      setMockRole(getCookie("playwright_role") || "Admin");
      setMockOrg(getCookie("playwright_org_id") || "org_playwright_test");
    }
  }, []);

  const handleMockRoleChange = (role: string) => {
    setMockRole(role);
    document.cookie = `playwright_role=${role}; path=/; max-age=31536000`;
    window.location.reload();
  };

  const handleMockOrgChange = (org: string) => {
    setMockOrg(org);
    document.cookie = `playwright_org_id=${org}; path=/; max-age=31536000`;
    window.location.reload();
  };
  
  const { orgId: clerkOrgId } = useAuth();
  const orgId = isTestMode ? mockOrg : clerkOrgId;
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; severity: string }>>([
    { id: "1", title: "Intrusion Alert (Severity 9.8)", message: "Unusual SSH attempts on server-cluster-04.", severity: "CRITICAL" },
    { id: "2", title: "Demo notification", message: "Illustrative example only; no verified DDoS containment.", severity: "HIGH" },
  ]);

  useRealtimeEvents(orgId || undefined, (type, payload) => {
    if (type === "incident") {
      setNotifications(prev => [
        {
          id: payload.id || Math.random().toString(),
          title: `Incident: ${payload.title}`,
          message: payload.description || "",
          severity: payload.severity || "HIGH"
        },
        ...prev
      ].slice(0, 10));
      setCriticalCount(prev => prev + 1);
    }
  });


  // Update live UTC clock and mock live counters
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace("GMT", "UTC"));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const telemetryInterval = setInterval(() => {
      setActiveThreats(prev => {
        const diff = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(120, Math.min(200, prev + diff));
      });
      setSystemHealth(prev => {
        const diff = (Math.random() * 0.1 - 0.05); // -0.05 to +0.05
        return parseFloat(Math.max(99.6, Math.min(100.0, prev + diff)).toFixed(2));
      });
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(telemetryInterval);
    };
  }, []);

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

  const navGroups: NavGroup[] = [
    {
      groupName: "SOC Command",
      items: [
        { name: "SOC Overview", href: "/overview", icon: LayoutDashboard },
        { name: "Threat Map Console", href: "/threat-map", icon: Globe, badge: "Map", badgeVariant: "default" },
        { name: "Live SOC Command", href: "/soc", icon: Tv, badge: "Live", badgeVariant: "destructive" },
        { name: "SOAR Dashboard", href: "/automation", icon: Network },
        { name: "SOAR Playbooks", href: "/playbooks", icon: Network },
        { name: "Case Workspace", href: "/cases", icon: Briefcase },
        { name: "Evidence Vault", href: "/vault", icon: Archive },
        { name: "MITRE ATT&CK", href: "/mitre", icon: Grid },
        { name: "Simulation Lab", href: "/lab", icon: Shield },
      ]
    },
    {
      groupName: "Threat Hunting",
      items: [
        { name: "Console Workstation", href: "/hunt", icon: Search },
        { name: "Hunt Timeline", href: "/hunt/timeline", icon: History },
        { name: "Hunt Analytics", href: "/hunt/analytics", icon: BarChart3 },
      ]
    },
    {
      groupName: "Threat Intel",
      items: [
        { name: "Threat Feed", href: "/threats", icon: ShieldAlert, badge: "3 Active", badgeVariant: "destructive" },
        { name: "Log Ingestion", href: "/ingestion", icon: Database },
        { name: "Flow Collection", href: "/flows", icon: Database },
        { name: "Incidents Hub", href: "/incidents", icon: AlertOctagon, badge: "2", badgeVariant: "secondary" },
      ]
    },
    {
      groupName: "Compliance",
      items: [
        { name: "Compliance Checker", href: "/compliance", icon: CheckSquare },
        { name: "Reports Center", href: "/reports", icon: FileText },
      ]
    },
    {
      groupName: "AI Operations",
      items: [
        { name: "Security AI Chat", href: "/chat", icon: Bot },
      ]
    },
    {
      groupName: "Administration",
      items: [
        { name: "Team Management", href: "/team", icon: Users },
        { name: "Settings & API Keys", href: "/settings", icon: Settings },
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card/60 backdrop-blur-md border-r border-border relative z-20">
      {/* Sidebar Header / Logo */}
      <div className="flex items-center gap-2 px-6 h-16 border-b border-border">
        <div className="p-1.5 rounded bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue shadow-[0_0_10px_rgba(6,182,212,0.1)]">
          <Shield className="w-5 h-5" />
        </div>
        <span className="font-semibold tracking-wider text-sm">
          AEGIS<span className="text-cyber-blue">SOC</span>
        </span>
        <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1.5 border-cyber-blue/30 text-cyber-blue font-mono bg-cyber-blue/5">
          SaaS
        </Badge>
      </div>

      {/* Organization Switcher (Clerk B2B or Test Mode custom panel) */}
      {isTestMode ? (
        <div className="p-4 border-b border-border space-y-3 font-mono text-[10px]">
          <div className="space-y-1">
            <span className="text-muted-foreground uppercase tracking-widest block font-bold text-[8px]">Mock Active Org</span>
            <select
              value={mockOrg}
              id="playwright-org-switcher"
              onChange={(e) => handleMockOrgChange(e.target.value)}
              className="w-full bg-background border border-cyber-blue/30 text-cyber-blue text-xs rounded-lg px-2 h-9 focus:outline-none focus:ring-1 focus:ring-cyber-blue"
            >
              <option value="org_playwright_test">Playwright Test Org</option>
              <option value="org_alpha">Alpha Security</option>
              <option value="org_beta">Beta Operations</option>
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground uppercase tracking-widest block font-bold text-[8px]">Mock RBAC Role</span>
            <select
              value={mockRole}
              id="playwright-role-switcher"
              onChange={(e) => handleMockRoleChange(e.target.value)}
              className="w-full bg-background border border-cyber-blue/30 text-cyber-blue text-xs rounded-lg px-2 h-9 focus:outline-none focus:ring-1 focus:ring-cyber-blue"
            >
              <option value="Admin">Admin (Full Access)</option>
              <option value="Analyst">Analyst (Triage operations)</option>
              <option value="Viewer">Viewer (Read-only)</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-border">
          <OrganizationSwitcher 
            afterCreateOrganizationUrl="/overview"
            afterSelectOrganizationUrl="/overview"
            afterLeaveOrganizationUrl="/onboarding"
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
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full justify-between bg-background/50 hover:bg-secondary/40 border border-border text-foreground text-xs px-3 h-10 rounded-lg flex flex-row items-center",
                organizationSwitcherTriggerIcon: "text-muted-foreground",
                organizationPreviewTextContainer: "text-left",
                organizationPreviewTitle: "text-xs font-semibold text-foreground",
                organizationPreviewSubtitle: "text-[9px] text-muted-foreground",
              }
            }}
          />
        </div>
      )}

      {/* Grouped Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.groupName} className="space-y-1">
            <span className="px-3 text-[9px] font-mono font-bold tracking-wider text-muted-foreground/50 uppercase block mb-1">
              {group.groupName}
            </span>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/overview" && item.href !== "/hunt" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all duration-200 group relative ${
                      isActive 
                        ? "bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue shadow-[0_0_15px_rgba(0,229,255,0.08)]" 
                        : "text-muted-foreground border border-transparent hover:bg-secondary/40 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-3.5 h-3.5 transition-transform group-hover:scale-105 ${
                        isActive ? "text-cyber-blue" : "text-muted-foreground group-hover:text-foreground"
                      }`} />
                      <span className="font-semibold">{item.name}</span>
                    </div>
                    {isActive && (
                      <span className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-cyber-blue rounded-r" />
                    )}
                    {item.badge && (
                      <Badge 
                        variant={item.badgeVariant || "default"}
                        className={`text-[9px] px-1 py-0 h-4.5 font-mono ${
                          item.badgeVariant === "destructive" 
                            ? "bg-red-500/20 text-red-500 border border-red-500/30" 
                            : "bg-secondary border border-border"
                        }`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Session Footer (Clerk UserButton or custom Test profile banner) */}
      <div className="p-4 border-t border-border bg-background/30 flex items-center justify-between">
        {isTestMode ? (
          <div className="w-full p-2.5 border border-cyber-blue/35 bg-cyber-blue/5 rounded-lg flex items-center justify-between text-xs font-mono">
            <div className="flex flex-col">
              <span className="font-semibold text-foreground capitalize font-sans">Playwright {mockRole}</span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[130px]">{mockRole.toLowerCase()}@playwright-test.com</span>
            </div>
            <Badge className="bg-cyber-blue/20 text-cyber-blue text-[9px] border-0">TEST</Badge>
          </div>
        ) : (
          <UserButton 
            showName={true}
            appearance={{
              variables: {
                colorPrimary: "oklch(0.7 0.19 200)",
                colorBackground: "oklch(0.13 0.018 240)",
                colorText: "oklch(0.93 0.01 240)",
                colorTextSecondary: "oklch(0.65 0.02 240)",
              },
              elements: {
                rootBox: "w-full flex items-center justify-between",
                userButtonTrigger: "w-full justify-between hover:bg-secondary/40 p-1.5 rounded-lg flex flex-row items-center border border-border/40 bg-background/30",
                userButtonBox: "flex flex-row items-center",
                userButtonOuterIdentifier: "text-xs font-semibold text-foreground",
              }
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground flex overflow-hidden cyber-grid-dots">
      {/* Background SOC scanline layer and particle container */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-background/50 pointer-events-none z-0" />
      <div className="scanlines" />
      <ParticleField />

      {/* Desktop Sidebar (Left) */}
      <aside className={`hidden md:block shrink-0 transition-all duration-300 h-screen sticky top-0 relative z-10 ${
        isSidebarOpen ? "w-64" : "w-0 overflow-hidden border-r-0"
      }`}>
        {sidebarContent}
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative z-10">
        {/* Global Telemetry Ribbon */}
        <div className="h-6 shrink-0 bg-[#050a15]/90 border-b border-white/5 font-mono text-[9px] text-cyber-blue flex items-center overflow-hidden relative z-20 select-none">
          <div className="animate-marquee flex whitespace-nowrap gap-10">
            {Array(4).fill(0).map((_, idx) => (
              <span key={idx}>
                [DEVELOPMENT] Decorative counters and example visuals are not measured security results. External response actions require the approval/outbox phase.
              </span>
            ))}
          </div>
        </div>

        {/* Diagnostic Top Header */}
        <header className="h-16 shrink-0 border-b border-border bg-card/20 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-6">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sidebar toggle button (desktop) */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex text-muted-foreground hover:text-foreground h-8 w-8 hover:bg-secondary/40"
            >
              <Menu className="w-4 h-4" />
            </Button>

            {/* Sidebar toggle button (mobile) */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMobileOpen(true)}
              className="flex md:hidden text-muted-foreground hover:text-foreground h-8 w-8 hover:bg-secondary/40"
            >
              <Menu className="w-4 h-4" />
            </Button>

            {/* Mission Control Title / System Health */}
            <div className="hidden lg:flex items-center gap-2 border-r border-white/5 pr-3">
              <span className="font-heading font-bold text-xs tracking-widest text-cyber-blue uppercase">AEGIS HUB</span>
            </div>

            {/* SOC Health */}
            <div className="hidden xl:flex items-center gap-1.5 bg-cyber-green/5 border border-cyber-green/20 px-2 py-1 rounded text-[9px] font-mono text-cyber-green">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
              SOC_HEALTH: {systemHealth}%
            </div>

            {/* Active Threats */}
            <div className="flex items-center gap-1.5 bg-cyber-red/5 border border-cyber-red/20 px-2 py-1 rounded text-[9px] font-mono text-cyber-red">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-red animate-pulse" />
              ACTIVE_THREATS: {activeThreats}
            </div>

            {/* Open Incidents */}
            <div className="flex items-center gap-1.5 bg-cyber-orange/5 border border-cyber-orange/20 px-2 py-1 rounded text-[9px] font-mono text-cyber-orange">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-orange animate-pulse" />
              INCIDENTS: {criticalCount} OPEN
            </div>

            {/* Threat Intel */}
            <div className="hidden xl:flex items-center gap-1.5 bg-cyber-purple/5 border border-cyber-purple/20 px-2 py-1 rounded text-[9px] font-mono text-cyber-purple">
              INTEL: MAPPED
            </div>

            {/* SOAR Status */}
            <div className="hidden lg:flex items-center gap-1.5 bg-cyber-blue/5 border border-cyber-blue/20 px-2 py-1 rounded text-[9px] font-mono text-cyber-blue">
              SOAR: ACTIVE
            </div>

            {/* AI Status */}
            <div className="hidden lg:flex items-center gap-1.5 bg-cyber-green/5 border border-cyber-green/20 px-2 py-1 rounded text-[9px] font-mono text-cyber-green">
              AI_AGENT: DEPLOYED
            </div>

            {/* UTC Time */}
            <div className="hidden sm:block text-[10px] font-mono text-muted-foreground bg-background/30 border border-border/50 px-3 py-1.5 rounded-lg">
              {utcTime || "UTC CLOCK INIT"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Critical Alerts Counter */}
            <div className="hidden md:flex items-center gap-2 border border-cyber-orange/20 bg-cyber-orange/5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-cyber-orange">
              <span>ALERTS: {criticalCount} CRIT</span>
            </div>

            {/* Global SOC Threat Level Indicator */}
            <div className="hidden sm:flex items-center gap-2 border border-cyber-red/20 bg-cyber-red/5 px-3 py-1.5 rounded-lg text-xs font-mono text-cyber-red">
              <span className="w-2 h-2 rounded-full bg-cyber-red animate-ping" />
              <span>DEFCON 3 / ACTIVE THREAT</span>
            </div>

            {/* Alarm Sound Toggle */}
            <Button
              variant="outline"
              size="icon"
              className={`h-9 w-9 border-border ${isMuted ? "text-muted-foreground" : "text-cyber-orange border-cyber-orange/30 bg-cyber-orange/5 animate-pulse"}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyber-orange" />}
            </Button>

            {/* Notification Bell */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="icon" className="h-9 w-9 border-border relative text-muted-foreground hover:text-foreground">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyber-red" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-80 bg-card border-border text-foreground p-2">
                <DropdownMenuLabel className="text-xs text-muted-foreground">SOC Critical Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-2 border rounded text-xs ${
                        notif.severity === "CRITICAL" 
                          ? "bg-cyber-red/5 border-cyber-red/20 text-cyber-red" 
                          : notif.severity === "HIGH"
                            ? "bg-cyber-orange/5 border-cyber-orange/20 text-cyber-orange"
                            : "bg-cyber-yellow/5 border-cyber-yellow/20 text-cyber-yellow"
                      }`}
                    >
                      <p className="font-semibold">{notif.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{notif.message}</p>
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-6 relative">
          {children}
        </main>
      </div>

      {/* Mobile Drawer (Left overlay) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          {/* Content */}
          <div className="relative w-64 h-full">
            {sidebarContent}
            {/* Close button */}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-4 right-[-50px] border-border bg-card/60 backdrop-blur-md h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
