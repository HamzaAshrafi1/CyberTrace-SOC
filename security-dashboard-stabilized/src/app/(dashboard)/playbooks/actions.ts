"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";

export async function getPlaybooksAction() {
  const { org } = await verifyPermission("read:settings");
  
  const playbooks = await prisma.playbook.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" }
  });

  return playbooks.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    enabled: p.enabled,
    triggerType: p.triggerType,
    conditions: typeof p.conditions === "string" ? JSON.parse(p.conditions) : p.conditions,
    actions: typeof p.actions === "string" ? JSON.parse(p.actions) : p.actions,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function createPlaybookAction(data: {
  name: string;
  description: string;
  triggerType: string;
  conditions: any;
  actions: any;
}) {
  const { org } = await verifyPermission("write:settings");

  const playbook = await prisma.playbook.create({
    data: {
      organizationId: org.id,
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      conditions: data.conditions || {},
      actions: data.actions || {},
    }
  });

  await writeAuditLog("PLAYBOOK_CREATED", { playbookId: playbook.id, name: playbook.name });
  revalidatePath("/playbooks");
  revalidatePath("/automation");
  
  return playbook;
}

export async function updatePlaybookAction(id: string, data: {
  name?: string;
  description?: string;
  triggerType?: string;
  conditions?: any;
  actions?: any;
  enabled?: boolean;
}) {
  const { org } = await verifyPermission("write:settings");

  const playbook = await prisma.playbook.update({
    where: { id, organizationId: org.id },
    data: {
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      conditions: data.conditions,
      actions: data.actions,
      enabled: data.enabled
    }
  });

  await writeAuditLog("PLAYBOOK_UPDATED", { playbookId: playbook.id, name: playbook.name });
  revalidatePath("/playbooks");
  revalidatePath("/automation");
  
  return playbook;
}

export async function togglePlaybookEnabledAction(id: string, enabled: boolean) {
  const { org } = await verifyPermission("write:settings");

  const playbook = await prisma.playbook.update({
    where: { id, organizationId: org.id },
    data: { enabled }
  });

  await writeAuditLog("PLAYBOOK_TOGGLED", { playbookId: playbook.id, enabled });
  revalidatePath("/playbooks");
  revalidatePath("/automation");
  
  return playbook;
}

export async function deletePlaybookAction(id: string) {
  const { org } = await verifyPermission("write:settings");

  const playbook = await prisma.playbook.delete({
    where: { id, organizationId: org.id }
  });

  await writeAuditLog("PLAYBOOK_DELETED", { playbookId: playbook.id, name: playbook.name });
  revalidatePath("/playbooks");
  revalidatePath("/automation");
  
  return playbook;
}

export async function updateSlackWebhookAction(slackWebhookUrl: string) {
  const { org } = await verifyPermission("write:settings");

  await prisma.organization.update({
    where: { id: org.id },
    data: { slackWebhookUrl }
  });

  await writeAuditLog("SLACK_WEBHOOK_UPDATED", { slackWebhookUrl: slackWebhookUrl ? "Configured" : "Cleared" });
  revalidatePath("/settings");
  
  return { success: true };
}

export async function getAutomationLogsAction() {
  const { org } = await verifyPermission("read:settings");

  const logs = await prisma.automationExecution.findMany({
    where: { organizationId: org.id },
    include: {
      playbook: true
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return logs.map(l => ({
    id: l.id,
    playbookName: l.playbook.name,
    eventId: l.eventId,
    status: l.status,
    message: l.message,
    startedAt: l.startedAt.toISOString(),
    completedAt: l.completedAt.toISOString()
  }));
}

export async function getAutomationDashboardMetricsAction() {
  const { org } = await verifyPermission("read:settings");

  const [
    totalPlaybooks,
    executions,
    automatedIncidents,
    automatedCases
  ] = await Promise.all([
    prisma.playbook.count({ where: { organizationId: org.id } }),
    prisma.automationExecution.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" }
    }),
    prisma.incident.count({
      where: {
        organizationId: org.id,
        description: { contains: "playbook" }
      }
    }),
    prisma.case.count({
      where: {
        organizationId: org.id,
        description: { contains: "playbook" }
      }
    })
  ]);

  const successful = executions.filter(e => e.status === "success").length;
  const failed = executions.filter(e => e.status === "failed" || e.status === "partial").length;
  const totalExecutions = executions.length;
  const successRate = totalExecutions > 0 ? Math.round((successful / totalExecutions) * 100) : 100;

  // Build daily trend chart data
  const dailyMap: Record<string, { success: number; fail: number }> = {};
  executions.forEach(e => {
    const dateStr = e.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { success: 0, fail: 0 };
    }
    if (e.status === "success") {
      dailyMap[dateStr].success++;
    } else {
      dailyMap[dateStr].fail++;
    }
  });

  const chartData = Object.entries(dailyMap).map(([date, counts]) => ({
    date,
    success: counts.success,
    failed: counts.fail
  })).slice(-10); // last 10 days

  // Default empty chart data if none exists
  if (chartData.length === 0) {
    const mockDates = ["Jun 8", "Jun 9", "Jun 10", "Jun 11", "Jun 12"];
    mockDates.forEach(d => {
      chartData.push({ date: d, success: 0, failed: 0 });
    });
  }

  return {
    totalPlaybooks,
    totalExecutions,
    successfulExecutions: successful,
    failedExecutions: failed,
    automatedIncidents,
    automatedCases,
    successRate,
    chartData
  };
}
