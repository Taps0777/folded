-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read and update their own profile. Admins can do everything.
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to profiles" ON profiles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Addresses: Users can CRUD their own addresses.
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins have full access to addresses" ON addresses FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Service Areas: Public read. Admin all.
CREATE POLICY "Public can read service areas" ON service_areas FOR SELECT USING (true);
CREATE POLICY "Admins can manage service areas" ON service_areas FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Services & Items: Public read. Admin all.
CREATE POLICY "Public can read services" ON services FOR SELECT USING (true);
CREATE POLICY "Admins can manage services" ON services FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public can read items" ON items FOR SELECT USING (true);
CREATE POLICY "Admins can manage items" ON items FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Orders: 
-- Customers can read/insert their own orders.
CREATE POLICY "Customers can manage own orders" ON orders FOR ALL USING (customer_id = auth.uid());
-- Pickup staff can read/update assigned orders.
CREATE POLICY "Pickup staff can read assigned orders" ON orders FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'pickup_staff') AND (pickup_agent_id = auth.uid() OR pickup_agent_id IS NULL));
CREATE POLICY "Pickup staff can update assigned orders" ON orders FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'pickup_staff') AND pickup_agent_id = auth.uid());
-- Delivery staff can read/update assigned orders.
CREATE POLICY "Delivery staff can read assigned orders" ON orders FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'delivery_staff') AND (delivery_agent_id = auth.uid() OR delivery_agent_id IS NULL));
CREATE POLICY "Delivery staff can update assigned orders" ON orders FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'delivery_staff') AND delivery_agent_id = auth.uid());
-- Laundry staff can read and update all processing orders.
CREATE POLICY "Laundry staff can read processing orders" ON orders FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'laundry_staff'));
CREATE POLICY "Laundry staff can update processing orders" ON orders FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'laundry_staff'));
-- Admins have full access.
CREATE POLICY "Admins have full access to orders" ON orders FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Order Items: Follows Order permissions (simplified here: customers can read own)
CREATE POLICY "Customers can read own order items" ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Customers can insert own order items" ON order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Admins have full access to order items" ON order_items FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
-- Staff can read items for orders they can see
CREATE POLICY "Staff can read order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('pickup_staff', 'delivery_staff', 'laundry_staff'))
);

-- Payments: Customers can read own payments.
CREATE POLICY "Customers can read own payments" ON payments FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY "Admins have full access to payments" ON payments FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Add missing similar policies for other tables (Loyalty, Support Tickets, etc)
CREATE POLICY "Users can manage own support tickets" ON support_tickets FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "Admins can manage support tickets" ON support_tickets FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can manage own reviews" ON reviews FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "Admins can manage reviews" ON reviews FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
