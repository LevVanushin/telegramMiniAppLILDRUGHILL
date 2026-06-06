import { createClient } from '@supabase/supabase-js'

// Данные из настроек проекта Supabase (Project Settings → API)
const supabaseUrl = "https://hgswdnzhjsejqonxckgt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnc3dkbnpoanNlanFvbnhja2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIxNjA3MiwiZXhwIjoyMDk1NzkyMDcyfQ.DJkaC4rKJT1KttHifSfmH20frimEGqAZFpm1wEdVb1k";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);