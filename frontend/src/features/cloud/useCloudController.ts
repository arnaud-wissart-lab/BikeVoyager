import { useCallback, useEffect } from 'react'
import type { CloudAuthState } from './cloudSync'
import { useCloudFeatureSlice } from './useCloudFeatureSlice'
import {
  fetchCloudDiagnostics,
  fetchCloudProviderAvailability,
  isCloudProviderConfigured,
  loadCloudSession,
} from './api'
import type { ImportedApplyMode } from './types'
import {
  applyCloudPendingRestore,
  cancelCloudPendingRestore,
  restoreCloudBackupAfterConnect,
  syncCloudAutoBackup,
  syncCloudBackupAfterMerge,
  uploadCloudBackup,
} from './controller/backup'
import { resolveCloudErrorMessage } from './controller/errors'
import { connectCloudProvider, disconnectCloudProvider, processCloudOAuthCallback } from './controller/oauthFlow'
import {
  cloudBackupFileName,
  cloudDataRouteHash,
  cloudReconnectToastId,
  ensureCloudProviderReady,
  ensureCloudUploadSession,
  updateCloudAutoBackupPreference,
  updateCloudProviderPreference,
} from './controller/providers'
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
    cloudAutoBackupEnabled,
    pendingCloudRestore,
    pendingCloudMergeSyncAuthState,
    dataAccordionValue,
    shouldRevealCloudPanel,
    cloudOAuthCallbackHandledRef,
    cloudAutoSyncTimerRef,
    cloudLastAutoSyncPayloadRef,
    setCloudAuthState,
    setCloudProviderAvailability,
    setCloudProvider,
    setCloudAutoBackupEnabled,
    setPendingCloudRestore,
    setPendingCloudMergeSyncAuthState,
    setDataAccordionValue,
    setShouldRevealCloudPanel,
    setIsCloudAuthLoading,
    isCloudAuthLoading,
    setIsCloudSyncLoading,
    isCloudSyncLoading,
    setCloudSyncMessage,
    setCloudSyncError,
    setCloudLastSyncAt,
    setCloudDiagnostics,
    setIsCloudDiagnosticsLoading,
    setCloudDiagnosticsError,
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

  const loadCloudDiagnostics = useCallback(
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

  const tryRestoreCloudBackupAfterConnect = useCallback(
    async (authState: CloudAuthState) => {
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

  const handleCloudProviderChange = (value: string) => {
    updateCloudProviderPreference(
      value,
      setCloudProvider,
      {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    )
  }

  const handleCloudAutoBackupEnabledChange = (value: boolean) => {
    updateCloudAutoBackupPreference(
      value,
      setCloudAutoBackupEnabled,
      {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    )
  }

  const handleCloudConnect = async () => {
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
  }

  const handleCloudDisconnect = async () => {
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
  }

  const handleCloudUploadBackup = async () => {
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
  }

  const applyPendingCloudRestore = (modeToApply: ImportedApplyMode) => {
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
  }

  const handleCancelPendingCloudRestore = () => {
    cancelCloudPendingRestore({
      t,
      setPendingCloudRestore,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })
  }

  useEffect(() => {
    let isCancelled = false

    const loadCloudBootstrap = async () => {
      try {
        const availability = await fetchCloudProviderAvailability()
        if (isCancelled) {
          return
        }

        setCloudProviderAvailability(availability)
        const pageUrl = new URL(window.location.href)
        const hasOAuthQuery =
          pageUrl.searchParams.has('code') || pageUrl.searchParams.has('error')
        if (hasOAuthQuery) {
          return
        }

        const session = await loadCloudSession()
        if (isCancelled) {
          return
        }

        setCloudAuthState(session)
        if (session) {
          setCloudProvider(session.provider)
          return
        }

        const preferredProvider = cloudProvider
        if (
          preferredProvider === 'none' ||
          availability[preferredProvider] !== true
        ) {
          return
        }

        setCloudProvider(preferredProvider)
        setDataAccordionValue('backup-cloud')
        setShouldRevealCloudPanel(true)
      } catch {
        if (isCancelled) {
          return
        }
      }
    }

    void loadCloudBootstrap()

    return () => {
      isCancelled = true
    }
  }, [
    cloudProvider,
    setCloudAuthState,
    setCloudProvider,
    setCloudProviderAvailability,
    setDataAccordionValue,
    setShouldRevealCloudPanel,
  ])

  useEffect(() => {
    if (route !== 'aide') {
      return
    }

    if (cloudDiagnostics || isCloudDiagnosticsLoading) {
      return
    }

    void loadCloudDiagnostics()
  }, [cloudDiagnostics, isCloudDiagnosticsLoading, loadCloudDiagnostics, route])

  useEffect(() => {
    if (!shouldRevealCloudPanel) {
      return
    }

    if (route !== 'donnees' || dataAccordionValue !== 'backup-cloud') {
      return
    }

    const timerId = window.setTimeout(() => {
      document
        .getElementById('data-cloud-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setShouldRevealCloudPanel(false)
    }, 120)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [dataAccordionValue, route, setShouldRevealCloudPanel, shouldRevealCloudPanel])

  useEffect(() => {
    if (!cloudAuthState) {
      cloudLastAutoSyncPayloadRef.current = null
      return
    }

    if (cloudProvider === 'none' || cloudAuthState.provider !== cloudProvider) {
      cloudLastAutoSyncPayloadRef.current = null
    }
  }, [cloudAuthState, cloudProvider, cloudLastAutoSyncPayloadRef])

  useEffect(() => {
    if (cloudOAuthCallbackHandledRef.current) {
      return
    }

    cloudOAuthCallbackHandledRef.current = true
    const handleCloudCallback = async () => {
      await processCloudOAuthCallback({
        t,
        cloudDataRouteHash,
        setCloudAuthState,
        setCloudProvider,
        setDataAccordionValue,
        setShouldRevealCloudPanel,
        setters: {
          setCloudSyncMessage,
          setCloudSyncError,
        },
        tryRestoreCloudBackupAfterConnect,
      })
    }

    void handleCloudCallback()
  }, [
    cloudOAuthCallbackHandledRef,
    setCloudAuthState,
    setCloudProvider,
    setCloudSyncError,
    setCloudSyncMessage,
    setDataAccordionValue,
    setShouldRevealCloudPanel,
    t,
    tryRestoreCloudBackupAfterConnect,
  ])

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

  useEffect(() => {
    if (cloudProvider === 'none') {
      return
    }

    if (!isCloudProviderConfigured(cloudProvider, cloudProviderAvailability)) {
      setCloudProvider('none')
    }
  }, [cloudProvider, cloudProviderAvailability, setCloudProvider])

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
