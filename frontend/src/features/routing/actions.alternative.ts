import type { TripResult } from './domain'

type LoadAlternativeResult<TCandidate, TFailure> =
  { ok: true; candidate: TCandidate } | { ok: false; failure: TFailure }

type RequestDistinctAlternativeParams<TCandidate extends TripResult, TFailure> = {
  excludedCandidates: readonly TripResult[]
  currentIndex: number
  attemptCount: number
  load: (nextIndex: number) => Promise<LoadAlternativeResult<TCandidate, TFailure>>
  areEquivalent: (excluded: TripResult, candidate: TCandidate) => boolean
}

export const requestDistinctAlternative = async <TCandidate extends TripResult, TFailure>({
  excludedCandidates,
  currentIndex,
  attemptCount,
  load,
  areEquivalent,
}: RequestDistinctAlternativeParams<TCandidate, TFailure>) => {
  for (let offset = 1; offset <= attemptCount; offset += 1) {
    const nextIndex = currentIndex + offset
    const result = await load(nextIndex)

    if (!result.ok) {
      return { status: 'failed' as const, failure: result.failure }
    }

    const wasAlreadyProposed = excludedCandidates.some((excluded) =>
      areEquivalent(excluded, result.candidate),
    )
    if (!wasAlreadyProposed) {
      return { status: 'success' as const, nextIndex, candidate: result.candidate }
    }
  }

  return { status: 'unavailable' as const }
}
