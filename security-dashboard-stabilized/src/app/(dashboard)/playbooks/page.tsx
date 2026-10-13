import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import { getPlaybooksAction } from "./actions";
import PlaybooksClient from "./PlaybooksClient";

export default async function PlaybooksPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  await getOrCreateOrganization(orgId, orgSlug || undefined);
  const playbooks = await getPlaybooksAction();

  return (
    <PlaybooksClient
      initialPlaybooks={playbooks}
    />
  );
}
