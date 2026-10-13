-- DropIndex
DROP INDEX "AuditLog_organizationId_idx";

-- DropIndex
DROP INDEX "ComplianceCheck_organizationId_idx";

-- DropIndex
DROP INDEX "Incident_organizationId_idx";

-- DropIndex
DROP INDEX "SecurityLog_eventType_idx";

-- DropIndex
DROP INDEX "SecurityLog_organizationId_idx";

-- DropIndex
DROP INDEX "ThreatEvent_organizationId_idx";

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ComplianceCheck_organizationId_createdAt_idx" ON "ComplianceCheck"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Incident_organizationId_createdAt_idx" ON "Incident"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SecurityLog_organizationId_eventType_createdAt_idx" ON "SecurityLog"("organizationId", "eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ThreatEvent_organizationId_createdAt_idx" ON "ThreatEvent"("organizationId", "createdAt" DESC);
