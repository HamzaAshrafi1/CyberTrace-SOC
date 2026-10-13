"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import fs from "fs";
import { randomUUID, createHash } from "node:crypto";
import path from "path";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { verifyPermission } from "@/lib/dashboard/verify-permission";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function uploadEvidenceAction(formData: {
  fileName: string;
  fileType: string;
  fileSize: number; // in bytes
  fileBase64: string; // base64 encoded
  caseId?: string | null;
}) {
  const { org } = await verifyPermission("write:incidents");

  const buffer = Buffer.from(formData.fileBase64, "base64");
  if (formData.caseId && !await prisma.case.findFirst({ where: { id: formData.caseId, organizationId: org.id } })) throw new Error("Case not found or unauthorized");

  // Size limit validation (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_SIZE || buffer.length !== formData.fileSize) {
    throw new Error("File size exceeds 5MB security threshold.");
  }

  // Type security checks
  const allowedTypes = [
    "application/pdf", "text/plain", "text/csv", 
    "application/json", "image/png", "image/jpeg", 
    "text/x-log", "application/octet-stream"
  ];
  if (!allowedTypes.includes(formData.fileType) && !formData.fileName.endsWith(".log")) {
    throw new Error("File type prohibited. Approved: PDF, TXT, LOG, CSV, JSON, PNG, JPG");
  }

  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Avoid path traversal or filename spoofing
  const fileId = randomUUID();
  const safeName = `${fileId}_${formData.fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const filePath = path.join(UPLOADS_DIR, safeName);
  
  // Write content to disk
  fs.writeFileSync(filePath, buffer);

  const formattedSize = (formData.fileSize / 1024).toFixed(1) + " KB";

  // Persist Evidence in DB
  const evidence = await prisma.evidence.create({
    data: {
      organizationId: org.id,
      fileName: formData.fileName,
      fileType: formData.fileType,
      fileSize: formattedSize,
      storagePath: filePath,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      caseId: formData.caseId || null
    }
  });

  // Log audit
  await writeAuditLog("EVIDENCE_UPLOADED", { 
    evidenceId: evidence.id, 
    fileName: evidence.fileName, 
    caseId: evidence.caseId 
  });

  revalidatePath("/vault");
  revalidatePath("/cases");
  
  return {
    id: evidence.id,
    fileName: evidence.fileName,
    fileSize: evidence.fileSize,
    fileType: evidence.fileType,
    createdAt: evidence.createdAt.toISOString()
  };
}
