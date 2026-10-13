import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import { getAutomationLogsAction } from "../../playbooks/actions";
import LogsClient from "./LogsClient";

export default async function AutomationLogsPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  await getOrCreateOrganization(orgId, orgSlug || undefined);
  const logs = await getAutomationLogsAction();

  return (
    <LogsClient
      initialLogs={logs}
    />
  );
}
