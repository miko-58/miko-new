import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from './firebase'

export const MAX_MESSAGE_LENGTH = 2000

export type ChatHelp = {
  id: string
  title: string
  authorUid: string
  authorName: string
  authorPhotoUrl: string | null
  helperUid: string | null
  helperName: string | null
  status: string
  matchedAt: number
}

export function readChatHelp(id: string, data: Record<string, unknown>): ChatHelp {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Help',
    authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : '投稿者',
    authorPhotoUrl: typeof data.authorPhotoUrl === 'string' ? data.authorPhotoUrl : null,
    helperUid: typeof data.acceptedHelperUid === 'string' ? data.acceptedHelperUid : null,
    helperName: typeof data.acceptedHelperName === 'string' ? data.acceptedHelperName : null,
    status: typeof data.status === 'string' ? data.status : '',
    matchedAt: data.acceptedAt instanceof Timestamp ? data.acceptedAt.toMillis() : 0,
  }
}

export function canReadChat(help: ChatHelp, uid: string) {
  return Boolean(help.helperUid && (help.authorUid === uid || help.helperUid === uid))
}

export function chatPartnerName(help: ChatHelp, uid: string) {
  return help.authorUid === uid ? help.helperName ?? '助けに向かう人' : help.authorName
}

export async function sendChatMessage(helpId: string, senderUid: string, draft: string) {
  const text = draft.trim()
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    throw new Error('メッセージは1〜2000文字で入力してください。')
  }
  await addDoc(collection(db, 'helpPosts', helpId, 'messages'), {
    senderUid,
    text,
    createdAt: serverTimestamp(),
  })
}
