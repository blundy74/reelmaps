/**
 * My Fishing Spots panel — shows user-imported spots with edit/delete via 3-dot menu.
 * Import button lives here. Replaces the old Favorites tab.
 */

import { useState, useEffect, useRef } from 'react'
import { useUserSpotsStore } from '../../store/userSpotsStore'
import { useMapStore } from '../../store/mapStore'
import { SPOT_ICONS, getSpotIcon } from '../../lib/spotIcons'
import type { SavedSpot } from '../../lib/apiClient'
import { cn } from '../../lib/utils'

// ── Edit Modal ──────────────────────────────────────────────────────────────

function EditSpotModal({ spot, onClose }: { spot: SavedSpot; onClose: () => void }) {
  const updateSpot = useUserSpotsStore((s) => s.updateSpot)
  const [name, setName] = useState(spot.name)
  const [icon, setIcon] = useState(spot.icon || 'fish')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateSpot(spot.id, { name, icon })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-ocean-900 border border-ocean-600 rounded-2xl shadow-2xl w-80 max-w-[90vw] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Edit Spot</h3>

        {/* Name */}
        <label className="block text-xs text-slate-500 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-ocean-800 border border-ocean-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 mb-4"
          autoFocus
        />

        {/* Icon picker */}
        <label className="block text-xs text-slate-500 mb-2">Icon</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {SPOT_ICONS.map((ic) => (
            <button
              key={ic.key}
              onClick={() => setIcon(ic.key)}
              title={ic.label}
              className={cn(
                'w-9 h-9 rounded-lg border flex items-center justify-center transition-all',
                icon === ic.key
                  ? 'border-cyan-500 bg-cyan-500/15'
                  : 'border-ocean-600 bg-ocean-800 hover:border-ocean-500',
              )}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill={ic.color}>
                <path d={ic.path} />
              </svg>
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{error}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-ocean-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 3-Dot Menu ──────────────────────────────────────────────────────────────

function SpotMenu({ spot, onEdit, onDelete }: { spot: SavedSpot; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    // Open upward if less than 100px below, downward otherwise
    if (spaceBelow < 100) {
      setMenuStyle({ bottom: '100%', marginBottom: 4, right: 0 })
    } else {
      setMenuStyle({ top: '100%', marginTop: 4, right: 0 })
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="p-1 rounded-md hover:bg-ocean-600 text-slate-500 hover:text-slate-300 transition-colors"
        title="Options"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute w-36 bg-ocean-800 border border-ocean-600 rounded-xl shadow-xl z-50 overflow-hidden" style={menuStyle}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-ocean-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-ocean-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Spot Row ────────────────────────────────────────────────────────────────

function SpotRow({ spot, onEdit, selectMode, selected, onToggleSelect }: {
  spot: SavedSpot; onEdit: (s: SavedSpot) => void
  selectMode: boolean; selected: boolean; onToggleSelect: (id: string) => void
}) {
  const removeSpot = useUserSpotsStore((s) => s.removeSpot)
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget)
  const iconDef = getSpotIcon(spot.icon || 'fish')

  const handleDelete = () => {
    if (window.confirm(`Delete "${spot.name}"?`)) {
      removeSpot(spot.id)
    }
  }

  return (
    <div className={cn(
      'group rounded-xl p-3 border transition-all',
      selected ? 'border-red-500/50 bg-red-500/10' : 'border-ocean-700 bg-ocean-800/50 hover:bg-ocean-750/80 hover:border-ocean-500',
    )}>
      <div className="flex items-center gap-2.5">
        {/* Checkbox when in select mode */}
        {selectMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(spot.id)}
            className="flex-shrink-0 w-4 h-4 rounded border-ocean-600 bg-ocean-800 text-red-500 focus:ring-red-500/30 cursor-pointer"
          />
        )}

        {/* Icon */}
        <button
          onClick={() => selectMode ? onToggleSelect(spot.id) : setFlyToTarget({ lat: spot.lat, lng: spot.lng, zoom: 12 })}
          className="flex-shrink-0 w-8 h-8 rounded-lg bg-ocean-700/80 flex items-center justify-center hover:bg-ocean-600 transition-colors"
          title={selectMode ? 'Toggle select' : 'Fly to spot'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill={iconDef.color}>
            <path d={iconDef.path} />
          </svg>
        </button>

        {/* Name + coords */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => selectMode ? onToggleSelect(spot.id) : setFlyToTarget({ lat: spot.lat, lng: spot.lng, zoom: 12 })}
        >
          <h4 className="text-sm font-medium text-slate-200 leading-tight truncate">{spot.name}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-slate-500">
              {Math.abs(spot.lat).toFixed(4)}{'\u00B0'}{spot.lat >= 0 ? 'N' : 'S'}{' '}
              {Math.abs(spot.lng).toFixed(4)}{'\u00B0'}{spot.lng >= 0 ? 'E' : 'W'}
            </span>
            {spot.depthFt != null && (
              <span className="text-xs text-slate-600">{spot.depthFt.toLocaleString()} ft</span>
            )}
          </div>
        </div>

        {/* 3-dot menu (hidden in select mode) */}
        {!selectMode && <SpotMenu spot={spot} onEdit={() => onEdit(spot)} onDelete={handleDelete} />}
      </div>
    </div>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export default function MySpotsPanel({ onImportClick }: { onImportClick?: () => void }) {
  const spots = useUserSpotsStore((s) => s.spots)
  const fetchSpots = useUserSpotsStore((s) => s.fetchSpots)
  const removeSpot = useUserSpotsStore((s) => s.removeSpot)
  const [editingSpot, setEditingSpot] = useState<SavedSpot | null>(null)
  const [search, setSearch] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchSpots() }, [fetchSpots])

  const filtered = search.trim()
    ? spots.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : spots

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(s => s.id)))
    }
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selected.size} spot${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeleting(true)
    for (const id of selected) {
      await removeSpot(id)
    }
    setDeleting(false)
    exitSelectMode()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 pt-3 space-y-2">
        {/* Import button */}
        {onImportClick && !selectMode && (
          <button
            onClick={onImportClick}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import Spots (CSV, GPX, FIT)
          </button>
        )}

        {/* Search (only when there are spots) */}
        {spots.length > 0 && !selectMode && (
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search my spots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-ocean-800 border border-ocean-600 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
            />
          </div>
        )}

        {/* Stats + Select toggle */}
        {spots.length > 0 && (
          <div className="flex items-center justify-between">
            {selectMode ? (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={selectAll}
                  className="w-4 h-4 rounded border-ocean-600 bg-ocean-800 text-red-500 focus:ring-red-500/30 cursor-pointer"
                />
                <button onClick={selectAll} className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors">
                  {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-[10px] text-slate-500">
                  ({selected.size})
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                <span className="text-slate-300 font-medium">{filtered.length}</span> spot{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={cn(
                'text-[10px] transition-colors',
                selectMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-400',
              )}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          </div>
        )}

        {/* Bulk delete bar */}
        {selectMode && selected.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {deleting ? 'Deleting...' : `Delete ${selected.size} Spot${selected.size !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Spot list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {spots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <svg className="w-10 h-10 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-sm text-slate-500">No imported spots yet.</p>
            <p className="text-xs text-slate-600 mt-1">Import a CSV, GPX, or FIT file to add your spots.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm">No matches</div>
        ) : (
          filtered.map((spot) => (
            <SpotRow
              key={spot.id}
              spot={spot}
              onEdit={setEditingSpot}
              selectMode={selectMode}
              selected={selected.has(spot.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>

      {/* Edit modal */}
      {editingSpot && (
        <EditSpotModal spot={editingSpot} onClose={() => setEditingSpot(null)} />
      )}
    </div>
  )
}
