CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'BUSINESS',
    "entity_type" TEXT,
    "entity_id" TEXT,
    "summary" TEXT,
    "http_method" TEXT,
    "route" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "status_code" INTEGER,
    "changed_data" JSONB,
    "previous_data" JSONB,
    "new_data" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activity_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "activity_logs_actor_user_id_idx" ON "activity_logs"("actor_user_id");
CREATE INDEX "activity_logs_actor_role_idx" ON "activity_logs"("actor_role");
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");
CREATE INDEX "activity_logs_occurred_at_idx" ON "activity_logs"("occurred_at");
