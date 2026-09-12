-- 0007_schema_and_rpc_fixes.sql
-- 1. Fix handle_new_user trigger function to treat empty phone string as NULL (prevents unique constraint collision on signups)
UPDATE public.profiles SET phone = NULL WHERE phone = '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add missing enum values to order_status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ORDER_PLACED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PICKUP_STARTED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'SORTING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IRONING_FOLDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- 3. Resilient date parsing and safe coupon handling in create_order_secure
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

  -- Calculate Subtotal
  v_subtotal := v_service.base_price * p_weight_kg;

  -- 2. Delivery & Express Fees
  IF v_subtotal < 199 THEN
    v_delivery_fee := 40;
  END IF;

  IF p_is_express THEN
    v_express_fee := 100;
  END IF;

  -- 3. Validate Coupon
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
      END IF;
    END IF;
  END IF;

  -- 4. Calculate Final Total
  v_total := GREATEST(0, v_subtotal + v_delivery_fee + v_express_fee - v_discount);

  -- 5. Generate Order Number & PIN
  v_order_number := 'ORD-' || to_char(now(), 'YYMMDDHH24MISS');
  v_delivery_pin := floor(random() * 9000 + 1000)::text;

  -- Flexible date parsing
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

  -- 6. Insert Order
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

  -- 7. Insert Order Item
  INSERT INTO order_items (order_id, quantity, unit_price, total_price)
  VALUES (v_order_id, 1, v_service.base_price, v_subtotal);

  -- 8. Log History
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
