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
  const [stats, setStats] = useState(EMPTY)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const previous = useRef<{ x: number; z: number; fuel: number; at: number } | null>(null)

  useEffect(() => {
    if (!telemetry || telemetry.paused) return
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
    previous.current = telemetry
      ? { x: telemetry.x, z: telemetry.z, fuel: telemetry.fuel, at: Date.now() }
      : null
  }

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  const average = stats.movingSeconds > 0 ? (stats.distanceKm * 3600) / stats.movingSeconds : 0
  const consumption = stats.distanceKm > 0 ? (stats.fuelUsed / stats.distanceKm) * 100 : 0
  const etaMinutes = telemetry && telemetry.speed > 1
    ? telemetry.navigationDistance / telemetry.speed / 60
    : telemetry?.navigationTime ?? 0

  return (
    <section className="trip-computer" aria-label="Trip computer">
      <header className="trip-computer__header">
        <span>TRIP COMPUTER</span>
        <button type="button" onClick={reset} title="Reset trip">Reset</button>
      </header>
      <div className="trip-computer__grid">
        <Metric label="Distance" value={stats.distanceKm.toFixed(1)} unit="km" />
        <Metric label="Average" value={average.toFixed(0)} unit="km/h" />
        <Metric label="Maximum" value={stats.maxSpeedKmh.toFixed(0)} unit="km/h" />
        <Metric label="Fuel used" value={stats.fuelUsed.toFixed(1)} unit="L" />
        <Metric label="Consumption" value={consumption.toFixed(1)} unit="L/100" />
        <Metric label="Driving time" value={formatDuration(stats.movingSeconds)} unit="" />
      </div>
      <div className="trip-computer__route">
        <span>{job?.active ? `To ${job.destinationCity || 'destination'}` : 'GPS'}</span>
        <strong>{telemetry ? formatDistance(telemetry.navigationDistance) : '—'}</strong>
        <span>{telemetry?.navigationSpeedLimit ? `Limit ${(telemetry.navigationSpeedLimit * 3.6).toFixed(0)} km/h` : 'Speed limit unavailable'}</span>
        <span>{telemetry?.navigationDistance ? `ETA ${formatDuration(Math.max(0, etaMinutes * 60))}` : 'No active route'}</span>
      </div>
      <footer>Session {formatDuration(elapsed)} · Live game telemetry</footer>
    </section>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return <div className="trip-computer__metric"><span>{label}</span><strong>{value}<small> {unit}</small></strong></div>
}

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}
