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
}

export const useNavigationDeviationState = ({
  deviationState,
  recalculationStatus,
  setDeviationState,
  setRecalculationStatus,
}: UseNavigationDeviationStateParams) => {
  const resetNavigationDeviation = useCallback(() => {
    setDeviationState(createNavigationDeviationState())
    setRecalculationStatus('idle')
  }, [setDeviationState, setRecalculationStatus])

  const handleDismissNavigationDeviation = useCallback(() => {
    setDeviationState((current) => dismissNavigationDeviation(current))
  }, [setDeviationState])

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
