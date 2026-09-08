-- 0011_production_hardening.sql
-- Production-readiness fixes: authorization, missing policies, missing functions,
-- idempotent payments, and alteration services.

-- ============================================================================
-- 1. SECURE update_order_status: enforce role-based authorization.
--    Previously customers/anon could set ANY status on ANY order (P0 IDOR).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_new_status order_status,
  p_reason TEXT DEFAULT NULL,
  p_quality_check JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status order_status;
  v_customer_id UUID;
  v_actor_id UUID := auth.uid();
  v_role TEXT := public.get_auth_user_role();
  v_agent_id UUID;
BEGIN
  -- 1. Fetch current order and lock for update
  SELECT status, customer_id INTO v_old_status, v_customer_id
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- ============================================================
  -- AUTHORIZATION  (defense in depth; enforced before any mutation)
  -- ============================================================
  -- Admin: full control
  IF v_role = 'admin' THEN
    NULL; -- allowed
  -- Customer: only allowed to CANCEL their OWN order (and only from cancellable states)
  ELSIF v_role IS NULL OR v_role = 'customer' THEN
    IF v_customer_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Unauthorized: cannot modify another customer''s order';
    END IF;
    IF p_new_status <> 'CANCELLED' THEN
      RAISE EXCEPTION 'Unauthorized: customers can only cancel their own order';
    END IF;
    IF v_old_status IN ('PICKED_UP','RECEIVED_AT_FACILITY','PROCESSING','SORTING','WASHING','DRYING','IRONING','FOLDING','IRONING_FOLDING','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERY_ASSIGNED','OUT_FOR_DELIVERY','DELIVERED','COMPLETED') THEN
      RAISE EXCEPTION 'Cannot cancel order once processing has begun';
    END IF;
  -- Pickup staff: only assigned orders, only pickup lifecycle statuses
  ELSIF v_role = 'pickup_staff' THEN
    SELECT pickup_agent_id INTO v_agent_id FROM orders WHERE id = p_order_id;
    IF v_agent_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Unauthorized: not assigned to this pickup';
    END IF;
    IF p_new_status NOT IN ('PICKUP_ASSIGNED','PICKUP_SCHEDULED','PICKUP_STARTED','PICKED_UP','RECEIVED_AT_FACILITY','FAILED_PICKUP') THEN
      RAISE EXCEPTION 'Unauthorized: pickup staff cannot set status to %', p_new_status;
    END IF;
  -- Delivery staff: only assigned orders, only delivery lifecycle statuses
  ELSIF v_role = 'delivery_staff' THEN
    SELECT delivery_agent_id INTO v_agent_id FROM orders WHERE id = p_order_id;
    IF v_agent_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Unauthorized: not assigned to this delivery';
    END IF;
    IF p_new_status NOT IN ('DELIVERY_ASSIGNED','OUT_FOR_DELIVERY','DELIVERED','DELIVERY_FAILED') THEN
      RAISE EXCEPTION 'Unauthorized: delivery staff cannot set status to %', p_new_status;
    END IF;
  -- Laundry staff: facility lifecycle only
  ELSIF v_role = 'laundry_staff' THEN
    IF p_new_status NOT IN ('RECEIVED_AT_FACILITY','PROCESSING','SORTING','WASHING','DRYING','IRONING','FOLDING','IRONING_FOLDING','QUALITY_CHECK','READY_FOR_DELIVERY','ON_HOLD') THEN
      RAISE EXCEPTION 'Unauthorized: laundry staff cannot set status to %', p_new_status;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized: unknown role';
  END IF;

  -- 2. Validate status transition (basic guard)
  IF v_old_status = p_new_status THEN
    RAISE EXCEPTION 'Order already in status %', p_new_status;
  END IF;

  -- 3. Prevent invalid transitions from terminal states
  IF v_old_status IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED')
     AND p_new_status NOT IN ('REFUND_PENDING', 'REFUNDED') THEN
    RAISE EXCEPTION 'Cannot transition from terminal status % to %', v_old_status, p_new_status;
  END IF;

  -- 4. Update order status
  UPDATE orders
  SET
    status = p_new_status,
    updated_at = NOW(),
    quality_check = COALESCE(p_quality_check, quality_check),
    estimated_delivery_at = CASE
      WHEN p_new_status = 'READY_FOR_DELIVERY' THEN NOW() + INTERVAL '4 hours'
      ELSE estimated_delivery_at
    END
  WHERE id = p_order_id;

  -- 5. Log status history
  INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, v_old_status, p_new_status, v_actor_id, p_reason);

  -- 6. Handle loyalty points on completion
  IF p_new_status = 'COMPLETED' AND v_old_status <> 'COMPLETED' THEN
    PERFORM public.earn_loyalty_points(p_order_id);
  END IF;

  -- 7. Handle refund initiation
  IF p_new_status = 'REFUND_PENDING' AND v_old_status NOT IN ('REFUND_PENDING', 'REFUNDED') THEN
    PERFORM public.initiate_refund(p_order_id);
  END IF;

END;
$$;

-- ============================================================================
-- 2. Missing functions referenced by update_order_status
-- ============================================================================

-- 2a. Loyalty earning (1 point per 100 INR, idempotent per order)
CREATE OR REPLACE FUNCTION public.earn_loyalty_points(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_points INTEGER;
BEGIN
  SELECT customer_id, total INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.customer_id IS NULL THEN
    RETURN;
  END IF;

  -- Ensure loyalty account exists
  INSERT INTO loyalty_accounts (user_id, balance)
  VALUES (v_order.customer_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  v_points := floor(v_order.total / 100)::INTEGER;
  IF v_points <= 0 THEN
    RETURN;
  END IF;

  -- Idempotency: only credit once per order
  IF EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE user_id = v_order.customer_id AND order_id = p_order_id AND type = 'EARNED'
  ) THEN
    RETURN;
  END IF;

  UPDATE loyalty_accounts SET balance = balance + v_points, updated_at = NOW()
  WHERE user_id = v_order.customer_id;

  INSERT INTO loyalty_transactions (user_id, loyalty_account_id, points, type, order_id, description)
  VALUES (v_order.customer_id, v_order.customer_id, v_points, 'EARNED', p_order_id,
          'Earned ' || v_points || ' points from order');
END;
$$;

-- 2b. Refund initiation stub (marks payment refund pending; no external gateway call)
CREATE OR REPLACE FUNCTION public.initiate_refund(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE order_id = p_order_id ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND v_payment.status <> 'REFUNDED' THEN
    UPDATE payments SET status = 'REFUNDED', updated_at = NOW()
    WHERE id = v_payment.id AND status <> 'REFUNDED';
  END IF;
END;
$$;

-- ============================================================================
-- 3. Idempotent process_payment_webhook (replaces old non-idempotent version)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_order_id UUID,
  p_transaction_id TEXT,
  p_amount NUMERIC
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.payment_status = 'SUCCESS' THEN
    RETURN 'Already processed';
  END IF;

  IF p_amount <> v_order.total THEN
    UPDATE orders SET payment_status = 'FAILED' WHERE id = p_order_id;
    RETURN 'Amount mismatch';
  END IF;

  UPDATE orders SET payment_status = 'SUCCESS', updated_at = now()
  WHERE id = p_order_id;

  -- Idempotent insert keyed on gateway_transaction_id
  INSERT INTO payments (order_id, customer_id, amount, status, transaction_id, gateway, gateway_transaction_id)
  VALUES (p_order_id, v_order.customer_id, p_amount, 'SUCCESS', p_transaction_id, 'razorpay', p_transaction_id)
  ON CONFLICT (gateway_transaction_id) DO NOTHING;

  RETURN 'Payment successful';
END;
$$;

-- ============================================================================
-- 4. Server-side coupon validation RPC (referenced by BookingPage)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code TEXT,
  p_subtotal NUMERIC
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount NUMERIC := 0;
BEGIN
  IF p_code IS NULL OR p_code = '' THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon code required');
  END IF;

  SELECT * INTO v_coupon FROM coupons
  WHERE upper(code) = upper(p_code) AND active = true
    AND (valid_until IS NULL OR valid_until > now());

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

  RETURN json_build_object(
    'valid', true,
    'discount', v_discount,
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code
  );
END;
$$;

-- ============================================================================
-- 5. Alteration Services table (referenced by alterationService.ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alteration_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alteration_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active alteration services" ON alteration_services;
CREATE POLICY "Public can read active alteration services" ON alteration_services
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Admins can manage alteration services" ON alteration_services;
CREATE POLICY "Admins can manage alteration services" ON alteration_services
  FOR ALL USING (public.get_auth_user_role() = 'admin');

INSERT INTO alteration_services (name, description, price, unit, category, active) VALUES
('Button Replacement / Stitching', 'Secure loose or missing buttons', 30, 'piece', 'repair', true),
('Pant / Trouser Length Hemming', 'Shorten or re-stitch pants length', 99, 'pair', 'alteration', true),
('Zipper Repair & Slider Replacement', 'Fix stuck or split zippers', 120, 'garment', 'repair', true),
('Fabric De-Bobble & Lint Shave', 'Restore woolens & knits', 80, 'piece', 'care', true),
('Seam Reinforce & Spot Mending', 'Mend pocket tears & split seams', 60, 'spot', 'repair', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. MISSING RLS POLICIES (tables with RLS enabled but no policies -> deny-all,
--    which silently breaks customer-facing loyalty/subscription/history/coupons)
-- ============================================================================

-- Loyalty Accounts
DROP POLICY IF EXISTS "Users can read own loyalty account" ON loyalty_accounts;
CREATE POLICY "Users can read own loyalty account" ON loyalty_accounts
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins have full access to loyalty accounts" ON loyalty_accounts;
CREATE POLICY "Admins have full access to loyalty accounts" ON loyalty_accounts
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Loyalty Transactions
DROP POLICY IF EXISTS "Users can read own loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Users can read own loyalty transactions" ON loyalty_transactions
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins have full access to loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Admins have full access to loyalty transactions" ON loyalty_transactions
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Coupons
DROP POLICY IF EXISTS "Public can read active coupons" ON coupons;
CREATE POLICY "Public can read active coupons" ON coupons
  FOR SELECT USING (active = true AND (valid_until IS NULL OR valid_until > now()));
DROP POLICY IF EXISTS "Admins can manage coupons" ON coupons;
CREATE POLICY "Admins can manage coupons" ON coupons
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Subscription Plans
DROP POLICY IF EXISTS "Public can read subscription plans" ON subscription_plans;
CREATE POLICY "Public can read subscription plans" ON subscription_plans
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON subscription_plans;
CREATE POLICY "Admins can manage subscription plans" ON subscription_plans
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- User Subscriptions
DROP POLICY IF EXISTS "Users can read own subscriptions" ON user_subscriptions;
CREATE POLICY "Users can read own subscriptions" ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins have full access to user subscriptions" ON user_subscriptions;
CREATE POLICY "Admins have full access to user subscriptions" ON user_subscriptions
  FOR ALL USING (public.get_auth_user_role() = 'admin');

-- Order Status History (customers read own, staff read all)
DROP POLICY IF EXISTS "Customers can read own order history" ON order_status_history;
CREATE POLICY "Customers can read own order history" ON order_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.customer_id = auth.uid())
  );
DROP POLICY IF EXISTS "Staff can read order history" ON order_status_history;
CREATE POLICY "Staff can read order history" ON order_status_history
  FOR SELECT USING (public.get_auth_user_role() IN ('pickup_staff','delivery_staff','laundry_staff','admin'));
DROP POLICY IF EXISTS "Admins have full access to order history" ON order_status_history;
CREATE POLICY "Admins have full access to order history" ON order_status_history
  FOR ALL USING (public.get_auth_user_role() = 'admin');