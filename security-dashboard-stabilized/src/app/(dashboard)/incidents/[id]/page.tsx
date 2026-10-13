import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import IncidentDetailsClient from "./IncidentDetailsClient";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { orgId } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  const { id } = await params;

  // Resolve organisation
  const org = await prisma.organization.findUnique({
    where: { clerkOrgId: orgId },
  });
  if (!org) {
    redirect("/onboarding");
  }

  // Fetch incident, ensuring organization isolation
  const incident = await prisma.incident.findFirst({
    where: {
      id,
      organizationId: org.id,
    },
    include: {
      threatEvents: true,
      comments: {
        orderBy: { createdAt: "asc" },
      },
      activityLogs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!incident) {
    notFound();
  }

  // Fetch users for the assignment dropdown
  const dbUsers = await prisma.user.findMany({
    where: { organizationId: org.id },
  });
  const organizationUsers = dbUsers.map(u => u.email);

  // Fetch current user details
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress || "Analyst";

  return (
    <IncidentDetailsClient
      incident={{
        id: incident.id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        assignedTo: incident.assignedTo,
        aiSummary: incident.aiSummary,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        threatEvents: incident.threatEvents.map(t => ({
          id: t.id,
          createdAt: t.createdAt.toISOString(),
          sourceIp: t.sourceIp,
          target: t.target,
          severity: t.severity,
          description: t.description,
        })),
        comments: incident.comments.map(c => ({
          id: c.id,
          userName: c.userName,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
        })),
        activityLogs: incident.activityLogs.map(l => ({
          id: l.id,
          activityType: l.activityType,
          description: l.description,
          createdAt: l.createdAt.toISOString(),
        })),
      }}
      organizationUsers={organizationUsers}
      currentUserEmail={email}
    />
  );
}
