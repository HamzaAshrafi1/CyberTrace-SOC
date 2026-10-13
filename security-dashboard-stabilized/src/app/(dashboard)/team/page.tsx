import React from "react";
import TeamClient from "./TeamClient";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { 
  getTeamMembersAction, 
  getClerkInvitationsAction, 
  getAuditLogsAction, 
  getNotificationPreferencesAction 
} from "./actions";
import { Shield } from "lucide-react";

export default async function TeamPage() {
  let errorMsg: string | null = null;
  let initialMembers: Awaited<ReturnType<typeof getTeamMembersAction>> | undefined;
  let initialInvitations: Awaited<ReturnType<typeof getClerkInvitationsAction>> | undefined;
  let initialAuditLogs: Awaited<ReturnType<typeof getAuditLogsAction>> | undefined;
  let initialPreferences: Awaited<ReturnType<typeof getNotificationPreferencesAction>> | undefined;

  try {
    // Run verification gate at route level
    await verifyPermission("read:team");

    // Pre-fetch initial datasets concurrently
    const [members, invitations, auditLogs, preferences] = await Promise.all([
      getTeamMembersAction(),
      getClerkInvitationsAction(),
      getAuditLogsAction(),
      getNotificationPreferencesAction(),
    ]);

    initialMembers = members;
    initialInvitations = invitations;
    initialAuditLogs = auditLogs;
    initialPreferences = preferences;
  } catch (error) {
    errorMsg = error instanceof Error ? error.message : "You do not have sufficient privileges to access the Team & Administration Workspace.";
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] border border-border bg-card/40 rounded-xl p-8 max-w-md mx-auto text-center space-y-4 mt-12">
        <Shield className="w-12 h-12 text-cyber-red animate-pulse" />
        <h2 className="text-lg font-bold font-mono text-cyber-red">ACCESS CONTROLS RESTRICTED</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {errorMsg}
        </p>
      </div>
    );
  }

  return (
    <TeamClient
      initialMembers={initialMembers || []}
      initialInvitations={initialInvitations || []}
      initialAuditLogs={initialAuditLogs || []}
      initialPreferences={initialPreferences || {
        notifyCriticalThreats: false, notifyIncidentCreated: false, notifyFrameworkScoreDecay: false, notifyWeeklyDigest: false
      }}
    />
  );
}
