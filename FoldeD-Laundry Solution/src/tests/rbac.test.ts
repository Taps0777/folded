import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const customer1Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const customer2Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let customer1User: any = null;
let customer2User: any = null;

describe('RBAC Security Tests', () => {
  beforeAll(async () => {
    // 1. Register test users
    const email1 = `test_c1_${Date.now()}@example.com`;
    const pwd = 'TestPassword123!';
    const res1 = await customer1Client.auth.signUp({
      email: email1,
      password: pwd,
      options: { data: { full_name: 'Customer 1' } }
    });
    if (res1.error) console.error('Sign up error 1:', res1.error);
    customer1User = res1.data.user;

    const email2 = `test_c2_${Date.now()}@example.com`;
    const res2 = await customer2Client.auth.signUp({
      email: email2,
      password: pwd,
      options: { data: { full_name: 'Customer 2' } }
    });
    if (res2.error) console.error('Sign up error 2:', res2.error);
    customer2User = res2.data.user;
  });

  it('Customer 1 should be able to read their own profile', async () => {
    expect(customer1User).not.toBeNull();
    const { data, error } = await customer1Client.from('profiles').select('*').eq('id', customer1User.id).single();
    expect(error).toBeNull();
    expect(data.id).toBe(customer1User.id);
  });

  it('Customer 1 should NOT be able to read Customer 2 profile', async () => {
    expect(customer2User).not.toBeNull();
    const { data } = await customer1Client.from('profiles').select('*').eq('id', customer2User.id).maybeSingle();
    // Due to RLS, no rows returned is standard, or an error.
    expect(data).toBeNull();
  });

  it('Anonymous client should NOT be able to read any profiles', async () => {
    const { data } = await supabaseAnon.from('profiles').select('*').limit(1);
    expect(data?.length).toBe(0);
  });
});

