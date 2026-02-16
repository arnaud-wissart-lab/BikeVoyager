import type { TFunction } from 'i18next'
import type { ActiveCloudProvider, CloudAuthState } from '../cloudSync'
import {
  clearOAuthCallbackQueryParams,
  completeCloudOAuthCallback,
  disconnectCloudSession,
  startCloudOAuth,
} from '../api'
import { translateCloudError } from './errors'
import { clearCloudSyncFeedback } from './providers'

type CloudSyncFeedbackSetters = {
  setCloudSyncMessage: (value: string | null) => void
  setCloudSyncError: (value: string | null) => void
}

export const connectCloudProvider = async (params: {
  provider: ActiveCloudProvider
  cloudDataRouteHash: string
  t: TFunction
  setIsCloudAuthLoading: (value: boolean) => void
  setPendingCloudRestore: (value: null) => void
  setPendingCloudMergeSyncAuthState: (value: null) => void
  setDataAccordionValue: (value: string | null) => void
  setShouldRevealCloudPanel: (value: boolean) => void
  setters: CloudSyncFeedbackSetters
}) => {
  params.setIsCloudAuthLoading(true)
  params.setPendingCloudRestore(null)
  params.setPendingCloudMergeSyncAuthState(null)
  params.setDataAccordionValue('backup-cloud')
  params.setShouldRevealCloudPanel(true)
  clearCloudSyncFeedback(params.setters)

  try {
    const authUrl = await startCloudOAuth(params.provider, {
      returnHash: params.cloudDataRouteHash,
    })
    window.location.assign(authUrl)
  } catch (error) {
    params.setIsCloudAuthLoading(false)
    params.setters.setCloudSyncMessage(null)
    params.setters.setCloudSyncError(
      translateCloudError({
        t: params.t,
        key: 'cloudConnectError',
        error,
      }),
    )
  }
}

export const disconnectCloudProvider = async (params: {
  t: TFunction
  setIsCloudAuthLoading: (value: boolean) => void
  setPendingCloudRestore: (value: null) => void
  setPendingCloudMergeSyncAuthState: (value: null) => void
  setCloudAuthState: (value: CloudAuthState | null) => void
  setCloudLastSyncAt: (value: string | null) => void
  setters: CloudSyncFeedbackSetters
}) => {
  params.setIsCloudAuthLoading(true)
  params.setPendingCloudRestore(null)
  params.setPendingCloudMergeSyncAuthState(null)
  clearCloudSyncFeedback(params.setters)

  try {
    await disconnectCloudSession()
    params.setCloudAuthState(null)
    params.setCloudLastSyncAt(null)
    params.setters.setCloudSyncError(null)
    params.setters.setCloudSyncMessage(params.t('cloudDisconnectSuccess'))
  } catch (error) {
    params.setters.setCloudSyncMessage(null)
    params.setters.setCloudSyncError(
      translateCloudError({
        t: params.t,
        key: 'cloudDisconnectError',
        error,
      }),
    )
  } finally {
    params.setIsCloudAuthLoading(false)
  }
}

export const processCloudOAuthCallback = async (params: {
  t: TFunction
  cloudDataRouteHash: string
  setCloudAuthState: (value: CloudAuthState) => void
  setCloudProvider: (value: ActiveCloudProvider) => void
  setDataAccordionValue: (value: string | null) => void
  setShouldRevealCloudPanel: (value: boolean) => void
  setters: CloudSyncFeedbackSetters
  tryRestoreCloudBackupAfterConnect: (authState: CloudAuthState) => Promise<void>
}) => {
  const result = await completeCloudOAuthCallback()
  if (result.status === 'none') {
    return
  }

  clearOAuthCallbackQueryParams()

  if (result.status === 'error') {
    params.setters.setCloudSyncMessage(null)
    params.setters.setCloudSyncError(
      params.t('cloudConnectError', {
        message: result.message,
      }),
    )
    return
  }

  params.setCloudAuthState(result.authState)
  params.setCloudProvider(result.authState.provider)
  params.setters.setCloudSyncError(null)
  params.setters.setCloudSyncMessage(params.t('cloudConnectSuccess'))
  params.setDataAccordionValue('backup-cloud')
  params.setShouldRevealCloudPanel(true)
  window.location.hash = params.cloudDataRouteHash
  await params.tryRestoreCloudBackupAfterConnect(result.authState)
}
