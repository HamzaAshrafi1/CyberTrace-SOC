-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "attackType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "eventsGenerated" INTEGER NOT NULL DEFAULT 0,
    "incidentsGenerated" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationRun_organizationId_startedAt_idx" ON "SimulationRun"("organizationId", "startedAt");

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
