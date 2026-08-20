-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "id_number" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "last_login" DATETIME,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "can_be_edited" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OTHER',
    "nic_number" TEXT,
    "date_of_birth" DATETIME,
    "gender" TEXT,
    "social_handle" TEXT,
    "additional_notes" TEXT,
    "assigned_sales_manager_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "customers_assigned_sales_manager_id_fkey" FOREIGN KEY ("assigned_sales_manager_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "inquiry_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentative_wedding_date" DATETIME,
    "tentative_venue" TEXT,
    "estimated_guest_count" INTEGER,
    "budget_range" TEXT,
    "lead_source" TEXT NOT NULL DEFAULT 'INSTAGRAM_DM',
    "stage" TEXT NOT NULL DEFAULT 'NEW_INQUIRY',
    "next_followup_date" DATETIME,
    "assigned_sales_exec_id" TEXT,
    "interest_notes" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leads_assigned_sales_exec_id_fkey" FOREIGN KEY ("assigned_sales_exec_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city_area" TEXT NOT NULL,
    "full_address" TEXT,
    "venue_type" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "max_capacity" INTEGER,
    "indoor_outdoor" TEXT,
    "load_in_notes" TEXT,
    "floral_restrictions" TEXT,
    "parking_availability" TEXT,
    "power_access" TEXT,
    "in_house_catering" BOOLEAN NOT NULL DEFAULT false,
    "notes_rating" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "area_served" TEXT,
    "reliability_rating" INTEGER DEFAULT 5,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "wedding_date" DATETIME NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "ceremony_venue_id" TEXT,
    "ceremony_time" TEXT,
    "reception_venue_id" TEXT,
    "reception_time" TEXT,
    "florist_setup_time" TEXT,
    "guest_count" INTEGER,
    "package_type" TEXT NOT NULL DEFAULT 'CLASSIC_ELEGANCE',
    "service_scope" TEXT NOT NULL DEFAULT 'FULL_WEDDING_PACKAGE',
    "colour_theme" TEXT,
    "sales_exec_id" TEXT,
    "total_quote_amount" INTEGER NOT NULL,
    "deposit_percent" REAL NOT NULL DEFAULT 30.0,
    "deposit_amount" INTEGER NOT NULL,
    "deposit_paid_date" DATETIME,
    "balance_due_amount" INTEGER NOT NULL,
    "balance_due_date" DATETIME,
    "payment_status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "booking_status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "days_until_wedding" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "photographer_vendor_id" TEXT,
    "decorator_vendor_id" TEXT,
    "caterer_vendor_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_ceremony_venue_id_fkey" FOREIGN KEY ("ceremony_venue_id") REFERENCES "venues" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_reception_venue_id_fkey" FOREIGN KEY ("reception_venue_id") REFERENCES "venues" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_sales_exec_id_fkey" FOREIGN KEY ("sales_exec_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_photographer_vendor_id_fkey" FOREIGN KEY ("photographer_vendor_id") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_decorator_vendor_id_fkey" FOREIGN KEY ("decorator_vendor_id") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_caterer_vendor_id_fkey" FOREIGN KEY ("caterer_vendor_id") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "booking_id" TEXT NOT NULL,
    "stage_type" TEXT NOT NULL,
    "amount_due" INTEGER NOT NULL,
    "due_date" DATETIME NOT NULL,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "paid_date" DATETIME,
    "paid_confirmed_by_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payment_stages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_stages_paid_confirmed_by_id_fkey" FOREIGN KEY ("paid_confirmed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_deadline_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage_type" TEXT NOT NULL,
    "days_before_due_to_notify" INTEGER NOT NULL,
    "default_days_from_enquiry" INTEGER,
    "default_days_before_event" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expense_id" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "booking_id" TEXT,
    "client_name" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supplier_name" TEXT,
    "supplier_contact" TEXT,
    "department" TEXT DEFAULT 'OTHER_DEPT',
    "payment_method" TEXT DEFAULT 'CASH',
    "amount" INTEGER NOT NULL,
    "tax_vat" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "paid_by_name" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'PAID',
    "approval_status" TEXT NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "imported_from" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "historical_incomes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "booking_ref" TEXT,
    "client_name" TEXT,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "payment_type" TEXT,
    "received_via" TEXT,
    "imported_from" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendor_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due_date" DATETIME NOT NULL,
    "paid_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "discount_approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "booking_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "discount_approvals_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT,
    "target_amount" INTEGER NOT NULL,
    "achieved_amount" INTEGER NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL DEFAULT 'MONTHLY',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "booking_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "venue" TEXT,
    "coordinator_id" TEXT,
    "coordinator_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "checklist_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "social_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "budget" INTEGER NOT NULL DEFAULT 0,
    "leads_captured" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sender_id" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "recipient_id" TEXT,
    "recipient_name" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "attachment_url" TEXT,
    "sent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "work_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME,
    "duration" INTEGER,
    "notes" TEXT,
    "clock_in_latitude" REAL,
    "clock_in_longitude" REAL,
    "clock_in_accuracy_meters" REAL,
    "clock_out_latitude" REAL,
    "clock_out_longitude" REAL,
    "clock_out_accuracy_meters" REAL,
    "geofence_id" TEXT,
    "location_verified" BOOLEAN NOT NULL DEFAULT false,
    "device_info" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_sessions_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "geofences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "center_latitude" REAL NOT NULL,
    "center_longitude" REAL NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "attendance_attempt_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "accuracy_meters" REAL,
    "result" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "nearest_geofence_id" TEXT,
    "nearest_distance_m" REAL,
    "work_session_id" TEXT,
    "device_info" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_attempt_logs_nearest_geofence_id_fkey" FOREIGN KEY ("nearest_geofence_id") REFERENCES "geofences" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_session_overrides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "work_session_id" TEXT NOT NULL,
    "overridden_by_id" TEXT NOT NULL,
    "overridden_by_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "original_data" TEXT NOT NULL,
    "new_data" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "role_name" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "work_schedule_configs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "working_days" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "work_start_time" TEXT NOT NULL DEFAULT '09:00',
    "work_end_time" TEXT NOT NULL DEFAULT '17:00',
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "updated_by_id" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "requested_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approver_id" TEXT,
    "approver_name" TEXT,
    "decided_at" DATETIME,
    "decision_notes" TEXT
);

-- CreateTable
CREATE TABLE "system_target_configs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "yearly_target" REAL NOT NULL DEFAULT 60000000,
    "updated_by_id" TEXT,
    "updated_by_name" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_id_key" ON "customers"("customer_id");

-- CreateIndex
CREATE INDEX "customers_customer_id_idx" ON "customers"("customer_id");

-- CreateIndex
CREATE INDEX "leads_customer_id_idx" ON "leads"("customer_id");

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "leads_lead_source_idx" ON "leads"("lead_source");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_lead_id_idx" ON "bookings"("lead_id");

-- CreateIndex
CREATE INDEX "bookings_booking_status_idx" ON "bookings"("booking_status");

-- CreateIndex
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");

-- CreateIndex
CREATE INDEX "bookings_wedding_date_idx" ON "bookings"("wedding_date");

-- CreateIndex
CREATE INDEX "payment_stages_booking_id_idx" ON "payment_stages"("booking_id");

-- CreateIndex
CREATE INDEX "payment_stages_status_idx" ON "payment_stages"("status");

-- CreateIndex
CREATE INDEX "payment_stages_due_date_idx" ON "payment_stages"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_deadline_rules_stage_type_key" ON "payment_deadline_rules"("stage_type");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expense_id_key" ON "expenses"("expense_id");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_booking_id_idx" ON "expenses"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "historical_incomes_import_id_key" ON "historical_incomes"("import_id");

-- CreateIndex
CREATE INDEX "historical_incomes_date_idx" ON "historical_incomes"("date");

-- CreateIndex
CREATE INDEX "historical_incomes_booking_ref_idx" ON "historical_incomes"("booking_ref");

-- CreateIndex
CREATE INDEX "work_sessions_user_id_idx" ON "work_sessions"("user_id");

-- CreateIndex
CREATE INDEX "work_sessions_location_verified_idx" ON "work_sessions"("location_verified");

-- CreateIndex
CREATE INDEX "geofences_is_active_idx" ON "geofences"("is_active");

-- CreateIndex
CREATE INDEX "attendance_attempt_logs_user_id_idx" ON "attendance_attempt_logs"("user_id");

-- CreateIndex
CREATE INDEX "attendance_attempt_logs_result_idx" ON "attendance_attempt_logs"("result");

-- CreateIndex
CREATE INDEX "attendance_attempt_logs_timestamp_idx" ON "attendance_attempt_logs"("timestamp");

-- CreateIndex
CREATE INDEX "work_session_overrides_work_session_id_idx" ON "work_session_overrides"("work_session_id");

-- CreateIndex
CREATE INDEX "leave_requests_user_id_idx" ON "leave_requests"("user_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_user_role_idx" ON "leave_requests"("user_role");
