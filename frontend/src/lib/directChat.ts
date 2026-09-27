import { addDoc, collection, doc, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore'

export const MAX_MESSAGE_LENGTH = 2000
export class DirectChatError extends Error {}
export type DirectChat = {
  id: string
  members: string[]
  names: Record<string, string>
  participantRoles: Record<string, 'hero' | 'citizen'>
  requesterUid: string
  status: 'active' | 'closed'
  updatedAt: number
}

// 長さを含め、区切り文字を含むUIDでも別の組み合わせと衝突させない。
export function directChatId(a: string, b: string) {
  return `v2_${[a, b].sort().map(uid => `${uid.length}:${uid}`).join('')}`
}

export function readDirectChat(id: string, data: Record<string, unknown>): DirectChat {
  return {
    id,
    members: Array.isArray(data.members) ? data.members : [],
    names: (data.names ?? {}) as Record<string, string>,
    participantRoles: (data.participantRoles ?? {}) as Record<string, 'hero' | 'citizen'>,
    requesterUid: typeof data.requesterUid === 'string' ? data.requesterUid : '',
    status: data.status === 'active' ? 'active' : 'closed',
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0,
  }
}

export function partnerName(chat: DirectChat, uid: string) {
  return chat.names[chat.members.find(member => member !== uid) ?? ''] || '名前未設定'
}

/** 同じ2人は同じ部屋を再利用。相手ごとの会話は並行して開始できる。 */
export async function startDirectChat(db: Firestore, uid: string, partnerUid: string) {
  if (!uid || !partnerUid || uid === partnerUid) throw new DirectChatError('自分とはチャットできません。')
  const members = [uid, partnerUid].sort()
  const id = directChatId(uid, partnerUid)
  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'directChats', id)
    const [room, ...profiles] = await Promise.all([
      transaction.get(roomRef),
      ...members.map(member => transaction.get(doc(db, 'userProfiles', member))),
    ])
    if (room.data()?.status === 'active') return
    if (profiles.some(profile => !profile.exists())) throw new DirectChatError('プロフィールが見つかりません。')
    const participantRoles = Object.fromEntries(members.map((member, index) => [member,
      profiles[index].data()?.role === 'hero' ? 'hero' : 'citizen',
    ])) as Record<string, 'hero' | 'citizen'>
    if (participantRoles[uid] !== 'citizen') throw new DirectChatError('チャットを開始できるのは市民として利用しているときだけです。')
    if (participantRoles[partnerUid] !== 'hero') throw new DirectChatError('ヒーローを選択してください。')
    const names = Object.fromEntries(members.map((member, index) => [member,
      String(profiles[index].data()?.profileName || '名前未設定').slice(0, 100),
    ]))
    transaction.set(roomRef, {
      members, names, status: 'active', updatedAt: serverTimestamp(),
      requesterUid: uid, participantRoles,
      createdAt: room.data()?.createdAt ?? serverTimestamp(),
    })
  })
  return id
}

/** 市民の依頼者だけが終了でき、履歴は残す。 */
export async function endDirectChat(db: Firestore, uid: string, id: string) {
  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'directChats', id)
    const room = await transaction.get(roomRef)
    const data = room.data()
    if (!data?.members?.includes(uid) || data.requesterUid !== uid) throw new DirectChatError('依頼を終了できるのは、チャットを始めた市民だけです。')
    if (data.status === 'closed') return
    transaction.update(roomRef, { status: 'closed', updatedAt: serverTimestamp() })
  })
}

export async function sendDirectMessage(db: Firestore, chatId: string, senderUid: string, draft: string) {
  const text = draft.trim()
  if (!text || text.length > MAX_MESSAGE_LENGTH) throw new DirectChatError('メッセージは1〜2000文字で入力してください。')
  await addDoc(collection(db, 'directChats', chatId, 'messages'), { senderUid, text, createdAt: serverTimestamp() })
}
