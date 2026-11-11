-- 013 — Agente fase 2b: Knowledge Base + historial de conversaciones con métricas.
CREATE TABLE "agent_kb_entries" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "question" TEXT,
  "answer" TEXT,
  "title" TEXT,
  "content" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_kb_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_conversations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "turn_count" INTEGER NOT NULL DEFAULT 0,
  "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_output_tokens" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "tools" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_conversations_last_message_at_idx" ON "agent_conversations"("last_message_at" DESC);
CREATE INDEX "agent_messages_conversation_id_created_at_idx" ON "agent_messages"("conversation_id", "created_at");

ALTER TABLE "agent_messages"
  ADD CONSTRAINT "agent_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
