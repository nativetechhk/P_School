-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "nickname" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initial_password" TEXT,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "totp_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_classes" (
    "staff_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,

    CONSTRAINT "staff_classes_pkey" PRIMARY KEY ("staff_id","class_id")
);

-- CreateTable
CREATE TABLE "lesson_access" (
    "class_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "quota_per_student" INTEGER NOT NULL DEFAULT 10,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 60,
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "lesson_access_pkey" PRIMARY KEY ("class_id","lesson_id")
);

-- CreateTable
CREATE TABLE "quota_usage" (
    "student_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "last_generated_at" TIMESTAMP(3),

    CONSTRAINT "quota_usage_pkey" PRIMARY KEY ("student_id","lesson_id")
);

-- CreateTable
CREATE TABLE "daily_usage" (
    "student_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_usage_pkey" PRIMARY KEY ("student_id","date")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt_zh" TEXT,
    "prompt_sent" TEXT,
    "template_version" INTEGER,
    "source_artifact_ids" JSONB,
    "model" TEXT,
    "params" JSONB,
    "file_path" TEXT NOT NULL,
    "thumb_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "teacher_heart" INTEGER NOT NULL DEFAULT 0,
    "teacher_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "position" INTEGER,
    "result_artifact_ids" JSONB,
    "error" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'block',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "lesson_id" TEXT,
    "slot" TEXT,
    "set_name" TEXT,
    "item_id" TEXT,
    "label_zh" TEXT,
    "prompt_zh" TEXT,
    "boost_en" TEXT,
    "icon" TEXT,
    "group" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_template_history" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "saved_by" TEXT,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_template_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "usage_daily" (
    "date" TEXT NOT NULL,
    "images" INTEGER NOT NULL DEFAULT 0,
    "edits" INTEGER NOT NULL DEFAULT 0,
    "vision_calls" INTEGER NOT NULL DEFAULT 0,
    "stt_seconds" INTEGER NOT NULL DEFAULT 0,
    "est_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "audit" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_username_key" ON "students"("username");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "artifacts_student_id_lesson_id_idx" ON "artifacts"("student_id", "lesson_id");

-- CreateIndex
CREATE INDEX "artifacts_class_id_lesson_id_created_at_idx" ON "artifacts"("class_id", "lesson_id", "created_at");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_level_lesson_id_set_name_item_id_key" ON "prompt_templates"("level", "lesson_id", "set_name", "item_id");

-- CreateIndex
CREATE INDEX "prompt_template_history_template_id_saved_at_idx" ON "prompt_template_history"("template_id", "saved_at");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
