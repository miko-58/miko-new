import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore'
import { directChatId, startDirectChat, endDirectChat, sendDirectMessage } from '../frontend/src/lib/directChat.ts'

let env
const clients = new Map()
const db = uid => {
  if (!clients.has(uid)) clients.set(uid, env.authenticatedContext(uid).firestore())
  return clients.get(uid)
}
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nearu-participation', firestore: { host: '127.0.0.1', port: 8089, rules: readFileSync('firebase/firestore.rules', 'utf8') } })
})
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    await Promise.all(['a', 'b', 'c', 'd'].map(uid => setDoc(doc(context.firestore(), 'userProfiles', uid), { profileName: uid })))
  })
})
test('pair identity, participant reads, private messages and member query', async () => {
  const id = await startDirectChat(db('a'), 'a', 'b')
  assert.equal(await startDirectChat(db('b'), 'b', 'a'), id)
  assert.notEqual(directChatId('a', 'b_c'), directChatId('a_b', 'c'))
  for (const uid of ['a', 'b']) assert.equal((await getDoc(doc(db(uid), 'activeChats', uid))).data().chatId, id)
  await sendDirectMessage(db('a'), id, 'a', 'こんにちは')
  await assertSucceeds(getDocs(collection(db('b'), 'directChats', id, 'messages')))
  await assertFails(getDoc(doc(db('c'), 'directChats', id)))
  await assertFails(getDocs(collection(db('c'), 'directChats', id, 'messages')))
  await assertFails(sendDirectMessage(db('c'), id, 'c', 'unauthorized'))
  await assertFails(sendDirectMessage(db('a'), id, 'b', 'spoof'))
  const list = await getDocs(query(collection(db('a'), 'directChats'), where('members', 'array-contains', 'a')))
  assert.equal(list.size, 1)
  await assertFails(getDocs(collection(db('a'), 'directChats')))
})
test('both people are busy; concurrent attempts allow exactly one partner', async () => {
  const results = await Promise.allSettled([
    startDirectChat(db('a'), 'a', 'b'), startDirectChat(db('c'), 'c', 'b'),
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  await assert.rejects(startDirectChat(db('b'), 'b', 'd'))
  await assert.rejects(startDirectChat(db('d'), 'd', 'b'))
})
test('same user starting two different conversations simultaneously', async () => {
  const results = await Promise.allSettled([startDirectChat(db('a'), 'a', 'b'), startDirectChat(db('a'), 'a', 'c')])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
})
test('hero pairs cannot start a direct chat', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await Promise.all(['a', 'b'].map(uid => updateDoc(doc(context.firestore(), 'userProfiles', uid), { role: 'hero' })))
  })
  await assert.rejects(startDirectChat(db('a'), 'a', 'b'), /ヒーロー同士/)

  const id = directChatId('a', 'b')
  const batch = writeBatch(db('a'))
  batch.set(doc(db('a'), 'directChats', id), {
    members: ['a', 'b'], names: { a: 'a', b: 'b' }, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  batch.set(doc(db('a'), 'activeChats', 'a'), { chatId: id })
  batch.set(doc(db('a'), 'activeChats', 'b'), { chatId: id })
  await assertFails(batch.commit())
})
for (const endingUser of ['a', 'b']) test(`${endingUser} can end, both locks release, history survives reopening`, async () => {
  const id = await startDirectChat(db('a'), 'a', 'b')
  await sendDirectMessage(db('a'), id, 'a', '残す履歴')
  await endDirectChat(db(endingUser), endingUser, id)
  for (const uid of ['a', 'b']) assert.equal((await getDoc(doc(db(uid), 'activeChats', uid))).data().chatId, null)
  await assertFails(sendDirectMessage(db('b'), id, 'b', 'closed'))
  const next = await startDirectChat(db('b'), 'b', 'c')
  await endDirectChat(db('a'), 'a', id) // 終了済みの再操作で次の会話を解除しない。
  assert.equal((await getDoc(doc(db('b'), 'activeChats', 'b'))).data().chatId, next)
  await assert.rejects(startDirectChat(db('a'), 'a', 'b'))
  await endDirectChat(db('c'), 'c', next)
  assert.equal(await startDirectChat(db('b'), 'b', 'a'), id)
  assert.equal((await getDocs(collection(db('a'), 'directChats', id, 'messages'))).size, 1)
  await sendDirectMessage(db('b'), id, 'b', '再開')
})
test('direct writes cannot bypass locks, change participants or delete history', async () => {
  const id = await startDirectChat(db('a'), 'a', 'b')
  await assertFails(setDoc(doc(db('a'), 'activeChats', 'a'), { chatId: null }))
  await assertFails(deleteDoc(doc(db('a'), 'activeChats', 'a')))
  await assertFails(updateDoc(doc(db('a'), 'directChats', id), { status: 'closed', updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(doc(db('a'), 'directChats', id), { members: ['a', 'c'], updatedAt: serverTimestamp() }))
  await assertFails(deleteDoc(doc(db('a'), 'directChats', id)))
  const other = directChatId('a', 'c')
  const batch = writeBatch(db('a'))
  batch.set(doc(db('a'), 'directChats', other), { members: ['a', 'c'], names: { a: 'a', c: 'c' }, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  batch.set(doc(db('a'), 'activeChats', 'a'), { chatId: other })
  batch.set(doc(db('a'), 'activeChats', 'c'), { chatId: other })
  await assertFails(batch.commit())
  await assert.rejects(endDirectChat(db('c'), 'c', id))
})
test('self chat, missing profile, invalid message and unauthenticated access fail', async () => {
  await assert.rejects(startDirectChat(db('a'), 'a', 'a'))
  await assert.rejects(startDirectChat(db('a'), 'a', 'missing'))
  const id = await startDirectChat(db('a'), 'a', 'b')
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'directChats', id)))
  for (const text of ['', '   ', 'x'.repeat(2001)]) {
    await assertFails(addDoc(collection(db('a'), 'directChats', id, 'messages'), { senderUid: 'a', text, createdAt: serverTimestamp() }))
  }
})
