import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import { fetchCloudDiagnostics } from '../api'
import { resolveCloudErrorMessage } from './cloudErrors'

type UseCloudDiagnosticsParams = {
  t: TFunction
  setCloudDiagnostics: (value: Awaited<ReturnType<typeof fetchCloudDiagnostics>>) => void
  setIsCloudDiagnosticsLoading: (value: boolean) => void
  setCloudDiagnosticsError: (value: string | null) => void
}

export const useCloudDiagnostics = ({
  t,
  setCloudDiagnostics,
  setIsCloudDiagnosticsLoading,
  setCloudDiagnosticsError,
}: UseCloudDiagnosticsParams) =>
  useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true
      if (!quiet) {
        setIsCloudDiagnosticsLoading(true)
        setCloudDiagnosticsError(null)
      }

      try {
        const diagnostics = await fetchCloudDiagnostics()
        setCloudDiagnostics(diagnostics)
        if (!quiet) {
          setCloudDiagnosticsError(null)
        }
      } catch (error) {
        if (!quiet) {
          setCloudDiagnosticsError(
            resolveCloudErrorMessage(error, t('helpPlatformStatusUnavailable')),
          )
        }
      } finally {
        if (!quiet) {
          setIsCloudDiagnosticsLoading(false)
        }
      }
    },
    [setCloudDiagnostics, setCloudDiagnosticsError, setIsCloudDiagnosticsLoading, t],
  )
