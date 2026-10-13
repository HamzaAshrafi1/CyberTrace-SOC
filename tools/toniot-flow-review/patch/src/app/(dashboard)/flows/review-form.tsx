"use client";
import { useActionState } from "react";
import { saveFlowReview } from "./actions";
export function ReviewForm({ flowId, expectedReviewId }: { flowId: string; expectedReviewId: string }) {
 const [state, action, pending] = useActionState(saveFlowReview, { message: "" });
 return <form action={action} className="space-y-2 mt-3">
  <input type="hidden" name="flowId" value={flowId} />
  <input type="hidden" name="expectedReviewId" value={expectedReviewId} />
  <label className="block">Decision<select name="decision" required className="block rounded border p-2 bg-background" defaultValue="needs_investigation">
   <option value="needs_investigation">Needs investigation</option><option value="dismissed">Dismissed</option><option value="confirmed_suspicious">Confirmed suspicious by analyst</option>
  </select></label>
  <label className="block">Reason<textarea name="reason" required minLength={10} maxLength={2000} rows={3} className="block w-full rounded border p-2 bg-background" placeholder="Record the evidence and reasoning supporting your decision." /></label>
  <button type="submit" disabled={pending} className="rounded border px-3 py-2 disabled:opacity-50">{pending ? "Saving…" : "Save review"}</button>
  <p role="status">{state.message}</p>
 </form>;
}
