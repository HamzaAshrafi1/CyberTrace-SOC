"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";
import { sanitizeString } from "@/lib/dashboard/security";

export async function getChatSessionsAction() {
  const { org } = await verifyPermission("read:chatbot");

  return prisma.chatSession.findMany({
    where: { organizationId: org.id },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createChatSessionAction(title: string = "New Chat Session") {
  const { org } = await verifyPermission("write:chatbot");
  const sanitizedTitle = sanitizeString(title);

  const session = await prisma.chatSession.create({
    data: {
      organizationId: org.id,
      title: sanitizedTitle,
    },
  });

  await writeAuditLog("Chat Session Created", { title: sanitizedTitle, sessionId: session.id });

  revalidatePath("/chat");
  return session;
}

export async function deleteChatSessionAction(sessionId: string) {
  const { org } = await verifyPermission("write:chatbot");

  // Ensure session belongs to active organization before deletion
  await prisma.chatSession.delete({
    where: {
      id: sessionId,
      organizationId: org.id,
    },
  });

  revalidatePath("/chat");
  return { success: true };
}

export async function getChatMessagesAction(sessionId: string) {
  const { org } = await verifyPermission("read:chatbot");

  // Ensure session belongs to active organization
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, organizationId: org.id },
  });
  if (!session) throw new Error("Chat session not found");

  return prisma.chatMessage.findMany({
    where: { sessionId: sessionId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getDocumentsAction() {
  const { org } = await verifyPermission("read:chatbot");

  return prisma.document.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function uploadDocumentAction(
  fileName: string,
  fileType: string,
  fileSize: string,
  base64Data: string
) {
  const { org } = await verifyPermission("write:chatbot");
  const sanitizedFileName = sanitizeString(fileName);
  const sanitizedFileType = sanitizeString(fileType);

  // Enforce document metadata database logging first
  const doc = await prisma.document.create({
    data: {
      organizationId: org.id,
      name: sanitizedFileName,
      fileType: sanitizedFileType,
      fileSize: fileSize,
    },
  });

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/document/upload`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "write:chatbot"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: org.id,
        document_id: doc.id,
        file_name: sanitizedFileName,
        file_type: sanitizedFileType,
        base64_data: base64Data,
      }),
      signal: AbortSignal.timeout(30000), // Max 30 seconds upload processing time
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "FastAPI document processing failed.");
    }
  } catch (error: any) {
    console.error("FastAPI Document Upload Error:", error);
    // Delete database entry if ingestion fails so state is synchronized
    await prisma.document.delete({ where: { id: doc.id } });
    throw new Error(error.message || "Unable to parse and index document with vector database.");
  }

  await writeAuditLog("Document Uploaded", { name: fileName, size: fileSize });

  revalidatePath("/chat");
  return doc;
}

export async function sendChatMessageAction(sessionId: string, text: string) {
  const { org } = await verifyPermission("write:chatbot");
  const sanitizedText = sanitizeString(text);

  // Validate session ownership
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, organizationId: org.id },
  });
  if (!session) throw new Error("Session not found");

  // 1. Save user query to DB
  await prisma.chatMessage.create({
    data: {
      sessionId: sessionId,
      sender: "user",
      text: sanitizedText,
    },
  });

  // 2. Fetch last 10 messages of history
  const recentMessages = await prisma.chatMessage.findMany({
    where: { sessionId: sessionId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  
  // Format history for FastAPI (in reverse because it was ordered desc)
  const history = recentMessages
    .reverse()
    .filter((m) => m.text !== sanitizedText) // exclude current message
    .map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));

  let responseData: any = {
    response: "I was unable to contact the Aegis AI Threat service. Please check uvicorn daemon status.",
    sources: [],
    diagnostics: { retrievedChunks: 0, latencyMs: 0, sourceDocsCount: 0 },
  };

  // 3. Query FastAPI endpoint
  try {
    const res = await fetch(`${AEGIS_SERVICE_URL}/api/v1/chat`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "write:chatbot"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: sanitizedText,
        organization_id: org.id,
        history: history,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      responseData = await res.json();
    } else {
      console.error("FastAPI Chat Failure Status:", res.statusText);
    }
  } catch (err) {
    console.error("Critical FastAPI Chat API Connection Error:", err);
  }

  // 4. Save Bot Reply to DB
  const replyMessage = await prisma.chatMessage.create({
    data: {
      sessionId: sessionId,
      sender: "bot",
      text: responseData.response,
      sources: JSON.stringify(responseData.sources || []),
      diagnostics: JSON.stringify(responseData.diagnostics || {}),
    },
  });

  // Touch session updatedAt
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  await writeAuditLog("Chat Message Sent", { sessionId, textLength: text.length });

  revalidatePath("/chat");
  return replyMessage;
}
