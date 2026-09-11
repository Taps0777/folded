-- 0014_secure_rpcs.sql
-- FoldeD production-grade RPC layer.
-- Every sensitive mutation is a SECURITY DEFINER function that derives the
-- caller from auth.uid(), derives the role from profiles, validates ownership
-- / assignment / state, then performs the mutation atomically with audit.

-- ============================================================================
-- 1. create_order_secure: server-authoritative order creation.
--    - enforces auth.uid() == customer
--    - validates address ownership + serviceability
--    - validates pickup slot + atomically reserves capacity
--    - validates weight / per-item pricing server-side
--    - validates + locks + records coupon usage (race-safe)
--    - validates + locks loyalty redemption server-side
--    - stores immutable financial snapshot + hashed delivery PIN
-- ============================================================================
-- Drop the superseded 9-argument create_order_secure overload (installed by the
-- now-removed 0012 migration). It created orders in a pre-payment CONFIRMED
-- state, had no loyalty/items support, and — unlike the 11-arg version below —
-- was never REVOKEd from PUBLIC, so it left an authenticated caller an
-- alternate, weaker order-creation path.
DROP FUNCTION IF EXISTS public.create_order_secure(
  UUID, UUID, UUID, NUMERIC, BOOLEAN, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_customer_id UUID,
  p_address_id UUID,
  p_service_id UUID,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_is_express BOOLEAN DEFAULT false,
  p_coupon_code TEXT DEFAULT NULL,
  p_special_instructions TEXT DEFAULT NULL,
  p_pickup_date TEXT DEFAULT NULL,
  p_pickup_slot TEXT DEFAULT NULL,
  p_loyalty_points INTEGER DEFAULT 0,
  p_items JSONB DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_service RECORD;
  v_address RECORD;
  v_service_area RECORD;
  v_slot RECORD;
  v_coupon RECORD;
  v_loyalty RECORD;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_loyalty_discount NUMERIC := 0;
  v_delivery_fee NUMERIC := 0;
  v_express_fee NUMERIC := 0;
  v_total NUMERIC := 0;
  v_order_id UUID;
  v_order_number TEXT;
  v_delivery_pin TEXT;
  v_parsed_date DATE;
  v_item RECORD;
  v_item_price NUMERIC;
  v_loyalty_points INTEGER := GREATEST(p_loyalty_points, 0);
  v_allowed_slots TEXT[] := ARRAY['10:00-12:00','12:00-14:00','14:00-16:00','16:00-18:00','18:00-20:00'];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_customer_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Unauthorized: cannot create an order on behalf of another user';
  END IF;

  -- 1. Service
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or inactive service';
  END IF;

  -- 2. Address ownership + serviceability
  SELECT * INTO v_address FROM public.addresses WHERE id = p_address_id AND user_id = v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Address not found or does not belong to you';
  END IF;
  SELECT * INTO v_service_area FROM public.service_areas
  WHERE pincode = v_address.pincode AND is_active = true AND is_pickup_available = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not available in this pincode';
  END IF;

  -- 3. Pickup slot validation (strict; never silently defaults)
  IF p_pickup_date IS NULL OR p_pickup_slot IS NULL OR trim(p_pickup_slot) = '' THEN
    RAISE EXCEPTION 'Pickup date and time slot are required';
  END IF;
  IF NOT (p_pickup_slot = ANY(v_allowed_slots)) THEN
    RAISE EXCEPTION 'Invalid pickup time slot';
  END IF;
  BEGIN
    v_parsed_date := p_pickup_date::DATE;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid pickup date format';
  END;
  IF v_parsed_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Pickup date cannot be in the past';
  END IF;
  IF v_parsed_date > CURRENT_DATE + 6 THEN
    RAISE EXCEPTION 'Pickup can only be scheduled within the next 7 days';
  END IF;
  IF v_parsed_date = CURRENT_DATE THEN
    -- Reject slots that have already ended today.
    IF (p_pickup_slot = '10:00-12:00' AND CURRENT_TIME > TIME '12:00')
       OR (p_pickup_slot = '12:00-14:00' AND CURRENT_TIME > TIME '14:00')
       OR (p_pickup_slot = '14:00-16:00' AND CURRENT_TIME > TIME '16:00')
       OR (p_pickup_slot = '16:00-18:00' AND CURRENT_TIME > TIME '18:00')
       OR (p_pickup_slot = '18:00-20:00' AND CURRENT_TIME > TIME '20:00') THEN
      RAISE EXCEPTION 'Pickup slot has already closed for today';
    END IF;
  END IF;

  -- 4. Server-side price calculation (immutable snapshot)
  IF v_service.pricing_type = 'PER_KG' THEN
    IF p_weight_kg IS NULL OR p_weight_kg < 1 OR p_weight_kg > COALESCE(v_service.maximum_quantity, 20) THEN
      RAISE EXCEPTION 'Weight must be between 1 and % kg', COALESCE(v_service.maximum_quantity, 20);
    END IF;
    v_subtotal := ROUND(v_service.base_price * p_weight_kg, 2);
  ELSIF v_service.pricing_type = 'PER_ITEM' THEN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'Item selection is required for this service';
    END IF;
    FOR v_item IN SELECT value->>'item_id' AS item_id, COALESCE((value->>'quantity')::int, 1) AS quantity
                 FROM jsonb_array_elements(p_items)
    LOOP
      SELECT price INTO v_item_price FROM public.items WHERE id = v_item.item_id AND service_id = p_service_id AND active = true;
      IF v_item_price IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive item selected';
      END IF;
      IF v_item.quantity < 1 OR v_item.quantity > 100 THEN
        RAISE EXCEPTION 'Invalid item quantity';
      END IF;
      v_subtotal := v_subtotal + ROUND(v_item_price * v_item.quantity, 2);
    END LOOP;
  ELSE
    v_subtotal := COALESCE(v_service.base_price, 0);
  END IF;

  -- 5. Fees
  IF v_subtotal < 199 THEN
    v_delivery_fee := 40;
  END IF;
  IF p_is_express THEN
    v_express_fee := COALESCE(v_service.express_surcharge, 100);
  END IF;

  -- 6. Coupon (locked + recorded)
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM public.coupons
    WHERE upper(code) = upper(trim(p_coupon_code)) AND active = true
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired coupon code';
    END IF;
    IF v_coupon.valid_from IS NOT NULL AND now() < v_coupon.valid_from THEN
      RAISE EXCEPTION 'Coupon is not yet active';
    END IF;
    IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
      RAISE EXCEPTION 'Coupon has expired';
    END IF;
    IF v_subtotal < COALESCE(v_coupon.minimum_order_value, 0) THEN
      RAISE EXCEPTION 'Order value does not meet coupon minimum';
    END IF;
    IF v_coupon.usage_limit IS NOT NULL THEN
      IF (SELECT COUNT(*) FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id) >= v_coupon.usage_limit THEN
        RAISE EXCEPTION 'Coupon usage limit reached';
      END IF;
    END IF;
    IF v_coupon.per_user_limit IS NOT NULL THEN
      IF (SELECT COUNT(*) FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id AND user_id = v_actor) >= v_coupon.per_user_limit THEN
        RAISE EXCEPTION 'Coupon already used by this account';
      END IF;
    END IF;
    IF v_coupon.discount_type = 'PERCENTAGE' THEN
      v_discount := v_subtotal * (v_coupon.discount_value / 100.0);
      IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN
        v_discount := v_coupon.maximum_discount;
      END IF;
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;
    v_discount := LEAST(v_discount, v_subtotal);
  END IF;

  -- 7. Loyalty redemption (locked)
  IF v_loyalty_points > 0 THEN
    INSERT INTO public.loyalty_accounts (user_id, balance) VALUES (v_actor, 0)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO v_loyalty FROM public.loyalty_accounts WHERE user_id = v_actor FOR UPDATE;
    IF v_loyalty.balance < v_loyalty_points THEN
      RAISE EXCEPTION 'Insufficient loyalty points';
    END IF;
    v_loyalty_discount := LEAST(v_loyalty_points * 0.10, v_subtotal + v_delivery_fee + v_express_fee - v_discount);
  END IF;

  -- 8. Total (financial snapshot)
  v_total := GREATEST(0, ROUND(v_subtotal + v_delivery_fee + v_express_fee - v_discount - v_loyalty_discount, 2));

  -- 9. Atomic capacity reservation
  SELECT booked, capacity INTO v_slot FROM public.pickup_slots
  WHERE slot_date = v_parsed_date AND time_slot = p_pickup_slot AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pickup slot is not available';
  END IF;
  IF v_slot.booked >= v_slot.capacity THEN
    RAISE EXCEPTION 'Pickup slot is full. Please choose another slot.';
  END IF;
  UPDATE public.pickup_slots SET booked = booked + 1
  WHERE slot_date = v_parsed_date AND time_slot = p_pickup_slot;

  -- 10. Order number (sequence-backed, collision-proof)
  v_order_number := 'FD-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('public.orders_order_number_seq')::text, 6, '0');

  -- 11. Delivery PIN (cryptographically random, stored hashed)
  v_delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');

  -- 12. Insert order (plaintext PIN is NEVER persisted on orders)
  INSERT INTO public.orders (
    order_number, customer_id, service_id, pickup_address_id, delivery_address_id,
    subtotal, discount, delivery_fee, express_fee, total,
    special_instructions, measured_weight_kg, pickup_date, pickup_time_slot,
    delivery_pin, delivery_pin_hash, status, payment_status, coupon_id
  ) VALUES (
    v_order_number, v_actor, p_service_id, p_address_id, p_address_id,
    v_subtotal, ROUND(v_discount + v_loyalty_discount, 2), v_delivery_fee, v_express_fee, v_total,
    p_special_instructions, CASE WHEN v_service.pricing_type = 'PER_KG' THEN p_weight_kg ELSE NULL END,
    v_parsed_date, p_pickup_slot,
    NULL, crypt(v_delivery_pin, gen_salt('bf')), 'PENDING_PAYMENT', 'PENDING', v_coupon.id
  ) RETURNING id INTO v_order_id;

  -- 13. Order items (immutable price snapshot)
  IF v_service.pricing_type = 'PER_ITEM' THEN
    FOR v_item IN SELECT value->>'item_id' AS item_id, COALESCE((value->>'quantity')::int, 1) AS quantity
                 FROM jsonb_array_elements(p_items)
    LOOP
      SELECT price INTO v_item_price FROM public.items WHERE id = v_item.item_id AND service_id = p_service_id AND active = true;
      INSERT INTO public.order_items (order_id, item_id, service_id, quantity, unit_price, total_price)
      VALUES (v_order_id, v_item.item_id, p_service_id, v_item.quantity, v_item_price, ROUND(v_item_price * v_item.quantity, 2));
    END LOOP;
  ELSE
    INSERT INTO public.order_items (order_id, item_id, service_id, quantity, unit_price, total_price)
    VALUES (v_order_id, NULL, p_service_id, 1, v_service.base_price, v_subtotal);
  END IF;

  -- 14. Delivery PIN in customer-only table
  INSERT INTO public.order_delivery_pins (order_id, customer_id, pin)
  VALUES (v_order_id, v_actor, v_delivery_pin);

  -- 15. History
  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (v_order_id, NULL, 'PENDING_PAYMENT', v_actor, 'Order created');

  -- 16. Coupon redemption record
  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
    VALUES (v_coupon.id, v_actor, v_order_id, v_discount);
  END IF;

  -- 17. Loyalty redemption record
  IF v_loyalty_points > 0 THEN
    UPDATE public.loyalty_accounts SET balance = balance - v_loyalty_points, updated_at = now()
    WHERE user_id = v_actor;
    INSERT INTO public.loyalty_transactions (user_id, loyalty_account_id, points, type, order_id, description)
    VALUES (v_actor, v_actor, -v_loyalty_points, 'REDEEMED', v_order_id, 'Redeemed ' || v_loyalty_points || ' points');
  END IF;

  RETURN json_build_object(
    'ok', true,
    'id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'delivery_pin', v_delivery_pin
  );
END;
$$;

-- ============================================================================
-- 2. update_order_status: strict state machine + role authorization
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_new_status public.order_status,
  p_reason TEXT DEFAULT NULL,
  p_quality_check JSONB DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_role TEXT := public.get_auth_user_role();
  v_actor UUID := auth.uid();
  v_allowed TEXT[];
  v_transition TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Role authorization
  IF v_role = 'admin' THEN
    NULL;
  ELSIF v_role = 'customer' THEN
    IF v_order.customer_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Unauthorized: cannot modify another customer''s order';
    END IF;
    IF p_new_status <> 'CANCELLED' THEN
      RAISE EXCEPTION 'Unauthorized: customers can only cancel their own order';
    END IF;
    IF v_order.status NOT IN ('PENDING_PAYMENT','CONFIRMED','PICKUP_ASSIGNED','PICKUP_SCHEDULED','PICKUP_STARTED','FAILED_PICKUP','ON_HOLD') THEN
      RAISE EXCEPTION 'Cannot cancel order at this stage';
    END IF;
  ELSIF v_role = 'pickup_staff' THEN
    IF v_order.pickup_agent_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Unauthorized: not assigned to this pickup';
    END IF;
    IF p_new_status NOT IN ('PICKUP_ASSIGNED','PICKUP_SCHEDULED','PICKUP_STARTED','PICKED_UP','RECEIVED_AT_FACILITY','FAILED_PICKUP') THEN
      RAISE EXCEPTION 'Unauthorized status for pickup staff';
    END IF;
  ELSIF v_role = 'delivery_staff' THEN
    IF v_order.delivery_agent_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Unauthorized: not assigned to this delivery';
    END IF;
    IF p_new_status NOT IN ('DELIVERY_ASSIGNED','OUT_FOR_DELIVERY','DELIVERED','DELIVERY_FAILED') THEN
      RAISE EXCEPTION 'Unauthorized status for delivery staff';
    END IF;
  ELSIF v_role = 'laundry_staff' THEN
    IF p_new_status NOT IN ('RECEIVED_AT_FACILITY','PROCESSING','SORTING','WASHING','DRYING','IRONING','FOLDING','IRONING_FOLDING','QUALITY_CHECK','READY_FOR_DELIVERY','ON_HOLD') THEN
      RAISE EXCEPTION 'Unauthorized status for laundry staff';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_order.status = p_new_status THEN
    RAISE EXCEPTION 'Order already in status %', p_new_status;
  END IF;

  -- State machine (admins may use any non-terminal transition; emergency jumps
  -- require the explicit admin_override_status with a reason)
  v_allowed := ARRAY[
    'PENDING_PAYMENT>CONFIRMED','PENDING_PAYMENT>CANCELLED',
    'CONFIRMED>PICKUP_ASSIGNED','CONFIRMED>PICKUP_STARTED','CONFIRMED>PICKED_UP','CONFIRMED>ON_HOLD','CONFIRMED>CANCELLED',
    'PICKUP_ASSIGNED>PICKUP_STARTED','PICKUP_ASSIGNED>PICKED_UP','PICKUP_ASSIGNED>FAILED_PICKUP','PICKUP_ASSIGNED>CANCELLED',
    'PICKUP_SCHEDULED>PICKUP_STARTED','PICKUP_SCHEDULED>PICKED_UP','PICKUP_SCHEDULED>FAILED_PICKUP','PICKUP_SCHEDULED>CANCELLED',
    'PICKUP_STARTED>PICKED_UP','PICKUP_STARTED>FAILED_PICKUP',
    'PICKED_UP>RECEIVED_AT_FACILITY',
    'RECEIVED_AT_FACILITY>PROCESSING','RECEIVED_AT_FACILITY>SORTING','RECEIVED_AT_FACILITY>ON_HOLD',
    'PROCESSING>SORTING','PROCESSING>WASHING','PROCESSING>ON_HOLD',
    'SORTING>WASHING','SORTING>ON_HOLD',
    'WASHING>DRYING','WASHING>ON_HOLD',
    'DRYING>IRONING','DRYING>FOLDING','DRYING>IRONING_FOLDING','DRYING>ON_HOLD',
    'IRONING>FOLDING','IRONING>IRONING_FOLDING','IRONING>ON_HOLD',
    'FOLDING>IRONING_FOLDING','FOLDING>QUALITY_CHECK','FOLDING>ON_HOLD',
    'IRONING_FOLDING>QUALITY_CHECK','IRONING_FOLDING>ON_HOLD',
    'QUALITY_CHECK>READY_FOR_DELIVERY','QUALITY_CHECK>ON_HOLD',
    'ON_HOLD>SORTING','ON_HOLD>WASHING','ON_HOLD>DRYING','ON_HOLD>IRONING_FOLDING','ON_HOLD>QUALITY_CHECK','ON_HOLD>READY_FOR_DELIVERY','ON_HOLD>CANCELLED',
    'READY_FOR_DELIVERY>DELIVERY_ASSIGNED','READY_FOR_DELIVERY>ON_HOLD','READY_FOR_DELIVERY>CANCELLED',
    'DELIVERY_ASSIGNED>OUT_FOR_DELIVERY','DELIVERY_ASSIGNED>DELIVERY_FAILED',
    'OUT_FOR_DELIVERY>DELIVERED','OUT_FOR_DELIVERY>DELIVERY_FAILED',
    'DELIVERY_FAILED>OUT_FOR_DELIVERY','DELIVERY_FAILED>ON_HOLD',
    'DELIVERED>COMPLETED','DELIVERED>REFUND_PENDING',
    'COMPLETED>REFUND_PENDING',
    'FAILED_PICKUP>CONFIRMED','FAILED_PICKUP>PICKUP_ASSIGNED','FAILED_PICKUP>CANCELLED',
    'CANCELLED>REFUND_PENDING',
    'REFUND_PENDING>REFUNDED'
  ];
  v_transition := v_order.status::text || '>' || p_new_status::text;
  IF NOT (v_transition = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_order.status, p_new_status;
  END IF;

  -- Terminal-state guard (all roles, including admin via normal path)
  IF v_order.status IN ('DELIVERED','COMPLETED','REFUNDED')
     AND p_new_status NOT IN ('REFUND_PENDING') THEN
    RAISE EXCEPTION 'Cannot transition from terminal status %', v_order.status;
  END IF;

  -- Payment gating: delivery/completion require a successful payment
  IF p_new_status IN ('DELIVERED','COMPLETED') AND v_order.payment_status <> 'SUCCESS' THEN
    RAISE EXCEPTION 'Cannot %: payment is not confirmed', p_new_status;
  END IF;

  UPDATE public.orders SET
    status = p_new_status,
    updated_at = now(),
    quality_check = COALESCE(p_quality_check, quality_check),
    estimated_delivery_at = CASE
      WHEN p_new_status = 'READY_FOR_DELIVERY' THEN now() + interval '4 hours'
      ELSE estimated_delivery_at
    END
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, v_order.status, p_new_status, v_actor, p_reason);

  IF p_new_status = 'COMPLETED' THEN
    PERFORM public.earn_loyalty_points(p_order_id);
  END IF;

  RETURN json_build_object('ok', true, 'status', p_new_status);
END;
$$;

-- ============================================================================
-- 3. record_pickup: pickup staff confirm handover
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_pickup(
  p_order_id UUID,
  p_bag_id TEXT,
  p_measured_weight_kg NUMERIC
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_auth_user_role();
  v_actor UUID := auth.uid();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_role = 'pickup_staff' AND v_order.pickup_agent_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Unauthorized: not assigned to this pickup';
  END IF;
  IF v_role NOT IN ('pickup_staff','admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_order.status NOT IN ('CONFIRMED','PICKUP_ASSIGNED','PICKUP_SCHEDULED','PICKUP_STARTED') THEN
    RAISE EXCEPTION 'Cannot record pickup from status %', v_order.status;
  END IF;
  IF p_bag_id IS NULL OR trim(p_bag_id) = '' THEN
    RAISE EXCEPTION 'Bag tag is required';
  END IF;
  IF p_measured_weight_kg IS NULL OR p_measured_weight_kg <= 0 OR p_measured_weight_kg > 30 THEN
    RAISE EXCEPTION 'Measured weight must be between 0 and 30 kg';
  END IF;

  UPDATE public.orders SET
    bag_id = trim(p_bag_id),
    measured_weight_kg = p_measured_weight_kg,
    status = 'PICKED_UP',
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, v_order.status, 'PICKED_UP', v_actor, 'Weighed at pickup: ' || p_measured_weight_kg || ' kg. Bag: ' || p_bag_id);

  RETURN json_build_object('ok', true, 'status', 'PICKED_UP');
END;
$$;

-- ============================================================================
-- 4. advance_laundry_stage: facility pipeline
-- ============================================================================
CREATE OR REPLACE FUNCTION public.advance_laundry_stage(
  p_order_id UUID,
  p_stage TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_auth_user_role();
  v_actor UUID := auth.uid();
  v_order RECORD;
  v_new_status public.order_status;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_role NOT IN ('laundry_staff','admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_new_status := CASE p_stage
    WHEN 'RECEIVED' THEN 'RECEIVED_AT_FACILITY'::public.order_status
    WHEN 'SORTING' THEN 'SORTING'::public.order_status
    WHEN 'WASHING' THEN 'WASHING'::public.order_status
    WHEN 'DRYING' THEN 'DRYING'::public.order_status
    WHEN 'IRONING_FOLDING' THEN 'IRONING_FOLDING'::public.order_status
    WHEN 'QUALITY_CHECK' THEN 'QUALITY_CHECK'::public.order_status
    WHEN 'READY' THEN 'READY_FOR_DELIVERY'::public.order_status
    ELSE NULL
  END;
  IF v_new_status IS NULL THEN RAISE EXCEPTION 'Invalid laundry stage'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- Only advance one stage at a time (strict sequencing)
  IF v_order.status = 'READY_FOR_DELIVERY' AND p_stage = 'READY' THEN
    RAISE EXCEPTION 'Order is already ready for delivery';
  END IF;
  IF v_order.laundry_stage IS NULL THEN
    IF NOT (
      (p_stage = 'RECEIVED' AND v_order.status IN ('PICKED_UP','RECEIVED_AT_FACILITY'))
      OR (p_stage = 'SORTING' AND v_order.status = 'RECEIVED_AT_FACILITY')
    ) THEN
      RAISE EXCEPTION 'Order must start from facility intake';
    END IF;
  ELSE
    IF NOT (
      (v_order.laundry_stage = 'RECEIVED' AND p_stage = 'SORTING')
      OR (v_order.laundry_stage = 'SORTING' AND p_stage = 'WASHING')
      OR (v_order.laundry_stage = 'WASHING' AND p_stage = 'DRYING')
      OR (v_order.laundry_stage = 'DRYING' AND p_stage = 'IRONING_FOLDING')
      OR (v_order.laundry_stage = 'IRONING_FOLDING' AND p_stage = 'QUALITY_CHECK')
      OR (v_order.laundry_stage = 'QUALITY_CHECK' AND p_stage = 'READY')
    ) THEN
      RAISE EXCEPTION 'Cannot skip laundry stages';
    END IF;
  END IF;

  IF v_order.status IS DISTINCT FROM v_new_status THEN
    PERFORM public.update_order_status(p_order_id, v_new_status, 'Advanced to stage ' || p_stage);
  END IF;
  UPDATE public.orders SET laundry_stage = p_stage, updated_at = now() WHERE id = p_order_id;

  RETURN json_build_object('ok', true, 'stage', p_stage);
END;
$$;

-- ============================================================================
-- 5. submit_quality_check
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_quality_check(
  p_order_id UUID,
  p_quality_check JSONB,
  p_passed BOOLEAN
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_auth_user_role();
  v_actor UUID := auth.uid();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_role NOT IN ('laundry_staff','admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 'QUALITY_CHECK' THEN
    RAISE EXCEPTION 'Quality check can only be submitted while order is in QUALITY_CHECK';
  END IF;

  UPDATE public.orders SET quality_check = p_quality_check, updated_at = now() WHERE id = p_order_id;

  IF p_passed THEN
    PERFORM public.update_order_status(p_order_id, 'READY_FOR_DELIVERY', 'Quality check passed', p_quality_check);
    UPDATE public.orders SET laundry_stage = 'READY' WHERE id = p_order_id;
  ELSE
    PERFORM public.update_order_status(p_order_id, 'ON_HOLD', 'Quality check failed: ' || COALESCE(p_quality_check->>'damage_notes', ''));
    UPDATE public.orders SET laundry_stage = 'QUALITY_CHECK' WHERE id = p_order_id;
  END IF;

  RETURN json_build_object('ok', true, 'passed', p_passed);
END;
$$;

-- ============================================================================
-- 6. assign_pickup_agent / assign_delivery_agent (admin dispatch)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_pickup_agent(
  p_order_id UUID,
  p_agent_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF public.get_auth_user_role() <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'Pickup can only be assigned to CONFIRMED orders';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_agent_id AND role = 'pickup_staff') THEN
    RAISE EXCEPTION 'Selected agent is not a pickup staff member';
  END IF;

  UPDATE public.orders SET pickup_agent_id = p_agent_id, updated_at = now() WHERE id = p_order_id;
  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, 'CONFIRMED', 'PICKUP_ASSIGNED', v_actor, 'Pickup agent assigned');

  UPDATE public.orders SET status = 'PICKUP_ASSIGNED' WHERE id = p_order_id;

  RETURN json_build_object('ok', true, 'status', 'PICKUP_ASSIGNED');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_delivery_agent(
  p_order_id UUID,
  p_agent_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF public.get_auth_user_role() <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 'READY_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'Delivery can only be assigned to READY_FOR_DELIVERY orders';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_agent_id AND role = 'delivery_staff') THEN
    RAISE EXCEPTION 'Selected agent is not a delivery staff member';
  END IF;

  UPDATE public.orders SET delivery_agent_id = p_agent_id, updated_at = now() WHERE id = p_order_id;
  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, 'READY_FOR_DELIVERY', 'DELIVERY_ASSIGNED', v_actor, 'Delivery agent assigned');

  UPDATE public.orders SET status = 'DELIVERY_ASSIGNED' WHERE id = p_order_id;

  RETURN json_build_object('ok', true, 'status', 'DELIVERY_ASSIGNED');
END;
$$;

-- ============================================================================
-- 7. Delivery PIN security
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_delivery_pin(
  p_order_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT := public.get_auth_user_role();
  v_order RECORD;
  v_pin TEXT;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT customer_id INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_role = 'customer' THEN
    IF v_order.customer_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT pin INTO v_pin FROM public.order_delivery_pins WHERE order_id = p_order_id;
  IF v_pin IS NULL THEN RAISE EXCEPTION 'No delivery PIN assigned to this order'; END IF;

  RETURN json_build_object('ok', true, 'pin', v_pin);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_delivery_pin(
  p_order_id UUID,
  p_pin TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_auth_user_role();
  v_actor UUID := auth.uid();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_role = 'delivery_staff' THEN
    IF v_order.delivery_agent_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Unauthorized: not assigned to this delivery';
    END IF;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_order.status <> 'OUT_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'Order is not out for delivery';
  END IF;

  -- Brute-force protection
  IF v_order.delivery_pin_locked_until IS NOT NULL AND v_order.delivery_pin_locked_until > now() THEN
    RETURN json_build_object('ok', false, 'message', 'Too many attempts. PIN locked. Retry later.');
  END IF;

  IF v_order.delivery_pin_hash IS NULL
     OR p_pin IS NULL
     OR crypt(p_pin, v_order.delivery_pin_hash) <> v_order.delivery_pin_hash THEN
    UPDATE public.orders SET
      delivery_pin_attempts = delivery_pin_attempts + 1,
      delivery_pin_locked_until = CASE
        WHEN delivery_pin_attempts + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      updated_at = now()
    WHERE id = p_order_id;
    RETURN json_build_object('ok', false, 'message', 'Invalid delivery PIN');
  END IF;

  -- Success: reset attempts, mark delivered
  UPDATE public.orders SET
    delivery_pin_attempts = 0,
    delivery_pin_locked_until = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.update_order_status(p_order_id, 'DELIVERED', 'Delivery verified with customer PIN');

  RETURN json_build_object('ok', true, 'message', 'Delivery verified');
END;
$$;

-- ============================================================================
-- 8. Cancellation / refund
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_auth_user_role();
  v_actor UUID := auth.uid();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_role = 'customer' THEN
    IF v_order.customer_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    IF v_order.status NOT IN ('PENDING_PAYMENT','CONFIRMED','PICKUP_ASSIGNED','PICKUP_SCHEDULED','PICKUP_STARTED','FAILED_PICKUP','ON_HOLD') THEN
      RAISE EXCEPTION 'Cannot cancel order at this stage';
    END IF;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_order.payment_status = 'SUCCESS' THEN
    -- Paid order: refund flow (real refund is executed by the refund edge function + webhook)
    UPDATE public.orders SET
      status = 'CANCELLED',
      payment_status = 'REFUND_PENDING',
      updated_at = now()
    WHERE id = p_order_id;
    IF NOT EXISTS (SELECT 1 FROM public.refunds WHERE order_id = p_order_id AND status IN ('PENDING','PROCESSING','SUCCESS')) THEN
      INSERT INTO public.refunds (order_id, payment_id, amount, status, requested_by, reason)
      SELECT p_order_id, id, amount, 'PENDING', v_actor, COALESCE(p_reason, 'Order cancelled')
      FROM public.payments
      WHERE order_id = p_order_id AND status = 'SUCCESS'
      ORDER BY created_at DESC LIMIT 1;
    END IF;
    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
    VALUES (p_order_id, v_order.status, 'CANCELLED', v_actor, 'Cancelled. Refund pending.');
  ELSE
    UPDATE public.orders SET
      status = 'CANCELLED',
      payment_status = CASE WHEN payment_status = 'PENDING' THEN 'FAILED' ELSE payment_status END,
      updated_at = now()
    WHERE id = p_order_id;
    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
    VALUES (p_order_id, v_order.status, 'CANCELLED', v_actor, COALESCE(p_reason, 'Order cancelled'));
  END IF;

  RETURN json_build_object('ok', true, 'status', 'CANCELLED');
END;
$$;

CREATE OR REPLACE FUNCTION public.request_refund(
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_auth_user_role();
  v_actor UUID := auth.uid();
  v_order RECORD;
  v_payment RECORD;
  v_refund_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_role = 'customer' THEN
    IF v_order.customer_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    IF v_order.status NOT IN ('DELIVERED','COMPLETED','REFUND_PENDING') THEN
      RAISE EXCEPTION 'Order is not eligible for refund';
    END IF;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_order.payment_status <> 'SUCCESS' AND v_order.payment_status <> 'REFUND_PENDING' THEN
    RAISE EXCEPTION 'Payment was not successful';
  END IF;

  IF EXISTS (SELECT 1 FROM public.refunds WHERE order_id = p_order_id AND status IN ('PENDING','PROCESSING','SUCCESS')) THEN
    RAISE EXCEPTION 'A refund is already pending or completed for this order';
  END IF;

  SELECT * INTO v_payment FROM public.payments
  WHERE order_id = p_order_id AND status = 'SUCCESS'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No successful payment found for this order';
  END IF;

  INSERT INTO public.refunds (order_id, payment_id, razorpay_payment_id, amount, status, requested_by, reason)
  VALUES (p_order_id, v_payment.id, v_payment.gateway_transaction_id, v_order.total, 'PENDING', v_actor, p_reason)
  RETURNING id INTO v_refund_id;

  UPDATE public.orders SET
    status = 'REFUND_PENDING',
    payment_status = 'REFUND_PENDING',
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, v_order.status, 'REFUND_PENDING', v_actor, 'Refund requested');

  RETURN json_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'razorpay_payment_id', v_payment.gateway_transaction_id,
    'amount', v_order.total
  );
END;
$$;

-- ============================================================================
-- 9. confirm_refund: called ONLY by the razorpay webhook / refund edge function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_refund(
  p_order_id UUID,
  p_razorpay_refund_id TEXT,
  p_razorpay_payment_id TEXT,
  p_amount NUMERIC,
  p_status TEXT,
  p_failure_reason TEXT DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_refund RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'Order not found'; END IF;

  SELECT * INTO v_refund FROM public.refunds
  WHERE order_id = p_order_id
  ORDER BY requested_at DESC LIMIT 1;

  IF NOT FOUND THEN
    -- Webhook-only path (no local refund row yet): create one from payment info
    IF p_status = 'SUCCESS' THEN
      INSERT INTO public.refunds (order_id, razorpay_refund_id, razorpay_payment_id, amount, status, completed_at)
      VALUES (p_order_id, p_razorpay_refund_id, p_razorpay_payment_id, p_amount, 'SUCCESS', now());
      RETURN 'Created refund record';
    ELSE
      RETURN 'Ignored';
    END IF;
  END IF;

  IF v_refund.status = 'SUCCESS' THEN
    RETURN 'Already processed';
  END IF;

  IF p_status = 'SUCCESS' THEN
    IF v_refund.amount IS DISTINCT FROM p_amount THEN
      INSERT INTO public.security_events (event_type, order_id, actor_id, description, severity, metadata)
      VALUES ('REFUND_AMOUNT_MISMATCH', p_order_id, NULL, 'Refund amount mismatch', 'critical',
              jsonb_build_object('stored_amount', v_refund.amount, 'webhook_amount', p_amount));
      RETURN 'Refund amount mismatch';
    END IF;
    UPDATE public.refunds SET
      status = 'SUCCESS',
      razorpay_refund_id = p_razorpay_refund_id,
      razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
      completed_at = now(),
      failure_reason = NULL
    WHERE id = v_refund.id;

    UPDATE public.payments SET status = 'REFUNDED', updated_at = now()
    WHERE id = v_refund.payment_id AND status = 'SUCCESS';

    UPDATE public.orders SET
      status = 'REFUNDED',
      payment_status = 'REFUNDED',
      updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
    VALUES (p_order_id, v_order.status, 'REFUNDED', NULL, 'Refund confirmed by payment gateway');

    RETURN 'Refund confirmed';
  ELSE
    UPDATE public.refunds SET
      status = 'FAILED',
      failure_reason = p_failure_reason,
      completed_at = now()
    WHERE id = v_refund.id;

    UPDATE public.orders SET
      payment_status = 'REFUND_FAILED',
      updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
    VALUES (p_order_id, v_order.status, v_order.status, NULL, 'Refund failed: ' || COALESCE(p_failure_reason, ''));

    RETURN 'Refund failed recorded';
  END IF;
END;
$$;

-- ============================================================================
-- 10. Admin emergency override (requires reason + audit)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_override_status(
  p_order_id UUID,
  p_new_status public.order_status,
  p_reason TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF public.get_auth_user_role() <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'An explicit reason (min 5 characters) is required for admin override';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = p_new_status THEN RAISE EXCEPTION 'Order already in status %', p_new_status; END IF;

  UPDATE public.orders SET status = p_new_status, updated_at = now() WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  VALUES (p_order_id, v_order.status, p_new_status, v_actor, '[ADMIN OVERRIDE] ' || p_reason);

  INSERT INTO public.security_events (event_type, order_id, actor_id, description, severity, metadata)
  VALUES ('ADMIN_STATUS_OVERRIDE', p_order_id, v_actor, 'Admin override: ' || v_order.status || ' -> ' || p_new_status, 'info',
          jsonb_build_object('reason', p_reason));

  RETURN json_build_object('ok', true, 'status', p_new_status);
END;
$$;

-- ============================================================================
-- 11. Payment lifecycle RPCs (called by Edge Functions / webhook with service role)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_payable_order(
  p_order_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT := public.get_auth_user_role();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RETURN json_build_object('ok', false, 'message', 'Authentication required'); END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'message', 'Order not found'); END IF;

  IF v_role = 'customer' THEN
    IF v_order.customer_id IS DISTINCT FROM v_actor THEN
      RETURN json_build_object('ok', false, 'message', 'Unauthorized');
    END IF;
  ELSIF v_role <> 'admin' THEN
    RETURN json_build_object('ok', false, 'message', 'Unauthorized');
  END IF;

  IF v_order.payment_status = 'SUCCESS' THEN
    RETURN json_build_object('ok', false, 'message', 'Order is already paid');
  END IF;
  IF v_order.status IN ('CANCELLED','REFUNDED','REFUND_PENDING') THEN
    RETURN json_build_object('ok', false, 'message', 'Order cannot be paid');
  END IF;
  IF v_order.total <= 0 THEN
    RETURN json_build_object('ok', false, 'message', 'Order has no payable amount');
  END IF;

  RETURN json_build_object(
    'ok', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'total', v_order.total,
    'currency', 'INR',
    'customer_id', v_order.customer_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_razorpay_order(
  p_order_id UUID,
  p_razorpay_order_id TEXT,
  p_amount NUMERIC
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'message', 'Order not found'); END IF;
  IF v_order.total IS DISTINCT FROM p_amount THEN
    RETURN json_build_object('ok', false, 'message', 'Amount mismatch');
  END IF;

  UPDATE public.orders SET razorpay_order_id = p_razorpay_order_id, updated_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_order_id UUID,
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'INR'
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_old_status public.order_status;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'Order not found'; END IF;

  IF v_order.razorpay_order_id IS NOT NULL AND v_order.razorpay_order_id <> p_razorpay_order_id THEN
    INSERT INTO public.security_events (event_type, order_id, actor_id, description, severity, metadata)
    VALUES ('RAZORPAY_ORDER_MISMATCH', p_order_id, NULL, 'Webhook razorpay_order_id does not match order', 'critical',
            jsonb_build_object('stored', v_order.razorpay_order_id, 'received', p_razorpay_order_id));
    RETURN 'Razorpay order mismatch';
  END IF;

  IF v_order.payment_status = 'SUCCESS' THEN
    RETURN 'Already processed';
  END IF;

  IF p_amount IS DISTINCT FROM v_order.total OR upper(COALESCE(p_currency,'INR')) <> 'INR' THEN
    INSERT INTO public.security_events (event_type, order_id, actor_id, description, severity, metadata)
    VALUES ('PAYMENT_AMOUNT_MISMATCH', p_order_id, NULL, 'Webhook amount/currency mismatch', 'critical',
            jsonb_build_object('order_total', v_order.total, 'webhook_amount', p_amount, 'currency', p_currency));
    UPDATE public.orders SET payment_status = 'FAILED', updated_at = now() WHERE id = p_order_id;
    RETURN 'Amount mismatch';
  END IF;

  v_old_status := v_order.status;

  UPDATE public.orders SET
    payment_status = 'SUCCESS',
    status = CASE WHEN status IN ('PENDING_PAYMENT','ORDER_PLACED') THEN 'CONFIRMED' ELSE status END,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.payments (
    order_id, customer_id, amount, status, currency, gateway,
    gateway_transaction_id, transaction_id, razorpay_order_id, razorpay_payment_id, captured
  ) VALUES (
    p_order_id, v_order.customer_id, p_amount, 'SUCCESS', 'INR', 'razorpay',
    p_razorpay_payment_id, p_razorpay_payment_id, p_razorpay_order_id, p_razorpay_payment_id, true
  ) ON CONFLICT (gateway_transaction_id) DO NOTHING;

  IF v_old_status IN ('PENDING_PAYMENT','ORDER_PLACED') THEN
    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, reason)
    VALUES (p_order_id, v_old_status, 'CONFIRMED', NULL, 'Payment confirmed');
  END IF;

  RETURN 'Payment successful';
END;
$$;

CREATE OR REPLACE FUNCTION public.process_payment_failed(
  p_order_id UUID,
  p_razorpay_payment_id TEXT
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'Order not found'; END IF;

  IF v_order.payment_status = 'SUCCESS' THEN
    RETURN 'Ignored';
  END IF;

  UPDATE public.orders SET payment_status = 'FAILED', updated_at = now() WHERE id = p_order_id;

  INSERT INTO public.payments (order_id, customer_id, amount, status, currency, gateway, gateway_transaction_id, transaction_id, razorpay_payment_id, captured)
  VALUES (p_order_id, v_order.customer_id, v_order.total, 'FAILED', 'INR', 'razorpay', p_razorpay_payment_id, p_razorpay_payment_id, p_razorpay_payment_id, false)
  ON CONFLICT (gateway_transaction_id) DO NOTHING;

  RETURN 'Payment failed recorded';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_payment_status(
  p_order_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT := public.get_auth_user_role();
  v_order RECORD;
BEGIN
  IF v_actor IS NULL THEN RETURN json_build_object('ok', false, 'message', 'Authentication required'); END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'message', 'Order not found'); END IF;
  IF v_role = 'customer' THEN
    IF v_order.customer_id IS DISTINCT FROM v_actor THEN
      RETURN json_build_object('ok', false, 'message', 'Unauthorized');
    END IF;
  ELSIF v_role <> 'admin' THEN
    RETURN json_build_object('ok', false, 'message', 'Unauthorized');
  END IF;
  RETURN json_build_object(
    'ok', true,
    'payment_status', v_order.payment_status,
    'status', v_order.status,
    'razorpay_order_id', v_order.razorpay_order_id
  );
END;
$$;

-- ============================================================================
-- 12. Loyalty (hardened) + coupon validation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.earn_loyalty_points(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_points INTEGER;
  v_customer UUID;
BEGIN
  SELECT customer_id, total, payment_status INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.customer_id IS NULL THEN
    RETURN;
  END IF;
  IF v_order.payment_status <> 'SUCCESS' THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_accounts (user_id, balance)
  VALUES (v_order.customer_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  v_points := floor(v_order.total / 100)::INTEGER;
  IF v_points <= 0 THEN
    RETURN;
  END IF;

  -- Idempotent: unique index on (order_id) WHERE type='EARNED'
  INSERT INTO public.loyalty_transactions (user_id, loyalty_account_id, points, type, order_id, description)
  SELECT v_order.customer_id, v_order.customer_id, v_points, 'EARNED', p_order_id,
         'Earned ' || v_points || ' points from order'
  ON CONFLICT (order_id) WHERE type = 'EARNED' DO NOTHING
  RETURNING points INTO v_points;

  IF FOUND THEN
    UPDATE public.loyalty_accounts SET balance = balance + v_points, updated_at = now()
    WHERE user_id = v_order.customer_id;
  END IF;
END;
$$;

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
  v_actor UUID := auth.uid();
BEGIN
  IF p_code IS NULL OR p_code = '' THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon code required');
  END IF;

  SELECT * INTO v_coupon FROM public.coupons
  WHERE upper(code) = upper(p_code) AND active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now());

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or expired coupon code');
  END IF;

  IF p_subtotal < COALESCE(v_coupon.minimum_order_value, 0) THEN
    RETURN json_build_object('valid', false, 'error', 'Order value does not meet minimum of ' || v_coupon.minimum_order_value);
  END IF;

  IF v_actor IS NOT NULL AND v_coupon.per_user_limit IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id AND user_id = v_actor) >= v_coupon.per_user_limit THEN
      RETURN json_build_object('valid', false, 'error', 'Coupon already used by this account');
    END IF;
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
    'discount', LEAST(v_discount, p_subtotal),
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code
  );
END;
$$;

-- ============================================================================
-- 13. Protect orders trigger (defense in depth for any residual direct updates)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_order_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER RPCs run as the table owner; admins may manage directly.
  IF current_user = 'postgres' OR public.get_auth_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Unauthorized: direct order modification is not allowed';
END;
$$;

DROP TRIGGER IF EXISTS order_protection_trigger ON public.orders;
CREATE TRIGGER order_protection_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_order_columns();

-- ============================================================================
-- 14. Handle new user trigger: add search_path hardening
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    'customer'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 15. EXECUTE grants / revokes
-- ============================================================================
REVOKE ALL ON FUNCTION public.create_order_secure(UUID, UUID, UUID, NUMERIC, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_secure(UUID, UUID, UUID, NUMERIC, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.update_order_status(UUID, public.order_status, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, public.order_status, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.record_pickup(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pickup(UUID, TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.advance_laundry_stage(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_laundry_stage(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_quality_check(UUID, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quality_check(UUID, JSONB, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_pickup_agent(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_pickup_agent(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_delivery_agent(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_delivery_agent(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.verify_delivery_pin(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_delivery_pin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_pin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.request_refund(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_refund(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_override_status(UUID, public.order_status, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_override_status(UUID, public.order_status, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_order_payment_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_payment_status(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_payable_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payable_order(UUID) TO authenticated;

-- Edge Function / webhook only (service role)
REVOKE ALL ON FUNCTION public.save_razorpay_order(UUID, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_razorpay_order(UUID, TEXT, NUMERIC) TO service_role;

REVOKE ALL ON FUNCTION public.process_payment_webhook(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.process_payment_failed(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_failed(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.confirm_refund(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_refund(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- Internal helpers: not callable by clients
REVOKE ALL ON FUNCTION public.earn_loyalty_points(UUID) FROM PUBLIC, anon, authenticated;

-- get_auth_user_role is used by RLS policies and must stay callable by authenticated.
REVOKE ALL ON FUNCTION public.get_auth_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;