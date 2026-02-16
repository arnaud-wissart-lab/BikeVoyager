import { useCallback } from 'react'
import type { AppStore } from '../../../state/appStore'
import type { ImportedApplyMode } from '../types'
import {
  applyCloudPendingRestore,
  cancelCloudPendingRestore,
  restoreCloudBackupAfterConnect,
} from './backup'
import { cloudBackupFileName } from './providers'
import type { UseCloudControllerParams } from './types'

type UseCloudRestoreActionsParams = Pick<
  UseCloudControllerParams,
  | 't'
  | 'parseImportedPayload'
  | 'applyParsedImportedData'
  | 'wouldCloudBackupMergeChangeLocal'
  | 'cloudRestoreSuccessMessageByKind'
  | 'hasLocalBackupData'
> & {
  store: AppStore
}

export const useCloudRestoreActions = ({
  store,
  t,
  parseImportedPayload,
  applyParsedImportedData,
  wouldCloudBackupMergeChangeLocal,
  cloudRestoreSuccessMessageByKind,
  hasLocalBackupData,
}: UseCloudRestoreActionsParams) => {
  const {
    pendingCloudRestore,
    cloudLastAutoSyncPayloadRef,
    setCloudAuthState,
    setCloudProvider,
    setPendingCloudRestore,
    setPendingCloudMergeSyncAuthState,
    setIsCloudSyncLoading,
    setCloudSyncMessage,
    setCloudSyncError,
    setCloudLastSyncAt,
  } = store

  const tryRestoreCloudBackupAfterConnect = useCallback(
    async (authState: Parameters<typeof restoreCloudBackupAfterConnect>[0]['authState']) => {
      await restoreCloudBackupAfterConnect({
        authState,
        cloudBackupFileName,
        hasLocalBackupData,
        parseImportedPayload,
        applyParsedImportedData,
        wouldCloudBackupMergeChangeLocal,
        cloudRestoreSuccessMessageByKind,
        cloudLastAutoSyncPayloadRef,
        t,
        setCloudAuthState,
        setCloudProvider,
        setCloudLastSyncAt,
        setPendingCloudRestore,
        setIsCloudSyncLoading,
        setters: {
          setCloudSyncMessage,
          setCloudSyncError,
        },
      })
    },
    [
      applyParsedImportedData,
      cloudLastAutoSyncPayloadRef,
      cloudRestoreSuccessMessageByKind,
      hasLocalBackupData,
      parseImportedPayload,
      setCloudAuthState,
      setCloudLastSyncAt,
      setCloudProvider,
      setCloudSyncError,
      setCloudSyncMessage,
      setIsCloudSyncLoading,
      setPendingCloudRestore,
      t,
      wouldCloudBackupMergeChangeLocal,
    ],
  )

  const applyPendingCloudRestore = useCallback(
    (modeToApply: ImportedApplyMode) => {
      applyCloudPendingRestore({
        pendingCloudRestore,
        modeToApply,
        applyParsedImportedData,
        cloudRestoreSuccessMessageByKind,
        cloudLastAutoSyncPayloadRef,
        t,
        setCloudAuthState,
        setCloudProvider,
        setCloudLastSyncAt,
        setPendingCloudMergeSyncAuthState,
        setPendingCloudRestore,
        setters: {
          setCloudSyncMessage,
          setCloudSyncError,
        },
      })
    },
    [
      pendingCloudRestore,
      applyParsedImportedData,
      cloudRestoreSuccessMessageByKind,
      cloudLastAutoSyncPayloadRef,
      t,
      setCloudAuthState,
      setCloudProvider,
      setCloudLastSyncAt,
      setPendingCloudMergeSyncAuthState,
      setPendingCloudRestore,
      setCloudSyncMessage,
      setCloudSyncError,
    ],
  )

  const handleCancelPendingCloudRestore = useCallback(() => {
    cancelCloudPendingRestore({
      t,
      setPendingCloudRestore,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
  }, [t, setPendingCloudRestore, setCloudSyncMessage, setCloudSyncError])

  return {
    tryRestoreCloudBackupAfterConnect,
    applyPendingCloudRestore,
    handleCancelPendingCloudRestore,
    pendingCloudRestore,
  }
}
