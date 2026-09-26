import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { LocationIcon } from '../components/icons'
import { chatPartnerName, type ChatHelp } from '../lib/chat'
import { db } from '../lib/firebase'
import './Messages.css'

export function PartnerPhoto({ help, uid }: { help: ChatHelp; uid: string }) {
  const photo = help.authorUid !== uid ? help.authorPhotoUrl : null
  return photo ? <img className="message-avatar" src={photo} alt={`${chatPartnerName(help, uid)}のプロフィール画像`} referrerPolicy="no-referrer" /> : null
}

export default function ChatSummary({ help, uid }: { help: ChatHelp; uid: string }) {
  const [location, setLocation] = useState('')
  useEffect(() => {
    return onSnapshot(doc(db, 'helpPosts', help.id, 'private', 'location'), (snapshot) => {
      const value = snapshot.data()?.location
      setLocation(typeof value === 'string' ? value : '')
    }, () => setLocation('場所を取得できませんでした'))
  }, [help.id])
  return <div className="message-summary">
    <div className="message-summary__badges">
      <span className={`message-badge ${help.authorUid === uid ? 'message-badge--request' : ''}`}>{help.authorUid === uid ? '助けてもらう' : '助ける'}</span>
      <span className="message-badge">{help.status === 'matched' ? '対応中' : help.status === 'closed' ? '解決済み' : help.status === 'open' ? '募集中' : '状態不明'}</span>
    </div>
    <h2 className="message-summary__title">{help.title}</h2>
    {location && <p className="message-summary__location"><LocationIcon />{location}</p>}
    <div className="message-summary__partner"><PartnerPhoto help={help} uid={uid} /><span>{chatPartnerName(help, uid)}</span></div>
  </div>
}
