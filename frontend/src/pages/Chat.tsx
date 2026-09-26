import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackIcon, SendIcon, LocationIcon, ChatIcon, UserIcon } from '../components/icons'
import nearuLogo from '../assets/nearu-logo.png'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import { DirectChatError, endDirectChat, partnerName, MAX_MESSAGE_LENGTH, readDirectChat, sendDirectMessage, startDirectChat, type DirectChat } from '../lib/directChat'
import './Chat.css'

type Message = {
  id: string
  senderUid: string
  text: string
  createdAt: Timestamp | null
  pending: boolean
}

function ChatAvatar({ name, photo, own = false }: { name: string; photo?: string | null; own?: boolean }) {
  const [failed, setFailed] = useState(false)
  return <span className={`chat-avatar${own ? ' chat-avatar--own' : ''}`} aria-label={name}>
    {photo && !failed ? <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <UserIcon aria-hidden="true" />}
  </span>
}

export default function Chat() {
  const { id } = useParams()
  const { user } = useAuth()
  if (!id || !user) return <p className="empty-state">会話を開けません。</p>
  return <ChatRoom key={`${id}:${user.uid}`} chatId={id} uid={user.uid} />
}

function ChatRoom({ chatId, uid }: { chatId: string; uid: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [room, setRoom] = useState<DirectChat | null>(null)
  const [changing, setChanging] = useState(false)
  const changePending = useRef(false)
  const [changeError, setChangeError] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loadError, setLoadError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const followMessagesRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => onSnapshot(doc(db, 'directChats', chatId), (snapshot) => {
    setRoom(snapshot.exists() ? readDirectChat(snapshot.id, snapshot.data()) : null)
    setLoadError('')
    setLoading(false)
  }, () => {
    setRoom(null)
    setLoadError('会話を読み込めませんでした。メッセージ一覧から開き直してください。')
    setLoading(false)
  }), [chatId])

  const allowed = Boolean(room?.members.includes(uid))

  useEffect(() => {
    if (!allowed) return
    setMessagesLoading(true)
    setMessageError('')
    const messagesQuery = query(collection(db, 'directChats', chatId, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(messagesQuery, { includeMetadataChanges: true }, (snapshot) => {
      setMessages(snapshot.docs.map((message) => {
        const data = message.data()
        return {
          id: message.id,
          senderUid: data.senderUid,
          text: data.text,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
          pending: message.metadata.hasPendingWrites,
        }
      }))
      setMessagesLoading(false)
      setMessageError('')
    }, () => {
      setMessages([])
      setMessagesLoading(false)
      setMessageError('メッセージを読み込めませんでした。時間をおいて開き直してください。')
    })
  }, [allowed, chatId])

  useEffect(() => {
    const thread = threadRef.current
    if (thread && followMessagesRef.current) thread.scrollTop = thread.scrollHeight
  }, [messages])

  const canSend = allowed && room?.status === 'active' && !changing && !messagesLoading && !messageError

  async function changeConversation() {
    if (!room || !allowed || changePending.current || sendingRef.current) return
    if (room.status === 'active' && !window.confirm('やり取りを終了しますか？履歴は残り、双方が別の相手とチャットできるようになります。')) return
    changePending.current = true
    setChanging(true)
    setChangeError('')
    try {
      if (room.status === 'active') await endDirectChat(db, uid, room.id)
      else await startDirectChat(db, uid, room.members.find(member => member !== uid)!)
    } catch (error) {
      setChangeError(error instanceof DirectChatError ? error.message : 'やり取りの状態を変更できませんでした。もう一度お試しください。')
    } finally {
      changePending.current = false
      setChanging(false)
    }
  }

  async function handleSend() {
    if (!canSend || !draft.trim() || sendingRef.current) return
    sendingRef.current = true
    followMessagesRef.current = true
    setSending(true)
    setSendError('')
    try {
      await sendDirectMessage(db, chatId, uid, draft)
      setDraft('')
    } catch {
      setSendError('送信できませんでした。入力内容を残しています。もう一度お試しください。')
    } finally {
      sendingRef.current = false
      setSending(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  return (
    <div className="screen screen--narrow chat-screen">
      <div className="chat-brand">
        <button type="button" className="chat-back" aria-label="メッセージ一覧に戻る" onClick={() => navigate('/messages')}><BackIcon /></button>
        <img src={nearuLogo} alt="Nearu" />
        <details className="chat-menu">
          <summary aria-label="チャットメニュー"><span aria-hidden="true">⋮</span></summary>
          <div><Link to="/messages">メッセージ一覧</Link>
            {allowed && <button type="button" disabled={changing || sending} onClick={() => void changeConversation()}>{room?.status === 'active' ? 'やり取りを終了' : 'やり取りを再開'}</button>}
          </div>
        </details>
      </div>
      {allowed && room && <div className="chat-person">
        <ChatAvatar name={partnerName(room, uid)} />
        <div><h1>{partnerName(room, uid)}</h1><p>{room.status === 'active' ? 'やり取り中' : '終了した会話'}</p></div>
      </div>}
      <header className="chat-header">
        {allowed && room ? <button className="chat-session-action" type="button" disabled={changing || sending} onClick={() => void changeConversation()}>{changing ? '更新中…' : room.status === 'active' ? 'やり取りを終了' : 'この相手とやり取りを再開'}</button> : <h1>メッセージ</h1>}
      </header>
      {changeError && <p className="chat-feedback" role="alert">{changeError}</p>}
      <div className="chat-thread" ref={threadRef} role="log" aria-label="会話履歴" aria-live="polite" aria-relevant="additions text" onScroll={() => {
        const thread = threadRef.current
        if (thread) followMessagesRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80
      }}>
        {loading ? <p className="empty-state">読み込み中...</p>
          : loadError ? <p className="chat-feedback" role="alert">{loadError}</p>
            : !allowed ? <p className="empty-state">この会話は当事者の2人だけが利用できます。</p>
              : <>
                {messageError && <p className="chat-feedback" role="alert">{messageError}</p>}
                {messagesLoading ? <p className="empty-state">メッセージを読み込み中...</p>
                  : !messageError && messages.length === 0 && <p className="empty-state">まだメッセージはありません。待ち合わせの連絡を送りましょう。</p>}
                {messages.map((message) => (
                  <div key={message.id} className={`chat-bubble-row chat-bubble-row--${message.senderUid === uid ? 'me' : 'other'}`}>
                    {room && <ChatAvatar name={message.senderUid === uid ? user?.displayName ?? 'あなた' : partnerName(room, uid)} own={message.senderUid === uid} photo={message.senderUid === uid ? user?.photoURL : null} />}
                    <div className="chat-message-content">
                    <div className="chat-bubble chat-bubble--text">{message.text}</div>
                    <span className="chat-bubble-row__time">{message.pending ? '送信中...' : message.createdAt?.toDate().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </>}
      </div>
      {allowed && <>
        <p className="chat-safety"><svg viewBox="0 0 48 54" aria-hidden="true"><path d="M24 3 44 11v16c0 11-13 20-20 24C17 47 4 38 4 27V11Z" fill="#fff" stroke="currentColor" strokeWidth="3" /><path d="m24 9 14 6v12c0 7-8 14-14 18-6-4-14-11-14-18V15Z" fill="#008c76" /><path d="M24 35s-11-7-11-13c0-6 8-7 11-1 3-6 11-5 11 1 0 6-11 13-11 13" fill="white" /></svg><span>個人情報やお金のやり取りはしないでください</span></p>
        {room?.status !== 'active' && <p className="chat-feedback">やり取りは終了しています。再開するとメッセージを送れます。</p>}
        {sendError && <p className="chat-feedback" role="alert">{sendError}</p>}
        <form className="chat-input" onSubmit={(event) => { event.preventDefault(); void handleSend() }}>
          <textarea
            ref={inputRef}
            rows={1}
            aria-label="メッセージ"
            aria-describedby="chat-input-hint"
            placeholder="メッセージを入力…"
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={!canSend || sending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault()
                void handleSend()
              }
            }}
          />
          <button type="submit" className="icon-btn icon-btn--accent" aria-label="送信" disabled={!canSend || sending || !draft.trim()}><SendIcon /></button>
        </form>
        <p id="chat-input-hint" className="chat-input-hint">Enterで改行・Ctrl / ⌘ + Enterで送信<span>{draft.length} / {MAX_MESSAGE_LENGTH}</span></p>
      </>}
      <nav className="chat-nav" aria-label="メインナビゲーション">
        <Link to="/map"><LocationIcon /><span>地図</span></Link>
        <Link to="/messages" className="is-active" aria-current="true"><ChatIcon /><span>メッセージ</span></Link>
        <Link to="/mypage"><UserIcon /><span>マイページ</span></Link>
      </nav>
    </div>
  )
}
