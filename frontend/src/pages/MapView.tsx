import { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import BottomNav from '../components/BottomNav'
import { LocationIcon } from '../components/icons'
import 'leaflet/dist/leaflet.css'
import './MapView.css'

type Position = { latitude: number; longitude: number; accuracy: number }

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
  const [position, setPosition] = useState<Position | null>(null)
  const [locating, setLocating] = useState(true)
  const [locationError, setLocationError] = useState('')
  const active = useRef(true)
  const requestPending = useRef(false)

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

  const coordinates: [number, number] | null = position ? [position.latitude, position.longitude] : null

  return (
    <div className="screen map-page">
      <header className="map-page__header">
        <button type="button" className="btn btn--outline btn--sm map-page__locate" onClick={locate} disabled={locating}>
          <LocationIcon width={18} height={18} />
          {locating ? '現在地を取得中...' : '現在地へ移動'}
        </button>
      </header>
      {locationError && <p className="map-page__error" role="alert">{locationError}</p>}
      <section className="map-page__canvas" aria-label="周辺の地図">
        {locating && !position ? <p className="map-page__info" role="status">現在地を取得しています。位置情報の利用を許可してください。</p> : (
        <MapContainer className="map-page__leaflet" center={coordinates ?? DEFAULT_CENTER} zoom={coordinates ? 16 : 14} scrollWheelZoom>
          <TileLayer
            attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapViewport position={position} />
          {coordinates && position && <>
            <Circle center={coordinates} radius={position.accuracy} pathOptions={{ color: '#078e8d', weight: 1, fillOpacity: 0.08 }} />
            <CircleMarker center={coordinates} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#078e8d', fillOpacity: 1 }}>
              <Popup>あなたの現在地<br />位置情報の精度：約{Math.round(position.accuracy)}m</Popup>
            </CircleMarker>
          </>}
        </MapContainer>
        )}
      </section>
      <BottomNav />
    </div>
  )
}
