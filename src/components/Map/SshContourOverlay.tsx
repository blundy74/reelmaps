/**
 * SSH isolines from one viewport grid — no tile seams, no fill.
 * ERDDAP nesdisSSH1day preferred; GIBS MEaSUREs fallback.
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { drawSshContoursScreen } from '../../lib/sshContours'
import {
  fetchSshGrid,
  sshAgeStamp,
  sshGridCovers,
  type SshGrid,
} from '../../lib/sshField'
import { useMapStore } from '../../store/mapStore'

const MOVE_DEBOUNCE_MS = 320
const DATA_TTL_MS = 30 * 60_000

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  mapReady: number
  visible: boolean
  opacity: number
}

export default function SshContourOverlay({ mapRef, mapReady, visible, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gridRef = useRef<SshGrid | null>(null)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const setLayerLoading = useMapStore((s) => s.setLayerLoading)
  const setSshMeta = useMapStore((s) => s.setSshMeta)

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    if (!canvas || !map) return
    const c = map.getContainer()
    const dpr = window.devicePixelRatio || 1
    canvas.width = c.clientWidth * dpr
    canvas.height = c.clientHeight * dpr
    canvas.style.width = `${c.clientWidth}px`
    canvas.style.height = `${c.clientHeight}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [mapRef])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    const grid = gridRef.current
    if (!canvas || !map) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cw = canvas.width / (window.devicePixelRatio || 1)
    const ch = canvas.height / (window.devicePixelRatio || 1)
    ctx.clearRect(0, 0, cw, ch)
    if (!visible || !grid) return
    ctx.globalAlpha = opacity
    drawSshContoursScreen(ctx, grid, (lng, lat) => {
      const p = map.project([lng, lat])
      return { x: p.x, y: p.y }
    })
    ctx.globalAlpha = 1
  }, [mapRef, visible, opacity])

  const fetchData = useCallback(async () => {
    const map = mapRef.current
    if (!map || !visible) return
    const bounds = map.getBounds()
    const south = bounds.getSouth()
    const north = bounds.getNorth()
    const west = bounds.getWest()
    const east = bounds.getEast()
    const zoom = map.getZoom()

    const existing = gridRef.current
    if (
      existing
      && existing.source === 'erddap'
      && Date.now() - existing.fetchedAt < DATA_TTL_MS
      && sshGridCovers(existing, south, north, west, east)
    ) {
      render()
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLayerLoading('altimetry', true)
    try {
      const result = await fetchSshGrid(south, north, west, east, zoom, controller.signal)
      if (controller.signal.aborted) return
      if (result) {
        gridRef.current = result
        setSshMeta(sshAgeStamp(result.fieldDate), result.source)
        render()
      }
    } catch {
      if (controller.signal.aborted) return
    } finally {
      if (!controller.signal.aborted) setLayerLoading('altimetry', false)
    }
  }, [mapRef, visible, render, setLayerLoading, setSshMeta])

  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(() => { void fetchData() }, MOVE_DEBOUNCE_MS)
  }, [fetchData])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    syncSize()

    const onResize = () => {
      syncSize()
      scheduleFetch()
      render()
    }
    const onMove = () => { render() }
    const onMoveEnd = () => { scheduleFetch() }

    map.on('resize', onResize)
    map.on('move', onMove)
    map.on('moveend', onMoveEnd)
    window.addEventListener('resize', onResize)

    if (visible) {
      render()
      void fetchData()
    }

    return () => {
      map.off('resize', onResize)
      map.off('move', onMove)
      map.off('moveend', onMoveEnd)
      window.removeEventListener('resize', onResize)
      abortRef.current?.abort()
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      setLayerLoading('altimetry', false)
    }
  }, [mapRef, mapReady, visible, syncSize, render, fetchData, scheduleFetch, setLayerLoading])

  useEffect(() => {
    if (!visible) {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) {
        const cw = canvasRef.current.width / (window.devicePixelRatio || 1)
        const ch = canvasRef.current.height / (window.devicePixelRatio || 1)
        ctx.clearRect(0, 0, cw, ch)
      }
      return
    }
    render()
  }, [visible, opacity, render])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 12 }}
    />
  )
}
