"use server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";
import { serviceHeaders } from "@/lib/dashboard/service-auth";
import { AEGIS_SERVICE_URL } from "@/lib/dashboard/config";

function reasonText(value: string) {
 if (typeof value !== "string" || value.trim().length < 10 || value.trim().length > 2000) throw new Error("Provide an investigation reason between 10 and 2000 characters.");
 return value.trim();
}
function refresh(id: string) {
 revalidatePath(`/incidents/${id}`); revalidatePath("/incidents"); revalidatePath("/overview");
}
export async function addIncidentCommentAction(incidentId: string, content: string) {
 const {org,user}=await verifyPermission("write:incidents"); const note=reasonText(content);
 await prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe("SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))) AS lock_request",org.id,incidentId);
  const incident=await tx.incident.findFirst({where:{id:incidentId,organizationId:org.id}});
  if(!incident) throw new Error("Incident not found or unauthorized.");
  await tx.incidentComment.create({data:{incidentId,organizationId:org.id,userName:user.email,content:note}});
  await tx.incidentActivityLog.create({data:{incidentId,organizationId:org.id,activityType:"note_added",description:`Investigation note added by ${user.email}.`}});
  await tx.auditLog.create({data:{organizationId:org.id,userId:user.id,userEmail:user.email,action:"Incident Comment Added",metadata:{incidentId}}});
 }); refresh(incidentId);
}
export async function updateIncidentWorkflowAction(incidentId: string,status: string,assignee?: string,expectedUpdatedAt?: string,reason?: string) {
 const {org,user}=await verifyPermission("write:incidents");
 const allowed: Record<string,string[]>={open:["investigating"],investigating:["contained","resolved"],contained:["investigating","resolved"],resolved:["investigating"]};
 if(!Object.hasOwn(allowed,status)) throw new Error("Invalid incident status.");
 if(!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) throw new Error("Refresh before updating this incident.");
 const explanation=reasonText(reason || "");
 await prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe("SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))) AS lock_request",org.id,incidentId);
  const incident=await tx.incident.findFirst({where:{id:incidentId,organizationId:org.id}});
  if(!incident) throw new Error("Incident not found or unauthorized.");
  if(incident.updatedAt.toISOString()!==expectedUpdatedAt) throw new Error("Another update was saved. Refresh before updating again.");
  if(status!==incident.status && !(allowed[incident.status] || []).includes(status)) throw new Error("Start investigation before advancing; reopen a resolved incident to investigate.");
  if(assignee!==undefined && assignee!=="Unassigned") {
   const member=await tx.organizationRole.findFirst({where:{organizationId:org.id,status:"Active",role:{in:["Admin","Analyst"]},user:{email:assignee}}});
   if(!member) throw new Error("Choose an active analyst from this organization.");
  }
  const assignedTo=assignee===undefined?incident.assignedTo:assignee;
  if(status!=="open" && assignedTo==="Unassigned") throw new Error("Assign an analyst before advancing this incident.");
  if(status===incident.status && assignedTo===incident.assignedTo) return;
  await tx.incident.update({where:{id:incidentId},data:{status,assignedTo}});
  await tx.incidentActivityLog.create({data:{organizationId:org.id,incidentId,activityType:status!==incident.status?(status==="resolved"?"resolved":"status_change"):"assigned",description:`${user.email}: ${incident.status} -> ${status}; assignee ${incident.assignedTo} -> ${assignedTo}. Reason: ${explanation}`}});
  await tx.auditLog.create({data:{organizationId:org.id,userId:user.id,userEmail:user.email,action:"Incident Workflow Updated",metadata:{incidentId,previousStatus:incident.status,status,assignedTo,reason:explanation}}});
 }); refresh(incidentId);
}

export async function generateIncidentAiSummaryAction(incidentId: string) {
  const { org } = await verifyPermission("write:incidents");

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId: org.id },
    include: {
      threatEvents: true,
    },
  });
  if (!incident) throw new Error("Incident not found or unauthorized");

  let summaryText = "";

  try {
    const response = await fetch(`${AEGIS_SERVICE_URL}/api/v1/summarize`, {
      method: "POST",
      headers: {
        ...await serviceHeaders(org.id, "write:incidents"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        incident_id: incident.id,
        category: incident.title || "GENERAL_INCIDENT",
        description: incident.description || `Incident involving ${incident.threatEvents.length} threat events.`,
        threat_count: incident.threatEvents.length || 1,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const data = await response.json();
      summaryText = data.summary;
    } else {
      throw new Error(`FastAPI returned status ${response.status}`);
    }
  } catch (error) {
    console.warn("Fallback to local heuristic AI incident summary:", error);

    throw new Error("AI summary unavailable. Review the stored evidence and add an investigation note.");
  }

  // Persist the summary
  await prisma.incident.update({
    where: { id: incidentId },
    data: { aiSummary: summaryText },
  });

  await writeAuditLog("Incident AI Summary Generated", { id: incidentId });

  revalidatePath(`/incidents/${incidentId}`);
  return summaryText;
}
