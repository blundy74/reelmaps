import { useFavoritesStore } from '../../store/favoritesStore'
import { useMapStore } from '../../store/mapStore'

export default function FavoritesList() {
  const { favorites, removeFavorite } = useFavoritesStore()
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget)

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <svg className="w-10 h-10 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <p className="text-sm text-slate-500">No saved locations.</p>
        <p className="text-xs text-slate-600 mt-1">Drop a pin and save it.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 pt-3 pb-1">
        <span className="text-xs text-slate-500">
          <span className="text-slate-300 font-medium">{favorites.length}</span> saved location{favorites.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {favorites.map((fav) => (
          <div
            key={fav.id}
            className="rounded-xl p-3 border border-ocean-700 bg-ocean-800/50 hover:bg-ocean-750/80 hover:border-ocean-500 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-100 leading-tight truncate">{fav.name}</h4>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  {Math.abs(fav.lat).toFixed(4)}{'\u00B0'}{fav.lat >= 0 ? 'N' : 'S'}{' '}
                  {Math.abs(fav.lng).toFixed(4)}{'\u00B0'}{fav.lng >= 0 ? 'E' : 'W'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setFlyToTarget({ lat: fav.lat, lng: fav.lng, zoom: 10 })}
                  className="p-1.5 rounded-lg hover:bg-ocean-600 text-slate-500 hover:text-cyan-400 transition-colors"
                  title="Fly to location"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => removeFavorite(fav.id)}
                  className="p-1.5 rounded-lg hover:bg-ocean-600 text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
