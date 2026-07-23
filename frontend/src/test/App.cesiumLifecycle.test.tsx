import { StrictMode } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { createAppFetchMock, resetAppTestEnvironment, setDesktopMatchMedia } from './app-test-utils'
import { renderWithProviders } from './test-utils'

const cesiumLifecycle = vi.hoisted(() => ({
  events: [] as string[],
  failures: [] as string[],
}))

vi.mock('../components/CesiumRouteMap', async () => {
  const { createElement, useEffect } = await import('react')

  return {
    default: function CesiumRouteMapMock() {
      useEffect(() => {
        let handlerDestroyed = false
        let viewerDestroyed = false
        cesiumLifecycle.events.push('viewer:init', 'handler:init')

        const destroyHandler = () => {
          if (handlerDestroyed) {
            return
          }
          handlerDestroyed = true
          cesiumLifecycle.events.push('handler:destroy')
        }

        const destroyViewer = () => {
          if (viewerDestroyed) {
            return
          }
          if (!handlerDestroyed) {
            cesiumLifecycle.failures.push('handler encore actif pendant la destruction du viewer')
          }
          viewerDestroyed = true
          cesiumLifecycle.events.push('viewer:destroy')
        }

        return () => {
          destroyHandler()
          destroyViewer()
        }
      }, [])

      return createElement('div', { 'data-testid': 'mock-cesium-route-map' })
    },
  }
})

describe('Navigation du shell avec le cycle de vie Cesium', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    setDesktopMatchMedia()
    vi.stubGlobal('fetch', createAppFetchMock())
    cesiumLifecycle.events.length = 0
    cesiumLifecycle.failures.length = 0
    window.location.hash = '#/planifier'
  })

  it('conserve le shell après plusieurs cycles Planifier → Carte → Planifier sans trajet', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    for (let cycle = 0; cycle < 5; cycle += 1) {
      await user.click(screen.getByText(/^Carte$|^Map$/i))
      expect(await screen.findByTestId('mock-cesium-route-map')).toBeInTheDocument()
      expect(window.location.hash).toBe('#/carte')

      await user.click(screen.getByText(/^Planifier$|^Plan$/i))
      await waitFor(() => expect(window.location.hash).toBe('#/planifier'))
      expect(screen.getByRole('tab', { name: 'Planifier' })).toBeInTheDocument()
      expect(document.body.textContent?.trim()).not.toBe('')
    }

    expect(cesiumLifecycle.failures).toEqual([])
    for (let index = 0; index < cesiumLifecycle.events.length; index += 1) {
      if (cesiumLifecycle.events[index] === 'handler:destroy') {
        expect(cesiumLifecycle.events[index + 1]).toBe('viewer:destroy')
      }
    }
  })
})
