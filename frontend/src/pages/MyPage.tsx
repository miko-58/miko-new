import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { auth, db } from '../lib/firebase'
import { emptyUserStats, readUserStats, type UserStats } from '../lib/userProfile'
import BottomNav from '../components/BottomNav'
import { SettingsIcon } from '../components/icons'
import './MyPage.css'

type HeroProfile = {
  role: 'hero' | 'citizen'
  profileName: string
  skills: string[]
  reward: string
  gender: string
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
            <div><p>報酬</p><strong>{profile.reward || '未登録'}</strong></div>
          </div>
          <div className="hero-my-page__fact hero-my-page__fact--skill">
            {/* <span className="hero-my-page__fact-icon" aria-hidden="true">⚔</span> */}
            <div><p>得意なこと</p><strong>{profile.skills.length ? profile.skills.join('・') : '未登録'}</strong></div>
          </div>
          <div className="hero-my-page__fact hero-my-page__fact--gender">
            {/* <span className="hero-my-page__fact-icon" aria-hidden="true">●</span> */}
            <div><p>性別</p><strong>{profile.gender || '未登録'}</strong></div>
          </div>
        </div>
      </section>
      <section className="hero-my-page__activity" aria-labelledby="hero-activity-title">
        <h2 id="hero-activity-title">あなたの活動</h2>
        <div className="hero-my-page__activity-grid">
          <div className="hero-my-page__activity-card hero-my-page__activity-card--helped">
            {/* <span aria-hidden="true">🤝</span> */}
            <div><strong>{stats.helpedCount}</strong><p>助けた回数</p></div>
          </div>
          <div className="hero-my-page__activity-card hero-my-page__activity-card--rated">
            {/* <span aria-hidden="true">★</span> */}
            <div><strong>{stats.ratingCount}</strong><p>評価をもらった数</p></div>
          </div>
        </div>
      </section>
    </div>
    <BottomNav />
  </div>
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
  const ratingLabel = displayedStats.ratingCount > 0 ? (displayedStats.ratingSum / displayedStats.ratingCount).toFixed(1) : '—'
  const statItems = [
    ...(profile?.role !== 'citizen'
      ? [{ kind: 'helped' as const, label: '助けた', value: stats.helpedCount, unit: '件' }]
      : []),
    ...(profile?.role !== 'hero'
      ? [{ kind: 'received' as const, label: '助けられた', value: stats.helpedByCount, unit: '件' }]
      : []),
    { kind: 'rating' as const, label: '評価', value: ratingLabel, unit: '' },
  ]

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
                <div><p>性別</p><strong>{profile.gender || '未登録'}</strong></div>
              </div>
            </div>
          )}
        </section>
        <section className="hero-my-page__activity" aria-labelledby="citizen-activity-title">
          <h2 id="citizen-activity-title">あなたの活動</h2>
          <div className="hero-my-page__activity-grid">
            {statItems.map(({ kind, label, value, unit }) => (
              <div key={kind} className={`hero-my-page__activity-card${kind === 'rating' ? ' hero-my-page__activity-card--rated' : ''}`}>
                <div>
                  <strong>{value}{unit && <span className="citizen-my-page__stat-unit">{unit}</span>}</strong>
                  <p>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <BottomNav />
    </div>
  )
}
