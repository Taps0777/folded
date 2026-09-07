import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// To deploy: supabase functions deploy razorpay-webhook

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Basic crypto implementation for webhook signature verification since standard Node crypto isn't available in Deno without imports
import { hmac } from "https://deno.land/x/crypto@v0.10.0/hmac.ts";

serve(async (req) => {
  try {
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      throw new Error('No signature found');
    }
    
    if (!RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('Webhook secret not configured');
    }

    const payloadText = await req.text();

    // Verify signature using Deno crypto
    const expectedSignature = hmac(
      "sha256",
      RAZORPAY_WEBHOOK_SECRET,
      payloadText,
      "utf8",
      "hex"
    );

    if (expectedSignature !== signature) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(payloadText);
    const event = payload.event;

    if (event === 'payment.captured') {
      const paymentData = payload.payload.payment.entity;
      
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Call our secure RPC to update the payment status, which handles row locking and idempotency
      const { data, error } = await supabase.rpc('process_payment_webhook', {
        p_transaction_id: paymentData.id,
        p_order_id: paymentData.notes.order_id, // assuming we pass order_id in notes
        p_amount: paymentData.amount / 100 // convert back to INR
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
