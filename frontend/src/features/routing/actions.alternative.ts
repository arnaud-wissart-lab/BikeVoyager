import { areRouteGeometriesEquivalent, type RouteGeometry } from './domain'

type AlternativeCandidate = {
  geometry: RouteGeometry
}

type LoadAlternativeResult<TCandidate, TFailure> =
  | { ok: true; candidate: TCandidate }
  | { ok: false; failure: TFailure }

type RequestDistinctAlternativeParams<TCandidate extends AlternativeCandidate, TFailure> = {
  currentGeometry: RouteGeometry
  currentIndex: number
  attemptCount: number
  load: (nextIndex: number) => Promise<LoadAlternativeResult<TCandidate, TFailure>>
}

export const requestDistinctAlternative = async <
  TCandidate extends AlternativeCandidate,
  TFailure,
>({
  currentGeometry,
  currentIndex,
  attemptCount,
  load,
}: RequestDistinctAlternativeParams<TCandidate, TFailure>) => {
  for (let offset = 1; offset <= attemptCount; offset += 1) {
    const nextIndex = currentIndex + offset
    const result = await load(nextIndex)

    if (!result.ok) {
      return { status: 'failed' as const, failure: result.failure }
    }

    if (!areRouteGeometriesEquivalent(currentGeometry, result.candidate.geometry)) {
      return { status: 'success' as const, nextIndex, candidate: result.candidate }
    }
  }

  return { status: 'unavailable' as const }
}
