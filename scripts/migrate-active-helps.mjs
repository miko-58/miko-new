import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.argv.find(arg => arg.startsWith('--project='))?.slice(10)
if (!projectId) throw new Error('Specify --project=PROJECT_ID. Default mode is read-only.')
const apply = process.argv.includes('--apply')
initializeApp({ projectId, ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }) })
const db = getFirestore()

// デフォルトは読み取り専用。複数案件がある人はIDを報告し、自動で終了させない。
function plan(posts, existing) {
  const desired = new Map()
  for (const post of posts.docs) {
    const data = post.data()
    if (!data.authorUid || !data.acceptedHelperUid || data.authorUid === data.acceptedHelperUid) {
      throw new Error(`Invalid participants: ${post.id}`)
    }
    for (const uid of [data.authorUid, data.acceptedHelperUid]) {
      if (desired.has(uid)) throw new Error(`Multiple active helps for ${uid}: ${desired.get(uid)}, ${post.id}`)
      desired.set(uid, post.id)
    }
  }
  const writes = new Map([...desired])
  for (const lock of existing.docs) if (!desired.has(lock.id)) writes.set(lock.id, null)
  if (writes.size > 450) throw new Error('More than 450 locks; use a reviewed server-side migration for this dataset.')
  return { writes, activePosts: posts.size }
}

if (!apply) {
  const [posts, locks] = await Promise.all([
    db.collection('helpPosts').where('status','==','matched').get(),
    db.collection('activeHelps').get(),
  ])
  const result = plan(posts, locks)
  console.log(JSON.stringify({ mode:'dry-run', projectId, activePosts:result.activePosts, locksToWrite:result.writes.size }))
} else {
  if (!process.argv.includes('--rules-installed')) throw new Error('Deploy the new rules first, then pass --rules-installed.')
  await db.runTransaction(async transaction => {
    const configRef = db.doc('appConfig/helpParticipation')
    const config = await transaction.get(configRef)
    if (config.data()?.enabled === true) throw new Error('Already enabled. Disable new claims in appConfig/helpParticipation before rerunning migration.')
    const posts = await transaction.get(db.collection('helpPosts').where('status','==','matched'))
    const locks = await transaction.get(db.collection('activeHelps'))
    const result = plan(posts,locks)
    for (const [uid, helpId] of result.writes) transaction.set(db.doc(`activeHelps/${uid}`),{helpId})
    transaction.set(configRef,{enabled:true})
  })
  console.log(JSON.stringify({mode:'applied', projectId, enabled:true}))
}
await db.terminate()
