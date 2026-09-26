import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'

export class HelpParticipationError extends Error {}

/** 投稿者・担当者の両方を同じトランザクションで確保する。 */
export async function claimHelp(db: Firestore, user: { uid: string; displayName: string | null }, postId: string) {
  await runTransaction(db, async (transaction) => {
    const postRef = doc(db, 'helpPosts', postId)
    const post = await transaction.get(postRef)
    const data = post.data()
    if (!data || data.status !== 'open' || data.acceptedHelperUid !== null) {
      throw new HelpParticipationError('この案件はすでに担当者が決まっているか、終了しています。')
    }
    if (data.authorUid === user.uid) throw new HelpParticipationError('自分の投稿は引き受けられません。')
    const refs = [doc(db, 'activeHelps', user.uid), doc(db, 'activeHelps', data.authorUid)]
    const locks = await Promise.all(refs.map((ref) => transaction.get(ref)))
    if (locks[0].data()?.helpId) throw new HelpParticipationError('現在進行中の助け合いを完了してから、次の案件を引き受けてください。')
    if (locks[1].data()?.helpId) throw new HelpParticipationError('投稿者は別の助け合いに対応中です。')
    transaction.update(postRef, {
      status: 'matched', acceptedHelperUid: user.uid,
      acceptedHelperName: user.displayName ?? '名前未設定', acceptedAt: serverTimestamp(),
    })
    for (const ref of refs) transaction.set(ref, { helpId: postId })
  })
}

/** 完了・双方の占有解除・本人の実績をまとめて保存する。再実行しても加算は1回。 */
export async function finishHelp(db: Firestore, uid: string, postId: string, role: 'author' | 'helper') {
  await runTransaction(db, async (transaction) => {
    const postRef = doc(db, 'helpPosts', postId)
    const post = await transaction.get(postRef)
    const data = post.data()
    if (!data || (role === 'author' ? data.authorUid !== uid : data.acceptedHelperUid !== uid)) {
      throw new HelpParticipationError('この案件を完了できるのは投稿者と担当者だけです。')
    }
    if (!['open', 'matched', 'closed'].includes(data.status) || (role === 'helper' && data.status === 'open')) {
      throw new HelpParticipationError('この案件は完了できません。')
    }
    const profileRef = doc(db, 'userProfiles', uid)
    const lockRefs = [data.authorUid, data.acceptedHelperUid].filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map((id) => doc(db, 'activeHelps', id))
    const [profile, ...locks] = await Promise.all([transaction.get(profileRef), ...lockRefs.map((ref) => transaction.get(ref))])
    if (data.status !== 'closed') transaction.update(postRef, { status: 'closed', updatedAt: serverTimestamp() })
    locks.forEach((lock, index) => {
      if (lock.data()?.helpId === postId) transaction.set(lockRefs[index], { helpId: null })
    })
    const countField = role === 'author' ? 'helpedByCount' : 'helpedCount'
    const idsField = role === 'author' ? 'closedPostIds' : 'completedHelpIds'
    const previous = profile.data() ?? {}
    const ids: string[] = Array.isArray(previous[idsField]) ? previous[idsField] : []
    if (!ids.includes(postId)) {
      const count = typeof previous[countField] === 'number' ? previous[countField] : 0
      transaction.set(profileRef, {
        ...(!profile.exists() ? { helpedCount: 0, helpedByCount: 0, ratingSum: 0, ratingCount: 0, completedHelpIds: [], closedPostIds: [], createdAt: serverTimestamp() } : {}),
        [countField]: count + 1, [idsField]: [...ids, postId], updatedAt: serverTimestamp(),
      }, { merge: true })
    }
  })
}
