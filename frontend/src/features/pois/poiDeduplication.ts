import { haversineDistanceMeters } from '../routing/domain'
import type { PoiItem } from '../routing/domain'

const maxPoiDuplicateSpatialDistanceMeters = 35
const maxPoiDuplicateAlongDistanceDeltaMeters = 80
const genericPoiNamesForDeduplication = new Set([
  "point d'interet",
  'point dinteret',
  'point of interest',
])

const normalizePoiTextForDeduplication = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

const getPoiSemanticKey = (poi: PoiItem) => {
  const normalizedName = normalizePoiTextForDeduplication(poi.name)
  if (!normalizedName || genericPoiNamesForDeduplication.has(normalizedName)) {
    return null
  }

  const normalizedKind = normalizePoiTextForDeduplication(poi.kind ?? '')
  return `${poi.category}|${normalizedKind}|${normalizedName}`
}

const getPoiDistanceToRoute = (poi: PoiItem) =>
  typeof poi.distance_to_route_m === 'number' && Number.isFinite(poi.distance_to_route_m)
    ? poi.distance_to_route_m
    : Number.POSITIVE_INFINITY

const selectPreferredPoiDuplicate = (left: PoiItem, right: PoiItem) => {
  const leftDistanceToRoute = getPoiDistanceToRoute(left)
  const rightDistanceToRoute = getPoiDistanceToRoute(right)
  if (rightDistanceToRoute + 1 < leftDistanceToRoute) {
    return right
  }
  if (leftDistanceToRoute + 1 < rightDistanceToRoute) {
    return left
  }

  const leftTagCount = left.tags ? Object.keys(left.tags).length : 0
  const rightTagCount = right.tags ? Object.keys(right.tags).length : 0
  if (rightTagCount > leftTagCount) {
    return right
  }
  if (leftTagCount > rightTagCount) {
    return left
  }

  return right.id.localeCompare(left.id) < 0 ? right : left
}

export const deduplicatePoiItems = (items: PoiItem[]) => {
  const semanticBuckets = new Map<string, PoiItem[]>()
  const passthrough: PoiItem[] = []

  for (const poi of items) {
    const semanticKey = getPoiSemanticKey(poi)
    if (!semanticKey) {
      passthrough.push(poi)
      continue
    }

    const bucket = semanticBuckets.get(semanticKey)
    if (!bucket) {
      semanticBuckets.set(semanticKey, [poi])
      continue
    }

    const duplicateIndex = bucket.findIndex((existing) => {
      if (Math.abs(existing.distance_m - poi.distance_m) > maxPoiDuplicateAlongDistanceDeltaMeters) {
        return false
      }

      return (
        haversineDistanceMeters([existing.lon, existing.lat], [poi.lon, poi.lat]) <=
        maxPoiDuplicateSpatialDistanceMeters
      )
    })

    if (duplicateIndex < 0) {
      bucket.push(poi)
      continue
    }

    bucket[duplicateIndex] = selectPreferredPoiDuplicate(bucket[duplicateIndex], poi)
  }

  const deduplicated = [
    ...passthrough,
    ...Array.from(semanticBuckets.values()).flat(),
  ]

  return deduplicated.sort((left, right) => {
    if (left.distance_m !== right.distance_m) {
      return left.distance_m - right.distance_m
    }

    const distanceToRouteDelta = getPoiDistanceToRoute(left) - getPoiDistanceToRoute(right)
    if (Math.abs(distanceToRouteDelta) > 0.001) {
      return distanceToRouteDelta
    }

    return left.id.localeCompare(right.id)
  })
}
