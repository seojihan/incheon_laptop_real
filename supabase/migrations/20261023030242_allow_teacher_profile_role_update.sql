-- Profile setup may change a user's own role from student/helper to teacher.
-- The RLS policies and protect_profile_role trigger still restrict which
-- rows and role transitions authenticated users can write.
grant update (role) on table public.profiles to authenticated;
