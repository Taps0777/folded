import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';

export const authService = {
  async getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
    
    // If no profile exists yet, return a default mapped from user (could happen during initial signup)
    if (!data) {
       return {
         id: session.user.id,
         email: session.user.email || '',
         full_name: session.user.user_metadata?.full_name || 'New User',
         phone: session.user.phone || '',
         role: 'customer'
       };
    }
    
    return data as unknown as Profile;
  },

  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string, fullName: string, phone: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        }
      }
    });
    
    if (error) throw error;
    
    // Auto sign in to guarantee active session immediately
    try {
      await this.signInWithEmail(email, password);
    } catch {
      // Ignored if session was already created
    }

    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
};
