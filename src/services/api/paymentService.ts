import { supabase } from '../../lib/supabase';
import type { PaymentStatusResult } from '../../types';

// Minimal shape of the Razorpay checkout global (checkout.js). Declared locally
// so the constructor/call sites typecheck without pulling in @types/razorpay.
interface RazorpayFailureResponse {
  error?: { description?: string };
}
interface RazorpayInstance {
  on(event: string, handler: (response: unknown) => void): void;
  open(): void;
}
interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}
type WindowWithRazorpay = Window & { Razorpay?: RazorpayConstructor };

// Helper to dynamically load the Razorpay checkout script.
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as WindowWithRazorpay).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface PaymentAttemptResult {
  attempt: 'completed' | 'dismissed' | 'failed';
  razorpayPaymentId?: string;
  message: string;
}

// Polls the database for the server-confirmed payment state.
// Frontend checkout success is NOT treated as final payment confirmation;
// only the webhook-driven database state is authoritative.
export async function pollPaymentStatus(
  orderId: string,
  attempts = 10,
  intervalMs = 2000
): Promise<PaymentStatusResult> {
  for (let i = 0; i < attempts; i += 1) {
    const result = await orderStatus(orderId);
    if (result.ok && (result.payment_status === 'SUCCESS' || result.payment_status === 'FAILED')) {
      return result;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: true, payment_status: 'PENDING', status: 'PENDING_PAYMENT' };
}

async function orderStatus(orderId: string): Promise<PaymentStatusResult> {
  const { data, error } = await supabase.rpc('get_order_payment_status', {
    p_order_id: orderId,
  });
  if (error) throw error;
  return (data as unknown as PaymentStatusResult) ?? { ok: false, message: 'Unable to load payment status' };
}

export const paymentService = {
  /**
   * Initializes Razorpay checkout for an INTERNAL order.
   * Only the internal order_id is sent to the Edge Function — the amount is
   * read from the database server-side. The browser can never alter the amount.
   */
  async processRazorpayPayment(
    orderId: string,
    customerInfo: { name: string; email: string; phone: string }
  ): Promise<PaymentAttemptResult> {
    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      return { attempt: 'failed', message: 'Payment gateway failed to load. Are you online?' };
    }

    try {
      const { data: checkout, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { order_id: orderId },
      });

      if (error || !checkout?.id || !checkout?.key_id) {
        const message = error?.message || checkout?.error || 'Unable to start payment';
        return { attempt: 'failed', message };
      }

      return new Promise((resolve) => {
        const options: Record<string, unknown> = {
          key: checkout.key_id,
          amount: checkout.amount,
          currency: checkout.currency || 'INR',
          name: 'FoldeD Laundry',
          description: `Payment for Order`,
          order_id: checkout.id,
          handler: function (response: Record<string, unknown>) {
            // Payment attempt completed. The webhook confirms the payment in
            // the database. Report attempt success; final state is polled.
            resolve({
              attempt: 'completed',
              razorpayPaymentId: String(response.razorpay_payment_id || ''),
              message: 'Payment processing. Please wait for confirmation.',
            });
          },
          prefill: {
            name: customerInfo.name,
            email: customerInfo.email,
            contact: customerInfo.phone,
          },
          theme: { color: '#0f172a' },
          modal: {
            ondismiss: () => resolve({ attempt: 'dismissed', message: 'Payment window closed' }),
          },
        };

        const RazorpayCtor = (window as WindowWithRazorpay).Razorpay;
        if (!RazorpayCtor) {
          resolve({ attempt: 'failed', message: 'Payment gateway unavailable' });
          return;
        }
        const rzp = new RazorpayCtor(options);
        rzp.on('payment.failed', (response: unknown) => {
          const description =
            (response as RazorpayFailureResponse)?.error?.description ||
            'Payment could not be completed';
          resolve({ attempt: 'failed', message: String(description) });
        });

        rzp.open();
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment could not be completed';
      return { attempt: 'failed', message };
    }
  },

  pollPaymentStatus,
  getPaymentStatus: orderStatus,
};