import type { TFunction } from 'i18next'
import type { CSSProperties } from 'react'
import { appendDetourPoint } from './actions.poi'
import type { DetourPoint, PlaceCandidate, RouteKey, TripResult } from './domain'

export const createPlannerPanelStyles = () => {
  const panelTransitionDuration = 220
  const panelTransitionTiming = 'ease-in-out'
  const panelStackStyle: CSSProperties = {
    position: 'relative',
  }
  const panelBaseStyle: CSSProperties = {
    transitionProperty: 'opacity, transform',
    transitionDuration: `${panelTransitionDuration}ms`,
    transitionTimingFunction: panelTransitionTiming,
  }

  const getPanelStyle = (isActive: boolean): CSSProperties => ({
    ...panelBaseStyle,
    position: isActive ? 'relative' : 'absolute',
    inset: isActive ? undefined : 0,
    opacity: isActive ? 1 : 0,
    transform: isActive ? 'translateY(0)' : 'translateY(-6px)',
    pointerEvents: isActive ? 'auto' : 'none',
    visibility: isActive ? 'visible' : 'hidden',
  })

  return {
    panelTransitionDuration,
    panelTransitionTiming,
    panelStackStyle,
    getPanelStyle,
  }
}

export const computeCanSubmitFeedback = (
  feedbackSubject: string,
  feedbackMessage: string,
  isFeedbackSubmitting: boolean,
) =>
  feedbackSubject.trim().length >= 6 &&
  feedbackMessage.trim().length >= 20 &&
  !isFeedbackSubmitting

export const resolveRouteErrorDisplayMessage = (
  routeErrorMessage: string | null,
  routeErrorKey: string | null,
  t: TFunction,
) => routeErrorMessage ?? (routeErrorKey ? t(routeErrorKey) : null)

export const resolveAlternativeRouteLabel = (
  routeResult: TripResult | null,
  t: TFunction,
) =>
  routeResult?.kind === 'loop'
    ? t('mapRegenerateLoopVariant')
    : t('mapRecalculateRouteVariant')

export const toRouteLocation = (place: PlaceCandidate) => ({
  lat: place.lat,
  lon: place.lon,
  label: place.label,
})

type RecalculateWithDetours = (nextDetours: DetourPoint[]) => Promise<boolean>

export const addDetourPointAndRecalculate = async (params: {
  detourPoints: DetourPoint[]
  point: DetourPoint
  recalculateWithDetours: RecalculateWithDetours
}) => {
  const nextDetours = appendDetourPoint(params.detourPoints, params.point)
  if (nextDetours === params.detourPoints) {
    return {
      status: 'unchanged' as const,
      nextDetours,
    }
  }

  const success = await params.recalculateWithDetours(nextDetours)
  if (!success) {
    return {
      status: 'failed' as const,
      nextDetours,
    }
  }

  return {
    status: 'success' as const,
    nextDetours,
  }
}

export const removeDetourPointAndRecalculate = async (params: {
  detourPoints: DetourPoint[]
  detourId: string
  recalculateWithDetours: RecalculateWithDetours
}) => {
  const nextDetours = params.detourPoints.filter((point) => point.id !== params.detourId)
  const success = await params.recalculateWithDetours(nextDetours)
  return {
    success,
    nextDetours,
  }
}

type SubmitDeveloperFeedbackActionParams = {
  canSubmitFeedback: boolean
  feedbackSubject: string
  feedbackMessage: string
  feedbackContactEmail: string
  route: RouteKey
  t: TFunction
  setIsFeedbackSubmitting: (value: boolean) => void
  setFeedbackSubmitMessage: (value: string | null) => void
  setFeedbackSubmitError: (value: string | null) => void
  setFeedbackSubject: (value: string) => void
  setFeedbackContactEmail: (value: string) => void
  setFeedbackMessage: (value: string) => void
  submitDeveloperFeedback: (payload: {
    subject: string
    message: string
    contactEmail: string
    page: RouteKey
  }) => Promise<Response>
  readApiMessage: (response: Response) => Promise<string | null>
}

export const submitDeveloperFeedbackAction = async (
  params: SubmitDeveloperFeedbackActionParams,
) => {
  if (!params.canSubmitFeedback) {
    return
  }

  params.setIsFeedbackSubmitting(true)
  params.setFeedbackSubmitMessage(null)
  params.setFeedbackSubmitError(null)

  try {
    const response = await params.submitDeveloperFeedback({
      subject: params.feedbackSubject,
      message: params.feedbackMessage,
      contactEmail: params.feedbackContactEmail,
      page: params.route,
    })

    if (!response.ok) {
      const message = await params.readApiMessage(response)
      params.setFeedbackSubmitError(message ?? params.t('helpFeedbackSubmitError'))
      return
    }

    params.setFeedbackSubject('')
    params.setFeedbackContactEmail('')
    params.setFeedbackMessage('')
    params.setFeedbackSubmitMessage(params.t('helpFeedbackSubmitSuccess'))
  } catch {
    params.setFeedbackSubmitError(params.t('helpFeedbackSubmitError'))
  } finally {
    params.setIsFeedbackSubmitting(false)
  }
}

type ExportRouteAsGpxActionParams = {
  routeResult: TripResult | null
  mapHeaderTitle: string
  t: TFunction
  setIsExporting: (value: boolean) => void
  setExportError: (value: string | null) => void
  exportRouteAsGpx: (payload: {
    geometry: TripResult['geometry']
    elevation_profile: TripResult['elevation_profile'] | null
    name: string
  }) => Promise<Response>
  parseContentDispositionFileName: (headerValue: string | null) => string | null
  buildGpxFileName: (baseName: string) => string
  downloadBlob: (blob: Blob, fileName: string) => void
}

export const exportRouteAsGpxAction = async (params: ExportRouteAsGpxActionParams) => {
  if (!params.routeResult || params.routeResult.geometry.coordinates.length < 2) {
    params.setExportError(params.t('exportGpxFailed'))
    return
  }

  params.setIsExporting(true)
  params.setExportError(null)

  try {
    const response = await params.exportRouteAsGpx({
      geometry: params.routeResult.geometry,
      elevation_profile:
        params.routeResult.elevation_profile.length > 1
          ? params.routeResult.elevation_profile
          : null,
      name: params.mapHeaderTitle || params.t('exportGpxDefaultName'),
    })

    if (!response.ok) {
      params.setExportError(params.t('exportGpxFailed'))
      return
    }

    const blob = await response.blob()
    const headerFileName = params.parseContentDispositionFileName(
      response.headers.get('content-disposition'),
    )
    const fallbackName = params.buildGpxFileName(
      params.mapHeaderTitle || params.t('exportGpxDefaultName'),
    )
    params.downloadBlob(blob, headerFileName ?? fallbackName)
  } catch {
    params.setExportError(params.t('exportGpxFailed'))
  } finally {
    params.setIsExporting(false)
  }
}
