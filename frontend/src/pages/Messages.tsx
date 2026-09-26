import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import { canReadChat, readChatHelp, type ChatHelp } from '../lib/chat'
import ChatSummary from './ChatSummary'
import './Messages.css'

export default function Messages() {
  const { user } = useAuth()
  if (!user) return <p className="empty-state">ログインしてください。</p>
  return <ConversationList key={user.uid} uid={user.uid} />
}

function ConversationList({ uid }: { uid: string }) {
  const [authored, setAuthored] = useState<ChatHelp[]>([])
  const [accepted, setAccepted] = useState<ChatHelp[]>([])
  const [loaded, setLoaded] = useState({ author: false, helper: false })
  const [errors, setErrors] = useState({ author: false, helper: false })
  useEffect(() => {
    const stops = ([['author', 'authorUid'], ['helper', 'acceptedHelperUid']] as const).map(([role, field]) =>
      onSnapshot(query(collection(db, 'helpPosts'), where(field, '==', uid)), (snapshot) => {
        const helps = snapshot.docs.map((post) => readChatHelp(post.id, post.data()))
          .filter((help) => help.status === 'matched' && canReadChat(help, uid))
        if (role === 'author') setAuthored(helps)
        else setAccepted(helps)
        setLoaded((previous) => ({ ...previous, [role]: true }))
        setErrors((previous) => ({ ...previous, [role]: false }))
      }, () => {
        setLoaded((previous) => ({ ...previous, [role]: true }))
        setErrors((previous) => ({ ...previous, [role]: true }))
      }))
    return () => stops.forEach((stop) => stop())
  }, [uid])
  const loading = !loaded.author || !loaded.helper
  const failed = errors.author || errors.helper
  // 複数ある場合の表示選択だけを行い、引受制御や保存データは変更しない。
  const current = [...new Map([...authored, ...accepted].map((help) => [help.id, help])).values()]
    .sort((a, b) => b.matchedAt - a.matchedAt || a.id.localeCompare(b.id))[0]
  return <div className="screen screen--narrow messages-screen">
    <header className="page-header messages-header"><h1>メッセージ</h1><p>現在進行中の助け合いの会話です</p></header>
    <div className="screen__scroll messages-screen__scroll">
      <h2 className="messages-section-title">現在の助け合い</h2>
      {loading ? <p className="empty-state">読み込み中...</p>
        : failed ? <p className="empty-state" role="alert">会話の一覧を読み込めませんでした。時間をおいて開き直してください。</p>
          : current ? <CurrentConversation key={current.id} help={current} uid={uid} />
            : <p className="empty-state">現在進行中の助け合いはありません</p>}
    </div>
    <BottomNav />
  </div>
}

function CurrentConversation({ help, uid }: { help: ChatHelp; uid: string }) {
  const navigate = useNavigate()
  const [latest, setLatest] = useState<{ text: string; date: Date | null } | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => onSnapshot(query(collection(db, 'helpPosts', help.id, 'messages'), orderBy('createdAt', 'desc'), limit(1)), (snapshot) => {
    const data = snapshot.docs[0]?.data()
    setLatest(data ? { text: typeof data.text === 'string' ? data.text : '', date: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null } : null)
    setState('ready')
  }, () => setState('error')), [help.id])
  return <button type="button" className="current-conversation" onClick={() => navigate(`/help/${help.id}/chat`)}>
    <div className="current-conversation__body">
      <ChatSummary help={help} uid={uid} />
      <div className="current-conversation__latest">
        <p>{state === 'loading' ? 'メッセージを読み込み中...' : state === 'error' ? '最新メッセージを取得できませんでした' : latest?.text || 'まだメッセージはありません'}</p>
        {state === 'ready' && latest?.date && <time dateTime={latest.date.toISOString()}>{latest.date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}
      </div>
    </div>
    <span className="current-conversation__arrow" aria-hidden="true">›</span>
  </button>
}
