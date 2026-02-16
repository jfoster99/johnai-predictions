import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { User as AuthUser } from '@supabase/supabase-js';

type User = Tables<'users'>;

interface UserContextType {
  user: User | null;
  authUser: AuthUser | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  authUser: null,
  loading: true,
  setUser: () => {},
  refreshUser: async () => {},
  signOut: async () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      // Get current auth session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setAuthUser(session.user);
        
        // Load user profile using auth_user_id
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        
        if (data) {
          setUser(data);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (authUser) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (data) setUser(data);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthUser(null);
  };

  useEffect(() => {
    loadUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthUser(session.user);
        // Load user profile
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        if (data) setUser(data);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAuthUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, authUser, loading, setUser, refreshUser, signOut }}>
      {children}
    </UserContext.Provider>
  );
};
