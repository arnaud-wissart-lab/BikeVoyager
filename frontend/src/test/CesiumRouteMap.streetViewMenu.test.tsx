import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CesiumRouteMap from '../components/CesiumRouteMap'
import type { StreetViewContextMenuRequest } from '../components/cesium/types'
import type { RouteGeometry } from '../features/routing/domain'
import { renderWithProviders } from './test-utils'

const hookMocks = vi.hoisted(() => ({
  useCameraControls: vi.fn(),
  useCesiumViewer: vi.fn(),
  useInteractionHandlers: vi.fn(),
  useMapLayers: vi.fn(),
  useRouteEntities: vi.fn(),
}))

vi.mock('../components/cesium/useCameraControls', () => ({
  default: hookMocks.useCameraControls,
}))

vi.mock('../components/cesium/useCesiumViewer', () => ({
  default: hookMocks.useCesiumViewer,
}))

vi.mock('../components/cesium/useInteractionHandlers', () => ({
  default: hookMocks.useInteractionHandlers,
}))

vi.mock('../components/cesium/useMapLayers', () => ({
  default: hookMocks.useMapLayers,
}))

vi.mock('../components/cesium/useRouteEntities', () => ({
  default: hookMocks.useRouteEntities,
}))

type InteractionHandlersParams = {
  onStreetViewContextMenu?: (request: StreetViewContextMenuRequest) => void
  onMapStateChange?: () => void
}

const streetViewRequest: StreetViewContextMenuRequest = {
  x: 42,
  y: 58,
  target: {
    lat: 48.8566,
    lon: 2.3522,
    heading: 90,
  },
}

const routeGeometry: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [2.3522, 48.8566],
    [2.36, 48.86],
  ],
}

const alternativeGeometry: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [2.3522, 48.8566],
    [2.37, 48.865],
  ],
}

const renderMap = (onOpenStreetView = vi.fn(), geometry: RouteGeometry | null = null) =>
  renderWithProviders(
    <CesiumRouteMap
      geometry={geometry}
      bounds={null}
      viewMode="3d"
      fallbackLabel="Carte indisponible"
      onOpenStreetView={onOpenStreetView}
    />,
  )

const getInteractionHandlersParams = () =>
  hookMocks.useInteractionHandlers.mock.calls.at(-1)?.[0] as InteractionHandlersParams

const openStreetViewMenu = () => {
  act(() => {
    getInteractionHandlersParams().onStreetViewContextMenu?.(streetViewRequest)
  })
}

describe('Menu Street View de CesiumRouteMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookMocks.useCesiumViewer.mockReturnValue('ready')
  })

  it('diffère l’ouverture Google Maps jusqu’au choix du menu', async () => {
    const user = userEvent.setup()
    const onOpenStreetView = vi.fn()

    renderMap(onOpenStreetView)
    openStreetViewMenu()

    expect(onOpenStreetView).not.toHaveBeenCalled()
    expect(screen.getByTestId('street-view-context-menu')).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Voir dans Google Street View' }))

    expect(onOpenStreetView).toHaveBeenCalledWith(streetViewRequest.target)
    expect(screen.queryByTestId('street-view-context-menu')).not.toBeInTheDocument()
  })

  it('ferme le menu au clic extérieur', () => {
    renderMap()

    openStreetViewMenu()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('street-view-context-menu')).not.toBeInTheDocument()
  })

  it('ferme le menu avec Échap', () => {
    renderMap()

    openStreetViewMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('street-view-context-menu')).not.toBeInTheDocument()
  })

  it('ferme le menu quand la carte change d’état', () => {
    renderMap()

    openStreetViewMenu()
    act(() => {
      getInteractionHandlersParams().onMapStateChange?.()
    })

    expect(screen.queryByTestId('street-view-context-menu')).not.toBeInTheDocument()
  })

  it('transmet le tracé alternatif au rendu Cesium', () => {
    renderWithProviders(
      <CesiumRouteMap
        geometry={routeGeometry}
        alternativeGeometry={alternativeGeometry}
        bounds={null}
        viewMode="3d"
        fallbackLabel="Carte indisponible"
      />,
    )

    expect(screen.getByTestId('cesium-route-map')).toHaveAttribute('data-route-layer-count', '2')
    expect(screen.getByTestId('cesium-route-map')).toHaveAttribute(
      'data-alternative-route-visible',
      'true',
    )
    expect(hookMocks.useRouteEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        geometry: routeGeometry,
        alternativeGeometry,
      }),
    )
  })

  it('ignore un tracé alternatif sans géométrie exploitable côté indicateur observable', () => {
    const emptyAlternativeGeometry: RouteGeometry = {
      type: 'LineString',
      coordinates: [],
    }

    renderWithProviders(
      <CesiumRouteMap
        geometry={routeGeometry}
        alternativeGeometry={emptyAlternativeGeometry}
        bounds={null}
        viewMode="3d"
        fallbackLabel="Carte indisponible"
      />,
    )

    expect(screen.getByTestId('cesium-route-map')).toHaveAttribute('data-route-layer-count', '1')
    expect(screen.getByTestId('cesium-route-map')).toHaveAttribute(
      'data-alternative-route-visible',
      'false',
    )
  })
})
