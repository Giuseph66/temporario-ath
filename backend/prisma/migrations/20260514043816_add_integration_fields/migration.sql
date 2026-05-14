-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "asaasApiKey" TEXT,
ADD COLUMN     "asaasBaseUrl" TEXT DEFAULT 'https://sandbox.asaas.com/api/v3',
ADD COLUMN     "asaasWebhookSecret" TEXT,
ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "metaAccessToken" TEXT,
ADD COLUMN     "metaPhoneId" TEXT,
ADD COLUMN     "metaVerifyToken" TEXT;
