-- CreateTable
CREATE TABLE "SavedHunt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedHunt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedHunt_organizationId_createdAt_idx" ON "SavedHunt"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SavedHunt" ADD CONSTRAINT "SavedHunt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
