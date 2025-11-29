import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cylycthijpudcczhleqq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bHljdGhpanB1ZGNjemhsZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTIxNDQsImV4cCI6MjA3OTk2ODE0NH0.7DbBB4TEHo-sM8atZVNrYlCcd9WyJxD7WhG1sH_9hwI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

