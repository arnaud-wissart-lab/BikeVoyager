import { renderHook } from '@testing-library/react'
import useInteractionHandlers from '../components/cesium/useInteractionHandlers'
import type { CesiumInteractionLifecycle } from '../components/cesium/lifecycle'
import type { CesiumModule } from '../components/cesium/types'

type InputAction = (movement: { position: import('cesium').Cartesian2 }) => void

const createHandler = () => {
  let destroyed = false
  const actions = new Map<string, InputAction>()

  return {
    actions,
    setInputAction: vi.fn((action: InputAction, eventType: string) => {
      actions.set(eventType, action)
    }),
    destroy: vi.fn(() => {
      destroyed = true
    }),
    isDestroyed: vi.fn(() => destroyed),
  }
}

describe('useInteractionHandlers — cycle de vie', () => {
  it('nettoie les ressources capturées sans relire la scène détruite', () => {
    const canvas = document.createElement('canvas')
    const addEventListenerSpy = vi.spyOn(canvas, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(canvas, 'removeEventListener')
    const removeCameraMoveStartListener = vi.fn()
    const handler = createHandler()
    const replacementHandler = createHandler()
    let viewerDestroyed = false
    const scene = {
      canvas,
      pick: vi.fn(),
      pickPositionSupported: false,
      globe: { ellipsoid: {} },
    }
    const sceneGetter = vi.fn(() => {
      if (viewerDestroyed) {
        throw new TypeError("Cannot read properties of undefined (reading 'scene')")
      }
      return scene
    })
    const viewer = {
      get scene() {
        return sceneGetter()
      },
      camera: {
        heading: 0,
        moveStart: {
          addEventListener: vi.fn(() => removeCameraMoveStartListener),
        },
        pickEllipsoid: vi.fn(),
      },
      isDestroyed: vi.fn(() => viewerDestroyed),
    } as unknown as import('cesium').Viewer
    const ScreenSpaceEventHandler = vi.fn(function ScreenSpaceEventHandler() {
      return handler
    })
    const Cesium = {
      ScreenSpaceEventHandler,
      ScreenSpaceEventType: {
        LEFT_CLICK: 'LEFT_CLICK',
        RIGHT_CLICK: 'RIGHT_CLICK',
      },
      defined: vi.fn((value: unknown) => value !== null && value !== undefined),
      JulianDate: { now: vi.fn() },
      Math: { toDegrees: vi.fn((value: number) => value) },
      Cartographic: { fromCartesian: vi.fn() },
    } as unknown as CesiumModule
    const viewerRef = { current: viewer }
    const cesiumRef = { current: Cesium }
    const poiClickHandlerRef = {
      current: null as import('cesium').ScreenSpaceEventHandler | null,
    }
    const interactionLifecycleRef = {
      current: null as CesiumInteractionLifecycle | null,
    }

    const { unmount } = renderHook(() =>
      useInteractionHandlers({
        status: 'ready',
        onPoiSelect: vi.fn(),
        onStreetViewContextMenu: vi.fn(),
        onMapStateChange: vi.fn(),
        viewerRef,
        cesiumRef,
        poiClickHandlerRef,
        interactionLifecycleRef,
      }),
    )

    expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function))
    expect(poiClickHandlerRef.current).toBe(handler)
    const cleanup = interactionLifecycleRef.current?.cleanup
    expect(cleanup).toBeTypeOf('function')

    viewerDestroyed = true
    expect(() => handler.actions.get('LEFT_CLICK')?.({ position: {} as never })).not.toThrow()
    expect(() => handler.actions.get('RIGHT_CLICK')?.({ position: {} as never })).not.toThrow()

    poiClickHandlerRef.current =
      replacementHandler as unknown as import('cesium').ScreenSpaceEventHandler
    expect(() => unmount()).not.toThrow()
    expect(() => cleanup?.()).not.toThrow()

    expect(sceneGetter).toHaveBeenCalledTimes(1)
    expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function))
    expect(removeCameraMoveStartListener).toHaveBeenCalledTimes(1)
    expect(handler.destroy).toHaveBeenCalledTimes(1)
    expect(poiClickHandlerRef.current).toBe(replacementHandler)
  })
})
