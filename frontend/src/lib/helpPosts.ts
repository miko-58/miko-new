import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import type { HelpCategory, HelpType } from '../types'
import { db } from './firebase'
import { claimHelp } from './helpParticipation'

type CreateHelpPostInput = {
  category: HelpCategory
  description: string
  type: HelpType
  location: string
  requesterFeature?: string
  approximateCoordinates?: {
    latitude: number
    longitude: number
    accuracyMeters: number
  } | null
  imageUrls?: string[]
}

function createTitle(description: string) {
  const firstLine = description.trim().split(/\r?\n/)[0] ?? ''
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine
}

/** ログイン済みの本人として Help 投稿を Firestore に保存する。 */
export async function createHelpPost(user: User, input: CreateHelpPostInput) {
  const description = input.description.trim()

  if (!description) {
    throw new Error('投稿内容を入力してください。')
  }

  const post = doc(collection(db, 'helpPosts'))
  const privateLocation = doc(post, 'private', 'location')
  const batch = writeBatch(db)

  // 一覧で読まれる投稿本体には、詳しい場所や座標を入れない。
  batch.set(post, {
    title: createTitle(description),
    description,
    category: input.category,
    type: input.type,
    locationHint: '詳しい場所は投稿詳細で確認できます',
    requesterFeature: input.requesterFeature?.trim() || null,
    status: 'open',
    acceptedHelperUid: null,
    authorUid: user.uid,
    authorName: user.displayName ?? '名前未設定',
    authorPhotoUrl: user.photoURL ?? null,
    imageUrls: input.imageUrls ?? [],
    imageUrl: input.imageUrls?.[0] ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 保存先を維持し、ルールでログイン済みユーザーに場所の閲覧を許可する。
  batch.set(privateLocation, {
    location: input.location,
    approximateCoordinates: input.approximateCoordinates ?? null,
    createdAt: serverTimestamp(),
  })
  await batch.commit()

  return post.id
}

/** 開いている投稿を引き受ける。認可は Firestore ルールでも確認する。 */
export async function acceptHelpPost(user: User, postId: string) {
  await claimHelp(db, user, postId)
}
