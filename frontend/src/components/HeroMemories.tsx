import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { collection, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

type Memory = { id: string; date: Date | null; rating: number }

function MemoryPhotos({ user, memory }: { user: User; memory: Memory }) {
  const [photos, setPhotos] = useState<{ outerPhotoUrl: string; innerPhotoUrl: string } | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPhotos(null)
    setError(false)
    void (async () => {
      try {
        const token = await user.getIdToken()
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/result-photos/${encodeURIComponent(memory.id)}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        })
        if (!response.ok) throw new Error('Photo request failed')
        const data = await response.json()
        if (typeof data.outerPhotoUrl !== 'string' || typeof data.innerPhotoUrl !== 'string') throw new Error('Invalid response')
        if (!controller.signal.aborted) setPhotos(data)
      } catch {
        if (!controller.signal.aborted) setError(true)
      }
    })()
    return () => controller.abort()
  }, [user, memory.id, attempt])
  return <figure className="hero-memories__card">
    <div className="hero-memories__photos">
      {error ? <div className="hero-memories__feedback"><p>写真を読み込めませんでした。</p><button type="button" onClick={() => setAttempt(value => value + 1)}>再読み込み</button></div>
        : photos ? <>
          <img className="hero-memories__outer" src={photos.outerPhotoUrl} alt="助け合いの外カメ写真" loading="lazy" onError={() => setError(true)} />
          <img className="hero-memories__inner" src={photos.innerPhotoUrl} alt="助け合いの内カメ写真" loading="lazy" onError={() => setError(true)} />
        </> : <p className="hero-memories__feedback" role="status">写真を読み込み中…</p>}
    </div>
    <figcaption>
      {memory.date ? <time dateTime={memory.date.toISOString()}>{memory.date.toLocaleDateString('ja-JP')}</time> : <span>保存中…</span>}
      <span aria-label={`評価 ${memory.rating}つ星`}>★ {memory.rating}</span>
    </figcaption>
  </figure>
}

export default function HeroMemories({ user }: { user: User }) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setState('loading')
    setMemories([])
    return onSnapshot(collection(db, 'userProfiles', user.uid, 'ratings'), snapshot => {
      setMemories(snapshot.docs.flatMap(record => {
        const data = record.data()
        if (typeof data.outerPhotoUrl !== 'string' || !data.outerPhotoUrl || typeof data.innerPhotoUrl !== 'string' || !data.innerPhotoUrl) return []
        return [{ id: record.id, date: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
          rating: typeof data.rating === 'number' ? data.rating : 0 }]
      }).sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)))
      setState('ready')
    }, () => setState('error'))
  }, [user.uid, attempt])
  return <section className="hero-my-page__activity hero-memories" aria-labelledby="hero-memories-title">
    <h2 id="hero-memories-title">助け合いの思い出</h2>
    <p className="hero-memories__description">市民から届いた、助け合いの写真を残しています。</p>
    {state === 'loading' ? <p role="status">思い出を読み込み中…</p>
      : state === 'error' ? <div role="alert"><p>思い出を読み込めませんでした。</p><button type="button" onClick={() => setAttempt(value => value + 1)}>再読み込み</button></div>
        : memories.length === 0 ? <p className="hero-memories__empty">まだ写真はありません。市民が写真と評価を送ると、ここに表示されます。</p>
          : <div className="hero-memories__grid">{memories.map(memory => <MemoryPhotos key={memory.id} user={user} memory={memory} />)}</div>}
  </section>
}
