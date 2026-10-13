import prisma from "@/lib/prisma";
import { verifyPermission } from "@/lib/dashboard/verify-permission";
import { hasPermission } from "@/lib/dashboard/permissions";
import { EscalationForm } from "./escalation-form";
import { ReviewForm } from "./review-form";
export const dynamic = "force-dynamic";

type Shadow = {
  status?: string;
  prediction?: string | null;
  scanning_score?: number;
  reason?: string;
  model_sha256?: string | null;
  model_contract?: string;
  assessed_at?: string;
};
function readShadow(value: unknown): Shadow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    status: typeof row.status === "string" ? row.status : undefined,
    prediction: typeof row.prediction === "string" ? row.prediction : null,
    scanning_score: typeof row.scanning_score === "number" && Number.isFinite(row.scanning_score) ? row.scanning_score : undefined,
    reason: typeof row.reason === "string" ? row.reason : undefined,
    model_sha256: typeof row.model_sha256 === "string" ? row.model_sha256 : null,
    model_contract: typeof row.model_contract === "string" ? row.model_contract : undefined,
    assessed_at: typeof row.assessed_at === "string" ? row.assessed_at : undefined,
  };
}
function shadowLabel(shadow: Shadow | null): string {
  if (!shadow) return "ML not assessed";
  if (shadow.status === "predicted_shadow") return `Shadow prediction: ${shadow.prediction ?? "unknown"}`;
  if (shadow.status === "rejected") return "ML rejected · no prediction";
  if (shadow.status === "disabled") return "Shadow mode disabled";
  return "ML unavailable · no prediction";
}
export default async function FlowCollectionPage() {
  const { org, role } = await verifyPermission("read:threats");
  const flows = await prisma.flowRecord.findMany({
    where: { organizationId: org.id }, orderBy: { createdAt: "desc" }, take: 50,
    include: { escalations: { where: { organizationId: org.id }, take: 1 }, logSource: { select: { name: true } }, reviews: { where: { organizationId: org.id }, orderBy: { revision: "desc" }, take: 10 } },
  });
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Flow Collection</h1>
      <p className="text-sm text-muted-foreground">Latest 50 collected flows. Shadow predictions cover normal versus scanning only and are provisional model observations. They do not establish confirmed threats or safe traffic.</p>
      <p className="text-xs text-muted-foreground">Missing duration may be handled by the trained model while feature validity remains false. Other unsupported quality issues receive no prediction. Shadow scoring does not create threats, incidents or response actions.</p>
      {!flows.length && <p>No flows collected. Replay Zeek JSON telemetry using a registered log source.</p>}
      {flows.map(flow => {
        const shadow = readShadow(flow.shadowAnalysis);
        return (
          <details key={flow.id} className="rounded border border-border p-3">
            <summary className="cursor-pointer text-sm">{flow.logSource.name} · {flow.zeekUid} · {flow.isSimulated ? "Synthetic" : "Source-reported telemetry"} · {shadowLabel(shadow)}</summary>
            <section className="my-3 rounded border border-border p-3 text-sm space-y-1">
              <h2 className="font-semibold">{shadowLabel(shadow)}</h2>
              {shadow?.status === "predicted_shadow" && shadow.scanning_score !== undefined && (
                <p>Scanning score: {shadow.scanning_score.toFixed(4)} (0–1; uncalibrated). Decision threshold: 0.5.</p>
              )}
              {shadow?.reason && <p>Assessment reason: {shadow.reason}</p>}
              {!shadow && <p>This historical flow has no model assessment. Replaying the same capture and UID preserves its original result.</p>}
              {shadow?.model_contract && <p className="text-xs break-all">Model contract: {shadow.model_contract}</p>}
              {shadow?.model_sha256 && <p className="text-xs break-all">Model SHA-256: {shadow.model_sha256}</p>}
              {shadow?.assessed_at && <p className="text-xs">Assessed at: {shadow.assessed_at}</p>}
            </section>
            <dl className="my-2 text-xs space-y-1">
              <dt>Flow ID</dt><dd>{flow.id}</dd>
              <dt>Trace ID</dt><dd>{flow.traceId}</dd>
              <dt>Capture ID</dt><dd>{flow.captureId}</dd>
              <dt>Collection status</dt><dd>{flow.analysisStatus}</dd>
              <dt>Feature validity</dt><dd>{flow.featureValid ? "Valid under collection schema" : "Quality flags present"}</dd>
              <dt>Event time</dt><dd>{flow.eventTime.toISOString()}</dd>
              <dt>Feature schema</dt><dd>{flow.featureSchema}</dd>
              <dt>Original JSON SHA-256</dt><dd className="break-all">{flow.rawHash}</dd>
            </dl>
            <p className="text-xs">Quality flags: {JSON.stringify(flow.qualityFlags)}</p>
            <pre className="text-xs whitespace-pre-wrap break-all my-2">{JSON.stringify(flow.features, null, 2)}</pre>
            <section className="my-3 rounded border p-3 text-sm">
 <h2 className="font-semibold">Analyst review</h2>
 <p>Review decisions express an analyst judgment. They do not alter evidence or model results, or automatically create records or response actions.</p>
 <p>Current decision: {flow.reviews[0]?.decision.replaceAll("_", " ") ?? "Not reviewed"}</p>
 {hasPermission(role, "write:threats") ? <ReviewForm key={flow.reviews[0]?.id ?? flow.id} flowId={flow.id} expectedReviewId={flow.reviews[0]?.id ?? ""} /> : <p>Your role can read reviews. An Analyst or Admin can save a decision.</p>}
 {flow.escalations[0] ? <div className="my-3 border p-2">
 <p>Linked {flow.escalations[0].kind} · created by {flow.escalations[0].creatorEmail} · {flow.escalations[0].createdAt.toISOString()}</p>
 <p className="whitespace-pre-wrap">{flow.escalations[0].reason}</p>
 <p className="break-all text-xs">Review: {flow.escalations[0].reviewId} · Record ID: {flow.escalations[0].threatId ?? flow.escalations[0].incidentId}</p>
 <a className="underline" href={flow.escalations[0].incidentId ? "/incidents/" + flow.escalations[0].incidentId : "/threats"}>Open linked record</a>
 </div> : flow.reviews[0]?.decision === "confirmed_suspicious" && hasPermission(role, "write:threats") ?
 <EscalationForm key={flow.reviews[0].id} flowId={flow.id} reviewId={flow.reviews[0].id} simulated={flow.isSimulated} canIncident={hasPermission(role, "write:incidents")} /> :
 <p className="mt-2">Record creation becomes available after a confirmed suspicious review.</p>}
 <h3 className="font-semibold mt-3">Latest 10 decisions</h3>
 {flow.reviews.map(review => <div key={review.id} className="border-t py-2">
  <p>Revision {review.revision} · {review.decision.replaceAll("_", " ")} · {review.reviewerEmail} · {review.createdAt.toISOString()}</p>
  <p className="whitespace-pre-wrap break-words">{review.reason}</p>
  <p className="text-xs break-all">Reviewed evidence SHA-256: {review.evidenceHash}</p>
 </div>)}
 </section>
 <h2 className="text-sm font-semibold">Original record</h2>
            <pre className="text-xs whitespace-pre-wrap break-all">{flow.rawRecord}</pre>
          </details>
        );
      })}
    </div>
  );
}
