import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase가 올바르게 설정되었는지 확인
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  supabaseUrl.trim() !== '' && 
  !supabaseUrl.includes('your-project-id') &&
  !!supabaseAnonKey && 
  supabaseAnonKey.trim() !== '' && 
  !supabaseAnonKey.includes('your-anon-key') &&
  localStorage.getItem('wii_force_sandbox') !== 'true';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase environment variables are not configured. The app will automatically run in local storage simulation mode.'
  );
}
