import { useEffect, useState } from 'react'
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import { auth, authPersistenceReady } from '../lib/firebase'
import nearuLogo from '../assets/nearu-logo.png'
import './Login.css'

function isMobileBrowser() {
  return window.matchMedia?.('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function loginErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''

  if (code === 'auth/popup-closed-by-user') return 'ログイン画面を閉じたため、ログインしていません。'
  if (code === 'auth/popup-blocked') return 'ログイン画面を開けませんでした。ブラウザのポップアップ設定を確認してください。'
  if (code === 'auth/unauthorized-domain') return 'このURLではログインできません。アプリのURL設定を確認してください。'
  if (code === 'auth/operation-not-allowed') return 'Googleログインの設定がまだ有効になっていません。'
  return 'ログインできませんでした。通信状況を確認して、もう一度お試しください。'
}

export default function Login() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void authPersistenceReady.then(() => getRedirectResult(auth)).catch((loginError) => {
      setError(loginErrorMessage(loginError))
    })
  }, [])

  async function handleLogin() {
    setPending(true)
    setError('')

    try {
      await authPersistenceReady
      const provider = new GoogleAuthProvider()

      if (isMobileBrowser()) {
        // スマホではポップアップが別タブ・白紙画面になりやすいため、画面遷移方式を使う。
        await signInWithRedirect(auth, provider)
        return
      }

      await signInWithPopup(auth, provider)
    } catch (loginError) {
      setError(loginErrorMessage(loginError))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="welcome-stage">
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcome__photo" aria-hidden="true" />
      <div className="welcome__island" aria-hidden="true" />
      <div className="splash__content">
        <img
          className="splash__logo-image"
          id="welcome-title"
          src={nearuLogo}
          alt="Nearu"
        />
        <p className="splash__tagline">
          <span>やさしい社会を、いっしょに。</span>
        </p>
      </div>
        <div className="splash__actions" aria-busy={pending}>
          <button
            type="button"
            className="welcome__button welcome__button--primary"
            onClick={handleLogin}
            disabled={pending}
          >
            はじめる
          </button>
          <button
            type="button"
            className="welcome__button welcome__button--secondary"
            onClick={handleLogin}
            disabled={pending}
          >
            ログイン
          </button>
          <p className="welcome__note" role="status">{pending ? 'Googleに接続しています…' : 'Googleアカウントでご利用いただけます'}</p>
          {error && <p className="welcome__error" role="alert">{error}</p>}
        </div>
      <div className="welcome__home-indicator" aria-hidden="true" />
    </section>
    </main>
  )
}
