import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildNavigationDeviationEpisodeKey,
  clampNavigationAutoRecalculationCountdown,
  navigationAutoRecalculationDelayMs,
  resolveNavigationAutoRecalculationDecision,
  type NavigationAutoRecalculationStatus,
  type NavigationDeviationState,
  type NavigationMode,
  type NavigationRecalculationPlan,
  type NavigationRecalculationStatus,
} from '../routing/domain'

export type UseNavigationAutoRecalculationParams = {
  enabled: boolean
  isNavigationActive: boolean
  navigationMode: NavigationMode
  deviationState: NavigationDeviationState
  recalculationStatus: NavigationRecalculationStatus
  routeSessionKey: string | number | null
  getRecalculationPlan: (evaluatedAtMs: number) => NavigationRecalculationPlan
  onRecalculate: () => Promise<boolean>
}

export type UseNavigationAutoRecalculationResult = {
  status: NavigationAutoRecalculationStatus
  remainingSeconds: number | null
  cancelForCurrentEpisode: () => void
  recalculateNow: () => Promise<boolean>
}

type ActiveCountdown = {
  episodeKey: string
  deadlineMs: number
}

export const useNavigationAutoRecalculation = ({
  enabled,
  isNavigationActive,
  navigationMode,
  deviationState,
  recalculationStatus,
  routeSessionKey,
  getRecalculationPlan,
  onRecalculate,
}: UseNavigationAutoRecalculationParams): UseNavigationAutoRecalculationResult => {
  const [status, setStatus] = useState<NavigationAutoRecalculationStatus>('idle')
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [evaluatedAtMs, setEvaluatedAtMs] = useState(() => Date.now())
  const mountedRef = useRef(false)
  const attemptedEpisodeKeyRef = useRef<string | null>(null)
  const cancelledEpisodeKeyRef = useRef<string | null>(null)
  const activeCountdownRef = useRef<ActiveCountdown | null>(null)
  const intervalIdRef = useRef<number | null>(null)
  const timeoutIdRef = useRef<number | null>(null)
  const latestInputsRef = useRef({
    enabled,
    isNavigationActive,
    navigationMode,
    deviationState,
    recalculationStatus,
    routeSessionKey,
    getRecalculationPlan,
    onRecalculate,
  })
  latestInputsRef.current = {
    enabled,
    isNavigationActive,
    navigationMode,
    deviationState,
    recalculationStatus,
    routeSessionKey,
    getRecalculationPlan,
    onRecalculate,
  }

  const clearScheduledTimers = useCallback(() => {
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
  }, [])

  const episodeKey = buildNavigationDeviationEpisodeKey({ deviationState, routeSessionKey })
  const planEvaluatedAtMs = Math.max(evaluatedAtMs, deviationState.lastSampleAtMs ?? 0)
  const recalculationPlan = getRecalculationPlan(planEvaluatedAtMs)
  const decision = resolveNavigationAutoRecalculationDecision({
    enabled,
    isNavigationActive,
    navigationMode,
    deviationState,
    routeSessionKey,
    isRecalculationAvailable: recalculationPlan.available,
    isRecalculationLoading: recalculationStatus === 'loading',
    attemptedEpisodeKey: attemptedEpisodeKeyRef.current,
    cancelledEpisodeKey: cancelledEpisodeKeyRef.current,
  })
  const decisionReason = decision.shouldCountdown ? null : decision.reason
  const decisionEpisodeKey = decision.shouldCountdown ? decision.episodeKey : null

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      activeCountdownRef.current = null
      clearScheduledTimers()
    }
  }, [clearScheduledTimers])

  useEffect(() => {
    clearScheduledTimers()

    if (!decision.shouldCountdown || !decisionEpisodeKey) {
      activeCountdownRef.current = null
      setRemainingSeconds(null)
      setStatus((current) => {
        if (deviationState.status === 'dismissed' && current === 'cancelled') {
          return current
        }
        if (decisionReason === 'already_attempted') {
          return 'triggered'
        }
        if (decisionReason === 'cancelled') {
          return 'cancelled'
        }
        return 'idle'
      })
      return
    }

    const now = Date.now()
    const activeCountdown =
      activeCountdownRef.current?.episodeKey === decisionEpisodeKey
        ? activeCountdownRef.current
        : {
            episodeKey: decisionEpisodeKey,
            deadlineMs: now + navigationAutoRecalculationDelayMs,
          }
    activeCountdownRef.current = activeCountdown
    setStatus('countdown')
    setRemainingSeconds(clampNavigationAutoRecalculationCountdown(activeCountdown.deadlineMs, now))

    const expireCountdown = () => {
      const active = activeCountdownRef.current
      if (!mountedRef.current || !active || active.episodeKey !== decisionEpisodeKey) {
        return
      }

      const latest = latestInputsRef.current
      const evaluatedAtMs = Date.now()
      const freshPlan = latest.getRecalculationPlan(evaluatedAtMs)
      const freshDecision = resolveNavigationAutoRecalculationDecision({
        enabled: latest.enabled,
        isNavigationActive: latest.isNavigationActive,
        navigationMode: latest.navigationMode,
        deviationState: latest.deviationState,
        routeSessionKey: latest.routeSessionKey,
        isRecalculationAvailable: freshPlan.available,
        isRecalculationLoading: latest.recalculationStatus === 'loading',
        attemptedEpisodeKey: attemptedEpisodeKeyRef.current,
        cancelledEpisodeKey: cancelledEpisodeKeyRef.current,
      })

      if (!freshDecision.shouldCountdown || freshDecision.episodeKey !== active.episodeKey) {
        activeCountdownRef.current = null
        clearScheduledTimers()
        setRemainingSeconds(null)
        setStatus('idle')
        return
      }

      attemptedEpisodeKeyRef.current = active.episodeKey
      activeCountdownRef.current = null
      clearScheduledTimers()
      setRemainingSeconds(null)
      setStatus('triggered')
      void latest.onRecalculate()
    }

    intervalIdRef.current = window.setInterval(() => {
      if (!mountedRef.current || activeCountdownRef.current !== activeCountdown) {
        return
      }
      setRemainingSeconds(
        clampNavigationAutoRecalculationCountdown(activeCountdown.deadlineMs, Date.now()),
      )
      setEvaluatedAtMs(Date.now())
    }, 1000)
    timeoutIdRef.current = window.setTimeout(
      expireCountdown,
      Math.max(0, activeCountdown.deadlineMs - now),
    )

    return clearScheduledTimers
  }, [
    clearScheduledTimers,
    decision.shouldCountdown,
    decisionEpisodeKey,
    decisionReason,
    deviationState.status,
    episodeKey,
  ])

  const cancelForCurrentEpisode = useCallback(() => {
    const latest = latestInputsRef.current
    const currentEpisodeKey = buildNavigationDeviationEpisodeKey({
      deviationState: latest.deviationState,
      routeSessionKey: latest.routeSessionKey,
    })
    if (currentEpisodeKey) {
      cancelledEpisodeKeyRef.current = currentEpisodeKey
    }
    activeCountdownRef.current = null
    clearScheduledTimers()
    if (mountedRef.current) {
      setRemainingSeconds(null)
      setStatus('cancelled')
    }
  }, [clearScheduledTimers])

  const recalculateNow = useCallback(async () => {
    const latest = latestInputsRef.current
    const currentEpisodeKey = buildNavigationDeviationEpisodeKey({
      deviationState: latest.deviationState,
      routeSessionKey: latest.routeSessionKey,
    })
    if (currentEpisodeKey) {
      attemptedEpisodeKeyRef.current = currentEpisodeKey
    }
    activeCountdownRef.current = null
    clearScheduledTimers()
    if (mountedRef.current) {
      setRemainingSeconds(null)
      setStatus(currentEpisodeKey ? 'triggered' : 'idle')
    }
    return latest.onRecalculate()
  }, [clearScheduledTimers])

  return {
    status,
    remainingSeconds,
    cancelForCurrentEpisode,
    recalculateNow,
  }
}
