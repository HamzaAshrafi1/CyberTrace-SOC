import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import { getAutomationDashboardMetricsAction } from "../playbooks/actions";
import AutomationClient from "./AutomationClient";

export default async function AutomationDashboardPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  await getOrCreateOrganization(orgId, orgSlug || undefined);
  const metrics = await getAutomationDashboardMetricsAction();

  return (
    <AutomationClient
      metrics={metrics}
    />
  );
}
