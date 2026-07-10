import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  createNavigationDeviationState,
  dismissNavigationDeviation,
  type NavigationDeviationState,
  type NavigationRecalculationStatus,
} from '../routing/domain'

type UseNavigationDeviationStateParams = {
  deviationState: NavigationDeviationState
  recalculationStatus: NavigationRecalculationStatus
  setDeviationState: Dispatch<SetStateAction<NavigationDeviationState>>
  setRecalculationStatus: Dispatch<SetStateAction<NavigationRecalculationStatus>>
  invalidateRecalculation: () => void
}

export const useNavigationDeviationState = ({
  deviationState,
  recalculationStatus,
  setDeviationState,
  setRecalculationStatus,
  invalidateRecalculation,
}: UseNavigationDeviationStateParams) => {
  const resetNavigationDeviation = useCallback(() => {
    invalidateRecalculation()
    setDeviationState(createNavigationDeviationState())
    setRecalculationStatus('idle')
  }, [invalidateRecalculation, setDeviationState, setRecalculationStatus])

  const handleDismissNavigationDeviation = useCallback(() => {
    if (recalculationStatus === 'loading') {
      return
    }

    setDeviationState((current) => dismissNavigationDeviation(current))
  }, [recalculationStatus, setDeviationState])

  useEffect(() => {
    if (deviationState.status === 'suspected' && recalculationStatus !== 'loading') {
      setRecalculationStatus('idle')
      return
    }

    if (deviationState.status === 'on_route' && recalculationStatus === 'error') {
      setRecalculationStatus('idle')
    }
  }, [deviationState.status, recalculationStatus, setRecalculationStatus])

  return {
    resetNavigationDeviation,
    handleDismissNavigationDeviation,
  }
}
