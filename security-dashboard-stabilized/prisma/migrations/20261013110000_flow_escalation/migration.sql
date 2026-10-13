CREATE UNIQUE INDEX "ThreatEvent_id_organizationId_key" ON "ThreatEvent"("id","organizationId");
CREATE UNIQUE INDEX "Incident_id_organizationId_key" ON "Incident"("id","organizationId");
CREATE UNIQUE INDEX "FlowReview_id_flowId_organizationId_key" ON "FlowReview"("id","flowId","organizationId");
CREATE TABLE "FlowEscalation" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "flowId" TEXT NOT NULL, "reviewId" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "threatId" TEXT, "incidentId" TEXT,
 "creatorId" TEXT NOT NULL, "creatorEmail" TEXT NOT NULL, "reason" TEXT NOT NULL CHECK(char_length(trim("reason")) BETWEEN 10 AND 2000),
 "evidenceHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("kind"='threat' AND "threatId" IS NOT NULL AND "incidentId" IS NULL) OR ("kind"='incident' AND "incidentId" IS NOT NULL AND "threatId" IS NULL)),
 CONSTRAINT "FlowEscalation_flowId_organizationId_fkey" FOREIGN KEY ("flowId","organizationId") REFERENCES "FlowRecord"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "FlowEscalation_reviewId_flowId_organizationId_fkey" FOREIGN KEY ("reviewId","flowId","organizationId") REFERENCES "FlowReview"("id","flowId","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "FlowEscalation_threatId_organizationId_fkey" FOREIGN KEY ("threatId","organizationId") REFERENCES "ThreatEvent"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "FlowEscalation_incidentId_organizationId_fkey" FOREIGN KEY ("incidentId","organizationId") REFERENCES "Incident"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FlowEscalation_organizationId_flowId_key" ON "FlowEscalation"("organizationId","flowId");
