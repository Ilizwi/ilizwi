-- F001: Authentication and Role-Based Access
-- Creates profiles table, auto-provisioning trigger, RLS policies,
-- and a SECURITY DEFINER helper to avoid recursive RLS evaluation.

-- ----------------------------------------------------------------
-- 1. Profiles table (must exist before is_super_admin() references it)
-- ----------------------------------------------------------------
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  global_role  TEXT NOT NULL DEFAULT 'user'
                 CHECK (global_role IN ('super_admin', 'user')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 2. SECURITY DEFINER helper (avoids RLS recursion in policies)
--    Must come after profiles table exists.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND global_role = 'super_admin'
  );
$$;

-- ----------------------------------------------------------------
-- 3. Auto-create profile when a new auth.users row is inserted
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, global_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------
-- 4. Auto-update updated_at on profile changes
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Super admins can read all profiles
CREATE POLICY "super_admin read all"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

-- Super admins can update any profile (for role promotion)
CREATE POLICY "super_admin update"
  ON public.profiles FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
