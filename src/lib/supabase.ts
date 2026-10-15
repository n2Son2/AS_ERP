import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://deszcifyqnorfcdqwwfa.supabase.co';
const DEFAULT_KEY = 'sb_publishable_iqw0LYLuvb9Vk5AJiFsYuA_7WrFMMkF';

export const getSupabaseConfig = () => {
  const url = localStorage.getItem('SUPABASE_URL') || DEFAULT_URL;
  const key = localStorage.getItem('SUPABASE_KEY') || DEFAULT_KEY;
  return { url, key };
};

export const createSupabaseClient = () => {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key);
};

export const supabase = createSupabaseClient();
