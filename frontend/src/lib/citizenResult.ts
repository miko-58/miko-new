import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'

export class CitizenResultError extends Error {}

type SubmitCitizenResultInput = {
  chatId: string
  citizenUid: string
  heroUid: string
  rating: number
  outerPhotoUrl: string
  innerPhotoUrl: string
}

/** 市民からヒーローへの評価は、1つのチャットにつき1回だけ保存する。 */
export async function submitCitizenResult(db: Firestore, input: SubmitCitizenResultInput) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new CitizenResultError('評価は1〜5つ星で選んでください。')
  }

  const room = await getDoc(doc(db, 'directChats', input.chatId))
  if (!room.exists() || room.data().status !== 'active' || !room.data().members?.includes(input.citizenUid) || !room.data().members?.includes(input.heroUid)) {
    throw new CitizenResultError('このチャットは評価できない状態です。')
  }

  await setDoc(doc(db, 'userProfiles', input.heroUid, 'ratings', input.chatId), {
    citizenUid: input.citizenUid,
    rating: input.rating,
    outerPhotoUrl: input.outerPhotoUrl,
    innerPhotoUrl: input.innerPhotoUrl,
    createdAt: serverTimestamp(),
  })
}
