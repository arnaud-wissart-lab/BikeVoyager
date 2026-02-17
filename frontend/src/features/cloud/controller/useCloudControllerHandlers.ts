import { useCallback } from 'react'
import type { AppStore } from '../../../state/appStore'
import type { ActiveCloudProvider } from '../cloudSync'
import { uploadCloudBackup } from './backup'
import { connectCloudProvider, disconnectCloudProvider } from './oauthFlow'
import {
  cloudBackupFileName,
  cloudDataRouteHash,
  ensureCloudProviderReady,
  ensureCloudUploadSession,
  updateCloudAutoBackupPreference,
  updateCloudProviderPreference,
} from './providers'
import { useCloudDiagnostics } from './useCloudDiagnostics'
import { useCloudRestoreActions } from './useCloudRestoreActions'
import type { UseCloudControllerParams } from './types'

type UseCloudControllerHandlersParams = Pick<
  UseCloudControllerParams,
  | 't'
  | 'cloudBackupPayloadContent'
  | 'parseImportedPayload'
  | 'applyParsedImportedData'
  | 'wouldCloudBackupMergeChangeLocal'
  | 'cloudRestoreSuccessMessageByKind'
  | 'hasLocalBackupData'
> & {
  store: AppStore
  selectedCloudProvider: ActiveCloudProvider | null
  selectedCloudConfigured: boolean
}

export const useCloudControllerHandlers = ({
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
}: UseCloudControllerHandlersParams) => {
  const {
    cloudAuthState,
    cloudLastAutoSyncPayloadRef,
    setCloudProvider,
    setCloudAutoBackupEnabled,
    setPendingCloudRestore,
    setPendingCloudMergeSyncAuthState,
    setCloudAuthState,
    setCloudLastSyncAt,
    setDataAccordionValue,
    setShouldRevealCloudPanel,
    setIsCloudAuthLoading,
    isCloudAuthLoading,
    setIsCloudSyncLoading,
    isCloudSyncLoading,
    setCloudSyncMessage,
    setCloudSyncError,
    setCloudDiagnostics,
    setIsCloudDiagnosticsLoading,
    setCloudDiagnosticsError,
  } = store

  const {
    tryRestoreCloudBackupAfterConnect,
    applyPendingCloudRestore,
    handleCancelPendingCloudRestore,
    pendingCloudRestore,
  } = useCloudRestoreActions({
    store,
    t,
    parseImportedPayload,
    applyParsedImportedData,
    wouldCloudBackupMergeChangeLocal,
    cloudRestoreSuccessMessageByKind,
    hasLocalBackupData,
  })

  const loadCloudDiagnostics = useCloudDiagnostics({
    t,
    setCloudDiagnostics,
    setIsCloudDiagnosticsLoading,
    setCloudDiagnosticsError,
  })

  const handleCloudProviderChange = useCallback(
    (value: string) => {
      updateCloudProviderPreference(value, setCloudProvider, {
        setCloudSyncMessage,
        setCloudSyncError,
      })
    },
    [setCloudProvider, setCloudSyncError, setCloudSyncMessage],
  )

  const handleCloudAutoBackupEnabledChange = useCallback(
    (value: boolean) => {
      updateCloudAutoBackupPreference(value, setCloudAutoBackupEnabled, {
        setCloudSyncMessage,
        setCloudSyncError,
      })
    },
    [setCloudAutoBackupEnabled, setCloudSyncError, setCloudSyncMessage],
  )

  const handleCloudConnect = useCallback(async () => {
    const provider = ensureCloudProviderReady({
      selectedCloudProvider,
      selectedCloudConfigured,
      t,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
    if (!provider) {
      return
    }

    await connectCloudProvider({
      provider,
      cloudDataRouteHash,
      t,
      setIsCloudAuthLoading,
      setPendingCloudRestore: () => setPendingCloudRestore(null),
      setPendingCloudMergeSyncAuthState: () => setPendingCloudMergeSyncAuthState(null),
      setDataAccordionValue,
      setShouldRevealCloudPanel,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
  }, [
    selectedCloudProvider,
    selectedCloudConfigured,
    t,
    setCloudSyncMessage,
    setCloudSyncError,
    setIsCloudAuthLoading,
    setPendingCloudRestore,
    setPendingCloudMergeSyncAuthState,
    setDataAccordionValue,
    setShouldRevealCloudPanel,
  ])

  const handleCloudDisconnect = useCallback(async () => {
    await disconnectCloudProvider({
      t,
      setIsCloudAuthLoading,
      setPendingCloudRestore: () => setPendingCloudRestore(null),
      setPendingCloudMergeSyncAuthState: () => setPendingCloudMergeSyncAuthState(null),
      setCloudAuthState,
      setCloudLastSyncAt,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
  }, [
    t,
    setIsCloudAuthLoading,
    setPendingCloudRestore,
    setPendingCloudMergeSyncAuthState,
    setCloudAuthState,
    setCloudLastSyncAt,
    setCloudSyncMessage,
    setCloudSyncError,
  ])

  const handleCloudUploadBackup = useCallback(async () => {
    const provider = ensureCloudProviderReady({
      selectedCloudProvider,
      selectedCloudConfigured,
      t,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
    if (!provider) {
      return
    }

    const authState = ensureCloudUploadSession({
      selectedCloudProvider: provider,
      cloudAuthState,
      t,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
    if (!authState) {
      return
    }

    await uploadCloudBackup({
      authState,
      cloudBackupFileName,
      cloudBackupPayloadContent,
      cloudLastAutoSyncPayloadRef,
      t,
      setCloudAuthState,
      setCloudLastSyncAt,
      setIsCloudSyncLoading,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
  }, [
    selectedCloudProvider,
    selectedCloudConfigured,
    t,
    setCloudSyncMessage,
    setCloudSyncError,
    cloudAuthState,
    cloudBackupPayloadContent,
    cloudLastAutoSyncPayloadRef,
    setCloudAuthState,
    setCloudLastSyncAt,
    setIsCloudSyncLoading,
  ])

  return {
    loadCloudDiagnostics,
    tryRestoreCloudBackupAfterConnect,
    handleCloudProviderChange,
    handleCloudAutoBackupEnabledChange,
    handleCloudConnect,
    handleCloudDisconnect,
    handleCloudUploadBackup,
    applyPendingCloudRestore,
    handleCancelPendingCloudRestore,
    isCloudAuthLoading,
    isCloudSyncLoading,
    pendingCloudRestore,
  }
}
