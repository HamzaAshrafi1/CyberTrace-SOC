import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLogSources } from "@/lib/dashboard/get-log-sources";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL
  const org = await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch log sources from Neon database
  const logSources = await getLogSources(orgId);

  return (
    <SettingsClient
      logSources={logSources.map(source => ({
        id: source.id,
        name: source.name,
        apiKey: source.apiKey,
        createdAt: source.createdAt,
      }))}
      orgName={org.name}
      clerkOrgId={orgId}
      initialSlackWebhookUrl={org.slackWebhookUrl || ""}
    />
  );
}
