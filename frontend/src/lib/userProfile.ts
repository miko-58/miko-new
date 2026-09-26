import { updateProfile, type User } from 'firebase/auth'
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

type OnboardingProfile = {
  role: 'hero' | 'citizen'
  name: string
  skills: string[]
  gender: string
  reward: string
}

function readOnboardingProfile(): OnboardingProfile | null {
  const raw = sessionStorage.getItem('nearu-onboarding')
  if (!raw) return null

  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null

    const data = value as Record<string, unknown>
    const role = data.role === 'hero' || data.role === 'citizen' ? data.role : null
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const gender = typeof data.gender === 'string' ? data.gender : ''
    const reward = typeof data.reward === 'string' ? data.reward : ''
    const skills = Array.isArray(data.skills) ? data.skills.filter((skill): skill is string => typeof skill === 'string') : []

    if (!role || !name || !gender) return null
    return { role, name, skills, gender, reward }
  } catch {
    return null
  }
}

function onboardingFields(profile: OnboardingProfile | null) {
  if (!profile) return {}

  return {
    role: profile.role,
    profileName: profile.name,
    skills: profile.skills,
    gender: profile.gender,
    reward: profile.reward,
  }
}

function initialProfile(profile: OnboardingProfile | null) {
  return {
    ...emptyUserStats,
    completedHelpIds: [],
    closedPostIds: [],
    ...onboardingFields(profile),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

/** 初回ログイン時に、本人だけが読めるプロフィールと利用回数の記録を作る。 */
export async function ensureUserProfile(user: User) {
  const profileRef = doc(db, 'userProfiles', user.uid)
  const onboarding = readOnboardingProfile()

  await runTransaction(db, async (transaction) => {
    const profile = await transaction.get(profileRef)
    if (!profile.exists()) {
      transaction.set(profileRef, initialProfile(onboarding))
    } else if (onboarding) {
      transaction.update(profileRef, {
        ...onboardingFields(onboarding),
        updatedAt: serverTimestamp(),
      })
    }
  })

  if (onboarding) {
    await updateProfile(user, { displayName: onboarding.name })
    sessionStorage.removeItem('nearu-onboarding')
  }
}

/** 「助ける」を完了した人の回数を、同じ Help では一度だけ増やす。 */
export async function recordHelped(userId: string, helpId: string) {
  await finishHelp(db, userId, helpId, 'helper')
}

export async function closePostAndRecordHelpedBy(userId: string, postId: string) {
  await finishHelp(db, userId, postId, 'author')
}
