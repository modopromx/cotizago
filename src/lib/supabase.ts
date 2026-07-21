import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Quién es administrador se decide con profiles.is_admin, que es lo que también
// lee la función is_admin() de la base para las políticas RLS.
// Aquí vivía una lista de correos en VITE_ADMIN_EMAILS: se eliminó porque ya no
// la usaba nadie y dejar un segundo camino de autorización invita a volver a
// usarlo por error. En el frontend, usar isAdminUser de AuthContext.
