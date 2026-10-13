"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { writeAuditLog } from "@/lib/dashboard/audit";

export async function getReportsHistoryAction() {
  const { org } = await verifyPermission("read:reports");

  return prisma.report.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteReportAction(reportId: string) {
  const { org } = await verifyPermission("write:reports");

  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      organizationId: org.id,
    },
  });
  if (!report) throw new Error("Report not found");

  await prisma.report.delete({
    where: { id: report.id },
  });

  await writeAuditLog("Report Deleted", { title: report.title });

  revalidatePath("/reports");
  return { success: true };
}

export async function generateSecurityReportAction(type: string, title: string) {
  const { org } = await verifyPermission("write:reports");

  // Get current user details
  const user = await currentUser();
  const operatorName = user?.emailAddresses[0]?.emailAddress || user?.firstName || "Security Operator";

  let metadataPayload: any = {};

  let threatEvents: any[] = [];
  let incidents: any[] = [];
  let complianceChecks: any[] = [];

  // 1. Gather context datasets on-demand based on requested report type to prevent redundant queries
  if (type === "threat_intel" || type === "executive_summary") {
    threatEvents = await prisma.threatEvent.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
    });
  }

  if (type === "incident_response" || type === "executive_summary") {
    incidents = await prisma.incident.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
    });
  }

  if (type === "compliance" || type === "executive_summary") {
    complianceChecks = await prisma.complianceCheck.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
    });
  }

  if (type === "threat_intel") {
    const totalThreats = threatEvents.length;
    
    // Severity breakdown
    const severityBreakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    threatEvents.forEach((t) => {
      const sev = t.severity.toUpperCase() as keyof typeof severityBreakdown;
      if (sev in severityBreakdown) {
        severityBreakdown[sev]++;
      }
    });

    // Type breakdown (description contains attack type)
    const typeBreakdown: Record<string, number> = {};
    threatEvents.forEach((t) => {
      const desc = t.description || "UNKNOWN";
      typeBreakdown[desc] = (typeBreakdown[desc] || 0) + 1;
    });

    // Top Source IPs
    const sourceIps: Record<string, number> = {};
    threatEvents.forEach((t) => {
      sourceIps[t.sourceIp] = (sourceIps[t.sourceIp] || 0) + 1;
    });
    const topSources = Object.entries(sourceIps)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top Targets
    const targets: Record<string, number> = {};
    threatEvents.forEach((t) => {
      targets[t.target] = (targets[t.target] || 0) + 1;
    });
    const topTargets = Object.entries(targets)
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Threat Trend Chart (Group counts by date)
    const dateCounts: Record<string, number> = {};
    threatEvents.slice(0, 50).forEach((t) => {
      const dateStr = new Date(t.createdAt).toLocaleDateString();
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });
    const trendData = Object.entries(dateCounts)
      .map(([date, count]) => ({ date, count }))
      .reverse();

    metadataPayload = {
      totalThreats,
      severityBreakdown,
      typeBreakdown,
      topSources,
      topTargets,
      trendData,
    };
  } else if (type === "incident_response") {
    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter((i) => i.status !== "resolved").length;
    const resolvedIncidents = incidents.filter((i) => i.status === "resolved").length;

    // Calculate Mean Resolution Time (MRT) in hours
    const resolved = incidents.filter((i) => i.status === "resolved");
    let meanResolutionTimeHr = 0;
    if (resolved.length > 0) {
      const sumMs = resolved.reduce((acc, inc) => {
        return acc + (inc.updatedAt.getTime() - inc.createdAt.getTime());
      }, 0);
      meanResolutionTimeHr = Number((sumMs / resolved.length / (1000 * 60 * 60)).toFixed(1));
    }

    // Incident timeline log
    const timeline = incidents.slice(0, 10).map((inc) => ({
      date: inc.createdAt.toISOString(),
      title: inc.title,
      status: inc.status,
      severity: inc.severity,
    }));

    metadataPayload = {
      totalIncidents,
      openIncidents,
      resolvedIncidents,
      meanResolutionTimeHr,
      timeline,
    };
  } else if (type === "compliance") {
    const totalChecks = complianceChecks.length;
    let overallScore = 0;
    if (totalChecks > 0) {
      const sum = complianceChecks.reduce((acc, c) => acc + c.score, 0);
      overallScore = Math.round(sum / totalChecks);
    }

    // Scores by framework
    const scoresMap: Record<string, { sum: number; count: number }> = {};
    complianceChecks.forEach((c) => {
      const baseFramework = c.framework.split(" - ")[0];
      if (!scoresMap[baseFramework]) {
        scoresMap[baseFramework] = { sum: 0, count: 0 };
      }
      scoresMap[baseFramework].sum += c.score;
      scoresMap[baseFramework].count++;
    });
    const frameworkScores = Object.entries(scoresMap).map(([framework, data]) => ({
      framework,
      score: Math.round(data.sum / data.count),
    }));

    // Failed controls
    const failedControls = complianceChecks
      .filter((c) => c.status === "failed" || c.status === "warning")
      .map((c) => ({
        framework: c.framework,
        description: c.description,
        status: c.status,
        score: c.score,
      }));

    // Remediation guidelines
    const remediations = failedControls.map((fc) => {
      let advise = "Verify configurations match isolated corporate criteria.";
      if (fc.framework.includes("A.12.4.1") || fc.framework.includes("A09")) {
        advise = "Configure at least one active log source node under Settings.";
      } else if (fc.framework.includes("5.2")) {
        advise = "Rotate and invalidate API keys active for longer than 90 days.";
      } else if (fc.framework.includes("33")) {
        advise = "Verify auto-incident pathways are active for critical threats.";
      }
      return {
        control: fc.framework,
        advise,
      };
    });

    // Compliance Score Trend
    const dateScores: Record<string, { sum: number; count: number }> = {};
    complianceChecks.slice(0, 30).forEach((c) => {
      const dateStr = new Date(c.createdAt).toLocaleDateString();
      if (!dateScores[dateStr]) {
        dateScores[dateStr] = { sum: 0, count: 0 };
      }
      dateScores[dateStr].sum += c.score;
      dateScores[dateStr].count++;
    });
    const trendData = Object.entries(dateScores)
      .map(([date, data]) => ({
        date,
        score: Math.round(data.sum / data.count),
      }))
      .reverse();

    metadataPayload = {
      overallScore,
      frameworkScores,
      failedControls,
      remediations,
      trendData,
    };
  } else if (type === "executive_summary") {
    // Compile combined indicators
    const totalThreats = threatEvents.length;
    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter((i) => i.status !== "resolved").length;
    const criticalThreats = threatEvents.filter((t) => t.severity.toUpperCase() === "CRITICAL").length;
    
    let overallComplianceScore = 100;
    if (complianceChecks.length > 0) {
      const sum = complianceChecks.reduce((acc, c) => acc + c.score, 0);
      overallComplianceScore = Math.round(sum / complianceChecks.length);
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    let aiSummaryText = "";
    let aiRiskText = "";
    let aiRecs: string[] = [];

    if (openrouterKey) {
      // Contact OpenRouter LLM to generate professional report summaries
      const systemPrompt = `You are a Chief Information Security Officer (CISO). 
Generate a professional, structured executive security summary report based on these SOC metrics:
- Total Threats Blocked: ${totalThreats}
- Active Incidents: ${openIncidents}
- Total Incidents Logged: ${totalIncidents}
- Critical Severity Telemetries: ${criticalThreats}
- Framework Compliance Rating: ${overallComplianceScore}%`;

      const prompt = `Return a JSON object containing exactly these fields (strictly in valid JSON format):
{
  "summary": "2-3 sentences overview of the SOC state",
  "riskAssessment": "Overview of primary risks and vulnerabilities",
  "recommendations": ["recomm 1", "recomm 2", "recomm 3", "recomm 4"]
}`;

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const resJson = await res.json();
          const responseContent = JSON.parse(resJson.choices[0].message.content);
          aiSummaryText = responseContent.summary;
          aiRiskText = responseContent.riskAssessment;
          aiRecs = responseContent.recommendations;
        }
      } catch (err) {
        console.error("OpenRouter report summaries fetch error:", err);
      }
    }

    // Dynamic Heuristic Fallbacks if API Key is absent or fails
    if (!aiSummaryText) {
      aiSummaryText = `The SOC operational posture indicates that security layers are actively ingestion telemetry data. Currently, there are ${openIncidents} unresolved incidents and ${criticalThreats} critical severity threats needing operator triaging. General network integrity remains stable under isolation protocols.`;
    }
    if (!aiRiskText) {
      aiRiskText = `Primary threat risks relate to command injections and authentication brute-force attempts targeting Kubernetes gateways. Security postures are warning on credential rotation intervals, which present potential compliance auditor findings.`;
    }
    if (aiRecs.length === 0) {
      aiRecs = [
        "Enforce immediate multi-factor authentication (MFA) credentials on all operator login domains.",
        "Rotate LogSource access API credentials active for longer than 90 days in Settings.",
        "Block the active source IPs identified in high-severity alarms at the edge router.",
        "Establish immediate alerts for volumetric threat rates spikes."
      ];
    }

    metadataPayload = {
      totalThreats,
      totalIncidents,
      openIncidents,
      overallComplianceScore,
      aiSummary: aiSummaryText,
      riskAssessment: aiRiskText,
      recommendations: aiRecs,
    };
  }

  // Create the database report entry
  const report = await prisma.report.create({
    data: {
      organizationId: org.id,
      type: type,
      title: title || `${type.replace("_", " ").toUpperCase()} Security Audit`,
      generatedBy: operatorName,
      metadata: JSON.stringify(metadataPayload),
    },
  });

  await writeAuditLog("Report Generated", { title: report.title, type });

  revalidatePath("/reports");
  return report;
}
