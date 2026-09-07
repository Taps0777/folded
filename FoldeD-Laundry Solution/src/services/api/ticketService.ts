import { supabase } from '../../lib/supabase';
import type { SupportTicket } from '../../types';

export const ticketService = {
  async getAllTickets(): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((t: any) => {
      const parts = (t.description || '').split('[RESOLUTION]:');
      return {
        ...t,
        user_id: t.customer_id || '',
        message: parts[0].trim(),
        resolution: parts.length > 1 ? parts[1].trim() : undefined,
      };
    });
  },

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((t: any) => {
      const parts = (t.description || '').split('[RESOLUTION]:');
      return {
        ...t,
        user_id: t.customer_id || '',
        message: parts[0].trim(),
        resolution: parts.length > 1 ? parts[1].trim() : undefined,
      };
    });
  },

  async createTicket(ticketData: { user_id: string; subject: string; message: string; category: string; order_id?: string }): Promise<SupportTicket> {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        customer_id: ticketData.user_id,
        subject: ticketData.subject,
        description: ticketData.message,
        category: ticketData.category,
        order_id: ticketData.order_id || null,
        status: 'open'
      } as any)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      user_id: data.customer_id || '',
      message: data.description || '',
      order_id: data.order_id || undefined,
    } as unknown as SupportTicket;
  },

  async resolveTicket(ticketId: string, resolution: string): Promise<SupportTicket> {
    // Fetch current ticket to append resolution
    const { data: current } = await supabase.from('support_tickets').select('description').eq('id', ticketId).single();
    
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        status: 'resolved',
        description: current?.description ? `${current.description}\n\n[RESOLUTION]: ${resolution}` : `[RESOLUTION]: ${resolution}`
      } as any)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      user_id: data.customer_id || '',
      message: data.description || '',
      resolution,
      order_id: data.order_id || undefined,
    } as unknown as SupportTicket;
  }
};
