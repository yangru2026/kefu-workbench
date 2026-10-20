-- 自动导出：旧项目 public schema（2026-10-20T09:48:18.123Z）

-- @@CHUNK1

create extension if not exists pgcrypto;

create sequence if not exists announcements_id_seq;

create sequence if not exists cross_sales_id_seq;

create sequence if not exists cross_sales_archive_months_id_seq;

create sequence if not exists daily_reports_id_seq;

create sequence if not exists option_templates_id_seq;

create sequence if not exists presale_data_id_seq;

create sequence if not exists presale_monthly_id_seq;

create sequence if not exists qc_records_id_fallback_seq;

create sequence if not exists qc_shares_id_seq;

create sequence if not exists qc_shops_id_seq;

create sequence if not exists qc_staffs_id_seq;

create sequence if not exists ranking_daily_id_seq;

create sequence if not exists ranking_data_id_seq;

create sequence if not exists schedule_data_id_seq;

create sequence if not exists shop_templates_id_seq;

create table if not exists public."ai_questions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "user_name" text,
  "group_name" text,
  "question" text not null,
  "answer" text,
  "status" text default 'pending'::text not null,
  "error" text,
  "model" text,
  "total_tokens" integer,
  "latency_ms" integer,
  "created_at" timestamp with time zone default now() not null,
  "answered_at" timestamp with time zone
);

create table if not exists public."announcements" (
  "id" bigint default nextval('announcements_id_seq'::regclass) not null,
  "title" text not null,
  "content" text not null,
  "author_id" uuid,
  "is_pinned" boolean default false,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."checkin_records" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "item_key" text not null,
  "period_key" text not null,
  "done_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."compensatory_leave_records" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid,
  "date" date not null,
  "hours" numeric default 0 not null,
  "note" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."cross_sales" (
  "id" bigint default nextval('cross_sales_id_seq'::regclass) not null,
  "record_date" date not null,
  "shop" text,
  "staff_name" text not null,
  "product_type" text,
  "first_order_no" text,
  "second_order_no" text,
  "first_order_status" text,
  "first_amount" numeric(12,2) default 0,
  "second_amount" numeric(12,2) default 0,
  "total_amount" numeric(12,2) default 0,
  "qc_confirmed" boolean default false,
  "feishu_record_id" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "team" text default 'A组'::text,
  "notes" text,
  "qc_result" text default 'pending'::text,
  "refund_order_no" text,
  "refund_amount" numeric(12,2) default 0,
  "qc_amount_threshold" numeric(12,2) default 0,
  "qc_note" text,
  "qc_checked_at" timestamp with time zone,
  "qc_by" text
);

create table if not exists public."cross_sales_archive_months" (
  "id" bigint default nextval('cross_sales_archive_months_id_seq'::regclass) not null,
  "month" text not null,
  "team" text default 'all'::text,
  "archived_by" uuid,
  "archived_at" timestamp with time zone default now(),
  "note" text
);

create table if not exists public."cs_requests" (
  "id" uuid default gen_random_uuid() not null,
  "type" text not null,
  "requester_id" uuid,
  "requester_name" text not null,
  "status" text default 'pending'::text not null,
  "target_date" date not null,
  "shift_from" text,
  "shift_to" text,
  "hours" numeric,
  "reason" text,
  "reviewer_id" uuid,
  "reviewer_name" text,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "swap_partner_id" uuid,
  "swap_partner_name" text,
  "partner_shift_from" text,
  "partner_shift_to" text
);

create table if not exists public."customer_voice" (
  "id" bigint not null,
  "raw_text" text not null,
  "scene" text,
  "topic" text,
  "staff_name" text,
  "team" text,
  "customer_tag" text,
  "created_at" timestamp with time zone default now() not null,
  "record_month" text,
  "brand" text default ''::text not null
);

create table if not exists public."daily_reports" (
  "id" bigint default nextval('daily_reports_id_seq'::regclass) not null,
  "user_id" uuid,
  "report_date" date not null,
  "content" jsonb default '{}'::jsonb not null,
  "status" text default 'draft'::text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."diversion_transfers" (
  "id" uuid default gen_random_uuid() not null,
  "cs_name" text not null,
  "customer_info" text,
  "reason" text not null,
  "screenshots" text[],
  "created_at" timestamp with time zone default now(),
  "shop" text,
  "diversion_nick" text
);

create table if not exists public."gift_codes" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "merchant_code" text,
  "cost" text,
  "image_path" text,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now(),
  "image_paths" text[]
);

create table if not exists public."licenses" (
  "id" uuid default gen_random_uuid() not null,
  "platform" text default ''::text not null,
  "shop_name" text default ''::text not null,
  "shop_short" text default ''::text not null,
  "company" text default ''::text not null,
  "factory" text default ''::text not null,
  "license_file" text default ''::text not null,
  "business_file" text default ''::text not null,
  "production_file" text default ''::text not null,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."notifications" (
  "id" bigint not null,
  "user_id" uuid not null,
  "type" text default 'cs_qc'::text not null,
  "title" text not null,
  "content" text not null,
  "related_table" text,
  "related_id" bigint,
  "is_read" boolean default false not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."option_templates" (
  "id" bigint default nextval('option_templates_id_seq'::regclass) not null,
  "key" text not null,
  "label" text not null,
  "options" jsonb default '[]'::jsonb,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "team" text default 'default'::text
);

create table if not exists public."overtime_records" (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid,
  "date" date not null,
  "hours" numeric default 0 not null,
  "note" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."page_collaborators" (
  "id" uuid default gen_random_uuid() not null,
  "page_key" text not null,
  "profile_id" uuid not null,
  "profile_name" text,
  "invited_by" uuid,
  "invited_by_name" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."pattern_assets" (
  "id" uuid default gen_random_uuid() not null,
  "brand" text not null,
  "type" text not null,
  "name" text not null,
  "series" text default ''::text,
  "color" text default ''::text,
  "diameter" text default ''::text,
  "color_diameter" text default ''::text,
  "material" text default ''::text,
  "oxygen" text default ''::text,
  "water" text default ''::text,
  "spec" text default ''::text,
  "lens_img" text default ''::text,
  "eye_img" text default ''::text,
  "description" text default ''::text,
  "created_at" timestamp with time zone default now(),
  "thumb_eye_url" text,
  "thumb_lens_url" text,
  "is_discontinued" boolean default false not null,
  "base_curve" text,
  "fixed_axis" text,
  "feishu_record_id" text,
  "lens_imgs" text[],
  "eye_imgs" text[],
  "sort_order" integer default 0 not null,
  "price_tier" text default ''::text,
  "diam_group" text default ''::text
);

create table if not exists public."pattern_categories" (
  "id" uuid default gen_random_uuid() not null,
  "category_type" text not null,
  "name" text not null,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."pending_invites" (
  "id" uuid default gen_random_uuid() not null,
  "token" text not null,
  "phone" text,
  "name" text,
  "group_name" text,
  "role" text default 'staff'::text not null,
  "created_by" uuid,
  "used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."platform_rules" (
  "id" uuid default gen_random_uuid() not null,
  "platform" text default '通用'::text not null,
  "level" text default '提醒'::text not null,
  "title" text not null,
  "content" text,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now(),
  "pinned" boolean default false
);

create table if not exists public."pp_card_notes" (
  "id" uuid default gen_random_uuid() not null,
  "note_key" text not null,
  "note_text" text default ''::text not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."presale_data" (
  "id" bigint default nextval('presale_data_id_seq'::regclass) not null,
  "record_date" date not null,
  "metrics" jsonb default '{}'::jsonb not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."presale_monthly" (
  "id" bigint default nextval('presale_monthly_id_seq'::regclass) not null,
  "period_month" text not null,
  "group_name" text not null,
  "visitors" integer default 0,
  "orders" integer default 0,
  "revenue" numeric(12,2) default 0,
  "conversion" numeric(5,2) default 0,
  "avg_response" integer default 0,
  "satisfaction" numeric(5,2) default 0,
  "cross_sales" numeric(12,2) default 0,
  "visitor_count" integer default 0,
  "inquiry_count" integer default 0,
  "payment_count" integer default 0,
  "feishu_record_id" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."production_factories" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "license_file" text default ''::text not null,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists public."profiles" (
  "id" uuid not null,
  "name" text not null,
  "phone" text not null,
  "group_name" text default ''::text,
  "role" text default 'staff'::text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "real_name" text,
  "hire_date" date,
  "position" text,
  "overtime" numeric default 0,
  "compensatory_leave" numeric default 0,
  "store_accounts" text,
  "status" text default 'active'::text not null,
  "left_at" timestamp with time zone
);

create table if not exists public."qc_confirmations" (
  "id" bigint not null,
  "record_id" bigint not null,
  "staff" text not null,
  "user_id" uuid,
  "confirmed_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."qc_good_cases" (
  "id" bigint not null,
  "title" text not null,
  "staff" text not null,
  "shop" text not null,
  "date" text not null,
  "tags" text[] default '{}'::text[] not null,
  "scenario" text default ''::text not null,
  "reply" text default ''::text not null,
  "highlights" text default ''::text not null,
  "images" text[] default '{}'::text[] not null,
  "created_by" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."qc_image_snapshots" (
  "id" bigint not null,
  "record_id" bigint not null,
  "scene_images" text[] default '{}'::text[] not null,
  "reply_images" text[] default '{}'::text[] not null,
  "knowledge_images" text[] default '{}'::text[] not null,
  "status_before" text,
  "triggered_by" text default ''::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."qc_images" (
  "id" bigint not null,
  "record_id" bigint not null,
  "kind" text not null,
  "seq" integer default 0 not null,
  "file_path" text not null,
  "trust" text default 'ok'::text not null,
  "uploaded_by" text default ''::text,
  "source" text default 'upload'::text,
  "note" text default ''::text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."qc_options" (
  "id" bigint not null,
  "category" text not null,
  "name" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."qc_records" (
  "id" bigint default nextval('qc_records_id_fallback_seq'::regclass) not null,
  "staff" text not null,
  "customer_id" text default ''::text,
  "shop" text not null,
  "date" text not null,
  "tags" text[] default '{}'::text[] not null,
  "severity" text default '一般'::text not null,
  "scene" text default ''::text,
  "reply" text default ''::text,
  "problem" text not null,
  "correct" text default ''::text,
  "knowledge" text default ''::text,
  "note" text default ''::text,
  "scene_images" text[] default '{}'::text[],
  "reply_images" text[] default '{}'::text[],
  "knowledge_images" text[] default '{}'::text[],
  "status" text default 'pending'::text not null,
  "coach_date" text default ''::text,
  "coach_note" text default ''::text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "created_by" text default ''::text,
  "penalty_amount" numeric default 0,
  "received_at" timestamp with time zone,
  "received_by" text
);

create table if not exists public."qc_records_backup_20260818" (
  "id" uuid,
  "staff" text,
  "shop" text,
  "category" text,
  "severity" text,
  "description" text,
  "screenshot" text,
  "chat" text,
  "standard" text,
  "error_why" text,
  "extra" text,
  "status" text,
  "explained_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "coach_date" text,
  "coach_note" text,
  "customer_id" text,
  "date" text,
  "tags" text[],
  "scene" text,
  "reply" text,
  "problem" text,
  "correct" text,
  "knowledge" text,
  "note" text,
  "scene_images" text[],
  "reply_images" text[],
  "knowledge_images" text[],
  "created_by" text
);

create table if not exists public."qc_records_images_backup_20260903" (
  "id" bigint,
  "staff" text,
  "shop" text,
  "date" text,
  "status" text,
  "scene_images" text[],
  "reply_images" text[],
  "knowledge_images" text[],
  "created_at" timestamp with time zone,
  "backup_at" timestamp with time zone
);

create table if not exists public."qc_shares" (
  "id" bigint default nextval('qc_shares_id_seq'::regclass) not null,
  "token" text not null,
  "staff" text not null,
  "record_ids" bigint[] default '{}'::bigint[] not null,
  "record_count" integer default 0,
  "created_by" text default ''::text,
  "created_at" timestamp with time zone default now(),
  "confirmed_at" timestamp with time zone,
  "confirm_note" text default ''::text,
  "auto_confirm_hours" integer default 48,
  "due_at" timestamp with time zone,
  "auto_confirmed" boolean default false,
  "reminded_at" timestamp with time zone
);

create table if not exists public."qc_shops" (
  "id" bigint default nextval('qc_shops_id_seq'::regclass) not null,
  "name" text not null,
  "sort_order" integer default 0,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."qc_snippets" (
  "id" bigint not null,
  "type" text not null,
  "category" text default ''::text not null,
  "title" text not null,
  "content" text not null,
  "sort_order" integer default 0 not null,
  "is_default" boolean default false not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "created_by" text default ''::text
);

create table if not exists public."qc_staffs" (
  "id" bigint default nextval('qc_staffs_id_seq'::regclass) not null,
  "name" text not null,
  "sort_order" integer default 0,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."qc_templates" (
  "id" bigint not null,
  "name" text not null,
  "severity" text default '一般'::text not null,
  "tags" text[] default '{}'::text[] not null,
  "problem" text default ''::text not null,
  "correct" text default ''::text not null,
  "knowledge" text default ''::text not null,
  "penalty_amount" numeric default 0 not null,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_by" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."quiz_results" (
  "id" uuid default gen_random_uuid() not null,
  "quiz_key" text default 'miyang-color-price'::text not null,
  "quiz_title" text,
  "examinee" text not null,
  "score" integer default 0 not null,
  "total" integer default 100 not null,
  "auto_score" integer,
  "auto_total" integer,
  "self_score" integer,
  "self_total" integer,
  "duration_sec" integer,
  "detail" jsonb,
  "user_agent" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."ranking_daily" (
  "id" bigint default nextval('ranking_daily_id_seq'::regclass) not null,
  "work_date" date not null,
  "group_name" text not null,
  "staff_name" text not null,
  "shop_name" text not null,
  "inquiry" numeric default 0,
  "payment" numeric default 0,
  "sales" numeric default 0,
  "good_reviews" numeric default 0,
  "bad_reviews" numeric default 0,
  "conversion" numeric default 0,
  "satisfaction" numeric,
  "response_time" numeric,
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."ranking_data" (
  "id" bigint default nextval('ranking_data_id_seq'::regclass) not null,
  "user_id" uuid,
  "group_name" text not null,
  "conversion_rate" numeric(5,2) default 0,
  "cross_sales" numeric(12,2) default 0,
  "satisfaction" numeric(5,2) default 0,
  "response_time" integer default 0,
  "period" text not null,
  "updated_at" timestamp with time zone default now(),
  "staff_name" text,
  "feishu_record_id" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."schedule_data" (
  "id" bigint default nextval('schedule_data_id_seq'::regclass) not null,
  "month_key" text not null,
  "staff_name" text not null,
  "group_name" text not null,
  "schedule" jsonb default '{}'::jsonb not null,
  "feishu_record_id" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."shop_templates" (
  "id" bigint default nextval('shop_templates_id_seq'::regclass) not null,
  "group_name" text not null,
  "shops" jsonb default '[]'::jsonb not null,
  "default_target" integer default 15 not null,
  "updated_by" uuid,
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."training_categories" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now(),
  "parent_id" text
);

create table if not exists public."training_knowledge" (
  "id" uuid default gen_random_uuid() not null,
  "subcat" text not null,
  "section_type" text not null,
  "title" text,
  "icon" text,
  "content" jsonb default '{}'::jsonb not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."training_materials" (
  "id" uuid default gen_random_uuid() not null,
  "brand" text not null,
  "category" text not null,
  "title" text not null,
  "url" text not null,
  "tags" text[] default '{}'::text[],
  "created_at" timestamp with time zone default now(),
  "group_name" text,
  "description" text
);

create table if not exists public."training_scripts" (
  "id" uuid default gen_random_uuid() not null,
  "category" text default '售前话术'::text not null,
  "subcategory" text default '未分类'::text not null,
  "title" text not null,
  "styles" jsonb default '{"专业": "", "亲切": "", "安抚": "", "标准": "", "简短": ""}'::jsonb not null,
  "tags" text[] default '{}'::text[] not null,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "script_group" text default '通用'::text not null
);

create table if not exists public."weekly_reports" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "group_name" text not null,
  "week_start" date not null,
  "week_end" date not null,
  "content" jsonb default '{}'::jsonb not null,
  "status" text default 'submitted'::text not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."weekly_templates" (
  "id" uuid default gen_random_uuid() not null,
  "group_name" text not null,
  "config" jsonb default '{}'::jsonb not null,
  "updated_by" uuid,
  "updated_at" timestamp with time zone default now(),
  "created_at" timestamp with time zone default now()
);

alter table ai_questions add constraint "ai_questions_pkey" PRIMARY KEY (id);

alter table announcements add constraint "announcements_pkey" PRIMARY KEY (id);

alter table checkin_records add constraint "checkin_records_pkey" PRIMARY KEY (id);

alter table compensatory_leave_records add constraint "compensatory_leave_records_pkey" PRIMARY KEY (id);

alter table cross_sales add constraint "cross_sales_pkey" PRIMARY KEY (id);

alter table cross_sales_archive_months add constraint "cross_sales_archive_months_pkey" PRIMARY KEY (id);

alter table cs_requests add constraint "cs_requests_pkey" PRIMARY KEY (id);

alter table customer_voice add constraint "customer_voice_pkey" PRIMARY KEY (id);

alter table daily_reports add constraint "daily_reports_pkey" PRIMARY KEY (id);

alter table diversion_transfers add constraint "diversion_transfers_pkey" PRIMARY KEY (id);

alter table gift_codes add constraint "gift_codes_pkey" PRIMARY KEY (id);

alter table licenses add constraint "licenses_pkey" PRIMARY KEY (id);

alter table notifications add constraint "notifications_pkey" PRIMARY KEY (id);

alter table option_templates add constraint "option_templates_pkey" PRIMARY KEY (id);

alter table overtime_records add constraint "overtime_records_pkey" PRIMARY KEY (id);

alter table page_collaborators add constraint "page_collaborators_pkey" PRIMARY KEY (id);

alter table pattern_assets add constraint "pattern_assets_pkey" PRIMARY KEY (id);

alter table pattern_categories add constraint "pattern_categories_pkey" PRIMARY KEY (id);

alter table pending_invites add constraint "pending_invites_pkey" PRIMARY KEY (id);

alter table platform_rules add constraint "platform_rules_pkey" PRIMARY KEY (id);

alter table pp_card_notes add constraint "pp_card_notes_pkey" PRIMARY KEY (id);

alter table presale_data add constraint "presale_data_pkey" PRIMARY KEY (id);

alter table presale_monthly add constraint "presale_monthly_pkey" PRIMARY KEY (id);

alter table production_factories add constraint "production_factories_pkey" PRIMARY KEY (id);

alter table profiles add constraint "profiles_pkey" PRIMARY KEY (id);

alter table qc_confirmations add constraint "qc_confirmations_pkey" PRIMARY KEY (id);

alter table qc_good_cases add constraint "qc_good_cases_pkey" PRIMARY KEY (id);

alter table qc_image_snapshots add constraint "qc_image_snapshots_pkey" PRIMARY KEY (id);

alter table qc_images add constraint "qc_images_pkey" PRIMARY KEY (id);

alter table qc_options add constraint "qc_options_pkey" PRIMARY KEY (id);

alter table qc_records add constraint "qc_records_pkey" PRIMARY KEY (id);

alter table qc_shares add constraint "qc_shares_pkey" PRIMARY KEY (id);

alter table qc_shops add constraint "qc_shops_pkey" PRIMARY KEY (id);

alter table qc_snippets add constraint "qc_snippets_pkey" PRIMARY KEY (id);

alter table qc_staffs add constraint "qc_staffs_pkey" PRIMARY KEY (id);

alter table qc_templates add constraint "qc_templates_pkey" PRIMARY KEY (id);

alter table quiz_results add constraint "quiz_results_pkey" PRIMARY KEY (id);

alter table ranking_daily add constraint "ranking_daily_pkey" PRIMARY KEY (id);

alter table ranking_data add constraint "ranking_data_pkey" PRIMARY KEY (id);

alter table schedule_data add constraint "schedule_data_pkey" PRIMARY KEY (id);

alter table shop_templates add constraint "shop_templates_pkey" PRIMARY KEY (id);

alter table training_categories add constraint "training_categories_pkey" PRIMARY KEY (id);

alter table training_knowledge add constraint "training_knowledge_pkey" PRIMARY KEY (id);

alter table training_materials add constraint "training_materials_pkey" PRIMARY KEY (id);

alter table training_scripts add constraint "training_scripts_pkey" PRIMARY KEY (id);

alter table weekly_reports add constraint "weekly_reports_pkey" PRIMARY KEY (id);

alter table weekly_templates add constraint "weekly_templates_pkey" PRIMARY KEY (id);

-- @@CHUNK2

alter table ai_questions add constraint "ai_questions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table announcements add constraint "announcements_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table checkin_records add constraint "checkin_records_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table checkin_records add constraint "checkin_records_user_id_item_key_period_key_key" UNIQUE (user_id, item_key, period_key);

alter table compensatory_leave_records add constraint "compensatory_leave_records_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table cross_sales_archive_months add constraint "cross_sales_archive_months_archived_by_fkey" FOREIGN KEY (archived_by) REFERENCES auth.users(id);

alter table cross_sales_archive_months add constraint "cross_sales_archive_months_month_key" UNIQUE (month);

alter table cs_requests add constraint "cs_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

alter table cs_requests add constraint "cs_requests_type_check" CHECK ((type = ANY (ARRAY['shift_swap'::text, 'overtime'::text, 'compensatory_leave'::text])));

alter table cs_requests add constraint "cs_requests_swap_partner_id_fkey" FOREIGN KEY (swap_partner_id) REFERENCES profiles(id);

alter table daily_reports add constraint "daily_reports_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text])));

alter table daily_reports add constraint "daily_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table daily_reports add constraint "daily_reports_user_id_report_date_key" UNIQUE (user_id, report_date);

alter table notifications add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table option_templates add constraint "option_templates_key_team_key" UNIQUE (key, team);

alter table overtime_records add constraint "overtime_records_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table page_collaborators add constraint "page_collaborators_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES profiles(id);

alter table page_collaborators add constraint "page_collaborators_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table pattern_categories add constraint "pattern_categories_category_type_check" CHECK ((category_type = ANY (ARRAY['brand'::text, 'type'::text, 'diameter'::text, 'series'::text, 'color'::text, 'price'::text, 'diam_group'::text])));

alter table pattern_categories add constraint "pattern_categories_category_type_name_key" UNIQUE (category_type, name);

alter table pending_invites add constraint "pending_invites_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table pending_invites add constraint "pending_invites_token_key" UNIQUE (token);

alter table pp_card_notes add constraint "pp_card_notes_note_key_key" UNIQUE (note_key);

alter table presale_data add constraint "presale_data_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table presale_data add constraint "presale_data_record_date_key" UNIQUE (record_date);

alter table presale_monthly add constraint "presale_monthly_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table presale_monthly add constraint "presale_monthly_period_month_group_name_key" UNIQUE (period_month, group_name);

alter table profiles add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'leader'::text])));

alter table profiles add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table profiles add constraint "profiles_phone_key" UNIQUE (phone);

alter table qc_confirmations add constraint "qc_confirmations_record_id_fkey" FOREIGN KEY (record_id) REFERENCES qc_records(id) ON DELETE CASCADE;

alter table qc_image_snapshots add constraint "qc_image_snapshots_record_id_fkey" FOREIGN KEY (record_id) REFERENCES qc_records(id) ON DELETE CASCADE;

alter table qc_images add constraint "qc_images_trust_check" CHECK ((trust = ANY (ARRAY['ok'::text, 'suspect'::text, 'orphan'::text])));

alter table qc_images add constraint "qc_images_kind_check" CHECK ((kind = ANY (ARRAY['scene'::text, 'reply'::text, 'knowledge'::text])));

alter table qc_images add constraint "qc_images_record_id_fkey" FOREIGN KEY (record_id) REFERENCES qc_records(id) ON DELETE CASCADE;

alter table qc_options add constraint "qc_options_category_name_key" UNIQUE (category, name);

alter table qc_records add constraint "qc_records_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text])));

alter table qc_shares add constraint "qc_shares_token_key" UNIQUE (token);

alter table qc_shops add constraint "qc_shops_name_key" UNIQUE (name);

alter table qc_snippets add constraint "qc_snippets_type_check" CHECK ((type = ANY (ARRAY['correct'::text, 'knowledge'::text])));

alter table qc_staffs add constraint "qc_staffs_name_key" UNIQUE (name);

alter table ranking_daily add constraint "ranking_daily_uniq" UNIQUE (work_date, group_name, staff_name, shop_name);

alter table ranking_data add constraint "ranking_data_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table ranking_data add constraint "ranking_data_user_id_period_key" UNIQUE (user_id, period);

alter table schedule_data add constraint "schedule_data_month_key_staff_name_key" UNIQUE (month_key, staff_name);

alter table shop_templates add constraint "shop_templates_group_name_key" UNIQUE (group_name);

alter table weekly_reports add constraint "weekly_reports_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text])));

alter table weekly_reports add constraint "weekly_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table weekly_reports add constraint "weekly_reports_user_id_week_start_key" UNIQUE (user_id, week_start);

alter table weekly_templates add constraint "weekly_templates_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);

alter table weekly_templates add constraint "weekly_templates_group_name_key" UNIQUE (group_name);

CREATE INDEX idx_aiq_time ON public.ai_questions USING btree (created_at DESC);

CREATE INDEX idx_aiq_user_time ON public.ai_questions USING btree (user_id, created_at DESC);

CREATE INDEX idx_chk_period ON public.checkin_records USING btree (period_key);

CREATE INDEX idx_chk_user_period ON public.checkin_records USING btree (user_id, period_key);

CREATE UNIQUE INDEX cross_sales_feishu_record_id_key ON public.cross_sales USING btree (feishu_record_id) WHERE ((feishu_record_id IS NOT NULL) AND (feishu_record_id <> ''::text));

CREATE INDEX idx_cross_sales_date ON public.cross_sales USING btree (record_date);

CREATE INDEX idx_cross_sales_qc_result ON public.cross_sales USING btree (qc_result);

CREATE INDEX idx_cross_sales_staff ON public.cross_sales USING btree (staff_name);

CREATE INDEX idx_cross_sales_team ON public.cross_sales USING btree (team);

CREATE INDEX idx_cs_archive_month ON public.cross_sales_archive_months USING btree (month);

CREATE INDEX idx_cs_archive_team ON public.cross_sales_archive_months USING btree (team);

CREATE INDEX idx_cs_requests_requester ON public.cs_requests USING btree (requester_id, created_at DESC);

CREATE INDEX idx_cs_requests_status ON public.cs_requests USING btree (status, created_at DESC);

CREATE INDEX customer_voice_created_at_idx ON public.customer_voice USING btree (created_at DESC);

CREATE INDEX customer_voice_record_month_idx ON public.customer_voice USING btree (record_month);

CREATE INDEX idx_licenses_platform ON public.licenses USING btree (platform);

CREATE INDEX idx_licenses_shop ON public.licenses USING btree (shop_short);

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read, created_at DESC);

CREATE UNIQUE INDEX page_collaborators_page_profile_key ON public.page_collaborators USING btree (page_key, profile_id);

CREATE INDEX idx_pattern_assets_discontinued ON public.pattern_assets USING btree (is_discontinued);

CREATE INDEX idx_pattern_assets_sort_order ON public.pattern_assets USING btree (sort_order DESC);

CREATE UNIQUE INDEX pattern_assets_name_brand_key ON public.pattern_assets USING btree (name, brand);

CREATE INDEX idx_presale_monthly_period ON public.presale_monthly USING btree (period_month);

CREATE INDEX idx_production_factories_name ON public.production_factories USING btree (name);

CREATE INDEX idx_qc_confirmations_record ON public.qc_confirmations USING btree (record_id);

CREATE INDEX idx_qc_images_file_path ON public.qc_images USING btree (file_path);

CREATE INDEX idx_qc_images_record ON public.qc_images USING btree (record_id, kind, seq);

CREATE INDEX idx_qc_images_trust ON public.qc_images USING btree (trust);

CREATE UNIQUE INDEX uq_qc_images_path_kind ON public.qc_images USING btree (record_id, kind, file_path);

CREATE INDEX idx_qc_options_cat ON public.qc_options USING btree (category);

CREATE INDEX idx_qc_records_date ON public.qc_records USING btree (date);

CREATE INDEX idx_qc_records_received ON public.qc_records USING btree (received_at);

CREATE INDEX idx_qc_records_shop ON public.qc_records USING btree (shop);

CREATE INDEX idx_qc_records_staff ON public.qc_records USING btree (staff);

CREATE INDEX idx_qc_records_status ON public.qc_records USING btree (status);

CREATE INDEX idx_qc_shares_created ON public.qc_shares USING btree (created_at);

CREATE INDEX idx_qc_shares_due ON public.qc_shares USING btree (due_at) WHERE (confirmed_at IS NULL);

CREATE INDEX idx_qc_shares_staff ON public.qc_shares USING btree (staff);

CREATE INDEX idx_qc_shares_token ON public.qc_shares USING btree (token);

CREATE INDEX idx_qc_shops_sort ON public.qc_shops USING btree (sort_order, name);

CREATE INDEX idx_qc_snippets_sort ON public.qc_snippets USING btree (sort_order);

CREATE INDEX idx_qc_snippets_type ON public.qc_snippets USING btree (type);

CREATE INDEX idx_qc_staffs_sort ON public.qc_staffs USING btree (sort_order, name);

CREATE INDEX idx_quiz_results_created ON public.quiz_results USING btree (created_at DESC);

CREATE INDEX idx_quiz_results_examinee ON public.quiz_results USING btree (examinee);

CREATE INDEX idx_ranking_daily_date ON public.ranking_daily USING btree (work_date DESC);

CREATE INDEX idx_ranking_daily_group ON public.ranking_daily USING btree (group_name, work_date DESC);

CREATE INDEX idx_ranking_daily_staff ON public.ranking_daily USING btree (staff_name, work_date DESC);

CREATE UNIQUE INDEX idx_ranking_data_staff_period ON public.ranking_data USING btree (staff_name, period) WHERE (staff_name IS NOT NULL);

CREATE INDEX idx_schedule_data_month ON public.schedule_data USING btree (month_key);

CREATE INDEX idx_training_knowledge_subcat ON public.training_knowledge USING btree (subcat);

CREATE INDEX idx_training_scripts_cat ON public.training_scripts USING btree (category);

CREATE INDEX idx_training_scripts_sub ON public.training_scripts USING btree (subcategory);

CREATE OR REPLACE FUNCTION public.claim_invite(p_token text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE pending_invites
  SET used_at = now()
  WHERE token = p_token AND used_at IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
 RETURNS TABLE(name text, group_name text, role text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pi.name, pi.group_name, pi.role
  FROM pending_invites pi
  WHERE pi.token = p_token
    AND pi.used_at IS NULL
    AND (pi.expires_at IS NULL OR pi.expires_at > now());
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '新客服'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.email),
    'staff'
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_or_leader()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'leader')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.qc_records_fix_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := nextval('qc_records_id_fallback_seq');
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

-- @@CHUNK3

alter table public."ai_questions" enable row level security;

alter table public."announcements" enable row level security;

alter table public."checkin_records" enable row level security;

alter table public."compensatory_leave_records" enable row level security;

alter table public."cross_sales" enable row level security;

alter table public."cross_sales_archive_months" enable row level security;

alter table public."cs_requests" enable row level security;

alter table public."customer_voice" enable row level security;

alter table public."daily_reports" enable row level security;

alter table public."diversion_transfers" enable row level security;

alter table public."gift_codes" enable row level security;

alter table public."licenses" enable row level security;

alter table public."notifications" enable row level security;

alter table public."option_templates" enable row level security;

alter table public."overtime_records" enable row level security;

alter table public."page_collaborators" enable row level security;

alter table public."pattern_assets" enable row level security;

alter table public."pattern_categories" enable row level security;

alter table public."pending_invites" enable row level security;

alter table public."platform_rules" enable row level security;

alter table public."pp_card_notes" enable row level security;

alter table public."presale_data" enable row level security;

alter table public."presale_monthly" enable row level security;

alter table public."production_factories" enable row level security;

alter table public."profiles" enable row level security;

alter table public."qc_confirmations" enable row level security;

alter table public."qc_good_cases" enable row level security;

alter table public."qc_image_snapshots" enable row level security;

alter table public."qc_images" enable row level security;

alter table public."qc_options" enable row level security;

alter table public."qc_records" enable row level security;

alter table public."qc_records_backup_20260818" enable row level security;

alter table public."qc_records_images_backup_20260903" enable row level security;

alter table public."qc_shares" enable row level security;

alter table public."qc_shops" enable row level security;

alter table public."qc_snippets" enable row level security;

alter table public."qc_staffs" enable row level security;

alter table public."qc_templates" enable row level security;

alter table public."quiz_results" enable row level security;

alter table public."ranking_daily" enable row level security;

alter table public."ranking_data" enable row level security;

alter table public."schedule_data" enable row level security;

alter table public."shop_templates" enable row level security;

alter table public."training_categories" enable row level security;

alter table public."training_knowledge" enable row level security;

alter table public."training_materials" enable row level security;

alter table public."training_scripts" enable row level security;

alter table public."weekly_reports" enable row level security;

alter table public."weekly_templates" enable row level security;

drop policy if exists "aiq_delete_admin" on public."ai_questions";
create policy "aiq_delete_admin" on public."ai_questions" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "aiq_insert_own" on public."ai_questions";
create policy "aiq_insert_own" on public."ai_questions" as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = user_id));

drop policy if exists "aiq_select_own_or_admin" on public."ai_questions";
create policy "aiq_select_own_or_admin" on public."ai_questions" as PERMISSIVE for SELECT to authenticated using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'leader'::text])))))));

drop policy if exists "aiq_update_admin" on public."ai_questions";
create policy "aiq_update_admin" on public."ai_questions" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'leader'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "所有人可查看公告" on public."announcements";
create policy "所有人可查看公告" on public."announcements" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可创建公告" on public."announcements";
create policy "管理员可创建公告" on public."announcements" as PERMISSIVE for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "管理员可删除公告" on public."announcements";
create policy "管理员可删除公告" on public."announcements" as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "管理员可更新公告" on public."announcements";
create policy "管理员可更新公告" on public."announcements" as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "chk_delete_admin" on public."checkin_records";
create policy "chk_delete_admin" on public."checkin_records" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

drop policy if exists "chk_insert_admin" on public."checkin_records";
create policy "chk_insert_admin" on public."checkin_records" as PERMISSIVE for INSERT to authenticated with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))));

drop policy if exists "chk_select_admin" on public."checkin_records";
create policy "chk_select_admin" on public."checkin_records" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

drop policy if exists "Allow all authenticated" on public."compensatory_leave_records";
create policy "Allow all authenticated" on public."compensatory_leave_records" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "客服可删除本人连带成交记录" on public."cross_sales";
create policy "客服可删除本人连带成交记录" on public."cross_sales" as PERMISSIVE for DELETE to public using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((cross_sales.staff_name = p.name) OR (cross_sales.staff_name = p.real_name))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text])))))));

drop policy if exists "客服可更新本人连带成交记录" on public."cross_sales";
create policy "客服可更新本人连带成交记录" on public."cross_sales" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.name = cross_sales.staff_name) OR (p.real_name = cross_sales.staff_name)))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.name = cross_sales.staff_name) OR (p.real_name = cross_sales.staff_name))))));

drop policy if exists "所有人可查看连带成交数据" on public."cross_sales";
create policy "所有人可查看连带成交数据" on public."cross_sales" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "所有登录用户可登记连带成交" on public."cross_sales";
create policy "所有登录用户可登记连带成交" on public."cross_sales" as PERMISSIVE for INSERT to public with check ((auth.uid() IS NOT NULL));

drop policy if exists "管理员可管理连带成交数据" on public."cross_sales";
create policy "管理员可管理连带成交数据" on public."cross_sales" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "所有人可查看归档月份" on public."cross_sales_archive_months";
create policy "所有人可查看归档月份" on public."cross_sales_archive_months" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可管理归档月份" on public."cross_sales_archive_months";
create policy "管理员可管理归档月份" on public."cross_sales_archive_months" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "cs_requests_insert_all" on public."cs_requests";
create policy "cs_requests_insert_all" on public."cs_requests" as PERMISSIVE for INSERT to authenticated with check (true);

drop policy if exists "cs_requests_select_all" on public."cs_requests";
create policy "cs_requests_select_all" on public."cs_requests" as PERMISSIVE for SELECT to authenticated using (true);

drop policy if exists "cs_requests_update_admin" on public."cs_requests";
create policy "cs_requests_update_admin" on public."cs_requests" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'leader'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "cv_delete" on public."customer_voice";
create policy "cv_delete" on public."customer_voice" as PERMISSIVE for DELETE to authenticated using (is_admin_or_leader());

drop policy if exists "cv_insert" on public."customer_voice";
create policy "cv_insert" on public."customer_voice" as PERMISSIVE for INSERT to authenticated with check (true);

drop policy if exists "cv_select" on public."customer_voice";
create policy "cv_select" on public."customer_voice" as PERMISSIVE for SELECT to authenticated using (true);

drop policy if exists "cv_update" on public."customer_voice";
create policy "cv_update" on public."customer_voice" as PERMISSIVE for UPDATE to authenticated using (is_admin_or_leader()) with check (is_admin_or_leader());

drop policy if exists "创建自己的日报" on public."daily_reports";
create policy "创建自己的日报" on public."daily_reports" as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));

drop policy if exists "更新自己的日报" on public."daily_reports";
create policy "更新自己的日报" on public."daily_reports" as PERMISSIVE for UPDATE to public using ((auth.uid() = user_id));

drop policy if exists "查看自己的日报" on public."daily_reports";
create policy "查看自己的日报" on public."daily_reports" as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));

drop policy if exists "领导可查看全组日报" on public."daily_reports";
create policy "领导可查看全组日报" on public."daily_reports" as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "diversion admin delete" on public."diversion_transfers";
create policy "diversion admin delete" on public."diversion_transfers" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "diversion authed insert" on public."diversion_transfers";
create policy "diversion authed insert" on public."diversion_transfers" as PERMISSIVE for INSERT to authenticated with check (true);

drop policy if exists "diversion authed read" on public."diversion_transfers";
create policy "diversion authed read" on public."diversion_transfers" as PERMISSIVE for SELECT to authenticated using (true);

drop policy if exists "gift_codes admin write" on public."gift_codes";
create policy "gift_codes admin write" on public."gift_codes" as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "gift_codes authed read" on public."gift_codes";
create policy "gift_codes authed read" on public."gift_codes" as PERMISSIVE for SELECT to authenticated using (true);

drop policy if exists "licenses admin write" on public."licenses";
create policy "licenses admin write" on public."licenses" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "licenses public read" on public."licenses";
create policy "licenses public read" on public."licenses" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "Allow authenticated insert notifications" on public."notifications";
create policy "Allow authenticated insert notifications" on public."notifications" as PERMISSIVE for INSERT to authenticated with check (true);

drop policy if exists "notif_insert_authed" on public."notifications";
create policy "notif_insert_authed" on public."notifications" as PERMISSIVE for INSERT to authenticated with check (true);

drop policy if exists "notif_select_own" on public."notifications";
create policy "notif_select_own" on public."notifications" as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));

drop policy if exists "用户可删除自己的通知" on public."notifications";
create policy "用户可删除自己的通知" on public."notifications" as PERMISSIVE for DELETE to anon,authenticated using ((user_id = auth.uid()));

drop policy if exists "用户可查看自己的通知" on public."notifications";
create policy "用户可查看自己的通知" on public."notifications" as PERMISSIVE for SELECT to anon,authenticated using ((user_id = auth.uid()));

drop policy if exists "用户可标记自己的通知为已读" on public."notifications";
create policy "用户可标记自己的通知为已读" on public."notifications" as PERMISSIVE for UPDATE to anon,authenticated using ((user_id = auth.uid()));

drop policy if exists "登录用户可创建通知" on public."notifications";
create policy "登录用户可创建通知" on public."notifications" as PERMISSIVE for INSERT to anon,authenticated with check (true);

drop policy if exists "所有人可查看选项模板" on public."option_templates";
create policy "所有人可查看选项模板" on public."option_templates" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可管理选项模板" on public."option_templates";
create policy "管理员可管理选项模板" on public."option_templates" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "Allow all authenticated" on public."overtime_records";
create policy "Allow all authenticated" on public."overtime_records" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "所有人可查看协作者" on public."page_collaborators";
create policy "所有人可查看协作者" on public."page_collaborators" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可管理协作者" on public."page_collaborators";
create policy "管理员可管理协作者" on public."page_collaborators" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "Allow all authenticated" on public."pattern_assets";
create policy "Allow all authenticated" on public."pattern_assets" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow anon read on pattern_assets" on public."pattern_assets";
create policy "Allow anon read on pattern_assets" on public."pattern_assets" as PERMISSIVE for SELECT to anon using (true);

drop policy if exists "Allow authenticated write on pattern_categories" on public."pattern_categories";
create policy "Allow authenticated write on pattern_categories" on public."pattern_categories" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow public read on pattern_categories" on public."pattern_categories";
create policy "Allow public read on pattern_categories" on public."pattern_categories" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "管理员可管理邀请" on public."pending_invites";
create policy "管理员可管理邀请" on public."pending_invites" as PERMISSIVE for ALL to public using (is_admin()) with check (is_admin());

drop policy if exists "platform rules admin delete" on public."platform_rules";
create policy "platform rules admin delete" on public."platform_rules" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "platform rules admin insert" on public."platform_rules";
create policy "platform rules admin insert" on public."platform_rules" as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "platform rules admin update" on public."platform_rules";
create policy "platform rules admin update" on public."platform_rules" as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "platform rules authed read" on public."platform_rules";
create policy "platform rules authed read" on public."platform_rules" as PERMISSIVE for SELECT to authenticated using (true);

drop policy if exists "pp_card_notes_insert" on public."pp_card_notes";
create policy "pp_card_notes_insert" on public."pp_card_notes" as PERMISSIVE for INSERT to public with check (true);

drop policy if exists "pp_card_notes_read" on public."pp_card_notes";
create policy "pp_card_notes_read" on public."pp_card_notes" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "pp_card_notes_update" on public."pp_card_notes";
create policy "pp_card_notes_update" on public."pp_card_notes" as PERMISSIVE for UPDATE to public using (true) with check (true);

drop policy if exists "所有人可查看售前数据" on public."presale_data";
create policy "所有人可查看售前数据" on public."presale_data" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可管理售前数据" on public."presale_data";
create policy "管理员可管理售前数据" on public."presale_data" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "所有人可查看售前月度数据" on public."presale_monthly";
create policy "所有人可查看售前月度数据" on public."presale_monthly" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可管理售前月度数据" on public."presale_monthly";
create policy "管理员可管理售前月度数据" on public."presale_monthly" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "production_factories admin write" on public."production_factories";
create policy "production_factories admin write" on public."production_factories" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "production_factories public read" on public."production_factories";
create policy "production_factories public read" on public."production_factories" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "允许更新自己的资料" on public."profiles";
create policy "允许更新自己的资料" on public."profiles" as PERMISSIVE for UPDATE to public using ((auth.uid() = id));

drop policy if exists "允许查看所有用户资料" on public."profiles";
create policy "允许查看所有用户资料" on public."profiles" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "允许注册时创建资料" on public."profiles";
create policy "允许注册时创建资料" on public."profiles" as PERMISSIVE for INSERT to public with check ((auth.uid() = id));

drop policy if exists "用户可读取自己的资料" on public."profiles";
create policy "用户可读取自己的资料" on public."profiles" as PERMISSIVE for SELECT to authenticated using ((auth.uid() = id));

drop policy if exists "管理员可修改任意成员" on public."profiles";
create policy "管理员可修改任意成员" on public."profiles" as PERMISSIVE for UPDATE to public using (((auth.uid() = id) OR is_admin())) with check (((auth.uid() = id) OR is_admin()));

drop policy if exists "管理员可更新所有资料" on public."profiles";
create policy "管理员可更新所有资料" on public."profiles" as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::text)))));

drop policy if exists "管理员和组长可读取所有资料" on public."profiles";
create policy "管理员和组长可读取所有资料" on public."profiles" as PERMISSIVE for SELECT to authenticated using (is_admin_or_leader());

drop policy if exists "qc_confirmations_all" on public."qc_confirmations";
create policy "qc_confirmations_all" on public."qc_confirmations" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "qc_good_cases_all" on public."qc_good_cases";
create policy "qc_good_cases_all" on public."qc_good_cases" as PERMISSIVE for ALL to public using (true) with check (true);

drop policy if exists "qc_snapshots_all_authed" on public."qc_image_snapshots";
create policy "qc_snapshots_all_authed" on public."qc_image_snapshots" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "qc_images_authed_write" on public."qc_images";
create policy "qc_images_authed_write" on public."qc_images" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "qc_images_public_read" on public."qc_images";
create policy "qc_images_public_read" on public."qc_images" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "qc_options_delete" on public."qc_options";
create policy "qc_options_delete" on public."qc_options" as PERMISSIVE for DELETE to authenticated using (true);

drop policy if exists "qc_options_insert" on public."qc_options";
create policy "qc_options_insert" on public."qc_options" as PERMISSIVE for INSERT to authenticated with check (true);

drop policy if exists "qc_options_select" on public."qc_options";
create policy "qc_options_select" on public."qc_options" as PERMISSIVE for SELECT to authenticated using (true);

drop policy if exists "Allow authenticated write on qc_records" on public."qc_records";
create policy "Allow authenticated write on qc_records" on public."qc_records" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow public read on qc_records" on public."qc_records";
create policy "Allow public read on qc_records" on public."qc_records" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "Allow public read on qc_records for shares" on public."qc_records";
create policy "Allow public read on qc_records for shares" on public."qc_records" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "qc_records_all_authed" on public."qc_records";
create policy "qc_records_all_authed" on public."qc_records" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow authenticated delete on qc_shares" on public."qc_shares";
create policy "Allow authenticated delete on qc_shares" on public."qc_shares" as PERMISSIVE for DELETE to authenticated using (true);

drop policy if exists "Allow authenticated insert on qc_shares" on public."qc_shares";
create policy "Allow authenticated insert on qc_shares" on public."qc_shares" as PERMISSIVE for INSERT to authenticated with check (true);

drop policy if exists "Allow confirm update on qc_shares" on public."qc_shares";
create policy "Allow confirm update on qc_shares" on public."qc_shares" as PERMISSIVE for UPDATE to anon,authenticated using (true) with check (true);

drop policy if exists "Allow public read on qc_shares" on public."qc_shares";
create policy "Allow public read on qc_shares" on public."qc_shares" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "qc_shares_authed_write" on public."qc_shares";
create policy "qc_shares_authed_write" on public."qc_shares" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "qc_shares_public_read" on public."qc_shares";
create policy "qc_shares_public_read" on public."qc_shares" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "Allow authenticated write on qc_shops" on public."qc_shops";
create policy "Allow authenticated write on qc_shops" on public."qc_shops" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow public read on qc_shops" on public."qc_shops";
create policy "Allow public read on qc_shops" on public."qc_shops" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "Allow authenticated write on qc_snippets" on public."qc_snippets";
create policy "Allow authenticated write on qc_snippets" on public."qc_snippets" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow public read on qc_snippets" on public."qc_snippets";
create policy "Allow public read on qc_snippets" on public."qc_snippets" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "Allow authenticated write on qc_staffs" on public."qc_staffs";
create policy "Allow authenticated write on qc_staffs" on public."qc_staffs" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow public read on qc_staffs" on public."qc_staffs";
create policy "Allow public read on qc_staffs" on public."qc_staffs" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "qc_templates_all" on public."qc_templates";
create policy "qc_templates_all" on public."qc_templates" as PERMISSIVE for ALL to public using (true) with check (true);

drop policy if exists "quiz results admin delete" on public."quiz_results";
create policy "quiz results admin delete" on public."quiz_results" as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

drop policy if exists "quiz results admin read" on public."quiz_results";
create policy "quiz results admin read" on public."quiz_results" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

drop policy if exists "quiz results anyone insert" on public."quiz_results";
create policy "quiz results anyone insert" on public."quiz_results" as PERMISSIVE for INSERT to anon,authenticated with check ((((length(btrim(examinee)) >= 1) AND (length(btrim(examinee)) <= 20)) AND (score >= 0) AND (score <= 1000) AND (total > 0) AND (total <= 1000)));

drop policy if exists "ranking_daily_read" on public."ranking_daily";
create policy "ranking_daily_read" on public."ranking_daily" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "所有人可查看排名" on public."ranking_data";
create policy "所有人可查看排名" on public."ranking_data" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "所有人可查看排名数据" on public."ranking_data";
create policy "所有人可查看排名数据" on public."ranking_data" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可管理排名" on public."ranking_data";
create policy "管理员可管理排名" on public."ranking_data" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "管理员可管理排名数据" on public."ranking_data";
create policy "管理员可管理排名数据" on public."ranking_data" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "所有人可查看排班数据" on public."schedule_data";
create policy "所有人可查看排班数据" on public."schedule_data" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可管理排班数据" on public."schedule_data";
create policy "管理员可管理排班数据" on public."schedule_data" as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

drop policy if exists "所有人可读模板" on public."shop_templates";
create policy "所有人可读模板" on public."shop_templates" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "管理员可修改模板" on public."shop_templates";
create policy "管理员可修改模板" on public."shop_templates" as PERMISSIVE for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "管理员可更新模板" on public."shop_templates";
create policy "管理员可更新模板" on public."shop_templates" as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists "Allow authenticated write on training_categories" on public."training_categories";
create policy "Allow authenticated write on training_categories" on public."training_categories" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow public read on training_categories" on public."training_categories";
create policy "Allow public read on training_categories" on public."training_categories" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "training_knowledge_auth_write" on public."training_knowledge";
create policy "training_knowledge_auth_write" on public."training_knowledge" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "training_knowledge_public_read" on public."training_knowledge";
create policy "training_knowledge_public_read" on public."training_knowledge" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "Allow all authenticated" on public."training_materials";
create policy "Allow all authenticated" on public."training_materials" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow authenticated write on training_materials" on public."training_materials";
create policy "Allow authenticated write on training_materials" on public."training_materials" as PERMISSIVE for ALL to authenticated using (true) with check (true);

drop policy if exists "Allow public read on training_materials" on public."training_materials";
create policy "Allow public read on training_materials" on public."training_materials" as PERMISSIVE for SELECT to anon,authenticated using (true);

drop policy if exists "scripts authed write" on public."training_scripts";
create policy "scripts authed write" on public."training_scripts" as PERMISSIVE for ALL to public using ((auth.role() = 'authenticated'::text)) with check ((auth.role() = 'authenticated'::text));

drop policy if exists "scripts public read" on public."training_scripts";
create policy "scripts public read" on public."training_scripts" as PERMISSIVE for SELECT to public using (true);

drop policy if exists "weekly_reports_select_own" on public."weekly_reports";
create policy "weekly_reports_select_own" on public."weekly_reports" as PERMISSIVE for SELECT to authenticated using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text])))))));

drop policy if exists "weekly_reports_update_own" on public."weekly_reports";
create policy "weekly_reports_update_own" on public."weekly_reports" as PERMISSIVE for UPDATE to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

drop policy if exists "weekly_reports_write_own" on public."weekly_reports";
create policy "weekly_reports_write_own" on public."weekly_reports" as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));

drop policy if exists "weekly_templates_select_all" on public."weekly_templates";
create policy "weekly_templates_select_all" on public."weekly_templates" as PERMISSIVE for SELECT to authenticated using (true);

drop policy if exists "weekly_templates_write_admin" on public."weekly_templates";
create policy "weekly_templates_write_admin" on public."weekly_templates" as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'leader'::text]))))));

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER trg_licenses_updated BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_production_factories_updated BEFORE UPDATE ON public.production_factories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_qc_records_fix_id BEFORE INSERT ON public.qc_records FOR EACH ROW EXECUTE FUNCTION qc_records_fix_id();

CREATE TRIGGER trg_training_scripts_updated BEFORE UPDATE ON public.training_scripts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- @@CHUNK4