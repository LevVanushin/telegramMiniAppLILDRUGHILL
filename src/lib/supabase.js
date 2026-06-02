import { createClient } from '@supabase/supabase-js'

// Данные из настроек проекта Supabase (Project Settings → API)
const supabaseUrl = "https://hgswdnzhjsejqonxckgt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnc3dkbnpoanNlanFvbnhja2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTYwNzIsImV4cCI6MjA5NTc5MjA3Mn0.8m-MyDmXVuDcaaCaluQUCvxtGzc0IOb_5pZmwrR1OnY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);