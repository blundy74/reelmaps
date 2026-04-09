/**
 * Export fishing spots to downloadable file formats.
 */

import type { SavedSpot } from './apiClient'

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Export spots as CSV */
export function exportCSV(spots: SavedSpot[], filename = 'reelmaps-spots.csv') {
  const headers = ['Name', 'Latitude', 'Longitude', 'Depth (ft)', 'Type', 'Species', 'Notes']
  const rows = spots.map(s => [
    `"${(s.name || '').replace(/"/g, '""')}"`,
    s.lat.toFixed(6),
    s.lng.toFixed(6),
    s.depthFt != null ? String(s.depthFt) : '',
    s.spotType || '',
    s.species || '',
    `"${(s.notes || '').replace(/"/g, '""')}"`,
  ].join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  download(csv, filename, 'text/csv')
}

/** Export spots as GPX 1.1 */
export function exportGPX(spots: SavedSpot[], filename = 'reelmaps-spots.gpx') {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const wpts = spots.map(s => {
    const depthM = s.depthFt != null ? (s.depthFt / 3.28084).toFixed(1) : null
    return `  <wpt lat="${s.lat.toFixed(6)}" lon="${s.lng.toFixed(6)}">
    <name>${escXml(s.name || 'Unnamed')}</name>${depthM ? `\n    <ele>${depthM}</ele>` : ''}${s.notes ? `\n    <desc>${escXml(s.notes)}</desc>` : ''}
    <sym>Fishing</sym>
  </wpt>`
  }).join('\n')

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ReelMaps" xmlns="http://www.topografix.com/GPX/1/1">
<metadata>
  <name>ReelMaps Spots Export</name>
  <time>${new Date().toISOString()}</time>
</metadata>
${wpts}
</gpx>`

  download(gpx, filename, 'application/gpx+xml')
}

/** Export spots as KML (Garmin-compatible alternative to FIT) */
export function exportKML(spots: SavedSpot[], filename = 'reelmaps-spots.kml') {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const placemarks = spots.map(s => `    <Placemark>
      <name>${escXml(s.name || 'Unnamed')}</name>${s.notes ? `\n      <description>${escXml(s.notes)}</description>` : ''}
      <Point>
        <coordinates>${s.lng.toFixed(6)},${s.lat.toFixed(6)},0</coordinates>
      </Point>
    </Placemark>`).join('\n')

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>ReelMaps Spots Export</name>
${placemarks}
  </Document>
</kml>`

  download(kml, filename, 'application/vnd.google-earth.kml+xml')
}
