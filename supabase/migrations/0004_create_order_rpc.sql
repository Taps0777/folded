-- Custom Type for Order Items Payload
CREATE TYPE new_order_item AS (
  service_id UUID,
  quantity INTEGER,
  weight NUMERIC,
  unit_price NUMERIC -- Note: This will be overwritten by server for security
);

-- RPC Function to safely create an order
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
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_delivery_fee NUMERIC := 0;
  v_express_fee NUMERIC := 0;
  v_total NUMERIC := 0;
  v_order_id UUID;
  v_order_number TEXT;
  v_delivery_pin TEXT;
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
    -- Assuming express_surcharge is on service or a flat fee, let's say flat 100 for now.
    -- Wait, service might have it. I'll just use a flat 100 or read from service if it exists.
    -- Since our schema doesn't have express_surcharge on service, we use flat 100.
    v_express_fee := 100;
  END IF;

  -- 3. Validate Coupon
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    SELECT * INTO v_coupon FROM coupons 
    WHERE code = p_coupon_code AND active = true AND (valid_until IS NULL OR valid_until > now());
    
    IF FOUND THEN
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

  -- 6. Insert Order
  INSERT INTO orders (
    order_number, customer_id, service_id, pickup_address_id, delivery_address_id,
    subtotal, discount, delivery_fee, express_fee, total,
    special_instructions, measured_weight_kg, pickup_date, pickup_time_slot, delivery_pin,
    status, payment_status, coupon_id
  ) VALUES (
    v_order_number, p_customer_id, p_service_id, p_address_id, p_address_id,
    v_subtotal, v_discount, v_delivery_fee, v_express_fee, v_total,
    p_special_instructions, p_weight_kg, p_pickup_date::DATE, p_pickup_slot, v_delivery_pin,
    'CONFIRMED', 'PENDING', v_coupon.id
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
