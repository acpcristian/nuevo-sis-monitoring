-- CreateEnum
CREATE TYPE "OsType" AS ENUM ('LINUX', 'WINDOWS', 'OTHER');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('PROD', 'STAGING', 'DEV', 'QA');

-- CreateEnum
CREATE TYPE "LifecycleState" AS ENUM ('ACTIVE', 'MAINTENANCE', 'DISABLED', 'RETIRED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('ONLINE', 'DEGRADED', 'UNREACHABLE', 'AUTH_FAILED', 'PENDING');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('SSH_KEY', 'PASSWORD', 'AGENT_TOKEN');

-- CreateEnum
CREATE TYPE "CheckResultStatus" AS ENUM ('SUCCESS', 'TIMEOUT', 'REFUSED', 'AUTH_ERROR', 'ERROR');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('SYS_KERNEL', 'AUTH_ACCESS', 'SSH_NETWORK', 'SYSTEM_SERVICE', 'WEB_APP', 'DATABASE', 'STORAGE_HW', 'BACKUP_TASK', 'SECURITY_AUDIT', 'AGENT_ERROR');

-- CreateEnum
CREATE TYPE "LogSeverity" AS ENUM ('INFO', 'WARN', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FreshnessState" AS ENUM ('FRESH', 'STALE', 'AGENT_DISCONNECTED', 'UNREACHABLE');

-- CreateEnum
CREATE TYPE "DiagnosisStatus" AS ENUM ('DRAFT', 'FINAL', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'OBSERVADOR');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('INCIDENT_CRITICAL', 'INCIDENT_MAJOR', 'INCIDENT_MINOR', 'INCIDENT_MAINTENANCE');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('EMAIL', 'SLACK', 'WEBHOOK', 'PAGERDUTY');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ActionKind" AS ENUM ('RESTART_SERVICE', 'APPLY_CONFIG', 'RUN_COMMAND', 'NOTIFY_TEAM', 'CHECK_STATE', 'WAIT_SECONDS');

-- CreateEnum
CREATE TYPE "PlaybookStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "hostname" TEXT,
    "os_type" "OsType" NOT NULL DEFAULT 'LINUX',
    "os_version" TEXT,
    "environment" "Environment" NOT NULL DEFAULT 'PROD',
    "connection_port" INTEGER NOT NULL DEFAULT 22,
    "technical_owner" TEXT,
    "description" TEXT,
    "lifecycle_state" "LifecycleState" NOT NULL DEFAULT 'ACTIVE',
    "health_status" "HealthStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_checked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_credentials" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "credential_type" "CredentialType" NOT NULL DEFAULT 'SSH_KEY',
    "username" TEXT NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "key_fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connectivity_checks" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER NOT NULL,
    "result_status" "CheckResultStatus" NOT NULL,
    "diagnostic_summary" TEXT,

    CONSTRAINT "connectivity_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_tags" (
    "server_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "server_tags_pkey" PRIMARY KEY ("server_id","tag_id")
);

-- CreateTable
CREATE TABLE "inventory_audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_server_id" TEXT,
    "details_diff" JSONB NOT NULL,
    "ip_address" TEXT,

    CONSTRAINT "inventory_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "log_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_events" (
    "id" TEXT NOT NULL,
    "server_id" TEXT,
    "category_id" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "ingestion_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_timestamp" TIMESTAMP(3),
    "event_type" TEXT,
    "severity" "LogSeverity" NOT NULL,
    "sanitized_message" TEXT NOT NULL,
    "raw_log" TEXT NOT NULL,
    "metadata" JSONB,
    "is_untrusted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "log_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_diagnoses" (
    "id" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observed_facts" TEXT NOT NULL,
    "probable_cause" TEXT NOT NULL,
    "evidence_support" JSONB NOT NULL,
    "alternative_diagnoses" TEXT,
    "impact_potential" TEXT,
    "verification_steps" TEXT,
    "remediation_recommendations" TEXT,
    "confidence_level" "ConfidenceLevel" NOT NULL,
    "status" "DiagnosisStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "incident_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_freshness_states" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "freshness_state" "FreshnessState" NOT NULL,
    "last_telemetry_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_freshness_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_alerts" (
    "id" TEXT NOT NULL,
    "server_id" TEXT,
    "category" "LogCategory",
    "pattern_type" TEXT NOT NULL,
    "event_count" INTEGER NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "severity" "LogSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "log_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "role" "UserRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "priority" "IncidentPriority" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "server_id" TEXT,
    "alert_id" TEXT,
    "event_id" TEXT,
    "assignedTo" TEXT,
    "sla_timeout_min" INTEGER,
    "sla_due_at" TIMESTAMP(3),
    "sla_met" BOOLEAN,
    "created_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "escalated_at" TIMESTAMP(3),
    "root_cause" TEXT,
    "corrective_actions" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_audit_logs" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "encrypted_payload" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "config_summary" JSONB,
    "last_test_at" TIMESTAMP(3),
    "last_test_status" TEXT,
    "last_test_detail" TEXT,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failure_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "incident_id" TEXT,
    "status" "DeliveryStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_retry_at" TIMESTAMP(3),
    "error" TEXT,
    "message_id" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PlaybookStatus" NOT NULL DEFAULT 'DISABLED',
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_executions" (
    "id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "trigger" JSONB,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "steps_log" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "playbook_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IncidentDiagnosisToLogEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_LogAlertToLogEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "servers_name_key" ON "servers"("name");

-- CreateIndex
CREATE INDEX "servers_environment_health_status_lifecycle_state_idx" ON "servers"("environment", "health_status", "lifecycle_state");

-- CreateIndex
CREATE INDEX "servers_ip_address_idx" ON "servers"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "server_credentials_server_id_key" ON "server_credentials"("server_id");

-- CreateIndex
CREATE INDEX "connectivity_checks_server_id_event_timestamp_idx" ON "connectivity_checks"("server_id", "event_timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tags_key_value_key" ON "tags"("key", "value");

-- CreateIndex
CREATE INDEX "inventory_audit_logs_timestamp_idx" ON "inventory_audit_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "inventory_audit_logs_target_server_id_idx" ON "inventory_audit_logs"("target_server_id");

-- CreateIndex
CREATE UNIQUE INDEX "log_categories_code_key" ON "log_categories"("code");

-- CreateIndex
CREATE INDEX "log_events_server_id_event_timestamp_idx" ON "log_events"("server_id", "event_timestamp" DESC);

-- CreateIndex
CREATE INDEX "log_events_category_id_event_timestamp_idx" ON "log_events"("category_id", "event_timestamp" DESC);

-- CreateIndex
CREATE INDEX "log_events_ingestion_timestamp_idx" ON "log_events"("ingestion_timestamp" DESC);

-- CreateIndex
CREATE INDEX "incident_diagnoses_generated_at_idx" ON "incident_diagnoses"("generated_at" DESC);

-- CreateIndex
CREATE INDEX "incident_diagnoses_status_idx" ON "incident_diagnoses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "data_freshness_states_server_id_key" ON "data_freshness_states"("server_id");

-- CreateIndex
CREATE INDEX "log_alerts_server_id_status_idx" ON "log_alerts"("server_id", "status");

-- CreateIndex
CREATE INDEX "log_alerts_window_start_window_end_idx" ON "log_alerts"("window_start", "window_end");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "incidents_status_priority_category_idx" ON "incidents"("status", "priority", "category");

-- CreateIndex
CREATE INDEX "incidents_server_id_idx" ON "incidents"("server_id");

-- CreateIndex
CREATE INDEX "incidents_assignedTo_status_idx" ON "incidents"("assignedTo", "status");

-- CreateIndex
CREATE INDEX "incidents_created_at_idx" ON "incidents"("created_at" DESC);

-- CreateIndex
CREATE INDEX "incident_audit_logs_incident_id_created_at_idx" ON "incident_audit_logs"("incident_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_name_key" ON "notification_channels"("name");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_retry_at_idx" ON "notification_deliveries"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_incident_id_idx" ON "notification_deliveries"("incident_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_channel_id_dedup_key_key" ON "notification_deliveries"("channel_id", "dedup_key");

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_name_key" ON "playbooks"("name");

-- CreateIndex
CREATE INDEX "playbooks_status_last_run_at_idx" ON "playbooks"("status", "last_run_at" DESC);

-- CreateIndex
CREATE INDEX "playbook_executions_playbook_id_started_at_idx" ON "playbook_executions"("playbook_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "playbook_executions_status_idx" ON "playbook_executions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "_IncidentDiagnosisToLogEvent_AB_unique" ON "_IncidentDiagnosisToLogEvent"("A", "B");

-- CreateIndex
CREATE INDEX "_IncidentDiagnosisToLogEvent_B_index" ON "_IncidentDiagnosisToLogEvent"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_LogAlertToLogEvent_AB_unique" ON "_LogAlertToLogEvent"("A", "B");

-- CreateIndex
CREATE INDEX "_LogAlertToLogEvent_B_index" ON "_LogAlertToLogEvent"("B");

-- AddForeignKey
ALTER TABLE "server_credentials" ADD CONSTRAINT "server_credentials_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectivity_checks" ADD CONSTRAINT "connectivity_checks_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_tags" ADD CONSTRAINT "server_tags_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_tags" ADD CONSTRAINT "server_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_target_server_id_fkey" FOREIGN KEY ("target_server_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_events" ADD CONSTRAINT "log_events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "log_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_events" ADD CONSTRAINT "log_events_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_freshness_states" ADD CONSTRAINT "data_freshness_states_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_alerts" ADD CONSTRAINT "log_alerts_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "log_alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "log_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_audit_logs" ADD CONSTRAINT "incident_audit_logs_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "notification_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_executions" ADD CONSTRAINT "playbook_executions_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncidentDiagnosisToLogEvent" ADD CONSTRAINT "_IncidentDiagnosisToLogEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "incident_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncidentDiagnosisToLogEvent" ADD CONSTRAINT "_IncidentDiagnosisToLogEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "log_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LogAlertToLogEvent" ADD CONSTRAINT "_LogAlertToLogEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "log_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LogAlertToLogEvent" ADD CONSTRAINT "_LogAlertToLogEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "log_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
