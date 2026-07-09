import { useEffect, type MutableRefObject } from 'react'
import type {
  MapViewMode,
  RouteBounds,
  RouteElevationPoint,
  RouteGeometry,
} from '../../features/routing/domain'
import { buildRouteHeights, buildRouteSignature, haversineDistanceMeters } from './math'
import type { CesiumModule, CesiumStatus, NavigationProgress, PoiMarker } from './types'

type UseRouteEntitiesParams = {
  status: CesiumStatus
  geometry: RouteGeometry | null
  alternativeGeometry?: RouteGeometry | null
  bounds: RouteBounds | null
  elevationProfile?: RouteElevationPoint[] | null
  alternativeElevationProfile?: RouteElevationPoint[] | null
  navigationActive: boolean
  navigationProgress: NavigationProgress | null
  viewMode: MapViewMode
  pois?: PoiMarker[]
  activePoiId?: string | null
  viewerRef: MutableRefObject<import('cesium').Viewer | null>
  cesiumRef: MutableRefObject<CesiumModule | null>
  routeEntityRef: MutableRefObject<import('cesium').Entity | null>
  alternativeRouteEntityRef: MutableRefObject<import('cesium').Entity | null>
  poiEntitiesRef: MutableRefObject<import('cesium').Entity[]>
  navigationEntityRef: MutableRefObject<import('cesium').Entity | null>
  lastRouteSignatureRef: MutableRefObject<string | null>
  lastAlternativeRouteSignatureRef: MutableRefObject<string | null>
}

const buildPolylinePositions = (
  Cesium: CesiumModule,
  geometry: RouteGeometry | null | undefined,
  elevationProfile?: RouteElevationPoint[] | null,
) => {
  if (!geometry || geometry.type !== 'LineString' || geometry.coordinates.length < 2) {
    return null
  }

  const coordinates = geometry.coordinates.filter(
    (coordinate): coordinate is [number, number] =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]),
  )

  if (coordinates.length < 2) {
    return null
  }

  const heights = buildRouteHeights(coordinates, elevationProfile)
  const positions = coordinates.map(([lon, lat], index) =>
    Cesium.Cartesian3.fromDegrees(lon, lat, heights ? (heights[index] ?? 0) : 0),
  )

  return {
    positions,
    hasAltitude: Boolean(heights),
  }
}

export default function useRouteEntities({
  status,
  geometry,
  alternativeGeometry,
  bounds,
  elevationProfile,
  alternativeElevationProfile,
  navigationActive,
  navigationProgress,
  viewMode,
  pois,
  activePoiId,
  viewerRef,
  cesiumRef,
  routeEntityRef,
  alternativeRouteEntityRef,
  poiEntitiesRef,
  navigationEntityRef,
  lastRouteSignatureRef,
  lastAlternativeRouteSignatureRef,
}: UseRouteEntitiesParams) {
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (status !== 'ready' || !viewer || !Cesium) {
      return
    }

    const nextSignature = buildRouteSignature(geometry, elevationProfile)
    if (nextSignature === lastRouteSignatureRef.current && routeEntityRef.current) {
      viewer.scene.requestRender()
      return
    }
    lastRouteSignatureRef.current = nextSignature

    if (routeEntityRef.current) {
      viewer.entities.remove(routeEntityRef.current)
      routeEntityRef.current = null
    }

    const routePolyline = buildPolylinePositions(Cesium, geometry, elevationProfile)
    if (!routePolyline) {
      return
    }

    routeEntityRef.current = viewer.entities.add({
      polyline: {
        positions: routePolyline.positions,
        width: 4,
        clampToGround: !routePolyline.hasAltitude,
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
  }, [
    bounds,
    cesiumRef,
    elevationProfile,
    geometry,
    lastRouteSignatureRef,
    navigationActive,
    routeEntityRef,
    status,
    viewerRef,
  ])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (status !== 'ready' || !viewer || !Cesium) {
      return
    }

    const nextSignature = buildRouteSignature(
      alternativeGeometry ?? null,
      alternativeElevationProfile,
    )
    if (
      nextSignature === lastAlternativeRouteSignatureRef.current &&
      alternativeRouteEntityRef.current
    ) {
      viewer.scene.requestRender()
      return
    }
    lastAlternativeRouteSignatureRef.current = nextSignature

    if (alternativeRouteEntityRef.current) {
      viewer.entities.remove(alternativeRouteEntityRef.current)
      alternativeRouteEntityRef.current = null
    }

    const alternativePolyline = buildPolylinePositions(
      Cesium,
      alternativeGeometry,
      alternativeElevationProfile,
    )
    if (!alternativePolyline) {
      viewer.scene.requestRender()
      return
    }

    alternativeRouteEntityRef.current = viewer.entities.add({
      polyline: {
        positions: alternativePolyline.positions,
        width: 3,
        clampToGround: !alternativePolyline.hasAltitude,
        material: Cesium.Color.fromCssColorString('#1971c2').withAlpha(0.58),
      },
    })

    viewer.scene.requestRender()
  }, [
    alternativeElevationProfile,
    alternativeGeometry,
    alternativeRouteEntityRef,
    cesiumRef,
    lastAlternativeRouteSignatureRef,
    status,
    viewerRef,
  ])

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
  }, [activePoiId, cesiumRef, poiEntitiesRef, pois, status, viewerRef])

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
          viewMode === '3d' ? Cesium.Math.toRadians(-72) : Cesium.Math.toRadians(-89.5),
          viewMode === '3d' ? 950 : 1350,
        ),
      })
      viewer.scene.requestRender()
      return
    }

    // Repli si l'entite POI n'est pas encore disponible.
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
  }, [activePoiId, cesiumRef, poiEntitiesRef, pois, status, viewMode, viewerRef])

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
      position: Cesium.Cartesian3.fromDegrees(navigationProgress.lon, navigationProgress.lat, 0),
      point: {
        pixelSize: 12,
        color: pointColor,
        outlineColor: Cesium.Color.fromCssColorString('#ffffff'),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    })

    viewer.scene.requestRender()
  }, [cesiumRef, navigationActive, navigationEntityRef, navigationProgress, status, viewerRef])
}
