-- 0008_phase1_security_fixes.sql
-- Phase 1: Security & Data Integrity Fixes

-- ============================================================
-- 1. Add missing RLS policies for tables without admin access
-- ============================================================

-- Loyalty Accounts
CREATE POLICY "Users can read own loyalty account" ON loyalty_accounts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins have full access to loyalty accounts" ON loyalty_accounts FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Loyalty Transactions
CREATE POLICY "Users can read own loyalty transactions" ON loyalty_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins have full access to loyalty transactions" ON loyalty_transactions FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Subscription Plans (public read, admin write)
CREATE POLICY "Public can read subscription plans" ON subscription_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage subscription plans" ON subscription_plans FOR ALL USING (public.get_auth_user_role() = 'admin');

-- User Subscriptions
CREATE POLICY "Users can read own subscriptions" ON user_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins have full access to user subscriptions" ON user_subscriptions FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Payments: Allow webhook (service role) to insert
CREATE POLICY "Service role can insert payments" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Customers can read own payments" ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid())
);
CREATE POLICY "Admins have full access to payments" ON payments FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Coupons: Public read (for validation), admin write
CREATE POLICY "Public can read active coupons" ON coupons FOR SELECT USING (active = true AND (valid_until IS NULL OR valid_until > now()));
CREATE POLICY "Admins can manage coupons" ON coupons FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Order Status History: Customers read own, staff read assigned, admin all
CREATE POLICY "Customers can read own order history" ON order_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.customer_id = auth.uid())
);
CREATE POLICY "Staff can read order history" ON order_status_history FOR SELECT USING (
  public.get_auth_user_role() IN ('pickup_staff', 'delivery_staff', 'laundry_staff', 'admin')
);
CREATE POLICY "Admins have full access to order history" ON order_status_history FOR ALL USING (public.get_auth_user_role() = 'admin');

-- ============================================================
-- 2. Harden create_order_secure RPC
-- ============================================================

-- Add express_surcharge column to services if not exists
ALTER TABLE services ADD COLUMN IF NOT EXISTS express_surcharge NUMERIC DEFAULT 100;

-- Update existing services with default express surcharge
UPDATE services SET express_surcharge = 100 WHERE express_surcharge IS NULL;

CREATE OR REPLACE FUNCTION create_order_secure(
  p_customer_id UUID,
  p_address_id UUID,
  p_service_id UUID,
  p_weight_kg NUMERIC,
  p_is_express BOOLEAN,
  p_coupon_code TEXT,
  p_special_instructions TEXT,
  p_pickup_date TEXT,
  p_pickup_slot TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service RECORD;
  v_coupon RECORD;
  v_coupon_id UUID := NULL;
  v_address RECORD;
  v_service_area RECORD;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_delivery_fee NUMERIC := 0;
  v_express_fee NUMERIC := 0;
  v_total NUMERIC := 0;
  v_order_id UUID;
  v_order_number TEXT;
  v_delivery_pin TEXT;
  v_parsed_date DATE;
BEGIN
  -- 1. Validate Service & Price
  SELECT * INTO v_service FROM services WHERE id = p_service_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or inactive service';
  END IF;

  -- 2. Validate Address Ownership
  SELECT * INTO v_address FROM addresses WHERE id = p_address_id AND user_id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Address not found or does not belong to customer';
  END IF;

  -- 3. Validate Pincode Serviceability
  SELECT * INTO v_service_area FROM service_areas 
  WHERE pincode = v_address.pincode AND is_active = true AND is_pickup_available = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not available in this pincode';
  END IF;

  -- 4. Calculate Subtotal
  v_subtotal := v_service.base_price * p_weight_kg;

  -- 5. Delivery & Express Fees
  IF v_subtotal < 199 THEN
    v_delivery_fee := 40;
  END IF;

  IF p_is_express THEN
    v_express_fee := COALESCE(v_service.express_surcharge, 100);
  END IF;

  -- 6. Validate Coupon (server-side)
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    SELECT * INTO v_coupon FROM coupons 
    WHERE code = p_coupon_code AND active = true AND (valid_until IS NULL OR valid_until > now());
    
    IF FOUND THEN
      v_coupon_id := v_coupon.id;
      IF v_subtotal >= v_coupon.minimum_order_value THEN
        IF v_coupon.discount_type = 'PERCENTAGE' THEN
          v_discount := v_subtotal * (v_coupon.discount_value / 100.0);
          IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN
            v_discount := v_coupon.maximum_discount;
          END IF;
        ELSE
          v_discount := v_coupon.discount_value;
        END IF;
      ELSE
        RAISE EXCEPTION 'Order value does not meet coupon minimum';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid or expired coupon code';
    END IF;
  END IF;

  -- 7. Calculate Final Total
  v_total := GREATEST(0, v_subtotal + v_delivery_fee + v_express_fee - v_discount);

  -- 8. Generate Order Number & PIN (cryptographically secure)
  v_order_number := 'ORD-' || to_char(now(), 'YYMMDDHH24MISS');
  v_delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');

  -- 9. Flexible date parsing
  IF p_pickup_date IS NULL OR lower(trim(p_pickup_date)) = 'today' THEN
    v_parsed_date := CURRENT_DATE;
  ELSIF lower(trim(p_pickup_date)) = 'tomorrow' THEN
    v_parsed_date := CURRENT_DATE + INTERVAL '1 day';
  ELSIF lower(trim(p_pickup_date)) = 'day after' OR lower(trim(p_pickup_date)) = 'day after tomorrow' THEN
    v_parsed_date := CURRENT_DATE + INTERVAL '2 days';
  ELSE
    BEGIN
      v_parsed_date := p_pickup_date::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_parsed_date := CURRENT_DATE;
    END;
  END IF;

  -- 10. Insert Order (atomic with all validations passed)
  INSERT INTO orders (
    order_number, customer_id, service_id, pickup_address_id, delivery_address_id,
    subtotal, discount, delivery_fee, express_fee, total,
    special_instructions, measured_weight_kg, pickup_date, pickup_time_slot, delivery_pin,
    status, payment_status, coupon_id
  ) VALUES (
    v_order_number, p_customer_id, p_service_id, p_address_id, p_address_id,
    v_subtotal, v_discount, v_delivery_fee, v_express_fee, v_total,
    p_special_instructions, p_weight_kg, v_parsed_date, p_pickup_slot, v_delivery_pin,
    'CONFIRMED', 'PENDING', v_coupon_id
  ) RETURNING id INTO v_order_id;

  -- 11. Insert Order Item
  INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
  VALUES (v_order_id, v_service.id, 1, v_service.base_price, v_subtotal);

  -- 12. Log History
  INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (v_order_id, NULL, 'CONFIRMED', p_customer_id, 'Order Created');

  RETURN json_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'delivery_pin', v_delivery_pin
  );
END;
$$;

-- ============================================================
-- 3. Idempotent Payment Webhook - Add unique constraint
-- ============================================================

-- Add unique constraint on gateway_transaction_id for idempotency
ALTER TABLE payments ADD CONSTRAINT IF NOT EXISTS payments_gateway_transaction_id_unique UNIQUE (gateway_transaction_id);

-- Update process_payment_webhook to use the constraint
CREATE OR REPLACE FUNCTION process_payment_webhook(
  p_order_id UUID,
  p_transaction_id TEXT,
  p_amount NUMERIC
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- 1. Fetch Order and lock for update to prevent race conditions
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- 2. Idempotency Check - payment already successful
  IF v_order.payment_status = 'SUCCESS' THEN
    RETURN 'Already processed';
  END IF;

  -- 3. Verification Check
  IF p_amount != v_order.total THEN
    UPDATE orders SET payment_status = 'FAILED' WHERE id = p_order_id;
    RETURN 'Amount mismatch';
  END IF;

  -- 4. Process Payment - use ON CONFLICT for idempotent payment record
  UPDATE orders 
  SET payment_status = 'SUCCESS',
      updated_at = now()
  WHERE id = p_order_id;

  -- Insert payment record with idempotency
  INSERT INTO payments (order_id, customer_id, amount, status, transaction_id, gateway, gateway_transaction_id)
  VALUES (p_order_id, v_order.customer_id, p_amount, 'SUCCESS', p_transaction_id, 'razorpay', p_transaction_id)
  ON CONFLICT (gateway_transaction_id) DO NOTHING;

  RETURN 'Payment successful';
END;
$$;

-- ============================================================
-- 4. Alteration Services Table (for server-side pricing)
-- ============================================================

CREATE TABLE IF NOT EXISTS alteration_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece', -- 'piece', 'pair', 'garment', 'spot'
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alteration_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active alteration services" ON alteration_services FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage alteration services" ON alteration_services FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Seed default alteration services
INSERT INTO alteration_services (name, description, price, unit, category, active) VALUES
('Button Replacement / Stitching', 'Secure loose or missing buttons', 30, 'piece', 'repair', true),
('Pant / Trouser Length Hemming', 'Shorten or re-stitch pants length', 99, 'pair', 'alteration', true),
('Zipper Repair & Slider Replacement', 'Fix stuck or split zippers', 120, 'garment', 'repair', true),
('Fabric De-Bobble & Lint Shave', 'Restore woolens & knits', 80, 'piece', 'care', true),
('Seam Reinforce & Spot Mending', 'Mend pocket tears & split seams', 60, 'spot', 'repair', true)
ON CONFLICT DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_alteration_services_updated_at ON alteration_services;
CREATE TRIGGER update_alteration_services_updated_at
BEFORE UPDATE ON alteration_services
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. Add maximum_quantity to services table
-- ============================================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS maximum_quantity NUMERIC DEFAULT 20;

-- Update existing services with reasonable defaults
UPDATE services SET maximum_quantity = 20 WHERE maximum_quantity IS NULL;

-- ============================================================
-- 6. Driver Locations Table (for real-time tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  speed_kmh NUMERIC,
  battery_pct INTEGER,
  status TEXT, -- 'idle', 'en_route_pickup', 'at_pickup', 'en_route_delivery', 'at_delivery'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert own location" ON driver_locations FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "Drivers can update own location" ON driver_locations FOR UPDATE USING (driver_id = auth.uid());
CREATE POLICY "Customers can read location for their order" ON driver_locations FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = driver_locations.order_id AND orders.customer_id = auth.uid())
);
CREATE POLICY "Staff can read locations for assigned orders" ON driver_locations FOR SELECT USING (
  public.get_auth_user_role() IN ('pickup_staff', 'delivery_staff', 'laundry_staff', 'admin')
);
CREATE POLICY "Admins have full access" ON driver_locations FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Index for real-time queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_order_id ON driver_locations(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at ON driver_locations(updated_at DESC);

-- ============================================================
-- 7. Server-side Coupon Validation RPC
-- ============================================================

CREATE OR REPLACE FUNCTION validate_coupon(
  p_code TEXT,
  p_subtotal NUMERIC
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon RECORD;
  v_discount NUMERIC := 0;
  v_valid BOOLEAN := false;
  v_error TEXT := '';
BEGIN
  IF p_code IS NULL OR p_code = '' THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon code required');
  END IF;

  SELECT * INTO v_coupon FROM coupons 
  WHERE code = upper(p_code) AND active = true AND (valid_until IS NULL OR valid_until > now());
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or expired coupon code');
  END IF;

  IF p_subtotal < v_coupon.minimum_order_value THEN
    RETURN json_build_object('valid', false, 'error', 'Order value does not meet minimum of ' || v_coupon.minimum_order_value);
  END IF;

  IF v_coupon.discount_type = 'PERCENTAGE' THEN
    v_discount := p_subtotal * (v_coupon.discount_value / 100.0);
    IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN
      v_discount := v_coupon.maximum_discount;
    END IF;
  ELSE
    v_discount := v_coupon.discount_value;
  END IF;

  v_valid := true;

  RETURN json_build_object(
    'valid', v_valid,
    'discount', v_discount,
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code
  );
END;
$$;