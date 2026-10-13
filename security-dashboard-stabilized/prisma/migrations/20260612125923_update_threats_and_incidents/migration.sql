-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "ThreatEvent" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "assignedTo" TEXT NOT NULL DEFAULT 'Unassigned',
ADD COLUMN     "incidentId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'New';

-- CreateTable
CREATE TABLE "IncidentComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentComment_organizationId_idx" ON "IncidentComment"("organizationId");

-- CreateIndex
CREATE INDEX "IncidentComment_incidentId_idx" ON "IncidentComment"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentActivityLog_organizationId_idx" ON "IncidentActivityLog"("organizationId");

-- CreateIndex
CREATE INDEX "IncidentActivityLog_incidentId_idx" ON "IncidentActivityLog"("incidentId");

-- CreateIndex
CREATE INDEX "ThreatEvent_incidentId_idx" ON "ThreatEvent"("incidentId");

-- AddForeignKey
ALTER TABLE "ThreatEvent" ADD CONSTRAINT "ThreatEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentActivityLog" ADD CONSTRAINT "IncidentActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentActivityLog" ADD CONSTRAINT "IncidentActivityLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
