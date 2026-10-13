ALTER TABLE "ThreatEvent" ADD COLUMN "traceId" TEXT,
 ADD COLUMN "rawHash" TEXT, ADD COLUMN "sourceEventId" TEXT,
 ADD COLUMN "eventTime" TIMESTAMP(3), ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "ThreatEvent_organizationId_target_sourceEventId_key"
 ON "ThreatEvent"("organizationId", "target", "sourceEventId");
