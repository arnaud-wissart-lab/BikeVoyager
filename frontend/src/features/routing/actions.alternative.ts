type LoadAlternativeResult<TCandidate> = { ok: true; candidate: TCandidate } | { ok: false }

type CollectRelevantAlternativesParams<TCandidate, TAssessment> = {
  candidateIndexes: readonly number[]
  maximumCount: number
  load: (nextIndex: number) => Promise<LoadAlternativeResult<TCandidate>>
  assess: (candidate: TCandidate) => TAssessment | null
  isRelevant: (assessment: TAssessment) => boolean
  isDuplicate: (accepted: TCandidate, candidate: TCandidate) => boolean
}

export const collectRelevantAlternatives = async <TCandidate, TAssessment>({
  candidateIndexes,
  maximumCount,
  load,
  assess,
  isRelevant,
  isDuplicate,
}: CollectRelevantAlternativesParams<TCandidate, TAssessment>) => {
  const loadedCandidates = await Promise.all(
    candidateIndexes.map(async (nextIndex) => ({
      nextIndex,
      result: await load(nextIndex),
    })),
  )
  const alternatives: {
    nextIndex: number
    candidate: TCandidate
    assessment: TAssessment
  }[] = []

  for (const loaded of loadedCandidates) {
    if (!loaded.result.ok) {
      continue
    }

    const candidate = loaded.result.candidate
    const assessment = assess(candidate)
    if (
      !assessment ||
      !isRelevant(assessment) ||
      alternatives.some((alternative) => isDuplicate(alternative.candidate, candidate))
    ) {
      continue
    }

    alternatives.push({
      nextIndex: loaded.nextIndex,
      candidate,
      assessment,
    })
    if (alternatives.length >= maximumCount) {
      break
    }
  }

  return alternatives
}
