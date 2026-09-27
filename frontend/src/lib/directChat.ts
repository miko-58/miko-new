import { addDoc, collection, doc, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore'

export const MAX_MESSAGE_LENGTH = 2000
export class DirectChatError extends Error {}
export type DirectChat = {
  id: string
  members: string[]
  names: Record<string, string>
  status: 'active' | 'closed'
  updatedAt: number
}

// 長さを含め、区切り文字を含むUIDでも別の組み合わせと衝突させない。
export function directChatId(a: string, b: string) {
  return [a, b].sort().map(uid => `${uid.length}:${uid}`).join('')
}

export function readDirectChat(id: string, data: Record<string, unknown>): DirectChat {
  return {
    id,
    members: Array.isArray(data.members) ? data.members : [],
    names: (data.names ?? {}) as Record<string, string>,
    status: data.status === 'active' ? 'active' : 'closed',
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0,
  }
}

export function partnerName(chat: DirectChat, uid: string) {
  return chat.names[chat.members.find(member => member !== uid) ?? ''] || '名前未設定'
}

/** 同じ2人は同じ部屋を再利用。双方の占有と部屋の開始を同時に保存する。 */
export async function startDirectChat(db: Firestore, uid: string, partnerUid: string) {
  if (!uid || !partnerUid || uid === partnerUid) throw new DirectChatError('自分とはチャットできません。')
  const members = [uid, partnerUid].sort()
  const id = directChatId(uid, partnerUid)
  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'directChats', id)
    const lockRefs = [uid, partnerUid].map(member => doc(db, 'activeChats', member))
    const [room, ownLock, partnerLock, ...profiles] = await Promise.all([
      transaction.get(roomRef), ...lockRefs.map(ref => transaction.get(ref)),
      ...members.map(member => transaction.get(doc(db, 'userProfiles', member))),
    ])
    if (ownLock.data()?.chatId && ownLock.data()?.chatId !== id) {
      throw new DirectChatError('現在のやり取りを終了してから、次の相手とチャットしてください。')
    }
    if (partnerLock.data()?.chatId && partnerLock.data()?.chatId !== id) {
      throw new DirectChatError('相手は別の人とやり取り中です。時間をおいてお試しください。')
    }
    if (room.data()?.status === 'active') return
    if (profiles.some(profile => !profile.exists())) throw new DirectChatError('プロフィールが見つかりません。')
    if (profiles.every(profile => profile.data()?.role === 'hero')) {
      throw new DirectChatError('ヒーロー同士ではチャットできません。市民からの相談を待ちましょう。')
    }
    const names = Object.fromEntries(members.map((member, index) => [member,
      String(profiles[index].data()?.profileName || '名前未設定').slice(0, 100),
    ]))
    transaction.set(roomRef, {
      members, names, status: 'active', updatedAt: serverTimestamp(),
      createdAt: room.data()?.createdAt ?? serverTimestamp(),
    })
    lockRefs.forEach(ref => transaction.set(ref, { chatId: id }))
  })
  return id
}

/** どちらからでも終了でき、履歴を残して双方の占有を解除する。 */
export async function endDirectChat(db: Firestore, uid: string, id: string) {
  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'directChats', id)
    const room = await transaction.get(roomRef)
    const data = room.data()
    if (!data?.members?.includes(uid)) throw new DirectChatError('この会話を終了できません。')
    if (data.status === 'closed') return
    const refs = (data.members as string[]).map(member => doc(db, 'activeChats', member))
    const locks = await Promise.all(refs.map(ref => transaction.get(ref)))
    transaction.update(roomRef, { status: 'closed', updatedAt: serverTimestamp() })
    locks.forEach((lock, index) => {
      if (lock.data()?.chatId === id) transaction.set(refs[index], { chatId: null })
    })
  })
}

export async function sendDirectMessage(db: Firestore, chatId: string, senderUid: string, draft: string) {
  const text = draft.trim()
  if (!text || text.length > MAX_MESSAGE_LENGTH) throw new DirectChatError('メッセージは1〜2000文字で入力してください。')
  await addDoc(collection(db, 'directChats', chatId, 'messages'), { senderUid, text, createdAt: serverTimestamp() })
}
