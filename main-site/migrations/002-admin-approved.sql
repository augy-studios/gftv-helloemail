-- Add admin and approval flags to hellomail_users
ALTER TABLE public.hellomail_users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: Automatically approve the first admin user manually
-- UPDATE public.hellomail_users SET is_admin = true, is_approved = true WHERE username = 'YOUR_USERNAME';