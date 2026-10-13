"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { verifyPermission, getOrCreateUserAndRole } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";

export async function getTeamMembersAction() {
  const { org } = await verifyPermission("read:team");

  const users = await prisma.user.findMany({
    where: {
      roles: {
        some: { organizationId: org.id }
      }
    },
    include: {
      roles: {
        where: { organizationId: org.id }
      }
    }
  });

  return users.map(u => {
    const roleRecord = u.roles[0];
    return {
      id: u.id,
      clerkUserId: u.clerkUserId,
      email: u.email,
      role: roleRecord?.role || "Viewer",
      status: roleRecord?.status || "Active",
      joinedAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    };
  });
}

export async function inviteTeamMemberAction(email: string, role: string) {
  const { org } = await verifyPermission("write:team");

  if (!email || !email.includes("@")) {
    throw new Error("Invalid email address");
  }

  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: org.clerkOrgId,
      emailAddress: email,
      role: role === "Admin" ? "org:admin" : "org:member",
    });

    await writeAuditLog("User Invited", { email, role });
    
    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    console.error("Clerk invitation failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message || "Failed to send invitation via Clerk B2B SDK.");
  }
}

export async function getClerkInvitationsAction() {
  const { org } = await verifyPermission("read:team");

  try {
    const client = await clerkClient();
    const response = await client.organizations.getOrganizationInvitationList({
      organizationId: org.clerkOrgId,
    });

    const invitations = Array.isArray(response) ? response : (response as any).data || [];

    return invitations.map((inv: any) => ({
      id: inv.id,
      email: inv.emailAddress,
      role: inv.role === "org:admin" ? "Admin" : "Analyst",
      status: inv.status,
      createdAt: new Date(inv.createdAt),
    }));
  } catch (error) {
    console.error("Failed to fetch Clerk invitations:", error);
    return [];
  }
}

export async function revokeInvitationAction(invitationId: string) {
  const { org } = await verifyPermission("write:team");

  try {
    const client = await clerkClient();
    await client.organizations.revokeOrganizationInvitation({
      organizationId: org.clerkOrgId,
      invitationId,
    });

    await writeAuditLog("Invitation Revoked", { invitationId });

    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    console.error("Failed to revoke invitation:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message || "Failed to revoke invitation");
  }
}

export async function updateMemberRoleAction(userId: string, role: string) {
  const { org } = await verifyPermission("write:team");

  const dbUser = await prisma.user.findFirst({
    where: { id: userId, organizationId: org.id },
  });
  if (!dbUser) throw new Error("Member not found");

  const orgRole = await prisma.organizationRole.findUnique({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: dbUser.id,
      },
    },
  });
  if (!orgRole) throw new Error("Member role not found");

  const oldRole = orgRole.role;

  await prisma.organizationRole.update({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: dbUser.id,
      },
    },
    data: { role },
  });

  try {
    const client = await clerkClient();
    await client.organizations.updateOrganizationMembership({
      organizationId: org.clerkOrgId,
      userId: dbUser.clerkUserId,
      role: role === "Admin" ? "org:admin" : "org:member",
    });
  } catch (error) {
    console.error("Clerk member role update error:", error);
  }

  await writeAuditLog("Role Changed", { email: dbUser.email, oldRole, newRole: role });

  revalidatePath("/team");
}

export async function updateMemberStatusAction(userId: string, status: string) {
  const { org } = await verifyPermission("write:team");

  const dbUser = await prisma.user.findFirst({
    where: { id: userId, organizationId: org.id },
  });
  if (!dbUser) throw new Error("Member not found");

  const { user: currentUser } = await getOrCreateUserAndRole();
  if (currentUser.id === dbUser.id && status === "Disabled") {
    throw new Error("You cannot disable your own account.");
  }

  await prisma.organizationRole.update({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: dbUser.id,
      },
    },
    data: { status },
  });

  await writeAuditLog(status === "Disabled" ? "User Disabled" : "User Enabled", { email: dbUser.email });

  revalidatePath("/team");
}

export async function removeTeamMemberAction(userId: string) {
  const { org } = await verifyPermission("write:team");

  const dbUser = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: org.id,
    },
  });
  if (!dbUser) throw new Error("Member not found in this organization");

  const { user: currentUser } = await getOrCreateUserAndRole();
  if (currentUser.id === dbUser.id) {
    throw new Error("You cannot remove yourself from the organization.");
  }

  try {
    const client = await clerkClient();
    await client.organizations.deleteOrganizationMembership({
      organizationId: org.clerkOrgId,
      userId: dbUser.clerkUserId,
    });
  } catch (error) {
    console.error("Clerk member deletion error:", error);
  }

  await prisma.organizationRole.delete({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: dbUser.id,
      },
    },
  });

  const otherRoles = await prisma.organizationRole.count({
    where: { userId: dbUser.id },
  });

  if (otherRoles === 0) {
    await prisma.user.delete({
      where: { id: dbUser.id },
    });
  }

  await writeAuditLog("User Removed", { email: dbUser.email });

  revalidatePath("/team");
}

export async function getAuditLogsAction(query?: string) {
  const { org } = await verifyPermission("read:team");

  const whereClause: any = {
    organizationId: org.id,
  };

  if (query && query.trim() !== "") {
    const trimmedQuery = query.trim();
    whereClause.OR = [
      { action: { contains: trimmedQuery, mode: "insensitive" } },
      { userEmail: { contains: trimmedQuery, mode: "insensitive" } },
    ];
  }

  return prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getNotificationPreferencesAction() {
  const { org } = await verifyPermission("read:settings");

  let preferences = await prisma.notificationPreference.findUnique({
    where: { organizationId: org.id },
  });

  if (!preferences) {
    preferences = await prisma.notificationPreference.create({
      data: {
        organizationId: org.id,
        criticalThreatAlerts: true,
        incidentAlerts: true,
        complianceAlerts: true,
        weeklyReports: true,
      },
    });
  }

  return preferences;
}

export async function updateNotificationPreferencesAction(data: {
  criticalThreatAlerts: boolean;
  incidentAlerts: boolean;
  complianceAlerts: boolean;
  weeklyReports: boolean;
}) {
  const { org } = await verifyPermission("write:settings");

  const preferences = await prisma.notificationPreference.upsert({
    where: { organizationId: org.id },
    update: {
      criticalThreatAlerts: data.criticalThreatAlerts,
      incidentAlerts: data.incidentAlerts,
      complianceAlerts: data.complianceAlerts,
      weeklyReports: data.weeklyReports,
    },
    create: {
      organizationId: org.id,
      criticalThreatAlerts: data.criticalThreatAlerts,
      incidentAlerts: data.incidentAlerts,
      complianceAlerts: data.complianceAlerts,
      weeklyReports: data.weeklyReports,
    },
  });

  await writeAuditLog("Notification Settings Updated", data);

  return preferences;
}

export async function getUserActivityHistoryAction(email: string) {
  const { org } = await verifyPermission("read:team");

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: org.id,
      userEmail: email,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    logins: logs.filter(l => l.action === "User Login").length,
    reportsCompiled: logs.filter(l => l.action === "Report Generated").length,
    incidentsTriaged: logs.filter(l => l.action === "Incident Status Change" || l.action === "Incident Assignment").length,
    complianceScans: logs.filter(l => l.action === "Compliance Scan Completed").length,
    logIngestions: logs.filter(l => l.action === "Log Upload Completed").length,
    totalActions: logs.length,
    recentActivities: logs.slice(0, 10).map(l => ({
      id: l.id,
      action: l.action,
      metadata: typeof l.metadata === "string" ? JSON.parse(l.metadata) : l.metadata,
      createdAt: l.createdAt,
    })),
  };
}
