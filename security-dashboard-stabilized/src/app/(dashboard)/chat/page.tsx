import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateOrganization } from "@/lib/dashboard/get-or-create-org";
import { getChatSessionsAction, getDocumentsAction } from "./actions";
import ChatClient from "./ChatClient";

export default async function ChatPage() {
  const { orgId, orgSlug } = await auth();
  if (!orgId) {
    redirect("/onboarding");
  }

  // Ensure organization exists in PostgreSQL (isolation partition)
  await getOrCreateOrganization(orgId, orgSlug || undefined);

  // Fetch initial chat sessions and document index logs
  const sessions = await getChatSessionsAction();
  const documents = await getDocumentsAction();

  return (
    <ChatClient
      initialSessions={sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))}
      initialDocuments={documents.map((d) => ({
        id: d.id,
        name: d.name,
        fileType: d.fileType,
        fileSize: d.fileSize,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
