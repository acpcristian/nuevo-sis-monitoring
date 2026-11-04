-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('RUNNING', 'STOPPED', 'ERROR', 'UNKNOWN');

-- CreateTable
CREATE TABLE "server_services" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "port" INTEGER,
    "endpoint" TEXT,
    "process_name" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "last_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "server_services_server_id_status_idx" ON "server_services"("server_id", "status");

-- CreateIndex
CREATE INDEX "server_services_server_id_name_idx" ON "server_services"("server_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "server_services_server_id_name_key" ON "server_services"("server_id", "name");

-- AddForeignKey
ALTER TABLE "server_services" ADD CONSTRAINT "server_services_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
