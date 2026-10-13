-- DropIndex
DROP INDEX "AuditLog_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "ChatMessage_sessionId_idx";

-- DropIndex
DROP INDEX "Incident_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "IncidentComment_incidentId_idx";

-- DropIndex
DROP INDEX "ThreatEvent_organizationId_createdAt_idx";

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_organizationId_createdAt_idx" ON "Incident"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentComment_incidentId_createdAt_idx" ON "IncidentComment"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "LogSource_organizationId_name_idx" ON "LogSource"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ThreatEvent_organizationId_createdAt_idx" ON "ThreatEvent"("organizationId", "createdAt");
