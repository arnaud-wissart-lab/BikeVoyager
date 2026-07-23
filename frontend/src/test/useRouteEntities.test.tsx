import { render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import useRouteEntities from '../components/cesium/useRouteEntities'
import type { CesiumModule } from '../components/cesium/types'
import type { RouteGeometry } from '../features/routing/domain'

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

const alternativeGeometryWithMiddlePoint: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [2.3522, 48.8566],
    [2.36, 48.86],
    [2.37, 48.865],
  ],
}

const alternativeGeometryWithDifferentMiddlePoint: RouteGeometry = {
  type: 'LineString',
  coordinates: [
    [2.3522, 48.8566],
    [2.365, 48.858],
    [2.37, 48.865],
  ],
}

type ViewerMock = {
  entities: {
    add: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }
  scene: {
    requestRender: ReturnType<typeof vi.fn>
  }
  camera: {
    flyTo: ReturnType<typeof vi.fn>
    heading: number
  }
  zoomTo: ReturnType<typeof vi.fn>
  isDestroyed: ReturnType<typeof vi.fn>
}

const createCesiumMock = () =>
  ({
    Cartesian3: {
      fromDegrees: vi.fn((lon: number, lat: number, height = 0) => ({ lon, lat, height })),
    },
    Color: {
      fromCssColorString: vi.fn((color: string) => ({
        color,
        withAlpha: vi.fn((alpha: number) => ({ color, alpha })),
      })),
    },
    PolylineDashMaterialProperty: vi.fn(function PolylineDashMaterialProperty(options: unknown) {
      return options
    }),
    Rectangle: {
      fromDegrees: vi.fn((minLon: number, minLat: number, maxLon: number, maxLat: number) => ({
        minLon,
        minLat,
        maxLon,
        maxLat,
      })),
    },
    EasingFunction: {
      QUADRATIC_IN_OUT: vi.fn(),
    },
    HeightReference: {
      CLAMP_TO_GROUND: 'CLAMP_TO_GROUND',
    },
    JulianDate: {
      now: vi.fn(() => ({})),
    },
    Math: {
      toRadians: vi.fn((value: number) => value),
    },
    HeadingPitchRange: vi.fn(),
  }) as unknown as CesiumModule

const createViewerMock = (): ViewerMock => ({
  entities: {
    add: vi.fn((entity: unknown) => entity),
    remove: vi.fn(),
  },
  scene: {
    requestRender: vi.fn(),
  },
  camera: {
    flyTo: vi.fn(),
    heading: 0,
  },
  zoomTo: vi.fn(),
  isDestroyed: vi.fn(() => false),
})

type HarnessProps = {
  viewer: ViewerMock
  cesium: CesiumModule
  geometry?: RouteGeometry | null
  alternativeGeometry?: RouteGeometry | null
}

const RouteEntitiesHarness = ({
  viewer,
  cesium,
  geometry = routeGeometry,
  alternativeGeometry = null,
}: HarnessProps) => {
  const viewerRef = useRef(viewer as unknown as import('cesium').Viewer)
  const cesiumRef = useRef(cesium)
  const routeEntityRef = useRef<import('cesium').Entity | null>(null)
  const alternativeRouteEntityRef = useRef<import('cesium').Entity | null>(null)
  const poiEntitiesRef = useRef<import('cesium').Entity[]>([])
  const navigationEntityRef = useRef<import('cesium').Entity | null>(null)
  const lastRouteSignatureRef = useRef<string | null>(null)
  const lastAlternativeRouteSignatureRef = useRef<string | null>(null)

  useRouteEntities({
    status: 'ready',
    geometry,
    alternativeGeometry,
    bounds: null,
    elevationProfile: null,
    alternativeElevationProfile: null,
    navigationActive: false,
    navigationProgress: null,
    viewMode: '3d',
    pois: [],
    activePoiId: null,
    viewerRef,
    cesiumRef,
    routeEntityRef,
    alternativeRouteEntityRef,
    poiEntitiesRef,
    navigationEntityRef,
    lastRouteSignatureRef,
    lastAlternativeRouteSignatureRef,
  })

  return null
}

describe('useRouteEntities', () => {
  it('ajoute un tracé principal et un tracé alternatif distinct', async () => {
    const viewer = createViewerMock()
    const cesium = createCesiumMock()

    render(
      <RouteEntitiesHarness
        viewer={viewer}
        cesium={cesium}
        alternativeGeometry={alternativeGeometry}
      />,
    )

    await waitFor(() => {
      expect(viewer.entities.add).toHaveBeenCalledTimes(2)
    })

    const primaryPolyline = viewer.entities.add.mock.calls[0][0].polyline
    const alternativePolyline = viewer.entities.add.mock.calls[1][0].polyline

    expect(primaryPolyline).toMatchObject({
      width: 6,
      clampToGround: true,
    })
    expect(alternativePolyline).toMatchObject({
      width: 4,
      clampToGround: true,
      material: {
        color: {
          color: '#862e9c',
          alpha: 0.95,
        },
        dashLength: 18,
      },
    })
  })

  it('ne rend pas de tracé alternatif quand il est absent', async () => {
    const viewer = createViewerMock()
    const cesium = createCesiumMock()

    render(<RouteEntitiesHarness viewer={viewer} cesium={cesium} />)

    await waitFor(() => {
      expect(viewer.entities.add).toHaveBeenCalledTimes(1)
    })
  })

  it('remplace le tracé alternatif quand seul un point intermédiaire change', async () => {
    const viewer = createViewerMock()
    const cesium = createCesiumMock()
    const { rerender } = render(
      <RouteEntitiesHarness
        viewer={viewer}
        cesium={cesium}
        alternativeGeometry={alternativeGeometryWithMiddlePoint}
      />,
    )

    await waitFor(() => {
      expect(viewer.entities.add).toHaveBeenCalledTimes(2)
    })
    const firstAlternativeEntity = viewer.entities.add.mock.calls[1][0]

    rerender(
      <RouteEntitiesHarness
        viewer={viewer}
        cesium={cesium}
        alternativeGeometry={alternativeGeometryWithDifferentMiddlePoint}
      />,
    )

    await waitFor(() => {
      expect(viewer.entities.remove).toHaveBeenCalledWith(firstAlternativeEntity)
    })
    await waitFor(() => {
      expect(viewer.entities.add).toHaveBeenCalledTimes(3)
    })
  })

  it('ignore une géométrie alternative invalide sans erreur', async () => {
    const viewer = createViewerMock()
    const cesium = createCesiumMock()
    const invalidAlternativeGeometry = {
      type: 'LineString',
      coordinates: [[2.3522, Number.NaN], [2.36]],
    } as unknown as RouteGeometry

    render(
      <RouteEntitiesHarness
        viewer={viewer}
        cesium={cesium}
        alternativeGeometry={invalidAlternativeGeometry}
      />,
    )

    await waitFor(() => {
      expect(viewer.entities.add).toHaveBeenCalledTimes(1)
    })
    expect(viewer.scene.requestRender).toHaveBeenCalled()
  })
})
