import { useEffect, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { auth, db } from '../lib/firebase'
import { emptyUserStats, readUserStats, type UserStats } from '../lib/userProfile'
import BottomNav from '../components/BottomNav'
import { HeartIcon, SettingsIcon, StarIcon, UserIcon } from '../components/icons'
import './MyPage.css'

type HeroProfile = {
  role: 'hero' | 'citizen'
  profileName: string
  skills: string[]
  reward: string
  offeredReward: string
  gender: string
}

function RewardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14" />
    <path d="M12 7H7.5A2.5 2.5 0 1 1 10 4.5L12 7Zm0 0h4.5A2.5 2.5 0 1 0 14 4.5L12 7Z" />
  </svg>
}
function HeroMyPage({
  user,
  profile,
  displayName,
  stats,
  failedPhotoURL,
  onPhotoError,
  onLogout,
  isLoggingOut,
  logoutError,
}: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>
  profile: HeroProfile
  displayName: string
  stats: UserStats
  failedPhotoURL: string | null
  onPhotoError: () => void
  onLogout: () => void
  isLoggingOut: boolean
  logoutError: string
}) {
  const joinedAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : null
  const joinedLabel = joinedAt && !Number.isNaN(joinedAt.getTime())
    ? `${joinedAt.getFullYear()}年${joinedAt.getMonth() + 1}月に参加`
    : 'Nearuに参加'

  return <div className="screen screen--narrow hero-my-page">
    <div className="screen__scroll hero-my-page__content">
      <div className="hero-my-page__topbar">
        <h1>マイページ</h1>
        <details className="hero-my-page__settings">
          <summary aria-label="設定"><SettingsIcon aria-hidden="true" /></summary>
          <div>
            <button type="button" onClick={onLogout} disabled={isLoggingOut}>{isLoggingOut ? 'ログアウト中…' : 'ログアウト'}</button>
            {logoutError && <p role="alert">{logoutError}</p>}
          </div>
        </details>
      </div>
      <section className="hero-my-page__profile" aria-label="ヒーロープロフィール">
        <img className="hero-my-page__banner" src="/images/profile-hero-banner.png" alt="" />
        <div className="hero-my-page__identity">
          <div className="hero-my-page__avatar">
            {user.photoURL && user.photoURL !== failedPhotoURL
              ? <img src={user.photoURL} alt={`${displayName}のプロフィール画像`} referrerPolicy="no-referrer" onError={onPhotoError} />
              : <span aria-hidden="true">{Array.from(displayName)[0]}</span>}
            <button type="button" className="hero-my-page__edit" aria-label="プロフィールを編集">✎</button>
          </div>
          <h1>{displayName}</h1>
          <p className="hero-my-page__role">ヒーロー</p>
          <p className="hero-my-page__meta">ID {user.uid.slice(0, 12)}</p>
          <p className="hero-my-page__meta">{joinedLabel}</p>
        </div>
        <div className="hero-my-page__facts">
          <div className="hero-my-page__fact hero-my-page__fact--reward">
            <span className="hero-my-page__fact-icon" aria-hidden="true"><RewardIcon /></span>
            <div><p>報酬</p><strong>{profile.reward || '未登録'}</strong></div>
          </div>
          <div className="hero-my-page__fact hero-my-page__fact--skill">
            <span className="hero-my-page__fact-icon" aria-hidden="true"><StarIcon /></span>
            <div><p>得意なこと</p><strong>{profile.skills.length ? profile.skills.join('・') : '未登録'}</strong></div>
          </div>
          <div className="hero-my-page__fact hero-my-page__fact--gender">
            <span className="hero-my-page__fact-icon" aria-hidden="true"><UserIcon /></span>
            <div><p>性別</p><strong>{profile.gender || '未登録'}</strong></div>
          </div>
        </div>
      </section>
      <section className="hero-my-page__activity" aria-labelledby="hero-activity-title">
        <h2 id="hero-activity-title">あなたの活動</h2>
        <div className="hero-my-page__activity-grid">
          <div className="hero-my-page__activity-card hero-my-page__activity-card--helped">
            <span className="my-page__activity-icon" aria-hidden="true"><HeartIcon /></span>
            <div><strong>{stats.helpedCount}</strong><p>助けた回数</p></div>
          </div>
          <div className="hero-my-page__activity-card hero-my-page__activity-card--rated">
            <span className="my-page__activity-icon" aria-hidden="true"><StarIcon /></span>
            <div><strong>{stats.ratingCount}</strong><p>評価をもらった数</p></div>
          </div>
        </div>
      </section>
    </div>
    <BottomNav />
  </div>
}

function CitizenRewardEditor({ uid, savedReward }: { uid: string; savedReward: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const value = draft ?? savedReward

  async function save() {
    if (savingRef.current || value.length > 300) return
    savingRef.current = true
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const offeredReward = value.trim()
      await updateDoc(doc(db, 'userProfiles', uid), { offeredReward, updatedAt: serverTimestamp() })
      setDraft(offeredReward)
      setSaved(true)
    } catch {
      setError('保存できませんでした。入力内容は残っています。もう一度お試しください。')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return <form className="citizen-my-page__reward" onSubmit={(event) => { event.preventDefault(); void save() }}>
    <div className="citizen-my-page__reward-heading"><span className="hero-my-page__fact-icon" aria-hidden="true"><RewardIcon /></span><label htmlFor="citizen-offered-reward">渡せる報酬（任意）</label></div>
    <p id="citizen-reward-hint">報酬として渡せるものがあれば、ご記入ください。空欄でも大丈夫です（300文字以内）。</p>
    <textarea id="citizen-offered-reward" rows={3} maxLength={300} value={value} disabled={saving}
      aria-describedby="citizen-reward-hint" placeholder="例：コーヒー1杯、お菓子など"
      onChange={(event) => { setDraft(event.target.value); setSaved(false); setError('') }} />
    <div className="citizen-my-page__reward-actions">
      <span>{value.length} / 300</span>
      <button type="submit" disabled={saving || value.trim() === savedReward}>{saving ? '保存中…' : '保存する'}</button>
    </div>
    {saved && <p role="status">保存しました。</p>}
    {error && <p className="citizen-my-page__reward-error" role="alert">{error}</p>}
  </form>
}

export default function MyPage() {
  const { user, loading } = useAuth()
  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null)
  const [stats, setStats] = useState<UserStats>(emptyUserStats)
  const [receivedRatings, setReceivedRatings] = useState({ sum: 0, count: 0 })
  const [profile, setProfile] = useState<HeroProfile | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError('')
    try {
      await signOut(auth)
    } catch {
      setLogoutError('ログアウトできませんでした。もう一度お試しください。')
    } finally {
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    if (!user) {
      setStats(emptyUserStats)
      setProfile(null)
      return
    }

    return onSnapshot(doc(db, 'userProfiles', user.uid), (snapshot) => {
      const data = snapshot.data()
      setStats(readUserStats(data))
      setProfile({
        role: data?.role === 'hero' ? 'hero' : 'citizen',
        profileName: typeof data?.profileName === 'string' ? data.profileName : '',
        skills: Array.isArray(data?.skills) ? data.skills.filter((skill): skill is string => typeof skill === 'string') : [],
        reward: typeof data?.reward === 'string' ? data.reward : '',
        offeredReward: typeof data?.offeredReward === 'string' ? data.offeredReward : '',
        gender: typeof data?.gender === 'string' ? data.gender : '',
      })
    }, () => {
      setStats(emptyUserStats)
      setProfile(null)
    })
  }, [user])

  useEffect(() => {
    if (!user || profile?.role !== 'hero') {
      setReceivedRatings({ sum: 0, count: 0 })
      return
    }
    return onSnapshot(collection(db, 'userProfiles', user.uid, 'ratings'), (snapshot) => {
      const values = snapshot.docs.map((rating) => rating.data().rating).filter((rating): rating is number => typeof rating === 'number' && rating >= 1 && rating <= 5)
      setReceivedRatings({ sum: values.reduce((total, rating) => total + rating, 0), count: values.length })
    }, () => setReceivedRatings({ sum: 0, count: 0 }))
  }, [profile?.role, user])

  if (loading) return <p>読み込み中...</p>
  if (!user) return <p>ログインしてください</p>

  const displayName = profile?.profileName || user.displayName || '名前未設定'
  const displayedStats = {
    ...stats,
    ratingSum: stats.ratingSum + receivedRatings.sum,
    ratingCount: stats.ratingCount + receivedRatings.count,
  }

  if (profile?.role === 'hero') {
    return <HeroMyPage
      user={user}
      profile={profile}
      displayName={displayName}
      stats={displayedStats}
      failedPhotoURL={failedPhotoURL}
      onPhotoError={() => setFailedPhotoURL(user.photoURL)}
      onLogout={() => void handleLogout()}
      isLoggingOut={isLoggingOut}
      logoutError={logoutError}
    />
  }

  return (
    <div className="screen screen--narrow hero-my-page citizen-my-page">
      <div className="screen__scroll hero-my-page__content">
        <div className="hero-my-page__topbar">
          <h1>マイページ</h1>
          <details className="hero-my-page__settings">
            <summary aria-label="設定"><SettingsIcon aria-hidden="true" /></summary>
            <div>
              <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut}>
                {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
              </button>
              {logoutError && <p role="alert">{logoutError}</p>}
            </div>
          </details>
        </div>
        <section className="hero-my-page__profile" aria-label="市民プロフィール">
          <img className="hero-my-page__banner" src="/images/profile-hero-banner.png" alt="" />
          <div className="hero-my-page__identity">
            <div className="hero-my-page__avatar">
              {user.photoURL && user.photoURL !== failedPhotoURL ? (
                <img
                  src={user.photoURL}
                  alt={`${displayName}のプロフィール画像`}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedPhotoURL(user.photoURL)}
                />
              ) : (
                <span aria-hidden="true">{Array.from(displayName)[0]}</span>
              )}
            </div>
            <h1>{displayName}</h1>
            <p className="hero-my-page__role">市民</p>
          </div>
          {profile && (
            <div className="hero-my-page__facts citizen-my-page__facts">
              <div className="hero-my-page__fact hero-my-page__fact--gender">
<span className="hero-my-page__fact-icon" aria-hidden="true"><UserIcon /></span>
                <div><p>性別</p><strong>{profile.gender || '未登録'}</strong></div>
              </div>
              <CitizenRewardEditor key={user.uid} uid={user.uid} savedReward={profile.offeredReward} />
            </div>
          )}
        </section>
        <section className="hero-my-page__activity" aria-labelledby="citizen-activity-title">
          <h2 id="citizen-activity-title">あなたの活動</h2>
          <div className="hero-my-page__activity-grid">
              <div className="hero-my-page__activity-card">
                <span className="my-page__activity-icon" aria-hidden="true"><HeartIcon /></span>
                <div>
                  <strong>{stats.helpedByCount}<span className="citizen-my-page__stat-unit">件</span></strong>
                  <p>助けられた</p>
                </div>
              </div>
          </div>
        </section>
      </div>
      <BottomNav />
    </div>
  )
}
