import { useEffect, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useNavigate, useParams } from 'react-router-dom'
import { StarIcon } from '../components/icons'
import { useAuth } from '../contexts/AuthContext'
import { submitCitizenResult } from '../lib/citizenResult'
import { endDirectChat } from '../lib/directChat'
import { db } from '../lib/firebase'
import { uploadHelpPhoto } from '../lib/photoUpload'

type CameraSide = 'environment' | 'user'
type CapturedPhoto = { file: File; previewUrl: string }
type ResultContext = { heroUid: string; heroName: string }

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export default function Resolve() {
  const { id: chatId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [context, setContext] = useState<ResultContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [cameraSide, setCameraSide] = useState<CameraSide | null>(null)
  const [outerPhoto, setOuterPhoto] = useState<CapturedPhoto | null>(null)
  const [innerPhoto, setInnerPhoto] = useState<CapturedPhoto | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!user || !chatId) {
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const room = await getDoc(doc(db, 'directChats', chatId))
        const members = room.data()?.members
        if (!room.exists() || room.data().status !== 'active' || !Array.isArray(members) || !members.includes(user.uid)) {
          throw new Error('このやり取りは解決できません。')
        }
        const heroUid = members.find((member) => member !== user.uid)
        if (typeof heroUid !== 'string') throw new Error('評価するヒーローが見つかりません。')
        const [citizenProfile, heroProfile] = await Promise.all([
          getDoc(doc(db, 'userProfiles', user.uid)),
          getDoc(doc(db, 'userProfiles', heroUid)),
        ])
        const citizenData = citizenProfile.data()
        const heroData = heroProfile.data()
        if (citizenData?.role !== 'citizen' || heroData?.role !== 'hero') {
          throw new Error('市民がヒーローに評価するやり取りだけを解決できます。')
        }
        if (!cancelled) {
          setContext({
            heroUid,
            heroName: typeof heroData?.profileName === 'string' ? heroData.profileName : 'ヒーロー',
          })
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '解決画面を開けませんでした。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [chatId, user])

  useEffect(() => () => stopStream(streamRef.current), [])

  const closeCamera = () => {
    stopStream(streamRef.current)
    streamRef.current = null
    setCameraSide(null)
  }

  const openCamera = async (side: CameraSide) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('この端末ではカメラを利用できません。')
      return
    }
    closeCamera()
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: side } } })
      streamRef.current = stream
      setCameraSide(side)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => setCameraError('カメラ映像を開始できませんでした。'))
        }
      })
    } catch {
      setCameraError('カメラを開始できませんでした。ブラウザでカメラの利用を許可してから、もう一度お試しください。')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || !cameraSide || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('カメラ映像の準備ができていません。')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('写真を作成できませんでした。')
        return
      }
      const photo = {
        file: new File([blob], `${cameraSide}-result-${Date.now()}.jpg`, { type: 'image/jpeg' }),
        previewUrl: URL.createObjectURL(blob),
      }
      const setPhoto = cameraSide === 'environment' ? setOuterPhoto : setInnerPhoto
      setPhoto((previous) => {
        if (previous) URL.revokeObjectURL(previous.previewUrl)
        return photo
      })
      closeCamera()
    }, 'image/jpeg', 0.88)
  }

  const sendResolution = async () => {
    if (isSending || !user || !chatId || !context) return
    if (!outerPhoto || !innerPhoto) {
      setError('外カメと内カメの写真を1枚ずつ撮影してください。')
      return
    }
    if (!rating) {
      setError('ヒーローへの評価を選んでください。')
      return
    }
    setIsSending(true)
    setError('')
    try {
      const [outer, inner] = await Promise.all([uploadHelpPhoto(user, outerPhoto.file), uploadHelpPhoto(user, innerPhoto.file)])
      await submitCitizenResult(db, {
        chatId, citizenUid: user.uid, heroUid: context.heroUid, rating,
        outerPhotoUrl: outer.imageUrl, innerPhotoUrl: inner.imageUrl,
      })
      await endDirectChat(db, user.uid, chatId)
      navigate('/messages', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '評価の送信に失敗しました。もう一度お試しください。')
    } finally {
      setIsSending(false)
    }
  }

  if (loading) return <p className="empty-state">解決内容を準備しています…</p>
  if (!context) return <div className="screen screen--narrow resolve-screen"><div className="resolve-body"><p role="alert">{error || '解決画面を開けませんでした。'}</p><button type="button" className="btn btn--primary" onClick={() => navigate('/messages')}>メッセージ一覧へ</button></div></div>

  return <div className="screen screen--narrow resolve-screen">
    <div className="screen__scroll resolve-body">
      <div className="resolve-confetti" aria-hidden="true">🎉</div>
      <h1>助け合い、ありがとう！</h1>
      <p className="resolve-sub">外カメと内カメで「できた！」を残して、{context.heroName}さんへ評価を送りましょう。</p>
      <section className="resolve-camera" aria-labelledby="resolve-camera-title">
        <div className="resolve-camera__heading"><span aria-hidden="true">📷</span><div><h2 id="resolve-camera-title">今日の助け合いを記録</h2><p>外カメ1枚＋内カメ1枚</p></div></div>
        <div className="resolve-camera__previews">
          {cameraSide ? <div className="resolve-camera__live"><video ref={videoRef} autoPlay playsInline muted /></div> : <>
            <div className="resolve-camera__outer">{outerPhoto ? <img src={outerPhoto.previewUrl} alt="外カメで撮影した写真" /> : <span>外カメ<br />未撮影</span>}</div>
            {innerPhoto && <div className="resolve-camera__inner"><img src={innerPhoto.previewUrl} alt="内カメで撮影した写真" /></div>}
          </>}
        </div>
        {cameraSide ? <div className="resolve-camera__live-actions"><button type="button" onClick={capturePhoto}>● 撮影する</button><button type="button" className="resolve-camera__cancel" onClick={closeCamera}>閉じる</button></div> : <div className="resolve-camera__actions"><button type="button" onClick={() => void openCamera('environment')}>{outerPhoto ? '外カメを撮り直す' : '外カメを起動'}</button><button type="button" onClick={() => void openCamera('user')}>{innerPhoto ? '内カメを撮り直す' : '内カメを起動'}</button></div>}
        {cameraError && <p className="resolve-camera__error" role="alert">{cameraError}</p>}
      </section>
      <section className="resolve-rating" aria-labelledby="resolve-rating-title">
        <p id="resolve-rating-title">{context.heroName}さんへの評価</p>
        <div className="resolve-stars">{[1, 2, 3, 4, 5].map((number) => <button key={number} type="button" aria-label={`${number}つ星`} onClick={() => setRating(number)} className="resolve-stars__btn"><StarIcon filled={number <= rating} /></button>)}</div>
        <small>{rating ? `${rating} / 5 を選択中` : '星をタップして評価してください'}</small>
      </section>
    </div>
    <div className="screen__footer screen__footer--stacked resolve-footer">
      {error && <p role="alert">{error}</p>}
      <button type="button" className="btn btn--primary btn--block" onClick={() => void sendResolution()} disabled={isSending || !outerPhoto || !innerPhoto || !rating}>{isSending ? '写真と評価を送信中…' : '解決して評価を送る'}</button>
      <button type="button" className="btn btn--text" onClick={() => navigate(`/chat/${chatId}`)} disabled={isSending}>チャットに戻る</button>
    </div>
  </div>
}
