import type { User } from 'firebase/auth'
import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { finishHelp } from './helpParticipation'

export type UserStats = {
  helpedCount: number
  helpedByCount: number
  ratingSum: number
  ratingCount: number
}

export const emptyUserStats: UserStats = {
  helpedCount: 0,
  helpedByCount: 0,
  ratingSum: 0,
  ratingCount: 0,
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function readUserStats(data: Record<string, unknown> | undefined): UserStats {
  return {
    helpedCount: numberOrZero(data?.helpedCount),
    helpedByCount: numberOrZero(data?.helpedByCount),
    ratingSum: numberOrZero(data?.ratingSum),
    ratingCount: numberOrZero(data?.ratingCount),
  }
}

function initialProfile() {
  return {
    ...emptyUserStats,
    completedHelpIds: [],
    closedPostIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

/** 初回ログイン時に、本人だけが読める利用回数の記録を作る。 */
export async function ensureUserProfile(user: User) {
  const profileRef = doc(db, 'userProfiles', user.uid)

  await runTransaction(db, async (transaction) => {
    const profile = await transaction.get(profileRef)
    if (!profile.exists()) {
      transaction.set(profileRef, initialProfile())
    }
  })
}

/** 「助ける」を完了した人の回数を、同じ Help では一度だけ増やす。 */
export async function recordHelped(userId: string, helpId: string) {
  await finishHelp(db, userId, helpId, 'helper')
}

export async function closePostAndRecordHelpedBy(userId: string, postId: string) {
  await finishHelp(db, userId, postId, 'author')
}
