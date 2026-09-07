-- Insert Service Areas
INSERT INTO service_areas (pincode, city, area_name, delivery_radius_km, is_pickup_available, is_delivery_available, is_active) VALUES
('560001', 'Bengaluru', 'MG Road & Brigade', 5.0, true, true, true),
('560034', 'Bengaluru', 'Koramangala', 4.5, true, true, true),
('560038', 'Bengaluru', 'Indiranagar', 5.0, true, true, true),
('560102', 'Bengaluru', 'HSR Layout', 6.0, true, true, true)
ON CONFLICT (pincode) DO NOTHING;

-- Insert Services
INSERT INTO services (name, description, pricing_type, base_price, price_per_kg, estimated_processing_hours, active) VALUES
('Premium Wash & Fold', 'Everyday garments washed with eco-friendly detergents, tumble dried, and perfectly folded.', 'PER_KG', 89, 89, 24, true),
('Wash & Iron', 'Wash, dry, and crisp steam ironing for a sharp everyday look.', 'PER_KG', 129, 129, 48, true),
('Dry Cleaning', 'Specialized solvent cleaning for delicate fabrics, suits, and silk.', 'PER_ITEM', 249, 0, 72, true),
('Steam Press Only', 'Professional steam ironing without washing.', 'PER_ITEM', 29, 0, 24, true)
ON CONFLICT DO NOTHING;

-- Insert Items (for Dry Cleaning / Steam Press)
-- Assuming we get the service IDs from the insert above. We can just use nested selects.
INSERT INTO items (service_id, name, category, price, active) 
SELECT id, 'Men''s Suit (2 Piece)', 'Formal', 399, true FROM services WHERE name = 'Dry Cleaning'
ON CONFLICT DO NOTHING;

INSERT INTO items (service_id, name, category, price, active) 
SELECT id, 'Silk Saree', 'Ethnic', 299, true FROM services WHERE name = 'Dry Cleaning'
ON CONFLICT DO NOTHING;

INSERT INTO items (service_id, name, category, price, active) 
SELECT id, 'Cotton Shirt', 'Everyday', 29, true FROM services WHERE name = 'Steam Press Only'
ON CONFLICT DO NOTHING;
