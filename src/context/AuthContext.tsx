import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface Profile {
  id: string
  email: string
  nombre: string | null
  empresa: string | null
  folios_balance: number
  plan: string
  logo_url: string | null
  color_marca: string
  moneda: string
  [key: string]: any
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdminUser: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdminUser: false,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    // Cuenta bloqueada desde el admin: la base ya no le muestra datos; se cierra
    // la sesión y se le avisa en vez de dejarle un panel vacío.
    if (data && data.activo === false) {
      await supabase.auth.signOut()
      setProfile(null)
      toast.error('Tu cuenta está suspendida. Escríbenos a soporte si crees que es un error.', { duration: 8000 })
      return
    }
    if (data) setProfile(data)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // El rol de admin vive en la base (profiles.is_admin), no en una lista de emails.
  const isAdminUser = profile?.is_admin === true

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdminUser, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
