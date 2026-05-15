-- CreateEnum
CREATE TYPE "GoogleCalendarIntegrationStatus" AS ENUM ('CONNECTED', 'ERROR', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "UserGoogleCalendarIntegration" (
    "id" TEXT NOT NULL,
    "tenantUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "googleEmail" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" JSONB,
    "status" "GoogleCalendarIntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGoogleCalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGoogleCalendarIntegration_tenantUserId_key" ON "UserGoogleCalendarIntegration"("tenantUserId");

-- CreateIndex
CREATE INDEX "UserGoogleCalendarIntegration_tenantId_idx" ON "UserGoogleCalendarIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "UserGoogleCalendarIntegration_status_idx" ON "UserGoogleCalendarIntegration"("status");

-- AddForeignKey
ALTER TABLE "UserGoogleCalendarIntegration"
ADD CONSTRAINT "UserGoogleCalendarIntegration_tenantUserId_fkey"
FOREIGN KEY ("tenantUserId") REFERENCES "TenantUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGoogleCalendarIntegration"
ADD CONSTRAINT "UserGoogleCalendarIntegration_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
