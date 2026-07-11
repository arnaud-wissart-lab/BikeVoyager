import { act, renderHook, waitFor } from '@testing-library/react'
import useCesiumViewer from '../components/cesium/useCesiumViewer'

const cesiumMocks = vi.hoisted(() => ({
  Viewer: vi.fn(function Viewer() {}),
  ImageryLayer: vi.fn(function ImageryLayer(provider: unknown) {
    return { provider }
  }),
  OpenStreetMapImageryProvider: vi.fn(function OpenStreetMapImageryProvider(options: unknown) {
    return { options }
  }),
  EllipsoidTerrainProvider: vi.fn(function EllipsoidTerrainProvider() {
    return { kind: 'ellipsoid' }
  }),
  createWorldTerrainAsync: vi.fn(),
  Ion: { defaultAccessToken: '' },
  viewerQueue: [] as import('cesium').Viewer[],
}))

vi.mock('cesium', () => ({
  Viewer: cesiumMocks.Viewer,
  ImageryLayer: cesiumMocks.ImageryLayer,
  OpenStreetMapImageryProvider: cesiumMocks.OpenStreetMapImageryProvider,
  EllipsoidTerrainProvider: cesiumMocks.EllipsoidTerrainProvider,
  createWorldTerrainAsync: cesiumMocks.createWorldTerrainAsync,
  Ion: cesiumMocks.Ion,
}))

vi.mock('../components/cesium/math', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/cesium/math')>()),
  hasWebglSupport: () => true,
}))

type ViewerParams = Parameters<typeof useCesiumViewer>[0]

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const createViewer = (order: string[] = []) => {
  let destroyed = false
  const viewer = {
    scene: {
      globe: {
        depthTestAgainstTerrain: true,
        maximumScreenSpaceError: 0,
      },
      screenSpaceCameraController: {
        enableCollisionDetection: false,
      },
      postProcessStages: {
        fxaa: { enabled: false },
      },
    },
    resolutionScale: 1,
    isDestroyed: vi.fn(() => destroyed),
    destroy: vi.fn(() => {
      order.push('viewer')
      destroyed = true
    }),
  }

  return viewer as unknown as import('cesium').Viewer
}

const createHandler = (order: string[] = []) => {
  let destroyed = false
  return {
    isDestroyed: vi.fn(() => destroyed),
    destroy: vi.fn(() => {
      order.push('handler')
      destroyed = true
    }),
  } as unknown as import('cesium').ScreenSpaceEventHandler
}

const createParams = (): ViewerParams => ({
  containerRef: { current: document.createElement('div') },
  viewerRef: { current: null },
  routeEntityRef: { current: null },
  alternativeRouteEntityRef: { current: null },
  poiEntitiesRef: { current: [] },
  navigationEntityRef: { current: null },
  smoothedHeadingRef: { current: null },
  lastRouteSignatureRef: { current: null },
  lastAlternativeRouteSignatureRef: { current: null },
  cesiumRef: { current: null },
  poiClickHandlerRef: { current: null },
  interactionLifecycleRef: { current: null },
})

describe('useCesiumViewer — cycle de vie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    cesiumMocks.viewerQueue.length = 0
    cesiumMocks.Ion.defaultAccessToken = ''
    cesiumMocks.Viewer.mockImplementation(function Viewer() {
      const viewer = cesiumMocks.viewerQueue.shift()
      if (!viewer) {
        throw new Error('Aucun viewer de test disponible.')
      }
      return viewer
    })
  })

  it('détruit le handler avant le viewer et rend le cleanup idempotent', async () => {
    const order: string[] = []
    const viewer = createViewer(order)
    const handler = createHandler(order)
    const params = createParams()
    cesiumMocks.viewerQueue.push(viewer)

    const { result, unmount } = renderHook(() => useCesiumViewer(params))
    await waitFor(() => expect(result.current).toBe('ready'))

    params.poiClickHandlerRef.current = handler
    expect(() => unmount()).not.toThrow()
    expect(() => unmount()).not.toThrow()

    expect(order).toEqual(['handler', 'viewer'])
    expect(handler.destroy).toHaveBeenCalledTimes(1)
    expect(viewer.destroy).toHaveBeenCalledTimes(1)
    expect(params.viewerRef.current).toBeNull()
    expect(params.poiClickHandlerRef.current).toBeNull()
  })

  it('empêche une ancienne génération de remplacer ou détruire la suivante', async () => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', 'token-de-test')
    const firstTerrain = createDeferred<unknown>()
    const secondTerrain = createDeferred<unknown>()
    cesiumMocks.createWorldTerrainAsync
      .mockReturnValueOnce(firstTerrain.promise)
      .mockReturnValueOnce(secondTerrain.promise)
    const firstParams = createParams()
    const secondParams = createParams()
    const secondViewer = createViewer()
    cesiumMocks.viewerQueue.push(secondViewer)

    const { result, rerender, unmount } = renderHook(
      ({ params }: { params: ViewerParams }) => useCesiumViewer(params),
      { initialProps: { params: firstParams } },
    )
    await waitFor(() => expect(cesiumMocks.createWorldTerrainAsync).toHaveBeenCalledTimes(1))

    rerender({ params: secondParams })
    await waitFor(() => expect(cesiumMocks.createWorldTerrainAsync).toHaveBeenCalledTimes(2))

    await act(async () => {
      secondTerrain.resolve({ kind: 'world-2' })
      await secondTerrain.promise
    })
    await waitFor(() => expect(result.current).toBe('ready'))
    expect(secondParams.viewerRef.current).toBe(secondViewer)

    await act(async () => {
      firstTerrain.resolve({ kind: 'world-1' })
      await firstTerrain.promise
    })

    expect(cesiumMocks.Viewer).toHaveBeenCalledTimes(1)
    expect(firstParams.viewerRef.current).toBeNull()
    expect(secondParams.viewerRef.current).toBe(secondViewer)
    expect(secondViewer.destroy).not.toHaveBeenCalled()

    unmount()
    expect(secondViewer.destroy).toHaveBeenCalledTimes(1)
  })

  it('abandonne le terrain résolu après démontage sans conserver de ressource', async () => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', 'token-de-test')
    const terrain = createDeferred<unknown>()
    cesiumMocks.createWorldTerrainAsync.mockReturnValueOnce(terrain.promise)
    const params = createParams()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = renderHook(() => useCesiumViewer(params))
    await waitFor(() => expect(cesiumMocks.createWorldTerrainAsync).toHaveBeenCalledTimes(1))
    unmount()

    await act(async () => {
      terrain.resolve({ kind: 'world' })
      await terrain.promise
    })

    expect(cesiumMocks.Viewer).not.toHaveBeenCalled()
    expect(params.viewerRef.current).toBeNull()
    expect(params.cesiumRef.current).toBeNull()
    expect(params.interactionLifecycleRef.current).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})
