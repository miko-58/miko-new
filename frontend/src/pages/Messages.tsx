import { useEffect, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import { partnerName, readDirectChat, type DirectChat } from '../lib/directChat'
import { BackIcon, SearchIcon } from '../components/icons'
import './Messages.css'

export default function Messages() {
  const { user } = useAuth()
  if (!user) return <p className="empty-state">ログインしてください。</p>
  return <ConversationList key={user.uid} uid={user.uid} />
}

function ConversationList({ uid }: { uid: string }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [rooms, setRooms] = useState<DirectChat[]>([])
  const [viewerRole, setViewerRole] = useState<'hero' | 'citizen' | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => onSnapshot(doc(db, 'userProfiles', uid), (snapshot) => {
    setViewerRole(snapshot.data()?.role === 'hero' ? 'hero' : 'citizen')
  }, () => setViewerRole(null)), [uid])
  useEffect(() => onSnapshot(query(collection(db, 'directChats'), where('members', 'array-contains', uid)), (snapshot) => {
    setRooms(snapshot.docs.map(room => readDirectChat(room.id, room.data()))
      .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.updatedAt - a.updatedAt))
    setLoading(false)
    setFailed(false)
  }, () => { setLoading(false); setFailed(true) }), [uid])
  return <div className="screen screen--narrow messages-screen">
    <header className="messages-header">
      <button className="messages-back" type="button" aria-label="地図へ戻る" onClick={() => navigate('/map')}><BackIcon /></button>
      <h1>{viewerRole === 'hero' ? 'サポートメッセージ' : 'メッセージ'}</h1><p>{viewerRole === 'hero' ? '市民から届いた相談' : 'ヒーローとのやりとり'}</p>
      <span className="messages-decoration" aria-hidden="true">✦</span>
    </header>
    <label className="messages-search"><SearchIcon /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="相手の名前を検索" aria-label="相手の名前を検索" /></label>
    <div className="screen__scroll messages-screen__scroll">
      {loading ? <p className="empty-state">読み込み中...</p>
        : failed ? <p className="empty-state" role="alert">会話の一覧を読み込めませんでした。時間をおいて開き直してください。</p>
          : viewerRole === null ? <p className="empty-state">プロフィールを読み込み中...</p>
            : rooms.filter(room => room.participantRoles[uid] === viewerRole).length ? <>
            {rooms.filter(room => room.participantRoles[uid] === viewerRole && partnerName(room, uid).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
              .map(room => <CurrentConversation key={room.id} room={room} uid={uid} />)}
            {!rooms.some(room => room.participantRoles[uid] === viewerRole && partnerName(room, uid).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) && <p className="empty-state">一致する会話はありません</p>}
          </> : <p className="empty-state">{viewerRole === 'hero' ? '市民からの相談はまだありません。' : '地図でヒーローを選んで、チャットを始めましょう。'}</p>}
    </div>
    <BottomNav />
  </div>
}

function CurrentConversation({ room, uid }: { room: DirectChat; uid: string }) {
  const navigate = useNavigate()
  const [latest, setLatest] = useState<{ text: string; date: Date | null } | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => onSnapshot(query(collection(db, 'directChats', room.id, 'messages'), orderBy('createdAt', 'desc'), limit(1)), (snapshot) => {
    const data = snapshot.docs[0]?.data()
    setLatest(data ? { text: typeof data.text === 'string' ? data.text : '', date: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null } : null)
    setState('ready')
  }, () => setState('error')), [room.id])
  const partner = partnerName(room, uid)
  const date = latest?.date
  const today = date?.toDateString() === new Date().toDateString()
  return <button type="button" className="messages-card" onClick={() => navigate(`/chat/${encodeURIComponent(room.id)}`)}>
    <span className="messages-card__avatar" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="25" stroke="currentColor" strokeWidth="4" /><circle cx="23" cy="27" r="3" fill="currentColor" /><circle cx="41" cy="27" r="3" fill="currentColor" /><path d="M22 39Q32 51 42 39" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></span>
    <div className="current-conversation__body">
      <div className="messages-card__heading"><h2>{partner}</h2>{state === 'ready' && date && <time dateTime={date.toISOString()}>{date.toLocaleString('ja-JP', today ? { hour: '2-digit', minute: '2-digit' } : { month: 'numeric', day: 'numeric' })}</time>}</div>
      <p className="messages-card__post">{room.status === 'active' ? room.requesterUid === uid ? 'ヒーローに相談中' : '市民をサポート中' : room.requesterUid === uid ? '終了した依頼' : '終了したサポート'}</p>
      <div className="messages-card__latest">
        <p>{state === 'loading' ? 'メッセージを読み込み中...' : state === 'error' ? '最新メッセージを取得できませんでした' : latest?.text || 'まだメッセージはありません'}</p>
      </div>
    </div>
    <span className="messages-card__arrow" aria-hidden="true">›</span>
  </button>
}
