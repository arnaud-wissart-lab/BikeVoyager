import { useEffect } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../../state/appStore'
import type { ActiveCloudProvider } from '../cloudSync'
import {
  syncCloudAutoBackup,
  syncCloudBackupAfterMerge,
} from './backup'
import { cloudBackupFileName } from './providers'

type UseCloudSyncEffectsParams = {
  store: AppStore
  t: TFunction
  cloudBackupPayloadContent: string
  selectedCloudProvider: ActiveCloudProvider | null
  selectedCloudConfigured: boolean
}

export const useCloudSyncEffects = ({
  store,
  t,
  cloudBackupPayloadContent,
  selectedCloudProvider,
  selectedCloudConfigured,
}: UseCloudSyncEffectsParams) => {
  const {
    cloudAuthState,
    cloudAutoBackupEnabled,
    pendingCloudMergeSyncAuthState,
    cloudAutoSyncTimerRef,
    cloudLastAutoSyncPayloadRef,
    setCloudAuthState,
    setCloudProvider,
    setCloudLastSyncAt,
    setPendingCloudMergeSyncAuthState,
    setIsCloudSyncLoading,
    setCloudSyncMessage,
    setCloudSyncError,
  } = store

  useEffect(() => {
    if (!pendingCloudMergeSyncAuthState) {
      return
    }

    const authStateToUse = pendingCloudMergeSyncAuthState
    void syncCloudBackupAfterMerge({
      authState: authStateToUse,
      cloudBackupFileName,
      cloudBackupPayloadContent,
      cloudLastAutoSyncPayloadRef,
      t,
      setCloudAuthState,
      setCloudProvider,
      setCloudLastSyncAt,
      setPendingCloudMergeSyncAuthState,
      setIsCloudSyncLoading,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
  }, [
    cloudBackupPayloadContent,
    pendingCloudMergeSyncAuthState,
    setCloudAuthState,
    setCloudLastSyncAt,
    setCloudProvider,
    setCloudSyncError,
    setCloudSyncMessage,
    setIsCloudSyncLoading,
    setPendingCloudMergeSyncAuthState,
    t,
    cloudLastAutoSyncPayloadRef,
  ])

  useEffect(() => {
    if (!cloudAutoBackupEnabled) {
      if (cloudAutoSyncTimerRef.current !== null) {
        window.clearTimeout(cloudAutoSyncTimerRef.current)
        cloudAutoSyncTimerRef.current = null
      }
      return
    }

    if (pendingCloudMergeSyncAuthState) {
      return
    }

    if (!selectedCloudProvider || !selectedCloudConfigured) {
      return
    }

    if (!cloudAuthState || cloudAuthState.provider !== selectedCloudProvider) {
      return
    }

    if (cloudBackupPayloadContent === cloudLastAutoSyncPayloadRef.current) {
      return
    }

    if (cloudAutoSyncTimerRef.current !== null) {
      window.clearTimeout(cloudAutoSyncTimerRef.current)
    }

    cloudAutoSyncTimerRef.current = window.setTimeout(() => {
      void syncCloudAutoBackup({
        authState: cloudAuthState,
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
    }, 1200)

    return () => {
      if (cloudAutoSyncTimerRef.current !== null) {
        window.clearTimeout(cloudAutoSyncTimerRef.current)
        cloudAutoSyncTimerRef.current = null
      }
    }
  }, [
    cloudAuthState,
    cloudAutoBackupEnabled,
    cloudBackupPayloadContent,
    pendingCloudMergeSyncAuthState,
    selectedCloudConfigured,
    selectedCloudProvider,
    setCloudAuthState,
    setCloudLastSyncAt,
    setCloudSyncError,
    setCloudSyncMessage,
    setIsCloudSyncLoading,
    t,
    cloudLastAutoSyncPayloadRef,
    cloudAutoSyncTimerRef,
  ])
}
