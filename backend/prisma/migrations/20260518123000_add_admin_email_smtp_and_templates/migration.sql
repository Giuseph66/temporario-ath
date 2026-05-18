-- AlterTable
ALTER TABLE "AdminConfig"
    ADD COLUMN "smtpHost" TEXT,
    ADD COLUMN "smtpPort" INTEGER,
    ADD COLUMN "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "smtpUser" TEXT,
    ADD COLUMN "smtpPass" TEXT,
    ADD COLUMN "smtpFromName" TEXT,
    ADD COLUMN "smtpFromEmail" TEXT,
    ADD COLUMN "smtpReplyTo" TEXT;

-- CreateTable
CREATE TABLE "AdminEmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminEmailTemplateTenant" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminEmailTemplateTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminEmailTemplate_isActive_idx" ON "AdminEmailTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AdminEmailTemplateTenant_templateId_tenantId_key" ON "AdminEmailTemplateTenant"("templateId", "tenantId");

-- CreateIndex
CREATE INDEX "AdminEmailTemplateTenant_templateId_idx" ON "AdminEmailTemplateTenant"("templateId");

-- CreateIndex
CREATE INDEX "AdminEmailTemplateTenant_tenantId_idx" ON "AdminEmailTemplateTenant"("tenantId");

-- AddForeignKey
ALTER TABLE "AdminEmailTemplateTenant"
    ADD CONSTRAINT "AdminEmailTemplateTenant_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "AdminEmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEmailTemplateTenant"
    ADD CONSTRAINT "AdminEmailTemplateTenant_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
