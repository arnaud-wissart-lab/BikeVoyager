import { useCloudFeatureSlice } from './useCloudFeatureSlice'
import {
  cloudBackupFileName,
  cloudDataRouteHash,
  cloudReconnectToastId,
} from './controller/providers'
import { useCloudBootstrapEffects } from './controller/useCloudBootstrapEffects'
import { useCloudControllerHandlers } from './controller/useCloudControllerHandlers'
import { useCloudSyncEffects } from './controller/useCloudSyncEffects'
import type { UseCloudControllerParams } from './controller/types'

export const useCloudController = ({
  store,
  route,
  t,
  isDesktop,
  cloudBackupPayloadContent,
  parseImportedPayload,
  applyParsedImportedData,
  wouldCloudBackupMergeChangeLocal,
  cloudRestoreSuccessMessageByKind,
  hasLocalBackupData,
}: UseCloudControllerParams) => {
  const {
    cloudAuthState,
    cloudProviderAvailability,
    cloudProvider,
    cloudDiagnostics,
    isCloudDiagnosticsLoading,
  } = store

  const {
    selectedCloudProvider,
    selectedCloudConfigured,
    hasAnyConfiguredCloudProvider,
    cloudProviderControlData,
    connectedCloudMatchesSelection,
    cloudAccountLabel,
    toCloudProviderLabel,
  } = useCloudFeatureSlice({
    cloudProvider,
    cloudProviderAvailability,
    cloudAuthState,
    t,
  })

  const {
    loadCloudDiagnostics,
    tryRestoreCloudBackupAfterConnect,
    handleCloudProviderChange,
    handleCloudAutoBackupEnabledChange,
    handleCloudConnect,
    handleCloudDisconnect,
    handleCloudUploadBackup,
    applyPendingCloudRestore,
    handleCancelPendingCloudRestore,
    pendingCloudRestore,
    isCloudAuthLoading,
    isCloudSyncLoading,
  } = useCloudControllerHandlers({
    store,
    t,
    cloudBackupPayloadContent,
    parseImportedPayload,
    applyParsedImportedData,
    wouldCloudBackupMergeChangeLocal,
    cloudRestoreSuccessMessageByKind,
    hasLocalBackupData,
    selectedCloudProvider,
    selectedCloudConfigured,
  })

  useCloudBootstrapEffects({
    store,
    route,
    t,
    loadCloudDiagnostics,
    tryRestoreCloudBackupAfterConnect,
  })

  useCloudSyncEffects({
    store,
    t,
    cloudBackupPayloadContent,
    selectedCloudProvider,
    selectedCloudConfigured,
  })

  return {
    cloudReconnectToastId,
    cloudDataRouteHash,
    cloudBackupFileName,
    selectedCloudProvider,
    selectedCloudConfigured,
    hasAnyConfiguredCloudProvider,
    cloudProviderControlData,
    connectedCloudMatchesSelection,
    cloudAccountLabel,
    toCloudProviderLabel,
    loadCloudDiagnostics,
    handleCloudProviderChange,
    handleCloudAutoBackupEnabledChange,
    handleCloudConnect,
    handleCloudDisconnect,
    handleCloudUploadBackup,
    applyPendingCloudRestore,
    handleCancelPendingCloudRestore,
    pendingCloudRestore,
    isCloudAuthLoading,
    isCloudSyncLoading,
    isDesktop,
    cloudDiagnostics,
    isCloudDiagnosticsLoading,
  }
}
