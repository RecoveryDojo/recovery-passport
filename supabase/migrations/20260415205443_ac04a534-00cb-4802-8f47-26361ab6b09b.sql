CREATE POLICY "Admin can update any user"
ON public.users
FOR UPDATE
TO authenticated
USING (get_user_role() = 'admin'::user_role)
WITH CHECK (get_user_role() = 'admin'::user_role);