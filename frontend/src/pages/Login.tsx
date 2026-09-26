import { useState } from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth, authPersistenceReady } from '../lib/firebase'
import { BackIcon, ImageIcon, UserIcon } from '../components/icons'
import './Login.css'

type Role = 'hero' | 'citizen'
type LoginStep = 'role' | 'profile'

const heroSkills = ['買い物サポート', '荷物を運ぶ', 'スマホ・PCサポート', '話し相手', '道案内', 'その他（自由入力）']
const rewardOptions = ['無償・気持ちで', 'お礼のお菓子', 'コーヒー1杯', '相談して決める', 'その他（自由入力）']

type SavedOnboarding = {
  role: Role
  name: string
  skills: string[]
  gender: string
  reward: string
}

function readSavedOnboarding(): SavedOnboarding | null {
  try {
    const raw = sessionStorage.getItem('nearu-onboarding')
    if (!raw) return null

    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const data = value as Record<string, unknown>
    const role = data.role === 'hero' || data.role === 'citizen' ? data.role : null
    const name = typeof data.name === 'string' ? data.name : ''
    const skills = Array.isArray(data.skills) ? data.skills.filter((item): item is string => typeof item === 'string') : []
    const gender = typeof data.gender === 'string' ? data.gender : ''
    const reward = typeof data.reward === 'string' ? data.reward : ''

    if (!role || !name || !gender) return null
    return { role, name, skills, gender, reward }
  } catch {
    return null
  }
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
  const savedOnboarding = readSavedOnboarding()
  const [step, setStep] = useState<LoginStep>(() => savedOnboarding ? 'profile' : 'role')
  const [role, setRole] = useState<Role | null>(() => savedOnboarding?.role ?? null)
  const [name, setName] = useState(() => savedOnboarding?.name ?? '')
  const [photoUrl, setPhotoUrl] = useState('')
  const [skill, setSkill] = useState(() => savedOnboarding?.skills[0] ?? '')
  const [customSkill, setCustomSkill] = useState('')
  const [gender, setGender] = useState(() => savedOnboarding?.gender ?? '')
  const [reward, setReward] = useState(() => savedOnboarding?.reward ?? '')
  const [customReward, setCustomReward] = useState('')
  const [profileError, setProfileError] = useState('')

  async function handleLogin() {
    setPending(true)
    setProfileError('')

    try {
      await authPersistenceReady
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (loginError) {
      setProfileError(loginErrorMessage(loginError))
    } finally {
      setPending(false)
    }
  }

  function chooseRole(nextRole: Role) {
    setRole(nextRole)
    setProfileError('')
    setStep('profile')
  }

  function selectPhoto(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => setPhotoUrl(String(reader.result)))
    reader.readAsDataURL(file)
  }

  async function continueFromProfile() {
    const heroNeedsCustomSkill = role === 'hero' && skill === 'その他（自由入力）' && !customSkill.trim()
    const heroNeedsCustomReward = role === 'hero' && reward === 'その他（自由入力）' && !customReward.trim()

    if (!role || !name.trim() || !gender || (role === 'hero' && (!skill || !reward || heroNeedsCustomSkill || heroNeedsCustomReward))) {
      setProfileError('名前・得意なこと・性別・ほしいもの（ヒーローの場合）を設定してください。')
      return
    }

    sessionStorage.setItem('nearu-onboarding', JSON.stringify({
      role,
      name: name.trim(),
      skills: role === 'hero' ? [skill === 'その他（自由入力）' ? customSkill.trim() : skill] : [],
      gender,
      reward: role === 'hero' ? (reward === 'その他（自由入力）' ? customReward.trim() : reward) : '',
    }))
    await handleLogin()
  }

  if (step === 'role') {
    return (
      <main className="role-stage">
        <section className="role-screen" aria-labelledby="role-title">
          <h1 id="role-title" className="sr-only">はじめに、どちらとして使いますか？</h1>
          <div className="role-screen__art">
            <div className="role-screen__art-frame">
              <button
                type="button"
                className="role-screen__art-choice role-screen__art-choice--hero"
                onClick={() => chooseRole('hero')}
                aria-label="ヒーローとしてはじめる。困っている人を助けたい"
              />
              <button
                type="button"
                className="role-screen__art-choice role-screen__art-choice--citizen"
                onClick={() => chooseRole('citizen')}
                aria-label="助けてほしい人としてはじめる。困ったときに助けてほしい"
              />
            </div>
            <div className="role-screen__mobile-choices">
              <button type="button" className="role-screen__mobile-choice role-screen__mobile-choice--hero" onClick={() => chooseRole('hero')}>
                <span className="role-screen__mobile-choice-icon" aria-hidden="true">▶</span>
                <span><strong>ヒーローとしてはじめる</strong><small>困っている人を助けたい</small></span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button" className="role-screen__mobile-choice role-screen__mobile-choice--citizen" onClick={() => chooseRole('citizen')}>
                <span className="role-screen__mobile-choice-icon" aria-hidden="true">▶</span>
                <span><strong>助けてほしい人としてはじめる</strong><small>困ったときに助けてほしい</small></span>
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (step === 'profile' && role) {
    const isHero = role === 'hero'
    const roleLabel = isHero ? 'ヒーロー' : '市民'
    const roleIcon = isHero ? '🗡️' : '🌼'

    return (
      <main className={`profile-stage profile-stage--${role}`}>
        <section className={`profile-setup profile-setup--${role}`} aria-labelledby="profile-title">
          <button type="button" className="profile-setup__back" onClick={() => setStep('role')} aria-label="役割選択に戻る">
            <BackIcon />
          </button>
          <div className="profile-setup__banner" aria-hidden="true">
            <b>{isHero ? 'NEARU HELPER GUILD' : 'NEARU CITIZEN GUILD'}</b>
            <span>{isHero ? 'HERO QUEST' : 'CITIZEN QUEST'}</span>
            <i>⚑</i>
          </div>
          <div className="profile-setup__intro">
            <div className="profile-setup__avatar">
              {photoUrl ? <img src={photoUrl} alt="選択したプロフィール写真" /> : <span aria-hidden="true">{roleIcon}</span>}
            </div>
            <div>
              <p className="profile-setup__eyebrow">{roleLabel}のプロフィール</p>
              <h1 id="profile-title">冒険の準備をしよう！</h1>
              <p>{isHero ? 'あなたの得意なことで、近くの誰かを助けよう。' : '安心して助けを求められるプロフィールを作ろう。'}</p>
            </div>
          </div>

          <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void continueFromProfile() }}>
            <label className="profile-photo-picker">
              <input type="file" accept="image/*" onChange={(event) => selectPhoto(event.target.files?.[0])} />
              <span className="profile-photo-picker__icon"><ImageIcon /></span>
              <span><strong>プロフィール写真</strong><small>{photoUrl ? '写真を変更する' : 'タップして写真を選ぶ'}</small></span>
              <span className="profile-photo-picker__action">選ぶ</span>
            </label>

            <label className="profile-field">
              <span className="profile-field__label"><UserIcon /> 名前</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例：れもん" autoComplete="nickname" />
            </label>

            {isHero && (
              <fieldset className="profile-fieldset">
                <legend>🗡️ 得意なこと</legend>
                <label className="profile-select">
                  <select value={skill} onChange={(event) => setSkill(event.target.value)}>
                    <option value="">得意なことを選んでください</option>
                    {heroSkills.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                {skill === 'その他（自由入力）' && (
                  <input className="profile-free-input" value={customSkill} onChange={(event) => setCustomSkill(event.target.value)} placeholder="得意なことを自由に書いてください" />
                )}
              </fieldset>
            )}

            <fieldset className="profile-fieldset">
              <legend>🌟 性別</legend>
              <div className="profile-option-grid profile-option-grid--three">
                {['女性', '男性', '回答しない'].map((option) => (
                  <button key={option} type="button" className={`profile-choice${gender === option ? ' is-selected' : ''}`} onClick={() => setGender(option)}>{option}</button>
                ))}
              </div>
            </fieldset>

            {isHero && (
              <fieldset className="profile-fieldset">
                <legend>🪙 ほしいもの <small>（報酬）</small></legend>
                <label className="profile-select">
                  <select value={reward} onChange={(event) => setReward(event.target.value)}>
                    <option value="">ほしいものを選んでください</option>
                    {rewardOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                {reward === 'その他（自由入力）' && (
                  <input className="profile-free-input" value={customReward} onChange={(event) => setCustomReward(event.target.value)} placeholder="ほしいものを自由に書いてください" />
                )}
              </fieldset>
            )}

            {profileError && <p className="profile-form__error" role="alert">{profileError}</p>}
            <button className="profile-form__submit" type="submit" disabled={pending}>
              {pending ? 'Google認証を開始しています…' : <>このプロフィールで登録する <span aria-hidden="true">→</span></>}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return null
}
