import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { clearCsrfToken, generateCsrfToken } from '@/lib/csrf';

type User = Tables<'users'>;

interface UserContextType {
  user: User | null;
  authUser: SupabaseUser | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  authUser: null,
  loading: true,
  setUser: () => {},
  refreshUser: async () => {},
  signOut: async () => {},
  signIn: async () => {},
  signUp: async () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async (supabaseAuthUser: SupabaseUser | null) => {
    if (!supabaseAuthUser) {
      setAuthUser(null);
      setUser(null);
      setLoading(false);
      return;
    }

    setAuthUser(supabaseAuthUser);

    try {
      // Load user profile from database using auth_user_id
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', supabaseAuthUser.id)
        .maybeSingle();
      
      if (data && !error) {
        setUser(data);
      } else if (error) {
        console.error('Error loading user profile:', error);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
    if (currentAuthUser) {
      await loadUser(currentAuthUser);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });
      
      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // The trigger will automatically create the user profile
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Load the user profile
      await loadUser(authData.user);
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('Login failed');
      }
      
      await loadUser(authData.user);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    // Clear CSRF token on sign out for security
    clearCsrfToken();
    await supabase.auth.signOut();
    setUser(null);
    setAuthUser(null);
  };

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user);
        // Generate CSRF token on session restore
        generateCsrfToken();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user);
        // Generate CSRF token on sign in
        generateCsrfToken();
      } else {
        setUser(null);
        setAuthUser(null);
        // Clear CSRF token on sign out
        clearCsrfToken();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, authUser, loading, setUser, refreshUser, signOut, signIn, signUp }}>
      {children}
    </UserContext.Provider>
  );
};
