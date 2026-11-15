import { useEffect, useRef, useState } from 'react'
import { useLive } from '../state/store'
import './tripComputer.css'

interface TripStats {
  distanceKm: number
  fuelUsed: number
  maxSpeedKmh: number
  movingSeconds: number
}
const EMPTY: TripStats = { distanceKm: 0, fuelUsed: 0, maxSpeedKmh: 0, movingSeconds: 0 }

/** A lightweight trip computer driven by the game's existing telemetry. */
export function TripComputer() {
  const telemetry = useLive((state) => state.telemetry)
  const job = useLive((state) => state.job)
  const mph = useLive((state) => state.mph)
  const [stats, setStats] = useState(EMPTY)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const previous = useRef<{ x: number; z: number; fuel: number; at: number } | null>(null)

  useEffect(() => {
    if (!telemetry || telemetry.paused) {
      previous.current = null
      return
    }
    const at = Date.now()
    const speedKmh = Math.abs(telemetry.speed) * 3.6
    const last = previous.current
    if (last) {
      const seconds = Math.max(0, Math.min(2, (at - last.at) / 1000))
      const deltaKm = Math.hypot(telemetry.x - last.x, telemetry.z - last.z) / 1000
      const fuelDrop = Math.max(0, last.fuel - telemetry.fuel)
      setStats((current) => ({
        distanceKm: current.distanceKm + (deltaKm < 0.25 ? deltaKm : 0),
        fuelUsed: current.fuelUsed + Math.min(fuelDrop, 2),
        maxSpeedKmh: Math.max(current.maxSpeedKmh, speedKmh),
        movingSeconds: current.movingSeconds + (speedKmh > 1 ? seconds : 0),
      }))
    }
    previous.current = { x: telemetry.x, z: telemetry.z, fuel: telemetry.fuel, at }
  }, [telemetry])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function reset() {
    setStats(EMPTY)
    setStartedAt(Date.now())
    previous.current = telemetry && !telemetry.paused
      ? { x: telemetry.x, z: telemetry.z, fuel: telemetry.fuel, at: Date.now() }
      : null
  }

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  const averageKmh = stats.movingSeconds > 0 ? (stats.distanceKm * 3600) / stats.movingSeconds : 0
  const consumption = stats.distanceKm > 0 ? (stats.fuelUsed / stats.distanceKm) * 100 : 0
  const speedMps = telemetry ? Math.abs(telemetry.speed) : 0
  const etaSeconds = telemetry && speedMps > 0.5
    ? telemetry.navigationDistance / speedMps
    : telemetry?.navigationTime ?? 0
  const distance = (km: number) => mph ? (km * 0.621371).toFixed(1) : km.toFixed(1)
  const speed = (kmh: number) => mph ? (kmh * 0.621371).toFixed(0) : kmh.toFixed(0)
  const unit = mph ? 'mi' : 'km'
  const speedUnit = mph ? 'mph' : 'km/h'

  return (
    <section className="trip-computer" aria-label="Trip computer">
      <header className="trip-computer__header">
        <span>TRIP COMPUTER</span>
        <button type="button" onClick={reset} title="Reset trip">Reset</button>
      </header>
      <div className="trip-computer__grid">
        <Metric label="Distance" value={distance(stats.distanceKm)} unit={unit} />
        <Metric label="Average" value={speed(averageKmh)} unit={speedUnit} />
        <Metric label="Maximum" value={speed(stats.maxSpeedKmh)} unit={speedUnit} />
        <Metric label="Fuel used" value={stats.fuelUsed.toFixed(1)} unit="L" />
        <Metric label="Consumption" value={consumption.toFixed(1)} unit="L/100km" />
        <Metric label="Driving time" value={formatDuration(stats.movingSeconds)} unit="" />
      </div>
      <div className="trip-computer__route">
        <span>{job?.active ? `To ${job.destinationCity || 'destination'}` : 'GPS'}</span>
        <strong>{telemetry ? formatDistance(telemetry.navigationDistance, mph) : '—'}</strong>
        <span>{telemetry?.navigationSpeedLimit ? `Limit ${speed(telemetry.navigationSpeedLimit * 3.6)} ${speedUnit}` : 'Speed limit unavailable'}</span>
        <span>{telemetry?.navigationDistance ? `ETA ${formatDuration(etaSeconds)}` : 'No active route'}</span>
      </div>
      <footer>Session {formatDuration(elapsed)} · Live game telemetry</footer>
    </section>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return <div className="trip-computer__metric"><span>{label}</span><strong>{value}<small> {unit}</small></strong></div>
}
function formatDistance(metres: number, miles: boolean): string {
  const value = miles ? metres / 1609.344 : metres / 1000
  return value >= 1 ? `${value.toFixed(1)} ${miles ? 'mi' : 'km'}` : `${Math.round(metres / (miles ? 1.609344 : 1))} m`
}
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}
