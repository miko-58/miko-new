import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore'
import { useNavigate, useParams } from 'react-router-dom'
import { BackIcon, SendIcon } from '../components/icons'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import { canReadChat, MAX_MESSAGE_LENGTH, readChatHelp, sendChatMessage, type ChatHelp } from '../lib/chat'
import ChatSummary, { PartnerPhoto } from './ChatSummary'
import './Chat.css'

type Message = {
  id: string
  senderUid: string
  text: string
  createdAt: Timestamp | null
  pending: boolean
}

export default function Chat() {
  const { id } = useParams()
  const { user } = useAuth()
  if (!id || !user) return <p className="empty-state">会話を開けません。</p>
  return <ChatRoom key={`${id}:${user.uid}`} helpId={id} uid={user.uid} />
}

function ChatRoom({ helpId, uid }: { helpId: string; uid: string }) {
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
    if (thread) thread.scrollTop = thread.scrollHeight
  }, [messages])

  const canSend = allowed && help?.status === 'matched' && !messagesLoading && !messageError

  async function handleSend() {
    if (!canSend || !draft.trim() || sendingRef.current) return
    sendingRef.current = true
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
    }
  }

  return (
    <div className="screen screen--narrow chat-screen">
      <button type="button" className="chat-back" onClick={() => navigate('/messages')}><BackIcon />メッセージ一覧に戻る</button>
      <header className="chat-header">
        {allowed && help ? <ChatSummary key={help.id} help={help} uid={uid} /> : <h1>メッセージ</h1>}
        <div className="chat-header__actions">
        {allowed && <button type="button" className="btn btn--outline btn--sm" onClick={() => navigate(`/help/${helpId}`)}>詳細・地図</button>}
        {allowed && help?.helperUid === uid && help.status === 'matched' && (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => navigate(`/help/${helpId}/resolve`)}>解決する</button>
        )}
        </div>
      </header>
      <div className="chat-thread" ref={threadRef}>
        {loading ? <p className="empty-state">読み込み中...</p>
          : loadError ? <p className="chat-feedback" role="alert">{loadError}</p>
            : !allowed ? <p className="empty-state">この会話は投稿者と担当者だけが利用できます。</p>
              : <>
                {messageError && <p className="chat-feedback" role="alert">{messageError}</p>}
                {messagesLoading ? <p className="empty-state">メッセージを読み込み中...</p>
                  : !messageError && messages.length === 0 && <p className="empty-state">まだメッセージはありません。待ち合わせの連絡を送りましょう。</p>}
                {messages.map((message) => (
                  <div key={message.id} className={`chat-bubble-row chat-bubble-row--${message.senderUid === uid ? 'me' : 'other'}`}>
                    {message.senderUid !== uid && help && <PartnerPhoto help={help} uid={uid} />}
                    <div className="chat-bubble chat-bubble--text">{message.text}</div>
                    <span className="chat-bubble-row__time">{message.pending ? '送信中...' : message.createdAt?.toDate().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </>}
      </div>
      {allowed && <>
        {help?.status !== 'matched' && <p className="chat-feedback">このHelpでは新しいメッセージを送れません。履歴は引き続き確認できます。</p>}
        {sendError && <p className="chat-feedback" role="alert">{sendError}</p>}
        <form className="chat-input" onSubmit={(event) => { event.preventDefault(); void handleSend() }}>
          <input
            aria-label="メッセージ"
            placeholder="メッセージを入力…"
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={!canSend || sending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
            }}
          />
          <button type="submit" className="icon-btn icon-btn--accent" aria-label="送信" disabled={!canSend || sending || !draft.trim()}><SendIcon /></button>
        </form>
      </>}
    </div>
  )
}
