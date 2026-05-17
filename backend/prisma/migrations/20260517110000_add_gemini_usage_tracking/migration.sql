-- Gemini usage tracking tables (multi-tenant)

CREATE TABLE "GeminiUsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT,
    "userId" TEXT,
    "chatHistoryId" TEXT,
    "source" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "phase" TEXT,
    "fsmState" TEXT,
    "channel" TEXT,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT,
    "responseId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "thinkingTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "toolUsePromptTokens" INTEGER NOT NULL DEFAULT 0,
    "inputTextTokens" INTEGER NOT NULL DEFAULT 0,
    "inputAudioTokens" INTEGER NOT NULL DEFAULT 0,
    "inputImageTokens" INTEGER NOT NULL DEFAULT 0,
    "inputVideoTokens" INTEGER NOT NULL DEFAULT 0,
    "inputDocumentTokens" INTEGER NOT NULL DEFAULT 0,
    "inputEmbeddingTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "estimatedCostBrl" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "exchangeRateUsdBrl" DECIMAL(18,8),
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "usageMetadataJson" JSONB,
    "priceSnapshotJson" JSONB,
    "requestMetaJson" JSONB,
    "toolsUsedJson" JSONB,
    "missingPricesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeminiUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeminiModelCatalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "version" TEXT,
    "description" TEXT,
    "inputTokenLimit" INTEGER,
    "outputTokenLimit" INTEGER,
    "supportedMethodsJson" JSONB,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeminiModelCatalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeminiPriceCatalog" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "pricePerMillion" DECIMAL(18,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unit" TEXT NOT NULL DEFAULT '1M_TOKENS',
    "contextThreshold" INTEGER,
    "thinkingIncludedInOutput" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isManual" BOOLEAN NOT NULL DEFAULT true,
    "isFallbackSeed" BOOLEAN NOT NULL DEFAULT false,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeminiPriceCatalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeminiUsageBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "monthlyLimitUsd" DECIMAL(18,8),
    "monthlyLimitBrl" DECIMAL(18,8),
    "fixedExchangeRateUsdBrl" DECIMAL(18,8),
    "warning50Enabled" BOOLEAN NOT NULL DEFAULT true,
    "warning80Enabled" BOOLEAN NOT NULL DEFAULT true,
    "warning90Enabled" BOOLEAN NOT NULL DEFAULT true,
    "hardLimitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "blockOnLimit" BOOLEAN NOT NULL DEFAULT false,
    "preciseEmbeddingCount" BOOLEAN NOT NULL DEFAULT false,
    "costCalculationMethod" TEXT NOT NULL DEFAULT 'ESTIMATED',
    "alertEmail" TEXT,
    "alertWhatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeminiUsageBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeminiPricingCache" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeminiPricingCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeminiModelCatalog_tenantId_name_key" ON "GeminiModelCatalog"("tenantId", "name");
CREATE INDEX "GeminiModelCatalog_tenantId_idx" ON "GeminiModelCatalog"("tenantId");
CREATE INDEX "GeminiModelCatalog_name_idx" ON "GeminiModelCatalog"("name");

CREATE INDEX "GeminiPriceCatalog_model_idx" ON "GeminiPriceCatalog"("model");
CREATE INDEX "GeminiPriceCatalog_model_modality_direction_idx" ON "GeminiPriceCatalog"("model", "modality", "direction");
CREATE INDEX "GeminiPriceCatalog_effectiveFrom_effectiveTo_idx" ON "GeminiPriceCatalog"("effectiveFrom", "effectiveTo");

CREATE UNIQUE INDEX "GeminiUsageBudget_tenantId_key" ON "GeminiUsageBudget"("tenantId");

CREATE INDEX "GeminiUsageEvent_tenantId_createdAt_idx" ON "GeminiUsageEvent"("tenantId", "createdAt");
CREATE INDEX "GeminiUsageEvent_tenantId_model_idx" ON "GeminiUsageEvent"("tenantId", "model");
CREATE INDEX "GeminiUsageEvent_tenantId_feature_idx" ON "GeminiUsageEvent"("tenantId", "feature");
CREATE INDEX "GeminiUsageEvent_tenantId_source_idx" ON "GeminiUsageEvent"("tenantId", "source");
CREATE INDEX "GeminiUsageEvent_tenantId_fsmState_idx" ON "GeminiUsageEvent"("tenantId", "fsmState");
CREATE INDEX "GeminiUsageEvent_tenantId_status_idx" ON "GeminiUsageEvent"("tenantId", "status");
CREATE INDEX "GeminiUsageEvent_agentId_createdAt_idx" ON "GeminiUsageEvent"("agentId", "createdAt");
CREATE INDEX "GeminiUsageEvent_userId_createdAt_idx" ON "GeminiUsageEvent"("userId", "createdAt");

ALTER TABLE "GeminiUsageEvent"
ADD CONSTRAINT "GeminiUsageEvent_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeminiUsageEvent"
ADD CONSTRAINT "GeminiUsageEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeminiModelCatalog"
ADD CONSTRAINT "GeminiModelCatalog_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeminiUsageBudget"
ADD CONSTRAINT "GeminiUsageBudget_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
