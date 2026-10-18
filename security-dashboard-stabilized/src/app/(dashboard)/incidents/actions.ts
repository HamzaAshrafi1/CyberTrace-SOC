"use server";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
export async function updateIncidentStatus(_incidentId:string,_status:string) {
 await verifyPermission("write:incidents");
 throw new Error("Open the incident detail page to update status with a reason and freshness check.");
}
export async function assignIncidentToSelf(_incidentId:string,_analystEmail:string) {
 await verifyPermission("write:incidents");
 throw new Error("Open the incident detail page to assign an active analyst and record a reason.");
}
