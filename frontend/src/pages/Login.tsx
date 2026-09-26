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

type Role = 'hero' | 'citizen'
type LoginStep = 'role' | 'profile' | 'auth'

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
  const [step, setStep] = useState<LoginStep>('role')
  const [role, setRole] = useState<Role | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [skills, setSkills] = useState<string[]>([])

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

  function chooseRole(nextRole: Role) {
    setRole(nextRole)
    setStep('profile')
  }

  function toggleSkill(skill: string) {
    setSkills((current) => current.includes(skill)
      ? current.filter((item) => item !== skill)
      : [...current, skill])
  }

  function continueToAuth() {
    if (!role || !displayName.trim()) return

    sessionStorage.setItem('nearu-onboarding', JSON.stringify({
      role,
      displayName: displayName.trim(),
      skills,
    }))
    setStep('auth')
  }

  if (step === 'role') {
    return (
      <main className="role-stage">
        <section className="role-screen" aria-labelledby="role-title">
          <div className="role-screen__art" aria-hidden="true" />
          <div className="role-screen__heading">
            <img className="role-screen__logo" src={nearuLogo} alt="Nearu" />
            <p id="role-title">はじめに、どちらとして使いますか？</p>
          </div>
          <div className="role-screen__choices">
            <button type="button" className="role-choice role-choice--hero" onClick={() => chooseRole('hero')}>
              <span className="role-choice__mark" aria-hidden="true">♥</span>
              <span>
                <strong>ヒーローとしてはじめる</strong>
                <small>困っている人を助けたい</small>
              </span>
              <span className="role-choice__arrow" aria-hidden="true">▶</span>
            </button>
            <button type="button" className="role-choice role-choice--citizen" onClick={() => chooseRole('citizen')}>
              <span className="role-choice__mark" aria-hidden="true">●</span>
              <span>
                <strong>助けてほしい人としてはじめる</strong>
                <small>困ったときに助けてほしい</small>
              </span>
              <span className="role-choice__arrow" aria-hidden="true">▶</span>
            </button>
          </div>
          <p className="role-screen__note">役割はあとからいつでも変更できます</p>
        </section>
      </main>
    )
  }

  if (step === 'profile') {
    const selectedRoleLabel = role === 'hero' ? 'ヒーロー' : '助けてほしい人'
    return (
      <main className="profile-stage">
        <section className="profile-setup" aria-labelledby="profile-title">
          <button type="button" className="profile-setup__back" onClick={() => setStep('role')} aria-label="役割選択に戻る">←</button>
          <p className="profile-setup__eyebrow">{selectedRoleLabel}として登録</p>
          <h1 id="profile-title">プロフィールを設定</h1>
          <p className="profile-setup__lead">まずは、呼ばれたい名前と得意なことを教えてください。</p>

          <label className="profile-setup__label" htmlFor="display-name">表示名</label>
          <input
            id="display-name"
            className="profile-setup__input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例：えいと"
            autoComplete="nickname"
          />

          <p className="profile-setup__label">得意なこと（複数選択）</p>
          <div className="profile-setup__skills">
            {['荷物運び', '道案内', '移動サポート', '話を聞く'].map((skill) => (
              <button
                key={skill}
                type="button"
                className={`profile-skill${skills.includes(skill) ? ' is-selected' : ''}`}
                onClick={() => toggleSkill(skill)}
              >
                {skill}
              </button>
            ))}
          </div>

          <p className="profile-setup__privacy">正確な現在地や個人情報は、必要な相手以外には公開されません。</p>
          <button type="button" className="profile-setup__continue" onClick={continueToAuth} disabled={!displayName.trim()}>
            Googleで登録を続ける →
          </button>
        </section>
      </main>
    )
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
