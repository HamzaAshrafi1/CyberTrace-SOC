-- Separate, optional model observations. Historical evidence remains unchanged.
ALTER TABLE "FlowRecord" ADD COLUMN "shadowAnalysis" JSONB;
