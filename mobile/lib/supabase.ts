import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = "https://jstojewashwoswsskwjk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdG9qZXdhc2h3b3N3c3Nrd2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTg2OTAsImV4cCI6MjA5MzkzNDY5MH0.o3hYxYr1ZbmEShPfZebx1vchjmIrN7uYZMX1C5fhoac";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
