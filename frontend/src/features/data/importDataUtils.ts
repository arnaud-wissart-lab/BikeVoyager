import type { PlannerDraft } from '../routing/domain'

export const toCanonicalJson = (value: unknown): string => {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) {
      return candidate.map((item) => normalize(item))
    }

    if (candidate && typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>
      return Object.keys(record)
        .sort((left, right) => left.localeCompare(right))
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = normalize(record[key])
          return acc
        }, {})
    }

    return candidate
  }

  return JSON.stringify(normalize(value))
}

export const hasPlannerDraftData = (draft: PlannerDraft) =>
  draft.mode !== null ||
  draft.tripType !== null ||
  draft.onewayStartValue.trim().length > 0 ||
  draft.loopStartValue.trim().length > 0 ||
  draft.endValue.trim().length > 0 ||
  typeof draft.targetDistanceKm === 'number'
