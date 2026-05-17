-- CreateTable
CREATE TABLE "SimulatorSession" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "title"       TEXT NOT NULL DEFAULT 'Nova sessão',
    "agentType"   TEXT NOT NULL DEFAULT 'atendente',
    "convState"   TEXT NOT NULL DEFAULT 'GREETING',
    "simMode"     TEXT NOT NULL DEFAULT 'cliente',
    "messages"    JSONB NOT NULL DEFAULT '[]',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatorSession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SimulatorSession" ADD CONSTRAINT "SimulatorSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
