/**
 * Measure oceanography upstream + isoline work. Run: node scripts/measure-oceanography.mjs
 */
const GULF_BBOX = '-10572137,2758450,-9127593,3503549'
const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
const NOWCOAST = 'https://nowcoast.noaa.gov/geoserver/grtofs/wms'

function sshUrl(w) {
  return `${GIBS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=EPSG:3857&WIDTH=${w}&HEIGHT=${w}&FORMAT=image/png&TRANSPARENT=TRUE&LAYERS=JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies&BBOX=${GULF_BBOX}`
}
function oscarUrl(layer, w, h) {
  return `${GIBS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=EPSG:3857&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/png&TRANSPARENT=TRUE&LAYERS=${layer}&TIME=2024-07-17&BBOX=${GULF_BBOX}`
}
function currentsUrl(w) {
  return `${NOWCOAST}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=EPSG:3857&WIDTH=${w}&HEIGHT=${w}&FORMAT=image/png&TRANSPARENT=TRUE&LAYERS=rtofs_east_sfc_currents&BBOX=${GULF_BBOX}`
}

async function timed(label, fn) {
  const t0 = performance.now()
  const result = await fn()
  const ms = performance.now() - t0
  console.log(`${label}: ${ms.toFixed(0)}ms${result != null ? ` (${result})` : ''}`)
  return ms
}

function isolineWork(w, h) {
  const grid = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / (w - 1) - 0.5
      const ny = y / (h - 1) - 0.5
      grid[y * w + x] = 0.25 * Math.sin(nx * 8) + 0.2 * Math.cos(ny * 6)
    }
  }
  const t0 = performance.now()
  let segs = 0
  const levels = [-0.3, -0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2, 0.3]
  for (const level of levels) {
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const v00 = grid[y * w + x]
        const v10 = grid[y * w + x + 1]
        const v01 = grid[(y + 1) * w + x]
        const v11 = grid[(y + 1) * w + x + 1]
        let code = 0
        if (v00 >= level) code |= 1
        if (v10 >= level) code |= 2
        if (v11 >= level) code |= 4
        if (v01 >= level) code |= 8
        if (code !== 0 && code !== 15) segs++
      }
    }
  }
  return { ms: performance.now() - t0, segs }
}

function oldContourWork(w, h) {
  const n = w * h
  const grid = new Float32Array(n)
  for (let i = 0; i < n; i++) grid[i] = Math.sin(i * 0.01)
  const t0 = performance.now()
  const radius = 2
  const out = new Float32Array(n)
  const count = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = grid[y * w + x]
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(w - 1, x + radius)
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(h - 1, y + radius)
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          out[yy * w + xx] += val
          count[yy * w + xx] += 1
        }
      }
    }
  }
  const scale = 2
  const ow = w * scale
  const oh = h * scale
  let acc = 0
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) acc += out[((oy / scale) | 0) * w + ((ox / scale) | 0)]
  }
  return { ms: performance.now() - t0, acc }
}

async function fetchSize(url) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  return `${res.status} ${buf.byteLength}B`
}

const iso256 = isolineWork(256, 256)
const iso512 = isolineWork(512, 512)
const old512 = oldContourWork(512, 512)
console.log(`isoline 256: ${iso256.ms.toFixed(1)}ms segs~${iso256.segs}`)
console.log(`isoline 512: ${iso512.ms.toFixed(1)}ms segs~${iso512.segs}`)
console.log(`old blur+2x 512: ${old512.ms.toFixed(1)}ms`)

await timed('GIBS SSH 256', () => fetchSize(sshUrl(256)))
await timed('GIBS SSH 512', () => fetchSize(sshUrl(512)))
const tOscar = performance.now()
const [u, v] = await Promise.all([
  fetchSize(oscarUrl('OSCAR_Sea_Surface_Currents_Zonal', 72, 56)),
  fetchSize(oscarUrl('OSCAR_Sea_Surface_Currents_Meridional', 72, 56)),
])
console.log(`OSCAR U+V LOD 72x56 parallel: ${(performance.now() - tOscar).toFixed(0)}ms (${u} / ${v})`)
await timed('nowCOAST currents 256 (not fetched until Advanced on)', () => fetchSize(currentsUrl(256)))
await timed('nowCOAST currents 512', () => fetchSize(currentsUrl(512)))
