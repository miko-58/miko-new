import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { auth, db } from '../lib/firebase'
import { closePostAndRecordHelpedBy, emptyUserStats, readUserStats, type UserStats } from '../lib/userProfile'
import BottomNav from '../components/BottomNav'
import {
  BellIcon,
  ChevronRightIcon,
  ClockIcon,
  HeartIcon,
  ListIcon,
  QuestionIcon,
  SettingsIcon,
} from '../components/icons'
import './MyPage.css'

const menuItems = [
  { label: '助けた履歴', Icon: ClockIcon },
  { label: 'お気に入り', Icon: HeartIcon },
  { label: 'お知らせ', Icon: BellIcon },
  { label: '設定', Icon: SettingsIcon },
  { label: 'ヘルプ', Icon: QuestionIcon },
]

type HistoryPost = {
  id: string
  title: string
  category: string
  type: 'come' | 'teach'
  location: string
  status: 'open' | 'closed'
  createdAt: Timestamp | null
  imageUrls: string[]
}

function formatPostedAt(createdAt: Timestamp | null) {
  if (!createdAt) return 'たった今'
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(createdAt.toDate())
}

export default function MyPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'account'>('history')
  const [history, setHistory] = useState<HistoryPost[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [stats, setStats] = useState<UserStats>(emptyUserStats)
  const [closingPostId, setClosingPostId] = useState<string | null>(null)
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
    if (!user) return

    const historyQuery = query(
      collection(db, 'helpPosts'),
      where('authorUid', '==', user.uid),
    )

    return onSnapshot(historyQuery, (snapshot) => {
      const nextHistory: HistoryPost[] = snapshot.docs.map((document): HistoryPost => {
        const data = document.data()
        return {
          id: document.id,
          title: typeof data.title === 'string' ? data.title : '投稿内容',
          category: typeof data.category === 'string' ? data.category : 'その他',
          type: data.type === 'teach' ? 'teach' : 'come',
          location: typeof data.location === 'string' ? data.location : '詳しい場所は投稿詳細で確認できます',
          status: data.status === 'closed' ? 'closed' : 'open',
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.filter((url): url is string => typeof url === 'string') : (typeof data.imageUrl === 'string' ? [data.imageUrl] : []),
        }
      })
      nextHistory.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setHistory(nextHistory)
      setIsHistoryLoading(false)
      setHistoryError('')
    }, () => {
      setHistoryError('投稿履歴を読み込めませんでした。時間をおいてもう一度お試しください。')
      setIsHistoryLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!user) {
      setStats(emptyUserStats)
      return
    }

    return onSnapshot(doc(db, 'userProfiles', user.uid), (snapshot) => {
      setStats(readUserStats(snapshot.data()))
    }, () => {
      setStats(emptyUserStats)
    })
  }, [user])

  const closePost = async (postId: string) => {
    if (!user || closingPostId) return

    setClosingPostId(postId)
    setHistoryError('')
    try {
      await closePostAndRecordHelpedBy(user.uid, postId)
    } catch {
      setHistoryError('投稿を解決済みにできませんでした。時間をおいてもう一度お試しください。')
    } finally {
      setClosingPostId(null)
    }
  }

  if (loading) return <p>読み込み中...</p>
  if (!user) return <p>ログインしてください</p>

  const displayName = user.displayName || '名前未設定'
  const ratingLabel = stats.ratingCount > 0 ? (stats.ratingSum / stats.ratingCount).toFixed(1) : '—'

  return (
    <div className="screen screen--narrow my-page">
      <header className="page-header">
        <h1>マイページ</h1>
      </header>

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
              <p className="profile-card__email">{user.email || 'メールアドレス未設定'}</p>
            </div>
          </div>
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

        <div className="mypage-tabs" role="tablist" aria-label="マイページの表示内容">
          <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'is-active' : ''} onClick={() => setActiveTab('history')}>投稿履歴</button>
          <button type="button" role="tab" aria-selected={activeTab === 'account'} className={activeTab === 'account' ? 'is-active' : ''} onClick={() => setActiveTab('account')}>アカウント</button>
        </div>

        {activeTab === 'history' ? (
          <section className="post-history" aria-label="投稿履歴">
            <div className="post-history__heading">
              <div><h2>あなたの投稿</h2><p>投稿後もここから内容を確認できます。</p></div>
              <span>{history.length}件</span>
            </div>
            {isHistoryLoading ? <p className="post-history__state">投稿履歴を読み込み中です...</p> : historyError ? <p className="post-history__state post-history__state--error">{historyError}</p> : history.length === 0 ? (
              <div className="post-history__empty"><ListIcon /><p>まだ投稿はありません</p><span>困ったときは、ここからいつでも投稿できます。</span></div>
            ) : (
              <div className="post-history__list">
                {history.map((post) => (
                  <article key={post.id} className="post-history__item">
                    <div className="post-history__item-top"><span className="post-history__category">{post.category}</span><span className={`post-history__status post-history__status--${post.status}`}>{post.status === 'open' ? '募集中' : '解決済み'}</span></div>
                    {post.imageUrls.length > 0 && <img src={post.imageUrls[0]} alt="投稿した状況" className="post-history__image" />}
                    <h3>{post.title}</h3>
                    <p className="post-history__meta">{post.type === 'come' ? '来てほしい' : '教えてほしい'} ・ {post.location}</p>
                    <time>{formatPostedAt(post.createdAt)}</time>
                    <button type="button" className="post-history__view" onClick={() => navigate(`/help/${post.id}`)}>写真・投稿詳細を見る</button>
                    {post.status === 'open' && <button type="button" className="post-history__close" onClick={() => void closePost(post.id)} disabled={closingPostId === post.id}>{closingPostId === post.id ? '変更中...' : '解決済みにする'}</button>}
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
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
        )}
      </div>

      <BottomNav />
    </div>
  )
}
