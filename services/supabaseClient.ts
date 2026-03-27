import { createClient } from '@supabase/supabase-js';

// These should ideally be in environment variables, but for simplicity we'll hardcode them as requested
const supabaseUrl = 'https://kredybxpmjpcklksglcx.supabase.co';
const supabaseAnonKey = 'sb_publishable_hBg8W_Jk0zrsbSL1nQgF8g_NI9sv4Y3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
