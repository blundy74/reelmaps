import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

// StrictMode is intentionally omitted: it double-invokes effects in development,
// which causes MapLibre GL to crash mid-initialization (migrateProjection on
// an already-removed map instance). MapLibre is an imperative API that does not
// tolerate being mounted/unmounted twice in the same tick.
createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
