import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/instrument-sans'
import './styles.css'
import App from './App'
import PanelApp from './PanelApp'

const isPanel = new URLSearchParams(window.location.search).get('panel') === '1'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isPanel ? <PanelApp /> : <App />}
  </React.StrictMode>
)
