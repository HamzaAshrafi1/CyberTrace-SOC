CREATE TABLE "FlowRecord" (
 "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "logSourceId" TEXT NOT NULL,
 "captureId" TEXT NOT NULL, "zeekUid" TEXT NOT NULL, "traceId" TEXT NOT NULL, "rawHash" TEXT NOT NULL,
 "rawRecord" TEXT NOT NULL, "featureSchema" TEXT NOT NULL, "features" JSONB NOT NULL,
 "qualityFlags" JSONB NOT NULL, "featureValid" BOOLEAN NOT NULL, "eventTime" TIMESTAMP(3) NOT NULL,
 "isSimulated" BOOLEAN NOT NULL DEFAULT false, "analysisStatus" TEXT NOT NULL DEFAULT 'collected',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FlowRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "FlowRecord_logSourceId_fkey" FOREIGN KEY ("logSourceId") REFERENCES "LogSource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FlowRecord_organizationId_logSourceId_captureId_zeekUid_key" ON "FlowRecord"("organizationId","logSourceId","captureId","zeekUid");
CREATE INDEX "FlowRecord_organizationId_eventTime_idx" ON "FlowRecord"("organizationId","eventTime");
