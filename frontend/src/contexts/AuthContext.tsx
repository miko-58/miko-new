import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, authPersistenceReady } from '../lib/firebase'
import { ensureUserProfile } from '../lib/userProfile'

type AuthContextValue = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    void authPersistenceReady.then(() => {
      if (cancelled) return

      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser)
        setLoading(false)

        if (currentUser) {
          void ensureUserProfile(currentUser).catch((error) => {
            console.error('Failed to prepare user profile', error)
          })
        }
      })

      void getRedirectResult(auth).catch((error) => {
        console.error('Failed to process Google authentication redirect', error)
      })
    }).catch((error) => {
      console.error('Failed to initialize authentication persistence', error)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuthはAuthProviderの内側で使ってください')
  }

  return context
}
