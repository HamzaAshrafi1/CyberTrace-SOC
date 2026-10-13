"use client";
import { useActionState } from "react";
import { escalateFlow, type EscalationResult } from "./escalation";
export function EscalationForm({ flowId, reviewId, simulated, canIncident }: { flowId: string; reviewId: string; simulated: boolean; canIncident: boolean }) {
 const [state, action, pending] = useActionState(escalateFlow, { message: "" } as EscalationResult);
 return <form action={action} className="space-y-2 mt-3 border-t pt-3">
  <h3 className="font-semibold">Create a linked record</h3>
  <p>This explicitly creates one threat or incident for this flow. Repeated submission returns the existing link.</p>
  {simulated && <p className="font-semibold">Synthetic evidence: the new record will be marked SYNTHETIC.</p>}
  <input type="hidden" name="flowId" value={flowId} /><input type="hidden" name="reviewId" value={reviewId} />
  <label className="block">Record type<select name="kind" className="block border rounded p-2 bg-background"><option value="threat">Threat</option>{canIncident && <option value="incident">Incident</option>}</select></label>
  <label className="block">Severity<select name="severity" defaultValue="MEDIUM" className="block border rounded p-2 bg-background">{["LOW","MEDIUM","HIGH","CRITICAL"].map(s=><option key={s}>{s}</option>)}</select></label>
  <label className="block">Title<input name="title" required minLength={5} maxLength={160} className="block w-full border rounded p-2 bg-background" /></label>
  <label className="block">Escalation reason<textarea name="reason" required minLength={10} maxLength={2000} rows={3} className="block w-full border rounded p-2 bg-background" /></label>
  <label className="block"><input type="checkbox" name="confirm" value="yes" required /> I intend to create this record based on my analyst review.</label>
  <button disabled={pending} className="rounded border px-3 py-2 disabled:opacity-50">{pending ? "Creating…" : "Create linked record"}</button>
  <p role="status">{state.message}</p>{state.href && <a className="underline" href={state.href}>Open linked record</a>}
 </form>;
}
