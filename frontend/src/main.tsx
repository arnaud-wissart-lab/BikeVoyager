import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  localStorageColorSchemeManager,
  MantineProvider,
} from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import './i18n'
import './index.css'
import App from './App'
import { theme } from './theme'

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'bv-color-scheme',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="light"
      colorSchemeManager={colorSchemeManager}
    >
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </StrictMode>,
)
