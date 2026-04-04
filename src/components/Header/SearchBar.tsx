import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '../../lib/utils'

interface SearchBarProps {
  onSelect: (lat: number, lng: number, label: string) => void
}

interface SearchResult {
  lat: number
  lng: number
  label: string
  description: string
}

// ── Coordinate parsers ──────────────────────────────────────────────────

/** Decimal: "28.5, -88.5" or "28.5 -88.5" */
function parseDecimal(input: string): { lat: number; lng: number } | null {
  const m = input.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/,
  )
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/** Decimal with direction: "28.5N 88.5W" */
function parseDecimalDir(input: string): { lat: number; lng: number } | null {
  const m = input.match(
    /^\s*(\d+(?:\.\d+)?)\s*([NSns])\s*[,\s]\s*(\d+(?:\.\d+)?)\s*([EWew])\s*$/,
  )
  if (!m) return null
  let lat = parseFloat(m[1])
  let lng = parseFloat(m[3])
  if (m[2].toUpperCase() === 'S') lat = -lat
  if (m[4].toUpperCase() === 'W') lng = -lng
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/** DMS: "28°30'N 88°30'W" — seconds optional */
function parseDMS(input: string): { lat: number; lng: number } | null {
  const m = input.match(
    /^\s*(\d+)[°]\s*(\d+)?['\u2032]?\s*(\d+(?:\.\d+)?)?["\u2033]?\s*([NSns])\s*[,\s]\s*(\d+)[°]\s*(\d+)?['\u2032]?\s*(\d+(?:\.\d+)?)?["\u2033]?\s*([EWew])\s*$/,
  )
  if (!m) return null
  let lat = parseInt(m[1]) + (parseInt(m[2] || '0') / 60) + (parseFloat(m[3] || '0') / 3600)
  let lng = parseInt(m[5]) + (parseInt(m[6] || '0') / 60) + (parseFloat(m[7] || '0') / 3600)
  if (m[4].toUpperCase() === 'S') lat = -lat
  if (m[8].toUpperCase() === 'W') lng = -lng
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function parseCoordinates(input: string): { lat: number; lng: number } | null {
  return parseDecimal(input) ?? parseDecimalDir(input) ?? parseDMS(input)
}

// ── Component ───────────────────────────────────────────────────────────

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const geocode = useCallback(async (q: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort()

    // Check for coordinate input first
    const coords = parseCoordinates(q)
    if (coords) {
      const label = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
      setResults([{ lat: coords.lat, lng: coords.lng, label, description: 'Coordinates' }])
      setShowDropdown(true)
      setLoading(false)
      return
    }

    if (q.trim().length < 3) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      const data = await res.json()

      const mapped: SearchResult[] = data.map(
        (item: { lat: string; lon: string; display_name: string }) => {
          const parts = item.display_name.split(', ')
          const label = parts[0]
          const description = parts.slice(1, 4).join(', ')
          return {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            label,
            description,
          }
        },
      )
      setResults(mapped)
      setShowDropdown(mapped.length > 0)
      setFocusedIndex(-1)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setResults([])
        setShowDropdown(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  const handleChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!value.trim()) {
        setResults([])
        setShowDropdown(false)
        return
      }
      debounceRef.current = setTimeout(() => geocode(value), 400)
    },
    [geocode],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  function selectResult(result: SearchResult) {
    onSelect(result.lat, result.lng, result.label)
    setQuery(result.label)
    setShowDropdown(false)
    setFocusedIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setShowDropdown(false)
      setFocusedIndex(-1)
      return
    }

    if (!showDropdown || results.length === 0) {
      if (e.key === 'Enter') {
        // Try direct coordinate parse on Enter
        const coords = parseCoordinates(query)
        if (coords) {
          const label = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
          onSelect(coords.lat, coords.lng, label)
          setQuery(label)
          setShowDropdown(false)
        }
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedIndex >= 0 && focusedIndex < results.length) {
        selectResult(results[focusedIndex])
      } else if (results.length > 0) {
        selectResult(results[0])
      }
    }
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    setFocusedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input container */}
      <div
        className={cn(
          'glass rounded-xl flex items-center gap-2 px-3 py-1.5 border transition-colors',
          'border-ocean-600 focus-within:border-cyan-500/40',
        )}
      >
        {/* Magnifying glass icon */}
        <svg
          className="w-3.5 h-3.5 text-slate-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true)
          }}
          placeholder="Search..."
          className="bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none w-24 sm:w-40 md:w-52"
        />

        {/* Loading spinner */}
        {loading && (
          <svg
            className="w-3.5 h-3.5 text-slate-500 animate-spin flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}

        {/* Clear button */}
        {query && !loading && (
          <button
            onClick={clearSearch}
            className="flex-shrink-0 p-0.5 rounded hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-ocean-900 border border-ocean-700 rounded-lg shadow-xl overflow-hidden z-50">
          {results.map((result, i) => (
            <button
              key={`${result.lat}-${result.lng}-${i}`}
              onClick={() => selectResult(result)}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-ocean-800 cursor-pointer text-sm text-slate-300 transition-colors',
                focusedIndex === i && 'bg-ocean-800',
              )}
            >
              <div className="font-medium text-slate-200 truncate">{result.label}</div>
              {result.description && (
                <div className="text-xs text-slate-500 truncate mt-0.5">{result.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
