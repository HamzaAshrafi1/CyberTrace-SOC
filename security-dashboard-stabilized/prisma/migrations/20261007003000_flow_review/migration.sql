CREATE UNIQUE INDEX "FlowRecord_id_organizationId_key" ON "FlowRecord"("id", "organizationId");
CREATE TABLE "FlowReview" (
 "id" TEXT NOT NULL PRIMARY KEY, "flowId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
 "reviewerId" TEXT NOT NULL, "reviewerEmail" TEXT NOT NULL,
 "decision" TEXT NOT NULL CHECK ("decision" IN ('needs_investigation','dismissed','confirmed_suspicious')),
 "reason" TEXT NOT NULL CHECK (char_length(trim("reason")) BETWEEN 10 AND 2000),
 "revision" INTEGER NOT NULL CHECK ("revision" > 0), "evidenceHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FlowReview_flowId_organizationId_fkey" FOREIGN KEY ("flowId","organizationId") REFERENCES "FlowRecord"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FlowReview_flowId_revision_key" ON "FlowReview"("flowId","revision");
CREATE INDEX "FlowReview_organizationId_flowId_idx" ON "FlowReview"("organizationId","flowId");
