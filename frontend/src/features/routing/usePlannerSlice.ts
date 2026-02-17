import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import type { Mode, TripType } from './domain'

type UsePlannerSliceParams = {
  mode: Mode | null
  tripType: TripType | null
  hasStartSelection: boolean
  hasEndSelection: boolean
  targetDistanceKm: number | ''
  hasResult: boolean
  isDirty: boolean
  t: TFunction
}

type PlannerHelperItem = {
  key: string
  show: boolean
  label: string
}

export const usePlannerSlice = ({
  mode,
  tripType,
  hasStartSelection,
  hasEndSelection,
  targetDistanceKm,
  hasResult,
  isDirty,
  t,
}: UsePlannerSliceParams) => {
  const helperItems: PlannerHelperItem[] = [
    {
      key: 'mode',
      show: !mode,
      label: t('helper.missing.mode'),
    },
    {
      key: 'type',
      show: !tripType,
      label: t('helper.missing.type'),
    },
    {
      key: 'start',
      show: Boolean(tripType) && !hasStartSelection,
      label: t('helper.missing.start'),
    },
    {
      key: 'end',
      show: tripType === 'oneway' && !hasEndSelection,
      label: t('helper.missing.end'),
    },
    {
      key: 'distance',
      show: tripType === 'loop' && !(typeof targetDistanceKm === 'number' && targetDistanceKm > 0),
      label: t('helper.missing.distance'),
    },
  ]

  const helperHasMissing = helperItems.some((item) => item.show)
  const helperReadyLabel =
    tripType === 'loop' ? t('helper.title.ready.loop') : t('helper.title.ready.route')

  const ctaLabel = useMemo(() => {
    const shouldRecalculate = hasResult && isDirty

    if (tripType === 'loop') {
      return shouldRecalculate ? t('ctaRegenerate') : t('ctaGenerateLoop')
    }

    if (tripType === 'oneway') {
      return shouldRecalculate ? t('ctaRecalculate') : t('ctaCalculate')
    }

    return t('ctaCalculate')
  }, [hasResult, isDirty, t, tripType])

  const isFormReady = useMemo(() => {
    if (!mode || !tripType) {
      return false
    }

    if (tripType === 'oneway') {
      return hasStartSelection && hasEndSelection
    }

    return hasStartSelection && typeof targetDistanceKm === 'number' && targetDistanceKm > 0
  }, [hasEndSelection, hasStartSelection, mode, targetDistanceKm, tripType])

  return {
    helperItems,
    helperHasMissing,
    helperReadyLabel,
    ctaLabel,
    isFormReady,
  }
}
