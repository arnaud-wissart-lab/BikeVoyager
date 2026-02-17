import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { localStorageColorSchemeManager, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { registerSW } from 'virtual:pwa-register'
import './i18n'
import './index.css'
import App from './App'
import { theme } from './theme'

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'bv-color-scheme',
})

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="auto"
      colorSchemeManager={colorSchemeManager}
    >
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </StrictMode>,
)
