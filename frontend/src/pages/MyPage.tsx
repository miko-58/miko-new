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
            <div className={`hero-profile-details${profile.role === 'citizen' ? ' hero-profile-details--citizen' : ''}`}>
              {profile.role === 'hero' ? (
                <>
                  <div className="hero-profile-details__item">
                    <span className="hero-profile-details__label">得意なこと</span>
                    <span className="hero-profile-details__value">
                      {profile.skills.length > 0 ? profile.skills.join('・') : '登録なし'}
                    </span>
                  </div>
                  <div className="hero-profile-details__item">
                    <span className="hero-profile-details__label">報酬</span>
                    <span className="hero-profile-details__value">{profile.reward || '相談して決める'}</span>
                  </div>
                  <div className="hero-profile-details__item">
                    <span className="hero-profile-details__label">性別</span>
                    <span className="hero-profile-details__value">{profile.gender || '未登録'}</span>
                  </div>
                </>
              ) : (
                <div className="hero-profile-details__item">
                  <span className="hero-profile-details__label">性別</span>
                  <span className="hero-profile-details__value">{profile.gender || '未登録'}</span>
                </div>
              )}
            </div>
          )}
          <div className="profile-card__stats">
            {([
              { kind: 'helped', label: '助けた', value: stats.helpedCount, unit: '件' },
              { kind: 'received', label: '助けられた', value: stats.helpedByCount, unit: '件' },
              { kind: 'rating', label: '評価', value: ratingLabel, unit: '' },
            ] as const).map(({ kind, label, value, unit }) => (
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
