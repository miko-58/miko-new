import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { DirectChatError, startDirectChat } from '../lib/directChat'
import BottomNav from '../components/BottomNav'
import { db } from '../lib/firebase'
import 'leaflet/dist/leaflet.css'
import './MapView.css'

type Position = { latitude: number; longitude: number; accuracy: number }
type HeroPin = {
  id: string
  name: string
  skills: string[]
  gender: string
  reward: string
  latitude: number
  longitude: number
}

// 位置情報を許可していない場合も、地図は閲覧できる。
const DEFAULT_CENTER: [number, number] = [34.6946, 135.1955]

function MapViewport({ position }: { position: Position | null }) {
  const map = useMap()

  useEffect(() => {
    if (position) map.setView([position.latitude, position.longitude], 16)
  }, [map, position])

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  return null
}

export default function MapView() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [position, setPosition] = useState<Position | null>(null)
  const [locating, setLocating] = useState(true)
  const [locationError, setLocationError] = useState('')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [heroPins, setHeroPins] = useState<HeroPin[]>([])
  const [heroesLoading, setHeroesLoading] = useState(true)
  const [heroesError, setHeroesError] = useState('')
  const [chatError, setChatError] = useState('')
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const active = useRef(true)
  const requestPending = useRef(false)

  async function openChat(partnerUid: string) {
    if (!user || startingRef.current) return
    startingRef.current = true
    setStarting(true)
    setChatError('')
    try {
      const id = await startDirectChat(db, user.uid, partnerUid)
      navigate(`/chat/${encodeURIComponent(id)}`)
    } catch (error) {
      setChatError(error instanceof DirectChatError ? error.message : 'チャットを開始できませんでした。時間をおいてもう一度お試しください。')
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  const locate = useCallback(() => {
    if (requestPending.current) return
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('このブラウザでは現在地を取得できません。地図はそのまま操作できます。')
      setLocating(false)
      return
    }
    requestPending.current = true
    setLocating(true)
    navigator.geolocation.getCurrentPosition((result) => {
      requestPending.current = false
      if (!active.current) return
      setPosition({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
      })
      setLocating(false)
    }, (error) => {
      requestPending.current = false
      if (!active.current) return
      setLocationError(error.code === error.PERMISSION_DENIED
        ? '現在地の利用が許可されていません。ブラウザの位置情報設定を確認してください。'
        : error.code === error.TIMEOUT
          ? '現在地の取得に時間がかかっています。もう一度お試しください。'
          : '現在地を取得できませんでした。地図はそのまま操作できます。')
      setLocating(false)
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }, [])

  useEffect(() => {
    active.current = true
    locate()
    return () => { active.current = false }
  }, [locate])

  useEffect(() => {
    const heroesQuery = query(collection(db, 'userProfiles'), where('role', '==', 'hero'))
    return onSnapshot(heroesQuery, (snapshot) => {
      setHeroPins(snapshot.docs.flatMap((hero) => {
        if (hero.id === user?.uid) return []
        const data = hero.data()
        const location = data.heroLocation
        if (
          !location
          || typeof location.latitude !== 'number'
          || typeof location.longitude !== 'number'
        ) return []

        return [{
          id: hero.id,
          name: typeof data.profileName === 'string' && data.profileName.trim()
            ? data.profileName
            : 'ヒーロー',
          skills: Array.isArray(data.skills)
            ? data.skills.filter((skill): skill is string => typeof skill === 'string')
            : [],
          gender: typeof data.gender === 'string' ? data.gender : '',
          reward: typeof data.reward === 'string' ? data.reward : '',
          latitude: location.latitude,
          longitude: location.longitude,
        }]
      }))
      setHeroesLoading(false)
      setHeroesError('')
    }, () => {
      setHeroPins([])
      setHeroesLoading(false)
      setHeroesError('ヒーローを読み込めませんでした。時間をおいて開き直してください。')
    })
  }, [user?.uid])

  const coordinates: [number, number] | null = position ? [position.latitude, position.longitude] : null

  return (
    <div className="screen map-page">
      <header className="map-page__header">
        <div className={`map-page__controls${view === 'list' ? ' map-page__controls--list' : ''}`}>
          <div className="map-page__switch" role="tablist" aria-label="表示方法">
            <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'is-active' : ''} onClick={() => setView('map')}>地図</button>
            <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>リスト</button>
          </div>
          {/* {view === 'map' && <button type="button" className="map-page__locate" aria-label="現在地へ移動" onClick={locate} disabled={locating}>
              <span aria-hidden="true">➤</span>
            </button>} */}
        </div>
        {(locationError || heroesError || chatError) && <div className="map-page__error" role="alert">
          {locationError && <p>{locationError}</p>}
          {heroesError && <p>{heroesError}</p>}
          {chatError && <p>{chatError} <button type="button" onClick={() => navigate('/messages')}>メッセージ一覧へ</button></p>}
        </div>}
      </header>
      <section className="map-page__canvas" aria-label="周辺の地図">
        {view === 'list' ? (
          <div className="map-page__list" role="tabpanel">
            <p className="map-page__list-title">地図上のヒーロー</p>
            {heroesLoading ? <p className="map-page__list-empty">読み込み中…</p> : heroPins.length ? heroPins.map(hero => <div key={hero.id} className="map-page__hero">
              <div className="map-page__hero-main">
                <div className="map-page__hero-name">
                  <span>ヒーロープロフィール</span>
                  <strong>{hero.name}さん</strong>
                </div>
                <dl className="map-page__hero-details">
                  {hero.gender && <><dt>性別</dt><dd>{hero.gender}</dd></>}
                  {hero.reward && <><dt>報酬</dt><dd>{hero.reward}</dd></>}
                </dl>
              </div>
              <div className="map-page__hero-skills">
                <span>できること</span>
                <p>{hero.skills.length > 0 ? hero.skills.join('・') : 'ヒーローとして活動中'}</p>
              </div>
              <button type="button" className="map-page__chat" disabled={starting} onClick={() => void openChat(hero.id)}>このヒーローにチャットする</button>
            </div>) : !heroesError && <p className="map-page__list-empty">現在、地図上に表示できるヒーローはいません。</p>}
          </div>
        ) : (
          <>
        <MapContainer className="map-page__leaflet" center={coordinates ?? DEFAULT_CENTER} zoom={coordinates ? 16 : 14} scrollWheelZoom zoomControl={false}> 
          <TileLayer
            attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapViewport position={position} />
          {heroPins.map((hero) => (
            <CircleMarker
              key={hero.id}
              center={[hero.latitude, hero.longitude]}
              radius={11}
              pathOptions={{ color: '#7f1d1d', weight: 3, fillColor: '#dc2626', fillOpacity: 1 }}
            >
              <Popup>
                <strong>{hero.name}</strong>
                <br />
                {hero.skills.length ? `得意なこと：${hero.skills.join('、')}` : 'ヒーローとして活動中'}
                <br />
                <button type="button" className="map-page__chat" disabled={starting} onClick={() => void openChat(hero.id)}>{starting ? '接続中…' : 'チャットする'}</button>
              </Popup>
            </CircleMarker>
          ))}
          {coordinates && position && <>
            <Circle center={coordinates} radius={position.accuracy} pathOptions={{ color: '#159868', weight: 2, fillColor: '#b9ead0', fillOpacity: 0.22 }} />
            <CircleMarker center={coordinates} radius={13} pathOptions={{ color: '#fff', weight: 5, fillColor: '#159868', fillOpacity: 1 }}>
              <Popup>あなたの現在地</Popup>
            </CircleMarker>
          </>}
        </MapContainer>

        <button
        type="button"
        className="map-page__locate"
        aria-label="現在地へ移動"
        onClick={locate}
        disabled={locating}
      >
        <span aria-hidden="true">➤</span>
      </button>
        </>
        )} 
        
      </section> 
      <BottomNav />
    </div>
  )
}
