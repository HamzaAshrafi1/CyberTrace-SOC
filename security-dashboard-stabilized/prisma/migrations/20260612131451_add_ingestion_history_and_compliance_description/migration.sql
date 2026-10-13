-- AlterTable
ALTER TABLE "ComplianceCheck" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "IngestionHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" TEXT NOT NULL,
    "eventsCount" INTEGER NOT NULL,
    "threatsCount" INTEGER NOT NULL,
    "incidentsCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionHistory_organizationId_idx" ON "IngestionHistory"("organizationId");

-- AddForeignKey
ALTER TABLE "IngestionHistory" ADD CONSTRAINT "IngestionHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
