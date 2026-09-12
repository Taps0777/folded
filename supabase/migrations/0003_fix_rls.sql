-- Create a Security Definer function to safely get the current user's role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- PROFILES
DROP POLICY IF EXISTS "Admins have full access to profiles" ON profiles;
CREATE POLICY "Admins have full access to profiles" ON profiles FOR ALL USING (public.get_auth_user_role() = 'admin');

-- ADDRESSES
DROP POLICY IF EXISTS "Admins have full access to addresses" ON addresses;
CREATE POLICY "Admins have full access to addresses" ON addresses FOR ALL USING (public.get_auth_user_role() = 'admin');

-- SERVICE AREAS
DROP POLICY IF EXISTS "Admins can manage service areas" ON service_areas;
CREATE POLICY "Admins can manage service areas" ON service_areas FOR ALL USING (public.get_auth_user_role() = 'admin');

-- SERVICES
DROP POLICY IF EXISTS "Admins can manage services" ON services;
CREATE POLICY "Admins can manage services" ON services FOR ALL USING (public.get_auth_user_role() = 'admin');

-- ITEMS
DROP POLICY IF EXISTS "Admins can manage items" ON items;
CREATE POLICY "Admins can manage items" ON items FOR ALL USING (public.get_auth_user_role() = 'admin');

-- ORDERS
DROP POLICY IF EXISTS "Pickup staff can read assigned orders" ON orders;
CREATE POLICY "Pickup staff can read assigned orders" ON orders FOR SELECT USING (public.get_auth_user_role() = 'pickup_staff' AND (pickup_agent_id = auth.uid() OR pickup_agent_id IS NULL));

DROP POLICY IF EXISTS "Pickup staff can update assigned orders" ON orders;
CREATE POLICY "Pickup staff can update assigned orders" ON orders FOR UPDATE USING (public.get_auth_user_role() = 'pickup_staff' AND pickup_agent_id = auth.uid());

DROP POLICY IF EXISTS "Delivery staff can read assigned orders" ON orders;
CREATE POLICY "Delivery staff can read assigned orders" ON orders FOR SELECT USING (public.get_auth_user_role() = 'delivery_staff' AND (delivery_agent_id = auth.uid() OR delivery_agent_id IS NULL));

DROP POLICY IF EXISTS "Delivery staff can update assigned orders" ON orders;
CREATE POLICY "Delivery staff can update assigned orders" ON orders FOR UPDATE USING (public.get_auth_user_role() = 'delivery_staff' AND delivery_agent_id = auth.uid());

DROP POLICY IF EXISTS "Laundry staff can read processing orders" ON orders;
CREATE POLICY "Laundry staff can read processing orders" ON orders FOR SELECT USING (public.get_auth_user_role() = 'laundry_staff');

DROP POLICY IF EXISTS "Laundry staff can update processing orders" ON orders;
CREATE POLICY "Laundry staff can update processing orders" ON orders FOR UPDATE USING (public.get_auth_user_role() = 'laundry_staff');

DROP POLICY IF EXISTS "Admins have full access to orders" ON orders;
CREATE POLICY "Admins have full access to orders" ON orders FOR ALL USING (public.get_auth_user_role() = 'admin');

-- ORDER ITEMS
DROP POLICY IF EXISTS "Admins have full access to order items" ON order_items;
CREATE POLICY "Admins have full access to order items" ON order_items FOR ALL USING (public.get_auth_user_role() = 'admin');

DROP POLICY IF EXISTS "Staff can read order items" ON order_items;
CREATE POLICY "Staff can read order items" ON order_items FOR SELECT USING (public.get_auth_user_role() IN ('pickup_staff', 'delivery_staff', 'laundry_staff'));

-- PAYMENTS
DROP POLICY IF EXISTS "Admins have full access to payments" ON payments;
CREATE POLICY "Admins have full access to payments" ON payments FOR ALL USING (public.get_auth_user_role() = 'admin');

-- SUPPORT TICKETS
DROP POLICY IF EXISTS "Admins can manage support tickets" ON support_tickets;
CREATE POLICY "Admins can manage support tickets" ON support_tickets FOR ALL USING (public.get_auth_user_role() = 'admin');

-- REVIEWS
DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;
CREATE POLICY "Admins can manage reviews" ON reviews FOR ALL USING (public.get_auth_user_role() = 'admin');
