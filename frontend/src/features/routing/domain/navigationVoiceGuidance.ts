import type { NavigationGuidance } from './navigationGuidance'
import type { NavigationDeviationStatus } from './navigationDeviation'
import type { NavigationRecalculationStatus } from './navigationRecalculation'

export type NavigationVoiceAnnouncementKind = 'advance' | 'near' | 'immediate' | 'arrival'

export type NavigationVoiceAnnouncement = {
  key: string
  kind: NavigationVoiceAnnouncementKind
  text: string
  stepIndex: number
}

export type NavigationVoiceBand = Exclude<NavigationVoiceAnnouncementKind, 'arrival'>

export type NavigationVoiceLanguage = 'fr' | 'en'

type NavigationVoiceTranslationKey =
  'navigationVoiceAdvance' | 'navigationVoiceImmediate' | 'navigationVoiceArrival'

type NavigationVoiceTranslate = (
  key: NavigationVoiceTranslationKey,
  values?: Record<string, string>,
) => string

type CreateNavigationVoiceAnnouncementParams = {
  guidance: NavigationGuidance
  previousGuidance: NavigationGuidance | null
  language: NavigationVoiceLanguage
  translate: NavigationVoiceTranslate
}

export const navigationVoiceNearThresholdMeters = 80
export const navigationVoiceImmediateThresholdMeters = 20

export const shouldSuspendNavigationVoiceGuidance = (
  deviationStatus: NavigationDeviationStatus,
  recalculationStatus: NavigationRecalculationStatus,
) =>
  deviationStatus === 'off_route' ||
  deviationStatus === 'dismissed' ||
  recalculationStatus === 'loading'

const isNonNegativeFiniteDistance = (distanceMeters: number | null): distanceMeters is number =>
  distanceMeters !== null && Number.isFinite(distanceMeters) && distanceMeters >= 0

export const resolveNavigationVoiceBand = (
  distanceMeters: number | null,
): NavigationVoiceBand | null => {
  if (!isNonNegativeFiniteDistance(distanceMeters)) {
    return null
  }

  if (distanceMeters <= navigationVoiceImmediateThresholdMeters) {
    return 'immediate'
  }

  if (distanceMeters <= navigationVoiceNearThresholdMeters) {
    return 'near'
  }

  return 'advance'
}

const roundSpokenDistanceMeters = (distanceMeters: number) => {
  if (distanceMeters < 100) {
    const roundedDistance = Math.round(distanceMeters / 5) * 5
    return distanceMeters > 0 ? Math.max(5, roundedDistance) : 0
  }

  if (distanceMeters < 500) {
    return Math.round(distanceMeters / 10) * 10
  }

  if (distanceMeters < 1000) {
    return Math.round(distanceMeters / 50) * 50
  }

  return distanceMeters
}

export const formatSpokenDistance = (
  distanceMeters: number | null,
  language: NavigationVoiceLanguage,
): string | null => {
  if (!isNonNegativeFiniteDistance(distanceMeters)) {
    return null
  }

  const roundedMeters = roundSpokenDistanceMeters(distanceMeters)
  if (roundedMeters < 1000) {
    const unit =
      language === 'fr'
        ? roundedMeters > 1
          ? 'mètres'
          : 'mètre'
        : roundedMeters === 1
          ? 'meter'
          : 'meters'
    return `${roundedMeters} ${unit}`
  }

  const kilometers = Math.round((distanceMeters / 1000) * 10) / 10
  const formattedValue = new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(kilometers)
  const unit =
    language === 'fr'
      ? kilometers < 2
        ? 'kilomètre'
        : 'kilomètres'
      : kilometers === 1
        ? 'kilometer'
        : 'kilometers'
  return `${formattedValue} ${unit}`
}

export const buildNavigationVoiceAnnouncementKey = (
  kind: NavigationVoiceAnnouncementKind,
  stepIndex: number,
) => (kind === 'arrival' ? 'arrival' : `step:${stepIndex}:${kind}`)

const bandUrgency: Record<NavigationVoiceBand, number> = {
  advance: 0,
  near: 1,
  immediate: 2,
}

export const createNavigationVoiceAnnouncement = ({
  guidance,
  previousGuidance,
  language,
  translate,
}: CreateNavigationVoiceAnnouncementParams): NavigationVoiceAnnouncement | null => {
  if (guidance.isArrival) {
    return {
      key: buildNavigationVoiceAnnouncementKey('arrival', guidance.activeStepIndex),
      kind: 'arrival',
      text: translate('navigationVoiceArrival'),
      stepIndex: guidance.activeStepIndex,
    }
  }

  const instruction = guidance.activeInstruction.trim().replace(/\s+/g, ' ')
  const band = resolveNavigationVoiceBand(guidance.distanceToManeuverMeters)
  if (!instruction || !band) {
    return null
  }

  if (previousGuidance?.activeStepIndex === guidance.activeStepIndex) {
    const previousBand = resolveNavigationVoiceBand(previousGuidance.distanceToManeuverMeters)
    if (previousBand && bandUrgency[band] <= bandUrgency[previousBand]) {
      return null
    }
  }

  const key = buildNavigationVoiceAnnouncementKey(band, guidance.activeStepIndex)
  if (band === 'immediate') {
    return {
      key,
      kind: band,
      text: translate('navigationVoiceImmediate', { instruction }),
      stepIndex: guidance.activeStepIndex,
    }
  }

  const distance = formatSpokenDistance(guidance.distanceToManeuverMeters, language)
  if (!distance) {
    return null
  }

  return {
    key,
    kind: band,
    text: translate('navigationVoiceAdvance', { distance, instruction }),
    stepIndex: guidance.activeStepIndex,
  }
}
