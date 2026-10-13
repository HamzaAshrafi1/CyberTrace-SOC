"use client";

import React, { useState, useEffect } from "react";
import { 
  Shield, Mail, CheckCircle, Plus, 
  Search, Activity, UserMinus, UserCheck, UserX, Loader2, 
  RefreshCw, FileText, Sliders, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

import {
  getTeamMembersAction,
  inviteTeamMemberAction,
  getClerkInvitationsAction,
  revokeInvitationAction,
  updateMemberRoleAction,
  updateMemberStatusAction,
  removeTeamMemberAction,
  getAuditLogsAction,
  updateNotificationPreferencesAction,
  getUserActivityHistoryAction
} from "./actions";

interface TeamClientProps {
  initialMembers: any[];
  initialInvitations: any[];
  initialAuditLogs: any[];
  initialPreferences: any;
}

export default function TeamClient({
  initialMembers,
  initialInvitations,
  initialAuditLogs,
  initialPreferences,
}: TeamClientProps) {

  // State arrays
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [preferences, setPreferences] = useState(initialPreferences);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected user for activity metrics
  const [selectedUserEmail, setSelectedUserEmail] = useState(initialMembers[0]?.email || "");
  const [userActivity, setUserActivity] = useState<any>(null);
  
  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");

  // Loading & notification states
  const [globalLoading, setGlobalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-clear messages
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Fetch activity stats whenever selected user email changes
  useEffect(() => {
    if (selectedUserEmail) {
      fetchUserActivity(selectedUserEmail);
    }
  }, [selectedUserEmail]);

  const fetchUserActivity = async (email: string) => {
    try {
      setActionLoading(prev => ({ ...prev, activity: true }));
      const stats = await getUserActivityHistoryAction(email);
      setUserActivity(stats);
    } catch (err: any) {
      console.error("Failed to fetch user activity:", err);
      setErrorMsg("Failed to load user activity history.");
    } finally {
      setActionLoading(prev => ({ ...prev, activity: false }));
    }
  };

  const handleRefresh = async () => {
    try {
      setGlobalLoading(true);
      setErrorMsg(null);
      const [newMembers, newInvites, newLogs] = await Promise.all([
        getTeamMembersAction(),
        getClerkInvitationsAction(),
        getAuditLogsAction(searchQuery)
      ]);
      setMembers(newMembers);
      setInvitations(newInvites);
      setAuditLogs(newLogs);
      if (selectedUserEmail) {
        await fetchUserActivity(selectedUserEmail);
      }
      setSuccessMsg("System data refreshed successfully.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to refresh data.");
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setActionLoading(prev => ({ ...prev, invite: true }));
      setErrorMsg(null);
      setSuccessMsg(null);
      await inviteTeamMemberAction(inviteEmail, inviteRole);
      setSuccessMsg(`Invitation sent to ${inviteEmail} successfully.`);
      setInviteEmail("");
      
      // Refresh list
      const newInvites = await getClerkInvitationsAction();
      setInvitations(newInvites);
      const newLogs = await getAuditLogsAction(searchQuery);
      setAuditLogs(newLogs);
    } catch (err: any) {
      setErrorMsg(err.message || "Invitation failed.");
    } finally {
      setActionLoading(prev => ({ ...prev, invite: false }));
    }
  };

  const handleRevokeInvite = async (id: string, email: string) => {
    try {
      setActionLoading(prev => ({ ...prev, [id]: true }));
      setErrorMsg(null);
      await revokeInvitationAction(id);
      setSuccessMsg(`Invitation to ${email} has been revoked.`);
      
      // Refresh lists
      const newInvites = await getClerkInvitationsAction();
      setInvitations(newInvites);
      const newLogs = await getAuditLogsAction(searchQuery);
      setAuditLogs(newLogs);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to revoke invitation.");
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === newRole) return;
    const actionKey = `role-${userId}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      setErrorMsg(null);
      await updateMemberRoleAction(userId, newRole);
      setSuccessMsg("Role configuration updated successfully.");
      
      const newMembers = await getTeamMembersAction();
      setMembers(newMembers);
      const newLogs = await getAuditLogsAction(searchQuery);
      setAuditLogs(newLogs);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update member role.");
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Active" ? "Disabled" : "Active";
    const actionKey = `status-${userId}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      setErrorMsg(null);
      await updateMemberStatusAction(userId, nextStatus);
      setSuccessMsg(`Member status set to ${nextStatus}.`);
      
      const newMembers = await getTeamMembersAction();
      setMembers(newMembers);
      const newLogs = await getAuditLogsAction(searchQuery);
      setAuditLogs(newLogs);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to toggle status.");
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleRemoveMember = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from this organization?`)) {
      return;
    }
    const actionKey = `remove-${userId}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      setErrorMsg(null);
      await removeTeamMemberAction(userId);
      setSuccessMsg(`Member ${email} removed successfully.`);
      
      const newMembers = await getTeamMembersAction();
      setMembers(newMembers);
      const newLogs = await getAuditLogsAction(searchQuery);
      setAuditLogs(newLogs);
      
      if (selectedUserEmail === email) {
        setSelectedUserEmail(newMembers[0]?.email || "");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to remove member.");
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleSearchLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(prev => ({ ...prev, logsSearch: true }));
      const logs = await getAuditLogsAction(searchQuery);
      setAuditLogs(logs);
    } catch {
      setErrorMsg("Failed to search audit logs.");
    } finally {
      setActionLoading(prev => ({ ...prev, logsSearch: false }));
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(prev => ({ ...prev, prefs: true }));
      setErrorMsg(null);
      setSuccessMsg(null);
      const updated = await updateNotificationPreferencesAction({
        criticalThreatAlerts: preferences.criticalThreatAlerts,
        incidentAlerts: preferences.incidentAlerts,
        complianceAlerts: preferences.complianceAlerts,
        weeklyReports: preferences.weeklyReports,
      });
      setPreferences(updated);
      setSuccessMsg("Notification alert preferences updated.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save notification settings.");
    } finally {
      setActionLoading(prev => ({ ...prev, prefs: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
            Team & Administration Workspace
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure tenant permissions, audits, Clerk invitations, and system notification preferences.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={globalLoading}
          className="h-9 border-border bg-card/40 flex items-center gap-2 hover:bg-secondary/40 font-mono text-xs"
        >
          {globalLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          REFRESH WORKSPACE
        </Button>
      </div>

      {/* Notifications banner */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-cyber-red/10 border border-cyber-red/30 text-cyber-red rounded-lg flex items-center gap-2.5 text-xs font-mono"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            <div className="flex-1">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-cyber-red/70 hover:text-cyber-red text-sm font-bold">×</button>
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-cyber-green/10 border border-cyber-green/30 text-cyber-green rounded-lg flex items-center gap-2.5 text-xs font-mono"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="text-cyber-green/70 hover:text-cyber-green text-sm font-bold">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Container */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-black/20 border border-border/80 p-1 rounded-xl h-auto shrink-0 mb-6 gap-1">
          <TabsTrigger value="members" className="data-[state=active]:bg-card/70 border border-transparent data-[state=active]:border-border/60 py-2.5 rounded-lg text-xs font-mono transition-all">
            MEMBERS & INVITES
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-card/70 border border-transparent data-[state=active]:border-border/60 py-2.5 rounded-lg text-xs font-mono transition-all">
            AUDIT TRAILS
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-card/70 border border-transparent data-[state=active]:border-border/60 py-2.5 rounded-lg text-xs font-mono transition-all">
            USER ACTIVITY
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-card/70 border border-transparent data-[state=active]:border-border/60 py-2.5 rounded-lg text-xs font-mono transition-all">
            ALERTS SETTINGS
          </TabsTrigger>
        </TabsList>

        {/* Members & Invites Tab */}
        <TabsContent value="members" className="space-y-6 outline-none focus:outline-none">
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Invite Form */}
            <Card className="border-border bg-card/60 backdrop-blur-sm lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyber-blue" />
                  Invite Team Member
                </CardTitle>
                <CardDescription className="text-[11px]">Send a Clerk B2B organization invitation code.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-mono uppercase text-muted-foreground">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="operator@aegis.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="pl-9 bg-black/20 border-border focus-visible:ring-cyber-blue"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-xs font-mono uppercase text-muted-foreground">Target Role</Label>
                    <select
                      id="role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full h-10 px-3 rounded-md bg-black/20 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-cyber-blue font-mono"
                    >
                      <option value="Viewer">Viewer (Read-only)</option>
                      <option value="Analyst">Analyst (Triage operations)</option>
                      <option value="Admin">Admin (Full organization access)</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    disabled={actionLoading.invite || !inviteEmail}
                    className="w-full bg-cyber-blue text-black hover:bg-cyber-blue/90 font-mono text-xs py-2 h-9 flex items-center gap-2 justify-center transition-colors"
                  >
                    {actionLoading.invite ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>INVITE USER</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Members and Pending Invites */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Members Card */}
              <Card className="border-border bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyber-green" />
                    Active Organization Roles ({members.length})
                  </CardTitle>
                  <CardDescription className="text-[11px]">Authorized members isolated via Clerk multi-tenant boundaries.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-black/10">
                      <TableRow className="border-b border-border/80">
                        <TableHead className="font-mono text-[10px] uppercase py-3 pl-4">Member</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase py-3">Role</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase py-3">Status</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase py-3">Last Active</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase py-3 pr-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((u) => {
                        const actionRoleKey = `role-${u.id}`;
                        const actionStatusKey = `status-${u.id}`;
                        const actionRemoveKey = `remove-${u.id}`;
                        
                        return (
                          <TableRow key={u.id} className="border-b border-border/30 hover:bg-black/10 transition-colors">
                            <TableCell className="py-3.5 pl-4 flex flex-col justify-center gap-0.5">
                              <span className="text-sm font-medium">{u.email}</span>
                              <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[180px]">{u.clerkUserId}</span>
                            </TableCell>
                            <TableCell className="py-3.5">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateRole(u.id, u.role, e.target.value)}
                                disabled={actionLoading[actionRoleKey]}
                                className="bg-transparent border-0 text-xs font-mono font-medium focus:ring-0 focus:outline-none cursor-pointer py-1 text-cyber-blue hover:underline"
                              >
                                <option value="Viewer">Viewer</option>
                                <option value="Analyst">Analyst</option>
                                <option value="Admin">Admin</option>
                              </select>
                            </TableCell>
                            <TableCell className="py-3.5">
                              <Badge 
                                variant="outline" 
                                className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border-0 ${
                                  u.status === "Active" 
                                    ? "bg-cyber-green/10 text-cyber-green" 
                                    : "bg-cyber-red/10 text-cyber-red"
                                }`}
                              >
                                {u.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                            </TableCell>
                            <TableCell className="py-3.5 pr-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleToggleStatus(u.id, u.status)}
                                  disabled={actionLoading[actionStatusKey]}
                                  title={u.status === "Active" ? "Disable User" : "Enable User"}
                                  className="h-7 w-7 border-border hover:bg-secondary/30"
                                >
                                  {actionLoading[actionStatusKey] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : u.status === "Active" ? (
                                    <UserX className="w-3.5 h-3.5 text-cyber-red/80" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5 text-cyber-green" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleRemoveMember(u.id, u.email)}
                                  disabled={actionLoading[actionRemoveKey]}
                                  title="Remove Member"
                                  className="h-7 w-7 border-border hover:bg-cyber-red/10 hover:border-cyber-red/30"
                                >
                                  {actionLoading[actionRemoveKey] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <UserMinus className="w-3.5 h-3.5 text-muted-foreground hover:text-cyber-red" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Pending Invitations Card */}
              <Card className="border-border bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyber-orange" />
                    Pending Clerk Invitations ({invitations.length})
                  </CardTitle>
                  <CardDescription className="text-[11px]">B2B invites waiting for users to sign up and bind organizational roles.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {invitations.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-black/10">
                        <TableRow className="border-b border-border/80">
                          <TableHead className="font-mono text-[10px] py-3 pl-4">Email</TableHead>
                          <TableHead className="font-mono text-[10px] py-3">Role Target</TableHead>
                          <TableHead className="font-mono text-[10px] py-3">Status</TableHead>
                          <TableHead className="font-mono text-[10px] py-3">Date Sent</TableHead>
                          <TableHead className="font-mono text-[10px] py-3 pr-4 text-right">Revoke</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((inv) => (
                          <TableRow key={inv.id} className="border-b border-border/30 hover:bg-black/10 transition-colors">
                            <TableCell className="py-3 pl-4 text-sm font-medium">{inv.email}</TableCell>
                            <TableCell className="py-3 text-xs font-mono">{inv.role}</TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline" className="font-mono text-[9px] bg-cyber-orange/10 text-cyber-orange border-0">
                                {inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                              {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "N/A"}
                            </TableCell>
                            <TableCell className="py-3 pr-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokeInvite(inv.id, inv.email)}
                                disabled={actionLoading[inv.id]}
                                className="h-7 px-2 border-border text-[10px] font-mono text-cyber-red/80 hover:bg-cyber-red/10 flex items-center gap-1.5 ml-auto"
                              >
                                {actionLoading[inv.id] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>REVOKE</>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground font-mono">
                      No pending invitations in Clerk.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Audit Trails Tab */}
        <TabsContent value="audit" className="space-y-6 outline-none focus:outline-none">
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyber-blue" />
                  Structured Operational Audits Logs
                </CardTitle>
                <CardDescription className="text-[11px]">Immutable JSON metadata logs tracing privileged operator actions.</CardDescription>
              </div>
              <form onSubmit={handleSearchLogs} className="flex items-center gap-2 max-w-sm w-full md:w-auto ml-auto">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search logs by action or user..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs bg-black/20 border-border focus-visible:ring-cyber-blue"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={actionLoading.logsSearch}
                  className="bg-cyber-blue text-black hover:bg-cyber-blue/90 h-9 font-mono text-xs px-3"
                >
                  {actionLoading.logsSearch ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>SEARCH</>
                  )}
                </Button>
              </form>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {auditLogs.length > 0 ? (
                <Table>
                  <TableHeader className="bg-black/10">
                    <TableRow className="border-b border-border/80">
                      <TableHead className="font-mono text-[10px] py-3 pl-4">Timestamp</TableHead>
                      <TableHead className="font-mono text-[10px] py-3">Operator</TableHead>
                      <TableHead className="font-mono text-[10px] py-3">Action</TableHead>
                      <TableHead className="font-mono text-[10px] py-3 pr-4">Payload (JSON Metadata)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => {
                      let parsedMeta = log.metadata;
                      if (typeof log.metadata === "string") {
                        try {
                          parsedMeta = JSON.parse(log.metadata);
                        } catch {}
                      }

                      return (
                        <TableRow key={log.id} className="border-b border-border/30 hover:bg-black/10 transition-colors">
                          <TableCell className="py-3 pl-4 text-xs font-mono text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="py-3 text-xs font-medium font-mono">{log.userEmail}</TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="font-mono text-[9px] uppercase bg-secondary/40 border-0">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 pr-4 text-xs font-mono text-cyber-blue max-w-sm truncate" title={JSON.stringify(parsedMeta)}>
                            {JSON.stringify(parsedMeta)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground font-mono">
                  No audit logs matching query found in database.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Activity Tab */}
        <TabsContent value="analytics" className="space-y-6 outline-none focus:outline-none">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* User selector list (Left 1 col) */}
            <Card className="border-border bg-card/60 backdrop-blur-sm md:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyber-blue" />
                  Select Operator
                </CardTitle>
                <CardDescription className="text-[11px]">Inspect metrics for a specific workspace email.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedUserEmail(m.email)}
                      className={`w-full text-left px-4 py-3 text-xs font-mono flex items-center justify-between transition-colors ${
                        selectedUserEmail === m.email 
                          ? "bg-cyber-blue/10 border-l-2 border-cyber-blue text-cyber-blue" 
                          : "hover:bg-black/10"
                      }`}
                    >
                      <span className="truncate">{m.email}</span>
                      <Badge variant="outline" className="text-[8px] h-4 shrink-0 uppercase border-0 bg-secondary/50">
                        {m.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Metrics and activity details (Right 2 cols) */}
            <div className="md:col-span-2 space-y-6">
              {actionLoading.activity ? (
                <Card className="border-border bg-card/60 backdrop-blur-sm h-64 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-xs font-mono text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-cyber-blue" />
                    Calculating activity records...
                  </div>
                </Card>
              ) : userActivity ? (
                <div className="space-y-6">
                  
                  {/* Aggregated indicators */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-4 bg-black/20 border border-border/80 rounded-xl">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Logins</div>
                      <div className="text-2xl font-extrabold font-mono mt-1 text-cyber-blue">{userActivity.logins}</div>
                    </div>
                    <div className="p-4 bg-black/20 border border-border/80 rounded-xl">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Reports</div>
                      <div className="text-2xl font-extrabold font-mono mt-1 text-cyber-orange">{userActivity.reportsCompiled}</div>
                    </div>
                    <div className="p-4 bg-black/20 border border-border/80 rounded-xl">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Triages</div>
                      <div className="text-2xl font-extrabold font-mono mt-1 text-cyber-red">{userActivity.incidentsTriaged}</div>
                    </div>
                    <div className="p-4 bg-black/20 border border-border/80 rounded-xl">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Scans</div>
                      <div className="text-2xl font-extrabold font-mono mt-1 text-cyber-green">{userActivity.complianceScans}</div>
                    </div>
                    <div className="p-4 bg-black/20 border border-border/80 rounded-xl col-span-2 md:col-span-1">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Log Ingests</div>
                      <div className="text-2xl font-extrabold font-mono mt-1 text-cyber-yellow">{userActivity.logIngestions}</div>
                    </div>
                  </div>

                  {/* Summary Card */}
                  <Card className="border-border bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-3 border-b border-border">
                      <CardTitle className="text-sm font-semibold">
                        Recent Activities for {selectedUserEmail}
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Last {userActivity.recentActivities.length} operations parsed from PostgreSQL. Total actions registered: {userActivity.totalActions}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 max-h-96 overflow-y-auto divide-y divide-border/30">
                      {userActivity.recentActivities.length > 0 ? (
                        userActivity.recentActivities.map((act: any) => (
                          <div key={act.id} className="p-3.5 text-xs font-mono flex items-start gap-4">
                            <span className="text-muted-foreground shrink-0 w-36">
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                            <div className="flex-1 space-y-1">
                              <Badge variant="outline" className="text-[9px] border-0 bg-secondary/50 py-0.5">
                                {act.action}
                              </Badge>
                              <p className="text-muted-foreground text-[10px] leading-relaxed break-all">
                                {JSON.stringify(act.metadata)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          No recent actions logged for this operator.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border-border bg-card/60 backdrop-blur-sm h-64 flex items-center justify-center">
                  <div className="text-xs font-mono text-muted-foreground">
                    Select an operator email from the left sidebar.
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Alerts Settings Tab */}
        <TabsContent value="settings" className="space-y-6 outline-none focus:outline-none">
          <Card className="border-border bg-card/60 backdrop-blur-sm max-w-xl">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyber-blue" />
                Notification Alert Preferences
              </CardTitle>
              <CardDescription className="text-[11px]">Define organization-wide parameters for notifications pipelines.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePreferences} className="space-y-6">
                
                <div className="space-y-4">
                  {/* Alert Option 1 */}
                  <div className="flex items-start justify-between gap-4 p-3 bg-black/10 rounded-lg border border-border/40">
                    <div className="space-y-1">
                      <Label htmlFor="criticalThreatsPref" className="text-xs font-mono font-bold text-foreground">CRITICAL THREAT INGESTIONS</Label>
                      <p className="text-[10px] text-muted-foreground">Send Slack/Webhook triggers instantly when a critical risk alert hits the database.</p>
                    </div>
                    <input
                      id="criticalThreatsPref"
                      type="checkbox"
                      checked={preferences.criticalThreatAlerts}
                      onChange={(e) => setPreferences((p: any) => ({ ...p, criticalThreatAlerts: e.target.checked }))}
                      className="w-4 h-4 text-cyber-blue bg-black/40 border-border rounded focus:ring-cyber-blue cursor-pointer shrink-0 mt-1"
                    />
                  </div>

                  {/* Alert Option 2 */}
                  <div className="flex items-start justify-between gap-4 p-3 bg-black/10 rounded-lg border border-border/40">
                    <div className="space-y-1">
                      <Label htmlFor="incidentAlertsPref" className="text-xs font-mono font-bold text-foreground">INCIDENT WORKFLOW CREATION</Label>
                      <p className="text-[10px] text-muted-foreground">Email assignees and SOC coordinators upon automated ticket creation.</p>
                    </div>
                    <input
                      id="incidentAlertsPref"
                      type="checkbox"
                      checked={preferences.incidentAlerts}
                      onChange={(e) => setPreferences((p: any) => ({ ...p, incidentAlerts: e.target.checked }))}
                      className="w-4 h-4 text-cyber-blue bg-black/40 border-border rounded focus:ring-cyber-blue cursor-pointer shrink-0 mt-1"
                    />
                  </div>

                  {/* Alert Option 3 */}
                  <div className="flex items-start justify-between gap-4 p-3 bg-black/10 rounded-lg border border-border/40">
                    <div className="space-y-1">
                      <Label htmlFor="complianceAlertsPref" className="text-xs font-mono font-bold text-foreground">COMPLIANCE POSTURE FAILURES</Label>
                      <p className="text-[10px] text-muted-foreground">Log warnings when framework compliance ratings fall below threshold.</p>
                    </div>
                    <input
                      id="complianceAlertsPref"
                      type="checkbox"
                      checked={preferences.complianceAlerts}
                      onChange={(e) => setPreferences((p: any) => ({ ...p, complianceAlerts: e.target.checked }))}
                      className="w-4 h-4 text-cyber-blue bg-black/40 border-border rounded focus:ring-cyber-blue cursor-pointer shrink-0 mt-1"
                    />
                  </div>

                  {/* Alert Option 4 */}
                  <div className="flex items-start justify-between gap-4 p-3 bg-black/10 rounded-lg border border-border/40">
                    <div className="space-y-1">
                      <Label htmlFor="weeklyReportsPref" className="text-xs font-mono font-bold text-foreground">WEEKLY SECURITY DIGESTS</Label>
                      <p className="text-[10px] text-muted-foreground">Compile and email executive security summaries every Monday morning.</p>
                    </div>
                    <input
                      id="weeklyReportsPref"
                      type="checkbox"
                      checked={preferences.weeklyReports}
                      onChange={(e) => setPreferences((p: any) => ({ ...p, weeklyReports: e.target.checked }))}
                      className="w-4 h-4 text-cyber-blue bg-black/40 border-border rounded focus:ring-cyber-blue cursor-pointer shrink-0 mt-1"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={actionLoading.prefs}
                  className="w-full bg-cyber-blue text-black hover:bg-cyber-blue/90 font-mono text-xs py-2 h-9 flex items-center justify-center gap-2"
                >
                  {actionLoading.prefs ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>SAVE PREFERENCES</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
