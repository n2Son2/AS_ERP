-- ====================================================================
-- HE THONG QUAN LY ERPS / HRM - SUPABASE DATABASE SCHEMA & RLS SETUP
-- ====================================================================
-- Huong dan su dung:
-- 1. Mo Supabase Dashboard -> Chon du an -> Vao muc "SQL Editor".
-- 2. Dan toan bo noi dung file nay va nhan "Run".
-- 3. Tat ca cac bang se duoc tao va cau hinh quyen RLS de tranh loi "new row violates row-level security policy".
-- ====================================================================

-- Enable pgcrypto generator for UUIDs if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BANG CHAM CONG (timesheets)
CREATE TABLE IF NOT EXISTS public.timesheets (
  id TEXT PRIMARY KEY,
  employee_code TEXT NOT NULL,
  employee_name TEXT,
  department TEXT,
  work_date DATE,
  day_of_week TEXT,
  check_in_1 TEXT,
  check_out_1 TEXT,
  check_in_2 TEXT,
  check_out_2 TEXT,
  work_day NUMERIC DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,
  late_minutes INT DEFAULT 0,
  early_minutes INT DEFAULT 0,
  overtime_1 NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Đúng giờ',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index ho tro tim kiem va loc theo thang/ngay va ma nhan vien
CREATE INDEX IF NOT EXISTS idx_timesheets_work_date ON public.timesheets(work_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_emp_code ON public.timesheets(employee_code);

-- 2. BANG NHAN SU (employees)
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  department TEXT,
  position TEXT,
  phone TEXT,
  email TEXT,
  join_date DATE,
  status TEXT DEFAULT 'Đang làm việc',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BANG BO PHAN (departments)
CREATE TABLE IF NOT EXISTS public.departments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  description TEXT,
  manager TEXT,
  status TEXT DEFAULT 'Hoạt động',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BANG NHOM HANG HOA / DANH MUC (categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BANG DON VI TINH (units)
CREATE TABLE IF NOT EXISTS public.units (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BANG GIAO DICH THU CHI (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  date DATE,
  type TEXT,
  account TEXT,
  category TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Chờ duyệt',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BANG QUAN LY CHUC NANG HE THONG (app_functions)
CREATE TABLE IF NOT EXISTS public.app_functions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  module_id TEXT,
  module_group TEXT,
  icon TEXT,
  table_name TEXT,
  show_on_sidebar BOOLEAN DEFAULT true,
  show_search BOOLEAN DEFAULT true,
  show_filter_date BOOLEAN DEFAULT true,
  date_filter_column TEXT DEFAULT 'created_at',
  show_filter_status BOOLEAN DEFAULT true,
  show_action_add BOOLEAN DEFAULT true,
  show_action_view BOOLEAN DEFAULT true,
  show_action_edit BOOLEAN DEFAULT true,
  show_action_delete BOOLEAN DEFAULT true,
  show_action_export BOOLEAN DEFAULT true,
  show_action_print BOOLEAN DEFAULT true,
  columns JSONB,
  fields JSONB,
  filters JSONB,
  actions JSONB,
  sql_schema TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BANG QUAN LY NGUOI DUNG (users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'User',
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. BANG VAI TRO / PHAN QUYEN (roles)
CREATE TABLE IF NOT EXISTS public.roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. BANG QUYEN (permissions)
CREATE TABLE IF NOT EXISTS public.permissions (
  id TEXT PRIMARY KEY,
  function_id TEXT,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. BANG LIEN KET VAI TRO & QUYEN (role_permissions)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. BANG NHAT KY AUDIT (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  type TEXT,
  message TEXT,
  details JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);


-- ====================================================================
-- CAU HINH RLS CHO SUPABASE
-- ====================================================================

DO $$
DECLARE
    tbl text;
BEGIN
    -- Chỉ lấy TABLE, bỏ qua VIEW
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP

        -- Enable RLS
        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;',
            tbl
        );

        -- Xóa policy cũ nếu có
        EXECUTE format(
            'DROP POLICY IF EXISTS "Allow anon full access" ON public.%I;',
            tbl
        );

        -- Tạo policy mới
        EXECUTE format(
            'CREATE POLICY "Allow anon full access"
             ON public.%I
             FOR ALL
             TO anon, authenticated, service_role
             USING (true)
             WITH CHECK (true);',
            tbl
        );

    END LOOP;
END $$;

-- ====================================================================
-- GRANT QUYỀN
-- ====================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES
ON ALL TABLES IN SCHEMA public
TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES
ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES
ON ALL ROUTINES IN SCHEMA public
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- ====================================================================
-- HOÀN TẤT
-- ====================================================================
