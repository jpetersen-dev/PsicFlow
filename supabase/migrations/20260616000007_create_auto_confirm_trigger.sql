-- Migration to auto-confirm email for all new users and confirm existing ones to avoid 'email not confirmed' errors and mail rate limit issues in dev environments

-- 1. Confirm existing unconfirmed users
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- 2. Create the auto-confirm trigger function
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind function to BEFORE INSERT trigger on auth.users
CREATE OR REPLACE TRIGGER tr_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();
