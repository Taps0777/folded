import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { 
  INITIAL_SERVICES, 
  INITIAL_SERVICE_AREAS, 
  INITIAL_TICKETS 
} from '../services/mockData';

// Load env vars
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
  console.log('Seeding data to Supabase...');

  // Seed Services
  if (INITIAL_SERVICES.length > 0) {
    const servicesToInsert = INITIAL_SERVICES.map(s => ({
      id: s.id, // if DB allows inserting UUID or string IDs
      name: s.name,
      description: s.description,
      pricing_type: s.pricing_type.toUpperCase(),
      base_price: s.base_price,
      price_per_kg: s.pricing_type === 'per_kg' ? s.base_price : 0,
      estimated_processing_hours: s.turnaround_hours,
      active: true,
      category: s.category
    }));
    const { error } = await supabase.from('services').upsert(servicesToInsert, { onConflict: 'id' });
    if (error) console.error('Error seeding services:', error.message);
    else console.log('✅ Services seeded');
  }

  // Seed Service Areas
  if (INITIAL_SERVICE_AREAS.length > 0) {
    const areasToInsert = INITIAL_SERVICE_AREAS.map(a => ({
      pincode: a.postal_code,
      city: a.city,
      area_name: a.area_name,
      is_active: a.is_active !== false
    }));
    const { error } = await supabase.from('service_areas').upsert(areasToInsert, { onConflict: 'pincode' });
    if (error) console.error('Error seeding service areas:', error.message);
    else console.log('✅ Service Areas seeded');
  }

  // Seed Support Tickets (Just as demo)
  if (INITIAL_TICKETS.length > 0) {
    const ticketsToInsert = INITIAL_TICKETS.map(t => ({
      id: t.id,
      customer_id: t.user_id,
      order_id: t.order_id,
      subject: t.subject,
      category: t.category,
      description: t.message + (t.resolution ? `\n\n[RESOLUTION]: ${t.resolution}` : ''),
      status: t.status,
      priority: t.priority,
    }));
    const { error } = await supabase.from('support_tickets').upsert(ticketsToInsert, { onConflict: 'id' });
    if (error) console.error('Error seeding support tickets:', error.message);
    else console.log('✅ Support Tickets seeded');
  }

  console.log('Seeding complete.');
}

seedData().catch(console.error);
