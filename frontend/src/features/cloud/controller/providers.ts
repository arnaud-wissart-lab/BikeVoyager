import type { TFunction } from 'i18next'
import type { CloudProvider } from '../../data/dataPortability'
import type { ActiveCloudProvider, CloudAuthState } from '../cloudSync'

export const cloudDataRouteHash = '#/donnees'
export const cloudReconnectToastId = 'cloud-reconnect-required'
export const cloudBackupFileName = 'bikevoyager-backup-latest.json'

type CloudSyncFeedbackSetters = {
  setCloudSyncMessage: (value: string | null) => void
  setCloudSyncError: (value: string | null) => void
}

export const clearCloudSyncFeedback = ({
  setCloudSyncMessage,
  setCloudSyncError,
}: CloudSyncFeedbackSetters) => {
  setCloudSyncMessage(null)
  setCloudSyncError(null)
}

const setCloudSyncValidationError = (
  key: string,
  t: TFunction,
  setters: CloudSyncFeedbackSetters,
) => {
  setters.setCloudSyncMessage(null)
  setters.setCloudSyncError(t(key))
}

export const updateCloudProviderPreference = (
  value: string,
  setCloudProvider: (provider: CloudProvider) => void,
  setters: CloudSyncFeedbackSetters,
) => {
  if (value === 'none' || value === 'onedrive' || value === 'google-drive') {
    setCloudProvider(value)
    clearCloudSyncFeedback(setters)
  }
}

export const updateCloudAutoBackupPreference = (
  value: boolean,
  setCloudAutoBackupEnabled: (enabled: boolean) => void,
  setters: CloudSyncFeedbackSetters,
) => {
  setCloudAutoBackupEnabled(value)
  clearCloudSyncFeedback(setters)
}

export const ensureCloudProviderReady = (params: {
  selectedCloudProvider: ActiveCloudProvider | null
  selectedCloudConfigured: boolean
  t: TFunction
  setters: CloudSyncFeedbackSetters
}): ActiveCloudProvider | null => {
  if (!params.selectedCloudProvider) {
    setCloudSyncValidationError('cloudSelectProvider', params.t, params.setters)
    return null
  }

  if (!params.selectedCloudConfigured) {
    setCloudSyncValidationError(
      'cloudProviderMissingClientId',
      params.t,
      params.setters,
    )
    return null
  }

  return params.selectedCloudProvider
}

export const ensureCloudUploadSession = (params: {
  selectedCloudProvider: ActiveCloudProvider
  cloudAuthState: CloudAuthState | null
  t: TFunction
  setters: CloudSyncFeedbackSetters
}): CloudAuthState | null => {
  if (
    !params.cloudAuthState ||
    params.cloudAuthState.provider !== params.selectedCloudProvider
  ) {
    setCloudSyncValidationError('cloudNotConnected', params.t, params.setters)
    return null
  }

  return params.cloudAuthState
}
