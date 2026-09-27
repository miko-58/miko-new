import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

function requiredFirebaseSetting(name: string) {
  const value = import.meta.env[name]
  if (!value) throw new Error(`Firebase設定 ${name} がありません。.env.local を確認してください。`)
  return value
}

const firebaseConfig = {
  apiKey: requiredFirebaseSetting('VITE_FIREBASE_API_KEY'),
  authDomain: requiredFirebaseSetting('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredFirebaseSetting('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requiredFirebaseSetting('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredFirebaseSetting('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredFirebaseSetting('VITE_FIREBASE_APP_ID'),
  measurementId: requiredFirebaseSetting('VITE_FIREBASE_MEASUREMENT_ID'),
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// 同じ端末・同じブラウザでは、明示的にログアウトするまでログインを保つ。
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
