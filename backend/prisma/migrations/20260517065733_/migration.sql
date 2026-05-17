-- Enable pgvector before creating vector columns.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "adminChatEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "agentInternalMode" TEXT NOT NULL DEFAULT 'orientador',
ADD COLUMN     "humanHandoffMessage" TEXT,
ADD COLUMN     "humanNotificationNumber" TEXT,
ADD COLUMN     "humanSupportNumber" TEXT,
ADD COLUMN     "ignoreGroups" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "knowledgeContractsJson" JSONB,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'Português (BR)',
ADD COLUMN     "objectionHandlingJson" JSONB,
ADD COLUMN     "ownerPhone" TEXT,
ADD COLUMN     "qualificationJson" JSONB,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "toneJson" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "whitelistEnabled" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "personaJson" DROP NOT NULL,
ALTER COLUMN "programsJson" DROP NOT NULL,
ALTER COLUMN "settingsJson" DROP NOT NULL,
ALTER COLUMN "geminiModel" SET DEFAULT 'gemini-2.5-flash';

-- AlterTable
ALTER TABLE "ChatHistory" ADD COLUMN     "media" JSONB;

-- AlterTable
ALTER TABLE "KnowledgeChunk" ADD COLUMN     "embedding" vector(768);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AgentProgram" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "programKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceType" TEXT NOT NULL DEFAULT 'monthly',
    "installments" INTEGER NOT NULL DEFAULT 1,
    "durationWeeks" INTEGER NOT NULL DEFAULT 0,
    "verbatimIntro" TEXT NOT NULL DEFAULT '',
    "fullText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgentProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProtocol" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AgentProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRestriction" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgentRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistPhone" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "WhitelistPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistGroup" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "WhitelistGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "customName" TEXT,
    "profilePicUrl" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentProgram_agentId_idx" ON "AgentProgram"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProgram_agentId_programKey_key" ON "AgentProgram"("agentId", "programKey");

-- CreateIndex
CREATE INDEX "AgentProtocol_agentId_idx" ON "AgentProtocol"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProtocol_agentId_key_key" ON "AgentProtocol"("agentId", "key");

-- CreateIndex
CREATE INDEX "AgentRestriction_agentId_idx" ON "AgentRestriction"("agentId");

-- CreateIndex
CREATE INDEX "WhitelistPhone_agentId_idx" ON "WhitelistPhone"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistPhone_agentId_phone_key" ON "WhitelistPhone"("agentId", "phone");

-- CreateIndex
CREATE INDEX "WhitelistGroup_agentId_idx" ON "WhitelistGroup"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistGroup_agentId_groupId_key" ON "WhitelistGroup"("agentId", "groupId");

-- CreateIndex
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_tenantId_phone_key" ON "Contact"("tenantId", "phone");

-- AddForeignKey
ALTER TABLE "AgentProgram" ADD CONSTRAINT "AgentProgram_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProtocol" ADD CONSTRAINT "AgentProtocol_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRestriction" ADD CONSTRAINT "AgentRestriction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistPhone" ADD CONSTRAINT "WhitelistPhone_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistGroup" ADD CONSTRAINT "WhitelistGroup_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
