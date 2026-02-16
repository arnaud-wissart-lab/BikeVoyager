import { useEffect, useRef, useState } from 'react'

type RouteGeometry = {
  type: 'LineString'
  coordinates: [number, number][]
}

type RouteBounds = {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

type RouteElevationPoint = {
  distance_m: number
  elevation_m: number
}

type PoiMarker = {
  id: string
  name: string
  lat: number
  lon: number
  category: string
  kind?: string | null
}

type MapViewMode = '2d' | '3d'
type MapCommand = 'zoomInPoi' | 'zoomOutPoi' | 'resetRoute'
type NavigationCameraMode = 'follow_3d' | 'panoramic_3d' | 'overview_2d'
type NavigationSource = 'gps' | 'simulation'

type NavigationProgress = {
  lat: number
  lon: number
  headingDeg: number
  source: NavigationSource
}

type CesiumRouteMapProps = {
  geometry: RouteGeometry | null
  bounds: RouteBounds | null
  elevationProfile?: RouteElevationPoint[] | null
  viewMode: MapViewMode
  mapCommand?: MapCommand | null
  mapCommandSeq?: number
  fallbackLabel: string
  pois?: PoiMarker[]
  activePoiId?: string | null
  onPoiSelect?: (poiId: string) => void
  navigationActive?: boolean
  navigationProgress?: NavigationProgress | null
  navigationCameraMode?: NavigationCameraMode
}

type CesiumModule = typeof import('cesium')

declare const CESIUM_BASE_URL: string

const hasWebglSupport = () => {
  if (typeof window === 'undefined') {
    return false
  }

  if (import.meta.env.MODE === 'test') {
    return false
  }

  try {
    const canvas = document.createElement('canvas')
    const webgl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return Boolean(webgl)
  } catch {
    return false
  }
}

const toRadians = (value: number) => (value * Math.PI) / 180

const haversineDistanceMeters = (
  a: [number, number],
  b: [number, number],
) => {
  const [lon1, lat1] = a
  const [lon2, lat2] = b
  const earthRadius = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const lat1Rad = toRadians(lat1)
  const lat2Rad = toRadians(lat2)

  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLon * sinLon
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)))
}

const buildCumulativeDistances = (coordinates: [number, number][]) => {
  if (coordinates.length === 0) {
    return []
  }

  const distances = [0]
  for (let i = 1; i < coordinates.length; i += 1) {
    const segment = haversineDistanceMeters(coordinates[i - 1], coordinates[i])
    distances.push(distances[i - 1] + segment)
  }
  return distances
}

const interpolateElevation = (
  profile: RouteElevationPoint[],
  distance: number,
) => {
  if (profile.length === 0) {
    return 0
  }

  if (distance <= profile[0].distance_m) {
    return profile[0].elevation_m
  }

  for (let i = 1; i < profile.length; i += 1) {
    const previous = profile[i - 1]
    const current = profile[i]
    if (distance <= current.distance_m) {
      const span = current.distance_m - previous.distance_m
      if (span <= 0) {
        return current.elevation_m
      }
      const ratio = (distance - previous.distance_m) / span
      return previous.elevation_m + ratio * (current.elevation_m - previous.elevation_m)
    }
  }

  return profile[profile.length - 1].elevation_m
}

const buildRouteHeights = (
  coordinates: [number, number][],
  elevationProfile?: RouteElevationPoint[] | null,
) => {
  if (!elevationProfile || elevationProfile.length < 2) {
    return null
  }

  const distances = buildCumulativeDistances(coordinates)
  return distances.map((distance) => interpolateElevation(elevationProfile, distance))
}

const buildRouteSignature = (
  geometry: RouteGeometry | null,
  elevationProfile?: RouteElevationPoint[] | null,
) => {
  if (!geometry || geometry.coordinates.length === 0) {
    return null
  }

  const first = geometry.coordinates[0]
  const last = geometry.coordinates[geometry.coordinates.length - 1]
  const altitudeKey = elevationProfile?.length ?? 0
  return `${geometry.coordinates.length}:${first[0].toFixed(5)}:${first[1].toFixed(5)}:${last[0].toFixed(5)}:${last[1].toFixed(5)}:${altitudeKey}`
}

const normalizeHeadingDegrees = (heading: number) => {
  if (!Number.isFinite(heading)) {
    return 0
  }

  const wrapped = heading % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

const destinationPointByBearing = (
  origin: [number, number],
  bearingDeg: number,
  distanceMeters: number,
): [number, number] => {
  const [lon, lat] = origin
  const earthRadius = 6371000
  const angularDistance = distanceMeters / earthRadius
  const bearing = toRadians(bearingDeg)
  const latRad = toRadians(lat)
  const lonRad = toRadians(lon)

  const nextLat = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const nextLon =
    lonRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nextLat),
    )

  return [(nextLon * 180) / Math.PI, (nextLat * 180) / Math.PI]
}

const getNavigationCameraPreset = (mode: NavigationCameraMode) => {
  if (mode === 'follow_3d') {
    return {
      backDistance_m: 115,
      height_m: 84,
      pitchDeg: -40,
    }
  }

  if (mode === 'panoramic_3d') {
    return {
      backDistance_m: 230,
      height_m: 150,
      pitchDeg: -34,
    }
  }

  return {
    backDistance_m: 0,
    height_m: 1700,
    pitchDeg: -89.5,
  }
}

export default function CesiumRouteMap({
  geometry,
  bounds,
  elevationProfile,
  viewMode,
  mapCommand,
  mapCommandSeq = 0,
  fallbackLabel,
  pois,
  activePoiId,
  onPoiSelect,
  navigationActive = false,
  navigationProgress = null,
  navigationCameraMode = 'follow_3d',
}: CesiumRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const routeEntityRef = useRef<import('cesium').Entity | null>(null)
  const poiEntitiesRef = useRef<import('cesium').Entity[]>([])
  const navigationEntityRef = useRef<import('cesium').Entity | null>(null)
  const smoothedHeadingRef = useRef<number | null>(null)
  const lastRouteSignatureRef = useRef<string | null>(null)
  const lastProcessedCommandSeqRef = useRef(0)
  const cesiumRef = useRef<CesiumModule | null>(null)
  const poiClickHandlerRef = useRef<import('cesium').ScreenSpaceEventHandler | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (!hasWebglSupport()) {
      setStatus('fallback')
      return
    }

    let isActive = true

    const initializeViewer = async () => {
      try {
        const Cesium = await import('cesium')
        if (!isActive || !containerRef.current) {
          return
        }

        cesiumRef.current = Cesium

        const baseUrl =
          typeof CESIUM_BASE_URL !== 'undefined'
            ? CESIUM_BASE_URL
            : `${import.meta.env.BASE_URL ?? '/'}cesium/`
        if (typeof window !== 'undefined') {
          ;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
            baseUrl
        }

        const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN
        if (ionToken) {
          Cesium.Ion.defaultAccessToken = ionToken
        }

        const terrainProvider = ionToken
          ? await Cesium.createWorldTerrainAsync({
              requestVertexNormals: true,
              requestWaterMask: true,
            })
          : new Cesium.EllipsoidTerrainProvider()

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider,
          baseLayer: new Cesium.ImageryLayer(
            new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/',
              maximumLevel: 19,
            }),
          ),
          geocoder: false,
          homeButton: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          timeline: false,
          animation: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          contextOptions: {
            webgl: {
              alpha: false,
              antialias: true,
            },
          },
          useBrowserRecommendedResolution: false,
          msaaSamples: 4,
          requestRenderMode: true,
          maximumRenderTimeChange: Number.POSITIVE_INFINITY,
        })

        viewer.scene.globe.depthTestAgainstTerrain = false
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true
        viewer.scene.postProcessStages.fxaa.enabled = true
        viewer.scene.globe.maximumScreenSpaceError = 1.4
        viewer.resolutionScale = Math.min(
          2,
          Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio : 1),
        )

        viewerRef.current = viewer
        setStatus('ready')
      } catch {
        setStatus('fallback')
      }
    }

    void initializeViewer()

    return () => {
      isActive = false
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
      }
      if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
        poiClickHandlerRef.current.destroy()
      }
      poiClickHandlerRef.current = null
      viewerRef.current = null
      routeEntityRef.current = null
      poiEntitiesRef.current = []
      navigationEntityRef.current = null
      smoothedHeadingRef.current = null
      lastRouteSignatureRef.current = null
      cesiumRef.current = null
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) {
      return
    }

    if (navigationActive) {
      return
    }

    if (viewMode === '2d') {
      viewer.scene.morphTo2D(0)
    } else {
      viewer.scene.morphTo3D(0)
    }
    viewer.scene.requestRender()
  }, [navigationActive, status, viewMode])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) {
      return
    }

    if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
      poiClickHandlerRef.current.destroy()
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((movement: { position: import('cesium').Cartesian2 }) => {
      if (!onPoiSelect) {
        return
      }

      const picked = viewer.scene.pick(movement.position)
      if (!Cesium.defined(picked)) {
        return
      }

      const pickedEntity = (picked as { id?: import('cesium').Entity }).id
      const poiProperty = pickedEntity?.properties?.poiId
      if (!poiProperty) {
        return
      }

      const poiId = typeof poiProperty.getValue === 'function'
        ? poiProperty.getValue(Cesium.JulianDate.now())
        : poiProperty

      if (typeof poiId === 'string' && poiId.trim()) {
        onPoiSelect(poiId)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    poiClickHandlerRef.current = handler

    return () => {
      if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
        poiClickHandlerRef.current.destroy()
      }
      poiClickHandlerRef.current = null
    }
  }, [onPoiSelect, status])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (status !== 'ready' || !viewer || !Cesium) {
      return
    }

    const nextSignature = buildRouteSignature(geometry, elevationProfile)
    if (
      nextSignature === lastRouteSignatureRef.current &&
      routeEntityRef.current
    ) {
      viewer.scene.requestRender()
      return
    }
    lastRouteSignatureRef.current = nextSignature

    if (routeEntityRef.current) {
      viewer.entities.remove(routeEntityRef.current)
      routeEntityRef.current = null
    }

    if (!geometry || geometry.coordinates.length === 0) {
      return
    }

    const heights = buildRouteHeights(geometry.coordinates, elevationProfile)
    const positions = geometry.coordinates.map(([lon, lat], index) =>
      Cesium.Cartesian3.fromDegrees(
        lon,
        lat,
        heights ? heights[index] ?? 0 : 0,
      ),
    )

    const hasAltitude = Boolean(heights)

    routeEntityRef.current = viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        clampToGround: !hasAltitude,
        material: Cesium.Color.fromCssColorString('#2b8a3e'),
      },
    })

    if (!navigationActive) {
      if (bounds) {
        const diagonalMeters = haversineDistanceMeters(
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
        )
        const duration = Math.min(2.4, Math.max(1.1, diagonalMeters / 300000))
        const rectangle = Cesium.Rectangle.fromDegrees(
          bounds.minLon,
          bounds.minLat,
          bounds.maxLon,
          bounds.maxLat,
        )
        viewer.camera.flyTo({
          destination: rectangle,
          duration,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        })
      } else if (routeEntityRef.current) {
        void viewer.zoomTo(routeEntityRef.current)
      }
    }

    viewer.scene.requestRender()
  }, [bounds, elevationProfile, geometry, navigationActive, status])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) {
      return
    }

    for (const entity of poiEntitiesRef.current) {
      viewer.entities.remove(entity)
    }
    poiEntitiesRef.current = []

    if (!pois || pois.length === 0) {
      return
    }

    for (const poi of pois) {
      const isActive = poi.id === activePoiId
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat),
        properties: {
          poiId: poi.id,
        },
        point: {
          pixelSize: isActive ? 10 : 7,
          color: Cesium.Color.fromCssColorString(isActive ? '#e8590c' : '#1c7ed6'),
          outlineColor: Cesium.Color.fromCssColorString('#ffffff'),
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })

      poiEntitiesRef.current.push(entity)
    }

    viewer.scene.requestRender()
  }, [activePoiId, pois, status])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium || !activePoiId || !pois || pois.length === 0) {
      return
    }

    const activePoi = pois.find((poi) => poi.id === activePoiId)
    if (!activePoi) {
      return
    }

    if (!Number.isFinite(activePoi.lat) || !Number.isFinite(activePoi.lon)) {
      return
    }

    const activeEntity = poiEntitiesRef.current.find((entity) => {
      const property = entity.properties?.poiId
      if (!property) {
        return false
      }

      const value =
        typeof property.getValue === 'function'
          ? property.getValue(Cesium.JulianDate.now())
          : property
      return value === activePoiId
    })

    if (activeEntity) {
      void viewer.flyTo(activeEntity, {
        duration: 1.15,
        offset: new Cesium.HeadingPitchRange(
          viewMode === '3d' ? viewer.camera.heading : 0,
          viewMode === '3d'
            ? Cesium.Math.toRadians(-72)
            : Cesium.Math.toRadians(-89.5),
          viewMode === '3d' ? 950 : 1350,
        ),
      })
      viewer.scene.requestRender()
      return
    }

    // Fallback when POI entity is not available yet.
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(activePoi.lon, activePoi.lat, 1200),
      duration: 1.1,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
      orientation: {
        heading: viewer.camera.heading,
        pitch: Cesium.Math.toRadians(-88),
        roll: 0,
      },
    })
    viewer.scene.requestRender()
  }, [activePoiId, pois, status, viewMode])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) {
      return
    }

    if (navigationEntityRef.current) {
      viewer.entities.remove(navigationEntityRef.current)
      navigationEntityRef.current = null
    }

    if (!navigationActive || !navigationProgress) {
      viewer.scene.requestRender()
      return
    }

    const pointColor =
      navigationProgress.source === 'simulation'
        ? Cesium.Color.fromCssColorString('#f76707')
        : Cesium.Color.fromCssColorString('#12b886')

    navigationEntityRef.current = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        navigationProgress.lon,
        navigationProgress.lat,
        0,
      ),
      point: {
        pixelSize: 12,
        color: pointColor,
        outlineColor: Cesium.Color.fromCssColorString('#ffffff'),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    })

    viewer.scene.requestRender()
  }, [navigationActive, navigationProgress, status])

  useEffect(() => {
    if (!navigationActive) {
      smoothedHeadingRef.current = null
    }
  }, [navigationActive])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (
      status !== 'ready' ||
      !viewer ||
      !Cesium ||
      !navigationActive ||
      !navigationProgress
    ) {
      return
    }

    const targetHeadingDeg = normalizeHeadingDegrees(navigationProgress.headingDeg)
    const previousHeadingDeg = smoothedHeadingRef.current
    let headingDeg = targetHeadingDeg
    if (previousHeadingDeg !== null) {
      const shortestDelta = ((targetHeadingDeg - previousHeadingDeg + 540) % 360) - 180
      const smoothingFactor = navigationProgress.source === 'gps' ? 0.28 : 0.45
      headingDeg = normalizeHeadingDegrees(
        previousHeadingDeg + shortestDelta * smoothingFactor,
      )
    }
    smoothedHeadingRef.current = headingDeg
    const heading = Cesium.Math.toRadians(headingDeg)

    if (navigationCameraMode === 'overview_2d') {
      if (viewer.scene.mode !== Cesium.SceneMode.SCENE2D) {
        viewer.scene.morphTo2D(0)
      }

      const preset = getNavigationCameraPreset(navigationCameraMode)
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          navigationProgress.lon,
          navigationProgress.lat,
          preset.height_m,
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(preset.pitchDeg),
          roll: 0,
        },
      })
      viewer.scene.requestRender()
      return
    }

    if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
      viewer.scene.morphTo3D(0)
    }

    const preset = getNavigationCameraPreset(navigationCameraMode)
    const [cameraLon, cameraLat] = destinationPointByBearing(
      [navigationProgress.lon, navigationProgress.lat],
      headingDeg + 180,
      preset.backDistance_m,
    )

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        cameraLon,
        cameraLat,
        preset.height_m,
      ),
      orientation: {
        heading,
        pitch: Cesium.Math.toRadians(preset.pitchDeg),
        roll: 0,
      },
    })
    viewer.scene.requestRender()
  }, [navigationActive, navigationCameraMode, navigationProgress, status])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (
      status !== 'ready' ||
      !viewer ||
      !Cesium ||
      navigationActive ||
      mapCommandSeq === 0 ||
      mapCommandSeq === lastProcessedCommandSeqRef.current ||
      !mapCommand
    ) {
      return
    }
    lastProcessedCommandSeqRef.current = mapCommandSeq

    if (mapCommand === 'resetRoute') {
      if (bounds) {
        const rectangle = Cesium.Rectangle.fromDegrees(
          bounds.minLon,
          bounds.minLat,
          bounds.maxLon,
          bounds.maxLat,
        )
        viewer.camera.flyTo({
          destination: rectangle,
          duration: 1.05,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        })
      } else if (routeEntityRef.current) {
        void viewer.flyTo(routeEntityRef.current, {
          duration: 1.05,
        })
      }

      viewer.scene.requestRender()
      return
    }

    if (!activePoiId || !pois || pois.length === 0) {
      return
    }

    const activePoi = pois.find((poi) => poi.id === activePoiId)
    if (!activePoi) {
      return
    }

    if (!Number.isFinite(activePoi.lat) || !Number.isFinite(activePoi.lon)) {
      return
    }

    const currentHeight = viewer.camera.positionCartographic.height
    const fallbackHeight = viewMode === '3d' ? 950 : 1350
    const safeCurrentHeight =
      Number.isFinite(currentHeight) && currentHeight > 0
        ? currentHeight
        : fallbackHeight
    const heightFactor = mapCommand === 'zoomInPoi' ? 0.68 : 1.45
    const minHeight = viewMode === '3d' ? 120 : 220
    const maxHeight = 18000
    const nextHeight = Math.min(
      maxHeight,
      Math.max(minHeight, safeCurrentHeight * heightFactor),
    )

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        activePoi.lon,
        activePoi.lat,
        nextHeight,
      ),
      duration: 0.55,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
      orientation: {
        heading: viewMode === '3d' ? viewer.camera.heading : 0,
        pitch:
          viewMode === '3d'
            ? viewer.camera.pitch
            : Cesium.Math.toRadians(-89.5),
        roll: 0,
      },
    })
    viewer.scene.requestRender()
  }, [activePoiId, bounds, mapCommand, mapCommandSeq, navigationActive, pois, status, viewMode])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {status === 'fallback' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '24px',
            backgroundColor: 'rgba(12, 14, 18, 0.35)',
            color: 'inherit',
          }}
        >
          <span>{fallbackLabel}</span>
        </div>
      )}
    </div>
  )
}
