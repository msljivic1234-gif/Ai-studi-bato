
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { readPublicSupabaseConfig } from './publicSupabaseConfig';

let klijent: SupabaseClient | null = null;


export function supabaseKonfigurisan(): boolean {
  return readPublicSupabaseConfig() !== null;
}

export function supabaseKlijent(): SupabaseClient {
  if (klijent) return klijent;

  const config = readPublicSupabaseConfig();
  if (!config) throw new Error('SUPABASE_CONFIGURATION_INVALID');

  klijent = createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  
  return klijent;
}

// React Native requires telling Supabase Auth when the app comes to foreground or goes to background
// to properly manage the token refresh timers.
AppState.addEventListener('change', (state) => {
  if (!klijent) return;
  if (state === 'active') {
    klijent.auth.startAutoRefresh();
  } else {
    klijent.auth.stopAutoRefresh();
  }
});


/** Recovery must not sign another account into the marketplace or consume its pending intent. */
export function createRecoveryTransport() {
  const config = readPublicSupabaseConfig();
  if (!config) throw new Error('SUPABASE_CONFIGURATION_INVALID');
  const controller = new AbortController();
  const recovery = createClient(config.url, config.anonKey, {
    auth: {
      storageKey: 'uskoci-password-recovery',
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, options) => fetch(input, { ...options, signal: controller.signal }),
    },
  });
  return { auth: recovery.auth, dispose: () => controller.abort() };
}
