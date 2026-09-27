import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { auth, db } from '../lib/firebase'
import { emptyUserStats, readUserStats, type UserStats } from '../lib/userProfile'
import BottomNav from '../components/BottomNav'
import {
  ChevronRightIcon,
  SettingsIcon,
} from '../components/icons'
import './MyPage.css'

type HeroProfile = {
  role: 'hero' | 'citizen'
  profileName: string
  skills: string[]
  reward: string
  gender: string
}

const menuItems = [
  { label: '設定', Icon: SettingsIcon },
]

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

  if (loading) return <p>読み込み中...</p>
  if (!user) return <p>ログインしてください</p>

  const displayName = profile?.profileName || user.displayName || '名前未設定'
  const ratingLabel = stats.ratingCount > 0 ? (stats.ratingSum / stats.ratingCount).toFixed(1) : '—'
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
      stats={stats}
      failedPhotoURL={failedPhotoURL}
      onPhotoError={() => setFailedPhotoURL(user.photoURL)}
      onLogout={() => void handleLogout()}
      isLoggingOut={isLoggingOut}
      logoutError={logoutError}
    />
  }

  return (
    <div className="screen screen--narrow my-page">
      <div className="screen__scroll my-page__content">
        <div className="profile-card profile-card--account">
          <div className="profile-card__identity">
            <div className="profile-card__avatar">
              {user.photoURL && user.photoURL !== failedPhotoURL ? (
                <img
                  className="profile-card__photo"
                  src={user.photoURL}
                  alt={`${displayName}のプロフィール画像`}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedPhotoURL(user.photoURL)}
                />
              ) : (
                <span aria-hidden="true">{Array.from(displayName)[0]}</span>
              )}
            </div>
            <div className="profile-card__account-details">
              <p className="profile-card__name">{displayName}</p>
            </div>
          </div>
          {profile && (
            <div className="hero-profile-details hero-profile-details--citizen">
              <div className="hero-profile-details__item">
                <span className="hero-profile-details__label">性別</span>
                <span className="hero-profile-details__value">{profile.gender || '未登録'}</span>
              </div>
            </div>
          )}
          <div className={`profile-card__stats profile-card__stats--${statItems.length}`}>
            {statItems.map(({ kind, label, value, unit }) => (
              <div key={kind} className={`my-page__stat my-page__stat--${kind}`}>
                <span className="my-page__stat-icon">
                  <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
                    {kind === 'rating' ? (
                      <path d="m16 3 3.9 8 8.8 1.3-6.4 6.2 1.5 8.8-7.8-4.1-7.8 4.1 1.5-8.8-6.4-6.2 8.8-1.3Z" />
                    ) : kind === 'received' ? (
                      <>
                        <path d="M16 16S7 11 7 6.8C7 2.5 12.7 1.6 16 5c3.3-3.4 9-2.5 9 1.8C25 11 16 16 16 16Z" />
                        <path opacity=".65" d="m3 22 5-5c1.2-1.2 3.2-.7 3.6.9l1 4.1-5 7-5-4Zm26 0-5-5c-1.2-1.2-3.2-.7-3.6.9l-1 4.1 5 7 5-4Z" />
                        <path d="m10 28 4-6-2-3c-.8-1.4.9-2.8 2-1.7l2 2 2-2c1.1-1.1 2.8.3 2 1.7l-2 3 4 6-6 3Z" />
                      </>
                    ) : (
                      <>
                        <path opacity=".55" d="M16 27S2 19 2 10a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 9-14 17-14 17Z" />
                        <path d="m3 17 6-7 6 1 5-1 9 9-5 6-6 4-8-5Zm8-3-5 4 6 5 6 3 4-3-7-7-3 3-3-2Z" />
                        <path d="m12 14 4-4 5 1 6 7-4 4-7-7-3 2c-2 1-3-1-1-3Z" stroke="#d7eee3" strokeWidth="1.2" strokeLinejoin="round" />
                      </>
                    )}
                  </svg>
                </span>
                <div className="my-page__stat-body">
                  <p className="profile-card__label">{label}</p>
                  <p className="profile-card__value">{value}{unit && <span className="my-page__stat-unit">{unit}</span>}</p>
                </div>
                <ChevronRightIcon className="my-page__stat-chevron" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>

        <div className="menu-list">
          {menuItems.map(({ label, Icon }) => (
            <button key={label} type="button" className="menu-list__item">
              <Icon />
              <span>{label}</span>
              <ChevronRightIcon className="menu-list__chevron" />
            </button>
          ))}
          <button
            type="button"
            className="btn btn--outline btn--block"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
