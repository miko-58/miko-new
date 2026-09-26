import { useEffect, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Coordinates = { latitude: number; longitude: number }

type Props = {
  destination: Coordinates
  helperPosition: Coordinates | null
}

const destinationIcon = divIcon({ className: 'route-map-marker route-map-marker--destination', html: '<span>●</span>', iconSize: [34, 34], iconAnchor: [17, 17] })
const helperIcon = divIcon({ className: 'route-map-marker route-map-marker--helper', html: '<span>●</span>', iconSize: [34, 34], iconAnchor: [17, 17] })

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 16)
      return
    }
    map.fitBounds(latLngBounds(points), { padding: [34, 34], maxZoom: 16 })
  }, [map, points])

  return null
}

export default function HelperRouteMap({ destination, helperPosition }: Props) {
  const destinationPoint: LatLngExpression = [destination.latitude, destination.longitude]
  const helperPoint: LatLngExpression | null = helperPosition ? [helperPosition.latitude, helperPosition.longitude] : null
  const [route, setRoute] = useState<LatLngExpression[]>([])

  useEffect(() => {
    if (!helperPosition) {
      setRoute([])
      return
    }

    const controller = new AbortController()
    const requestUrl = `https://router.project-osrm.org/route/v1/driving/${helperPosition.longitude},${helperPosition.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`

    fetch(requestUrl, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('route unavailable')))
      .then((data) => {
        const coordinates = data.routes?.[0]?.geometry?.coordinates
        if (!Array.isArray(coordinates)) return
        setRoute(coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as LatLngExpression))
      })
      .catch(() => setRoute([helperPoint, destinationPoint] as LatLngExpression[]))

    return () => controller.abort()
  }, [destination.latitude, destination.longitude, helperPosition])

  const points = helperPoint ? [helperPoint, destinationPoint] : [destinationPoint]

  return (
    <MapContainer className="helper-route-map__leaflet" center={destinationPoint} zoom={16} scrollWheelZoom={false} zoomControl={false} attributionControl>
      <TileLayer attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={points} />
      {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#078e8d', weight: 5, opacity: 0.82 }} />}
      <Marker position={destinationPoint} icon={destinationIcon}><Popup>助けを求めている人</Popup></Marker>
      {helperPoint && <Marker position={helperPoint} icon={helperIcon}><Popup>あなたの現在地</Popup></Marker>}
    </MapContainer>
  )
}
