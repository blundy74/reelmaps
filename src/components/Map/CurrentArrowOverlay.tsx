/**
 * OSCAR current arrows — the fishing layer.
 * GIBS OSCAR U/V, LOD by zoom, land-clipped. No Open-Meteo.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { paintLandMask } from '../../lib/landMask'
import {
  fetchOscarGrid,
  gridCovers,
  oscarLod,
  sampleOscar,
  OSCAR_SLACK_KT,
  OSCAR_SPEED_MAX_KT,
  type OscarGrid,
} from '../../lib/oscarCurrents'
import { useMapStore } from '../../store/mapStore'

const ARROW_LENGTH_MIN = 10
const ARROW_LENGTH_MAX = 26
const ARROW_HEAD_SIZE = 4.5
const SLACK_HEAD_SIZE = 3.2
const MOVE_DEBOUNCE_MS = 280
const DATA_TTL_MS = 30 * 60_000
/** One ink for every glyph. Speed is length / heads-only, not a 0–4 kt tint. */
const ARROW_INK = 'rgba(248, 250, 252, 0.95)'
const ARROW_HALO = 'rgba(15, 23, 42, 0.8)'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  visible: boolean
  opacity: number
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  headAngle: number,
  size: number,
) {
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(
    tipX - size * Math.cos(headAngle - 0.42),
    tipY - size * Math.sin(headAngle - 0.42),
  )
  ctx.lineTo(
    tipX - size * Math.cos(headAngle + 0.42),
    tipY - size * Math.sin(headAngle + 0.42),
  )
  ctx.closePath()
  ctx.fill()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDeg: number,
  length: number,
  headsOnly: boolean,
) {
  const screenAngle = ((angleDeg - 90) * Math.PI) / 180
  const dx = Math.cos(screenAngle) * length
  const dy = Math.sin(screenAngle) * length
  const headAngle = Math.atan2(dy, dx)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (headsOnly) {
    // Slack: chevron only. No shaft, no 0.2 kt tint.
    ctx.fillStyle = ARROW_HALO
    drawHead(ctx, x, y, headAngle, SLACK_HEAD_SIZE + 1.1)
    ctx.fillStyle = ARROW_INK
    drawHead(ctx, x, y, headAngle, SLACK_HEAD_SIZE)
    ctx.restore()
    return
  }

  const tipX = x + dx * 0.6
  const tipY = y + dy * 0.6
  ctx.strokeStyle = ARROW_HALO
  ctx.lineWidth = 3.1
  ctx.beginPath()
  ctx.moveTo(x - dx * 0.4, y - dy * 0.4)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()
  ctx.strokeStyle = ARROW_INK
  ctx.lineWidth = 1.55
  ctx.beginPath()
  ctx.moveTo(x - dx * 0.4, y - dy * 0.4)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()
  ctx.fillStyle = ARROW_HALO
  drawHead(ctx, tipX, tipY, headAngle, ARROW_HEAD_SIZE + 0.8)
  ctx.fillStyle = ARROW_INK
  drawHead(ctx, tipX, tipY, headAngle, ARROW_HEAD_SIZE)
  ctx.restore()
}

export default function CurrentArrowOverlay({ mapRef, visible, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gridRef = useRef<OscarGrid | null>(null)
  const landMaskRef = useRef<ImageData | null>(null)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const setLayerLoading = useMapStore((s) => s.setLayerLoading)
  const [harborHint, setHarborHint] = useState(false)
  const harborHintRef = useRef(false)

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

  const rebuildLandMask = useCallback(async () => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return
    const cw = canvas.width / (window.devicePixelRatio || 1)
    const ch = canvas.height / (window.devicePixelRatio || 1)
    const mask = document.createElement('canvas')
    mask.width = Math.max(1, Math.round(cw))
    mask.height = Math.max(1, Math.round(ch))
    const mctx = mask.getContext('2d')
    if (!mctx) return
    await paintLandMask(mctx, map, { inflatePx: 4 })
    landMaskRef.current = mctx.getImageData(0, 0, mask.width, mask.height)
  }, [mapRef])

  const isLandPx = (sx: number, sy: number) => {
    const mask = landMaskRef.current
    if (!mask) return false
    const x = Math.max(0, Math.min(mask.width - 1, Math.round(sx)))
    const y = Math.max(0, Math.min(mask.height - 1, Math.round(sy)))
    return mask.data[(y * mask.width + x) * 4 + 3] > 20
  }

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
    if (!visible) {
      if (harborHintRef.current) {
        harborHintRef.current = false
        setHarborHint(false)
      }
      return
    }
    if (!grid || !landMaskRef.current) return

    const zoom = map.getZoom()
    const spacing = oscarLod(zoom).spacingPx
    const samples: { sx: number; sy: number; angleDeg: number; length: number; slack: boolean }[] = []
    let flowing = 0
    ctx.globalAlpha = opacity
    for (let sy = spacing / 2; sy < ch; sy += spacing) {
      for (let sx = spacing / 2; sx < cw; sx += spacing) {
        if (isLandPx(sx, sy)) continue
        const ll = map.unproject([sx, sy])
        const sample = sampleOscar(grid, ll.lat, ll.lng)
        if (!sample) continue
        const slack = sample.speedKt < OSCAR_SLACK_KT
        if (!slack) flowing++
        const t = Math.min(sample.speedKt / OSCAR_SPEED_MAX_KT, 1)
        const len = ARROW_LENGTH_MIN + t * (ARROW_LENGTH_MAX - ARROW_LENGTH_MIN)
        samples.push({ sx, sy, angleDeg: sample.angleDeg, length: len, slack })
      }
    }
    // Harbor / high zoom: OSCAR is ~0.25° — a slack tick grid is fake.
    const sparse = zoom >= 8.5 && flowing === 0
    const showHint = flowing === 0
    if (showHint !== harborHintRef.current) {
      harborHintRef.current = showHint
      setHarborHint(showHint)
    }
    if (!sparse) {
      for (const s of samples) {
        drawArrow(ctx, s.sx, s.sy, s.angleDeg, s.length, s.slack)
      }
    }
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
    const lod = oscarLod(zoom)
    const sameRes = existing && existing.cols === lod.cols && existing.rows === lod.rows
    if (
      existing &&
      sameRes &&
      Date.now() - existing.fetchedAt < DATA_TTL_MS &&
      gridCovers(existing, south, north, west, east)
    ) {
      render()
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLayerLoading('current-arrows', true)
    try {
      const result = await fetchOscarGrid(south, north, west, east, zoom, controller.signal)
      if (controller.signal.aborted) return
      if (result) {
        gridRef.current = result
        render()
      } else if (map.getZoom() >= 8) {
        harborHintRef.current = true
        setHarborHint(true)
      }
    } catch {
      if (controller.signal.aborted) return
    } finally {
      if (!controller.signal.aborted) setLayerLoading('current-arrows', false)
    }
  }, [mapRef, visible, render, setLayerLoading])

  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(() => { void fetchData() }, MOVE_DEBOUNCE_MS)
  }, [fetchData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    syncSize()

    const onResize = () => {
      syncSize()
      landMaskRef.current = null
      void rebuildLandMask().then(render)
      scheduleFetch()
    }
    let moveRaf = 0
    const onMove = () => {
      if (moveRaf) return
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0
        landMaskRef.current = null
        void rebuildLandMask().then(render)
      })
    }
    const onMoveEnd = () => {
      landMaskRef.current = null
      void rebuildLandMask().then(render)
      scheduleFetch()
    }

    map.on('resize', onResize)
    map.on('move', onMove)
    map.on('moveend', onMoveEnd)
    window.addEventListener('resize', onResize)

    if (visible) {
      void rebuildLandMask().then(() => { render(); void fetchData() })
    }

    return () => {
      map.off('resize', onResize)
      map.off('move', onMove)
      map.off('moveend', onMoveEnd)
      window.removeEventListener('resize', onResize)
      abortRef.current?.abort()
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      setLayerLoading('current-arrows', false)
    }
  }, [mapRef, visible, syncSize, render, fetchData, scheduleFetch, rebuildLandMask, setLayerLoading])

  useEffect(() => {
    if (!visible) {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) {
        const cw = canvasRef.current.width / (window.devicePixelRatio || 1)
        const ch = canvasRef.current.height / (window.devicePixelRatio || 1)
        ctx.clearRect(0, 0, cw, ch)
      }
      if (harborHintRef.current) {
        harborHintRef.current = false
        setHarborHint(false)
      }
      return
    }
    render()
  }, [visible, opacity, render])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 15 }}
      />
      {visible && harborHint && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-2.5 py-1 rounded-md bg-black/65 border border-white/15 text-[11px] text-slate-200">
          Zoom out for currents
        </div>
      )}
    </>
  )
}
