-- 0013_harden_schema.sql
-- Schema-level production hardening for FoldeD.
--  - New payment_status values (REFUND_PENDING / REFUND_FAILED)
--  - Delivery PIN moved out of the orders table into a customer-only table + hashed
--  - Razorpay order mapping on orders/payments
--  - Pickup slot capacity table (server-side atomic capacity)
--  - Coupon redemption audit table
--  - Refund records table
--  - Security events audit table
--  - Unique order-number sequence
--  - Client write access revoked on every sensitive table
--  - RLS tightened (no broad FOR ALL on orders/payments/loyalty)
--  - Profile role-escalation guard

-- ============================================================================
-- 1. Payment status enum additions
-- ============================================================================
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'REFUND_FAILED';

-- ============================================================================
-- 2. Orders hardening columns
-- ============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pin_hash TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pin_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pin_locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_agent_id ON public.orders(pickup_agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_agent_id ON public.orders(delivery_agent_id);

-- Guaranteed-unique order number sequence (FD-YYMMDD-XXXXXX)
CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq START 1;

-- ============================================================================
-- 3. Payments hardening columns
-- ============================================================================
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS captured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);

-- ============================================================================
-- 4. Loyalty idempotency (earn at most once per order)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_loyalty_earned_per_order
  ON public.loyalty_transactions(order_id) WHERE type = 'EARNED';

-- ============================================================================
-- 5. Order delivery PIN table (customer-only read path)
--    The plaintext PIN lives ONLY here. The orders table stores a bcrypt hash.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_delivery_pins (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_delivery_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read own delivery pin" ON public.order_delivery_pins;
CREATE POLICY "Owner can read own delivery pin" ON public.order_delivery_pins
  FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage delivery pins" ON public.order_delivery_pins;
CREATE POLICY "Admins manage delivery pins" ON public.order_delivery_pins
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Backfill: existing plaintext PINs are moved into the customer-only table and
-- hashed on orders. The plaintext column is then nulled so staff can never read it.
INSERT INTO public.order_delivery_pins (order_id, customer_id, pin)
SELECT id, customer_id, delivery_pin
FROM public.orders
WHERE delivery_pin IS NOT NULL AND customer_id IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;

UPDATE public.orders
SET delivery_pin_hash = crypt(delivery_pin, gen_salt('bf'))
WHERE delivery_pin IS NOT NULL AND delivery_pin_hash IS NULL;

UPDATE public.orders SET delivery_pin = NULL;

-- ============================================================================
-- 6. Pickup slots (atomic capacity reservation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pickup_slots (
  id BIGSERIAL PRIMARY KEY,
  slot_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20,
  booked INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (slot_date, time_slot)
);

ALTER TABLE public.pickup_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active pickup slots" ON public.pickup_slots;
CREATE POLICY "Public can read active pickup slots" ON public.pickup_slots
  FOR SELECT USING (is_active = true AND slot_date >= CURRENT_DATE);

DROP POLICY IF EXISTS "Admins manage pickup slots" ON public.pickup_slots;
CREATE POLICY "Admins manage pickup slots" ON public.pickup_slots
  FOR ALL USING (public.get_auth_user_role() = 'admin');

INSERT INTO public.pickup_slots (slot_date, time_slot, capacity)
SELECT d::date, s.time_slot, 20
FROM generate_series(CURRENT_DATE, CURRENT_DATE + 6, interval '1 day') AS d
CROSS JOIN (VALUES
  ('10:00-12:00'),
  ('12:00-14:00'),
  ('14:00-16:00'),
  ('16:00-18:00'),
  ('18:00-20:00')
) AS s(time_slot)
ON CONFLICT (slot_date, time_slot) DO NOTHING;

-- ============================================================================
-- 7. Coupon redemptions (race-safe usage accounting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discount_applied NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (coupon_id, order_id),
  UNIQUE (coupon_id, user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON public.coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);

-- ============================================================================
-- 8. Refunds
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id),
  razorpay_refund_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSING | SUCCESS | FAILED
  requested_by UUID REFERENCES public.profiles(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

-- ============================================================================
-- 9. Security events audit log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  order_id UUID,
  actor_id UUID,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'warning',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_order ON public.security_events(order_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);

-- ============================================================================
-- 10. Revoke client write access on all sensitive tables.
--     All mutations now happen exclusively through SECURITY DEFINER RPCs.
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_status_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_accounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pickup_slots FROM anon, authenticated;
REVOKE ALL ON public.coupon_redemptions, public.refunds, public.order_delivery_pins, public.security_events
  FROM anon, authenticated;

-- ============================================================================
-- 11. RLS: replace broad policies with strict ones
-- ============================================================================

-- ORDERS ----------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can manage own orders" ON public.orders;
DROP POLICY IF EXISTS "Pickup staff can update assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Delivery staff can update assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Laundry staff can update processing orders" ON public.orders;

DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
CREATE POLICY "Customers can read own orders" ON public.orders
  FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Pickup staff can read assigned orders" ON public.orders;
CREATE POLICY "Pickup staff can read assigned orders" ON public.orders
  FOR SELECT USING (public.get_auth_user_role() = 'pickup_staff' AND pickup_agent_id = auth.uid());

DROP POLICY IF EXISTS "Delivery staff can read assigned orders" ON public.orders;
CREATE POLICY "Delivery staff can read assigned orders" ON public.orders
  FOR SELECT USING (public.get_auth_user_role() = 'delivery_staff' AND delivery_agent_id = auth.uid());

DROP POLICY IF EXISTS "Laundry staff can read processing orders" ON public.orders;
CREATE POLICY "Laundry staff can read processing orders" ON public.orders
  FOR SELECT USING (
    public.get_auth_user_role() = 'laundry_staff'
    AND status IN ('RECEIVED_AT_FACILITY','PROCESSING','SORTING','WASHING','DRYING','IRONING','FOLDING','IRONING_FOLDING','QUALITY_CHECK','READY_FOR_DELIVERY','ON_HOLD')
  );

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders" ON public.orders
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- ORDER ITEMS ------------------------------------------------------------
DROP POLICY IF EXISTS "Customers can insert own order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers can read own order items" ON public.order_items;
CREATE POLICY "Customers can read own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can read order items" ON public.order_items;
CREATE POLICY "Staff can read order items" ON public.order_items
  FOR SELECT USING (public.get_auth_user_role() IN ('pickup_staff','delivery_staff','laundry_staff'));

DROP POLICY IF EXISTS "Admins have full access to order items" ON public.order_items;
CREATE POLICY "Admins have full access to order items" ON public.order_items
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- ORDER STATUS HISTORY ----------------------------------------------------
DROP POLICY IF EXISTS "Customers can read own order history" ON public.order_status_history;
CREATE POLICY "Customers can read own order history" ON public.order_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_status_history.order_id AND orders.customer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can read order history" ON public.order_status_history;
CREATE POLICY "Staff can read order history" ON public.order_status_history
  FOR SELECT USING (public.get_auth_user_role() IN ('pickup_staff','delivery_staff','laundry_staff'));

DROP POLICY IF EXISTS "Admins have full access to order history" ON public.order_status_history;
CREATE POLICY "Admins have full access to order history" ON public.order_status_history
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- PAYMENTS ----------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Customers can read own payments" ON public.payments;
CREATE POLICY "Customers can read own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins have full access to payments" ON public.payments;
CREATE POLICY "Admins have full access to payments" ON public.payments
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- LOYALTY ACCOUNTS ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own loyalty account" ON public.loyalty_accounts;
CREATE POLICY "Users can read own loyalty account" ON public.loyalty_accounts
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to loyalty accounts" ON public.loyalty_accounts;
CREATE POLICY "Admins have full access to loyalty accounts" ON public.loyalty_accounts
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- LOYALTY TRANSACTIONS -----------------------------------------------------
DROP POLICY IF EXISTS "Users can read own loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Users can read own loyalty transactions" ON public.loyalty_transactions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Admins have full access to loyalty transactions" ON public.loyalty_transactions
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- SUPPORT TICKETS ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own support tickets" ON public.support_tickets;
CREATE POLICY "Customers can create support tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
    AND (order_id IS NULL OR EXISTS (
      SELECT 1 FROM public.orders WHERE orders.id = order_id AND orders.customer_id = auth.uid()
    ))
  );
CREATE POLICY "Customers can read own support tickets" ON public.support_tickets
  FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage support tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage support tickets" ON public.support_tickets
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- REVIEWS ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own reviews" ON public.reviews;
CREATE POLICY "Customers can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = reviews.order_id AND orders.customer_id = auth.uid()
    )
  );
CREATE POLICY "Customers can read own reviews" ON public.reviews
  FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews" ON public.reviews
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- PROFILES: prevent privilege escalation -----------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = public.get_auth_user_role());

DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles" ON public.profiles
  FOR ALL USING (public.get_auth_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- ============================================================================
-- 12. Profile privilege-escalation trigger (defense in depth)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     AND public.get_auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Cannot change role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();