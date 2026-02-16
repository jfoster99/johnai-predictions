import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type User = Tables<'users'>;

interface UserContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  signIn: (displayName: string) => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  refreshUser: async () => {},
  signOut: async () => {},
  signIn: async () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      // Check if we have a user ID stored locally
      const storedUserId = localStorage.getItem('johnai_user_id');
      
      if (storedUserId) {
        // Load user from database
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', storedUserId)
          .maybeSingle();
        
        if (data && !error) {
          setUser(data);
        } else {
          // User doesn't exist anymore, clear storage
          localStorage.removeItem('johnai_user_id');
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setUser(data);
    }
  };

  const signIn = async (displayName: string) => {
    try {
      // Create a new user
      const { data, error } = await supabase
        .from('users')
        .insert({ display_name: displayName })
        .select()
        .single();
      
      if (error) throw error;
      
      if (data) {
        setUser(data);
        localStorage.setItem('johnai_user_id', data.id);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('johnai_user_id');
    setUser(null);
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, setUser, refreshUser, signOut, signIn }}>
      {children}
    </UserContext.Provider>
  );
};
