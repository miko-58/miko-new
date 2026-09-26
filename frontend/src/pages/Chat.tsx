import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackIcon, SendIcon, LocationIcon, ChatIcon, UserIcon } from '../components/icons'
import nearuLogo from '../assets/nearu-logo.png'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import { canReadChat, chatPartnerName, MAX_MESSAGE_LENGTH, readChatHelp, sendChatMessage, type ChatHelp } from '../lib/chat'
import ChatSummary from './ChatSummary'
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
  return <ChatRoom key={`${id}:${user.uid}`} helpId={id} uid={user.uid} />
}

function ChatRoom({ helpId, uid }: { helpId: string; uid: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [help, setHelp] = useState<ChatHelp | null>(null)
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

  useEffect(() => onSnapshot(doc(db, 'helpPosts', helpId), (snapshot) => {
    setHelp(snapshot.exists() ? readChatHelp(snapshot.id, snapshot.data()) : null)
    setLoadError('')
    setLoading(false)
  }, () => {
    setHelp(null)
    setLoadError('会話を読み込めませんでした。メッセージ一覧から開き直してください。')
    setLoading(false)
  }), [helpId])

  const allowed = Boolean(help && canReadChat(help, uid))

  useEffect(() => {
    if (!allowed) return
    setMessagesLoading(true)
    setMessageError('')
    const messagesQuery = query(collection(db, 'helpPosts', helpId, 'messages'), orderBy('createdAt', 'asc'))
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
  }, [allowed, helpId])

  useEffect(() => {
    const thread = threadRef.current
    if (thread && followMessagesRef.current) thread.scrollTop = thread.scrollHeight
  }, [messages])

  const canSend = allowed && help?.status === 'matched' && !messagesLoading && !messageError

  async function handleSend() {
    if (!canSend || !draft.trim() || sendingRef.current) return
    sendingRef.current = true
    followMessagesRef.current = true
    setSending(true)
    setSendError('')
    try {
      await sendChatMessage(helpId, uid, draft)
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
            {allowed && help?.helperUid === uid && help.status === 'matched' && <Link to={`/help/${helpId}/resolve`}>解決する</Link>}
          </div>
        </details>
      </div>
      {allowed && help && <div className="chat-person">
        <ChatAvatar key={help.authorUid === uid ? help.helperUid : help.authorUid} name={chatPartnerName(help, uid)} photo={help.authorUid !== uid ? help.authorPhotoUrl : null} />
        <div><h1>{chatPartnerName(help, uid)}</h1><p>{help.authorUid === uid ? '依頼を引き受けた相手' : '依頼した相手'}</p></div>
      </div>}
      <header className="chat-header">
        {allowed && <svg className="chat-package" viewBox="0 0 48 48" fill="#ffedb0" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden="true"><path d="m4 13 20-8 20 8v23l-20 9-20-9Z" /><path d="m4 13 20 9 20-9M24 22v23M15 9l20 9v10" /></svg>}
        {allowed && help ? <ChatSummary key={help.id} help={help} uid={uid} /> : <h1>メッセージ</h1>}
      </header>
      <div className="chat-thread" ref={threadRef} role="log" aria-label="会話履歴" aria-live="polite" aria-relevant="additions text" onScroll={() => {
        const thread = threadRef.current
        if (thread) followMessagesRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80
      }}>
        {loading ? <p className="empty-state">読み込み中...</p>
          : loadError ? <p className="chat-feedback" role="alert">{loadError}</p>
            : !allowed ? <p className="empty-state">この会話は投稿者と担当者だけが利用できます。</p>
              : <>
                {messageError && <p className="chat-feedback" role="alert">{messageError}</p>}
                {messagesLoading ? <p className="empty-state">メッセージを読み込み中...</p>
                  : !messageError && messages.length === 0 && <p className="empty-state">まだメッセージはありません。待ち合わせの連絡を送りましょう。</p>}
                {messages.map((message) => (
                  <div key={message.id} className={`chat-bubble-row chat-bubble-row--${message.senderUid === uid ? 'me' : 'other'}`}>
                    {help && <ChatAvatar name={message.senderUid === uid ? user?.displayName ?? 'あなた' : chatPartnerName(help, uid)} own={message.senderUid === uid} photo={message.senderUid === uid ? user?.photoURL : help.authorUid !== uid ? help.authorPhotoUrl : null} />}
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
        {help?.status !== 'matched' && <p className="chat-feedback">このHelpでは新しいメッセージを送れません。履歴は引き続き確認できます。</p>}
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
