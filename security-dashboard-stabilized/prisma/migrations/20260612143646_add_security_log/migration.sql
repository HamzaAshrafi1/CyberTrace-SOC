-- CreateTable
CREATE TABLE "SecurityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "eventType" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityLog_organizationId_idx" ON "SecurityLog"("organizationId");

-- CreateIndex
CREATE INDEX "SecurityLog_eventType_idx" ON "SecurityLog"("eventType");
