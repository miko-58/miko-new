import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
﻿import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { claimHelp, finishHelp } from '../frontend/src/lib/helpParticipation.ts'

let env
const clients = new Map()
const db = (uid) => {
  if (!clients.has(uid)) clients.set(uid, env.authenticatedContext(uid).firestore())
  return clients.get(uid)
}
const user = (uid) => ({ uid, displayName: uid })
const post = (authorUid) => ({ authorUid, status: 'open', acceptedHelperUid: null })
const stats = { helpedCount: 0, helpedByCount: 0, ratingSum: 0, ratingCount: 0, completedHelpIds: [], closedPostIds: [] }
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nearu-participation', firestore: { host: '127.0.0.1', port: 8089, rules: readFileSync('firebase/firestore.rules','utf8') } })
})
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const admin = context.firestore()
    await Promise.all([
      setDoc(doc(admin,'appConfig','helpParticipation'), {enabled:true}),
      ...['a','b','c','d'].map(uid => setDoc(doc(admin,'userProfiles',uid),stats)),
      setDoc(doc(admin,'helpPosts','one'),post('a')),
      setDoc(doc(admin,'helpPosts','two'),post('c')),
      setDoc(doc(admin,'helpPosts','same-author'),post('a')),
      setDoc(doc(admin,'helpPosts','helpers-post'),post('b')),
    ])
  })
})
test('claim locks both people and still permits participant messages', async () => {
  await claimHelp(db('b'), user('b'), 'one')
  assert.equal((await getDoc(doc(db('b'),'activeHelps','a'))).data().helpId,'one')
  assert.equal((await getDoc(doc(db('b'),'activeHelps','b'))).data().helpId,'one')
  await assertSucceeds(addDoc(collection(db('b'),'helpPosts','one','messages'), {senderUid:'b',text:'test',createdAt:serverTimestamp()}))
  await assertFails(addDoc(collection(db('d'),'helpPosts','one','messages'), {senderUid:'d',text:'test',createdAt:serverTimestamp()}))
})
test('same helper concurrent claims: exactly one succeeds', async () => {
  const results=await Promise.allSettled([claimHelp(db('b'),user('b'),'one'),claimHelp(db('b'),user('b'),'two')])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
})
test('same author concurrent claims: exactly one succeeds', async () => {
  const results=await Promise.allSettled([claimHelp(db('b'),user('b'),'one'),claimHelp(db('d'),user('d'),'same-author')])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
})
test('busy users cannot participate in either role', async () => {
  await claimHelp(db('b'),user('b'),'one')
  await assert.rejects(claimHelp(db('a'),user('a'),'two'))
  await assert.rejects(claimHelp(db('d'),user('d'),'helpers-post'))
  await assert.rejects(claimHelp(db('b'),user('b'),'two'))
})
test('direct API bypass, lock release, deletion and reopening are denied', async () => {
  await assertFails(updateDoc(doc(db('b'),'helpPosts','one'), {status:'matched',acceptedHelperUid:'b',acceptedHelperName:'b',acceptedAt:serverTimestamp()}))
  await claimHelp(db('b'),user('b'),'one')
  await assertFails(setDoc(doc(db('b'),'activeHelps','b'), {helpId:null}))
  await assertFails(deleteDoc(doc(db('a'),'helpPosts','one')))
  await assertFails(updateDoc(doc(db('a'),'helpPosts','one'), {status:'open'}))
  await assertFails(updateDoc(doc(db('a'),'helpPosts','one'), {status:'closed'}))
  const batch=writeBatch(db('b'))
  batch.update(doc(db('b'),'helpPosts','two'), {status:'matched',acceptedHelperUid:'b',acceptedHelperName:'b',acceptedAt:serverTimestamp()})
  batch.set(doc(db('b'),'activeHelps','b'),{helpId:'two'})
  batch.set(doc(db('b'),'activeHelps','c'),{helpId:'two'})
  await assertFails(batch.commit())
})
for (const role of ['author','helper']) {
  test(`${role} completion releases both; next claim works; stats are idempotent`, async () => {
    await claimHelp(db('b'),user('b'),'one')
    const uid=role==='author'?'a':'b'
    await finishHelp(db(uid),uid,'one',role)
    await finishHelp(db(uid),uid,'one',role)
    assert.equal((await getDoc(doc(db(uid),'helpPosts','one'))).data().status,'closed')
    for(const id of ['a','b']) assert.equal((await getDoc(doc(db(uid),'activeHelps',id))).data().helpId,null)
    assert.equal((await getDoc(doc(db(uid),'userProfiles',uid))).data()[role==='author'?'helpedByCount':'helpedCount'],1)
    await claimHelp(db('b'),user('b'),'two')
    await finishHelp(db(uid),uid,'one',role)
    assert.equal((await getDoc(doc(db('b'),'activeHelps','b'))).data().helpId,'two')
  })
}
test('nonparticipant and self acceptance denied', async () => {
  await assert.rejects(claimHelp(db('a'),user('a'),'one'))
  await claimHelp(db('b'),user('b'),'one')
  await assert.rejects(finishHelp(db('d'),'d','one','helper'))
  await assertFails(updateDoc(doc(db('d'),'helpPosts','one'),{status:'closed'}))
})
test('migration gate fails closed', async () => {
  await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'appConfig','helpParticipation'),{enabled:false}))
  await assert.rejects(claimHelp(db('b'),user('b'),'one'))
})
test('legacy matched post without locks can still finish', async () => {
  await env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'helpPosts','one'),{status:'matched',acceptedHelperUid:'b'}))
  await finishHelp(db('b'),'b','one','helper')
  assert.equal((await getDoc(doc(db('b'),'helpPosts','one'))).data().status,'closed')
})

test('completion works before the profile was initialized', async () => {
  await env.withSecurityRulesDisabled(async ctx=>deleteDoc(doc(ctx.firestore(),'userProfiles','b')))
  await claimHelp(db('b'),user('b'),'one')
  await finishHelp(db('b'),'b','one','helper')
  assert.equal((await getDoc(doc(db('b'),'userProfiles','b'))).data().helpedCount,1)
})

test('simultaneous completion by both participants is idempotent', async () => {
  await claimHelp(db('b'),user('b'),'one')
  await Promise.all([finishHelp(db('a'),'a','one','author'),finishHelp(db('b'),'b','one','helper')])
  assert.equal((await getDoc(doc(db('a'),'userProfiles','a'))).data().helpedByCount,1)
  assert.equal((await getDoc(doc(db('b'),'userProfiles','b'))).data().helpedCount,1)
  await assertFails(addDoc(collection(db('b'),'helpPosts','one','messages'),{senderUid:'b',text:'closed',createdAt:serverTimestamp()}))
})
test('clients cannot enable migration or clear another person lock', async () => {
  await assertFails(setDoc(doc(db('b'),'appConfig','helpParticipation'),{enabled:true}))
  await claimHelp(db('b'),user('b'),'one')
  await assertFails(setDoc(doc(db('d'),'activeHelps','a'),{helpId:null}))
  await assertFails(deleteDoc(doc(db('b'),'activeHelps','b')))
})
const migrate = (...args) => promisify(execFile)(process.execPath,['scripts/migrate-active-helps.mjs','--project=demo-nearu-participation',...args])
test('migration dry run is read-only; apply backfills both people and enables claims', async () => {
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'appConfig','helpParticipation'),{enabled:false})
    await updateDoc(doc(ctx.firestore(),'helpPosts','one'),{status:'matched',acceptedHelperUid:'b'})
  })
  await migrate()
  assert.equal((await getDoc(doc(db('b'),'activeHelps','b'))).exists(),false)
  await migrate('--apply','--rules-installed')
  assert.equal((await getDoc(doc(db('b'),'activeHelps','a'))).data().helpId,'one')
  assert.equal((await getDoc(doc(db('b'),'activeHelps','b'))).data().helpId,'one')
  await assert.rejects(claimHelp(db('b'),user('b'),'two'))
  await claimHelp(db('d'),user('d'),'two')
})
test('migration refuses conflicting legacy posts without enabling claims', async () => {
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'appConfig','helpParticipation'),{enabled:false})
    await updateDoc(doc(ctx.firestore(),'helpPosts','one'),{status:'matched',acceptedHelperUid:'b'})
    await updateDoc(doc(ctx.firestore(),'helpPosts','two'),{status:'matched',acceptedHelperUid:'b'})
  })
  await assert.rejects(migrate('--apply','--rules-installed'))
  assert.equal((await getDoc(doc(db('b'),'activeHelps','b'))).exists(),false)
  await env.withSecurityRulesDisabled(async ctx=>{
    assert.equal((await getDoc(doc(ctx.firestore(),'appConfig','helpParticipation'))).data().enabled,false)
  })
})
