import { useCallback, useEffect } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { useCloudFeatureSlice } from './useCloudFeatureSlice'
import {
  CloudBackupNotFoundError,
  clearOAuthCallbackQueryParams,
  completeCloudOAuthCallback,
  disconnectCloudSession,
  fetchCloudDiagnostics,
  fetchCloudProviderAvailability,
  isCloudProviderConfigured,
  loadCloudSession,
  restoreBackupFromCloud,
  startCloudOAuth,
  syncBackupToCloud,
} from './api'
import type { ImportedApplyMode } from './types'
import type { ParsedImportedData } from '../data/dataPortability'
import type { ImportedDataApplyResult } from '../data/types'
import type { RouteKey } from '../routing/domain'

type UseCloudControllerParams = {
  store: AppStore
  route: RouteKey
  t: TFunction
  isDesktop: boolean
  cloudBackupPayloadContent: string
  parseImportedPayload: (payload: unknown) => ParsedImportedData
  applyParsedImportedData: (
    imported: ParsedImportedData,
    options?: { mode?: ImportedApplyMode },
  ) => ImportedDataApplyResult
  wouldCloudBackupMergeChangeLocal: (
    imported: Extract<ParsedImportedData, { kind: 'backup' }>,
  ) => boolean
  cloudRestoreSuccessMessageByKind: (kind: ParsedImportedData['kind']) => string
  hasLocalBackupData: boolean
}

const cloudDataRouteHash = '#/donnees'
const cloudReconnectToastId = 'cloud-reconnect-required'

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

  const cloudBackupFileName = 'bikevoyager-backup-latest.json'

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
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : t('helpPlatformStatusUnavailable')
          setCloudDiagnosticsError(message)
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
    async (authState: NonNullable<typeof cloudAuthState>) => {
      setIsCloudSyncLoading(true)
      setCloudSyncMessage(null)
      setCloudSyncError(null)

      try {
        const response = await restoreBackupFromCloud({
          authState,
          fileName: cloudBackupFileName,
        })
        setCloudAuthState(response.authState)
        setCloudLastSyncAt(response.modifiedAt)

        let parsedPayload: unknown
        try {
          parsedPayload = JSON.parse(response.content) as unknown
        } catch {
          throw new Error(t('dataImportInvalid'))
        }

        const imported = parseImportedPayload(parsedPayload)
        if (imported.kind === 'backup' && hasLocalBackupData) {
          if (wouldCloudBackupMergeChangeLocal(imported)) {
            setPendingCloudRestore({
              imported,
              authState: response.authState,
              modifiedAt: response.modifiedAt,
            })
            setCloudSyncMessage(t('cloudRestoreDecisionPrompt'))
          } else {
            setCloudSyncError(null)
            setCloudSyncMessage(t('cloudRestoreAlreadyUpToDate'))
          }
          return
        }

        const importedKind = applyParsedImportedData(imported, { mode: 'replace' })
        setCloudProvider(response.authState.provider)
        cloudLastAutoSyncPayloadRef.current = null
        setCloudSyncError(null)
        setCloudSyncMessage(cloudRestoreSuccessMessageByKind(importedKind))
      } catch (error) {
        if (error instanceof CloudBackupNotFoundError) {
          setCloudSyncError(null)
          setCloudSyncMessage(t('cloudRestoreNotFound'))
          return
        }

        setCloudSyncMessage(null)
        setCloudSyncError(
          t('cloudRestoreError', {
            message: error instanceof Error ? error.message : t('dataImportInvalid'),
          }),
        )
      } finally {
        setIsCloudSyncLoading(false)
      }
    },
    [
      applyParsedImportedData,
      cloudBackupFileName,
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
    if (value === 'none' || value === 'onedrive' || value === 'google-drive') {
      setCloudProvider(value)
      setCloudSyncMessage(null)
      setCloudSyncError(null)
    }
  }

  const handleCloudAutoBackupEnabledChange = (value: boolean) => {
    setCloudAutoBackupEnabled(value)
    setCloudSyncMessage(null)
    setCloudSyncError(null)
  }

  const handleCloudConnect = async () => {
    if (!selectedCloudProvider) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudSelectProvider'))
      return
    }

    if (!selectedCloudConfigured) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudProviderMissingClientId'))
      return
    }

    setIsCloudAuthLoading(true)
    setPendingCloudRestore(null)
    setPendingCloudMergeSyncAuthState(null)
    setDataAccordionValue('backup-cloud')
    setShouldRevealCloudPanel(true)
    setCloudSyncMessage(null)
    setCloudSyncError(null)

    try {
      const authUrl = await startCloudOAuth(selectedCloudProvider, {
        returnHash: cloudDataRouteHash,
      })
      window.location.assign(authUrl)
    } catch (error) {
      setIsCloudAuthLoading(false)
      setCloudSyncMessage(null)
      setCloudSyncError(
        t('cloudConnectError', {
          message: error instanceof Error ? error.message : t('dataImportInvalid'),
        }),
      )
    }
  }

  const handleCloudDisconnect = async () => {
    setIsCloudAuthLoading(true)
    setPendingCloudRestore(null)
    setPendingCloudMergeSyncAuthState(null)
    setCloudSyncMessage(null)
    setCloudSyncError(null)

    try {
      await disconnectCloudSession()
      setCloudAuthState(null)
      setCloudLastSyncAt(null)
      setCloudSyncError(null)
      setCloudSyncMessage(t('cloudDisconnectSuccess'))
    } catch (error) {
      setCloudSyncMessage(null)
      setCloudSyncError(
        t('cloudDisconnectError', {
          message: error instanceof Error ? error.message : t('dataImportInvalid'),
        }),
      )
    } finally {
      setIsCloudAuthLoading(false)
    }
  }

  const handleCloudUploadBackup = async () => {
    if (!selectedCloudProvider) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudSelectProvider'))
      return
    }

    if (!selectedCloudConfigured) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudProviderMissingClientId'))
      return
    }

    if (!cloudAuthState || cloudAuthState.provider !== selectedCloudProvider) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudNotConnected'))
      return
    }

    setIsCloudSyncLoading(true)
    setCloudSyncMessage(null)
    setCloudSyncError(null)

    try {
      const response = await syncBackupToCloud({
        authState: cloudAuthState,
        fileName: cloudBackupFileName,
        content: cloudBackupPayloadContent,
      })
      setCloudAuthState(response.authState)
      setCloudLastSyncAt(response.modifiedAt)
      cloudLastAutoSyncPayloadRef.current = cloudBackupPayloadContent
      setCloudSyncError(null)
      setCloudSyncMessage(t('cloudUploadSuccess'))
    } catch (error) {
      setCloudSyncMessage(null)
      setCloudSyncError(
        t('cloudUploadError', {
          message: error instanceof Error ? error.message : t('dataImportInvalid'),
        }),
      )
    } finally {
      setIsCloudSyncLoading(false)
    }
  }

  const applyPendingCloudRestore = (modeToApply: ImportedApplyMode) => {
    if (!pendingCloudRestore) {
      return
    }

    const importedKind = applyParsedImportedData(pendingCloudRestore.imported, {
      mode: modeToApply,
    })
    setCloudAuthState(pendingCloudRestore.authState)
    setCloudProvider(pendingCloudRestore.authState.provider)
    setCloudLastSyncAt(pendingCloudRestore.modifiedAt)
    cloudLastAutoSyncPayloadRef.current = null
    setPendingCloudMergeSyncAuthState(
      modeToApply === 'merge' ? pendingCloudRestore.authState : null,
    )
    setPendingCloudRestore(null)
    setCloudSyncError(null)
    setCloudSyncMessage(
      modeToApply === 'merge'
        ? t('cloudRestoreBackupMerged')
        : cloudRestoreSuccessMessageByKind(importedKind),
    )
  }

  const handleCancelPendingCloudRestore = () => {
    setPendingCloudRestore(null)
    setCloudSyncError(null)
    setCloudSyncMessage(t('cloudRestoreKeepLocal'))
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
      const result = await completeCloudOAuthCallback()
      if (result.status === 'none') {
        return
      }

      clearOAuthCallbackQueryParams()

      if (result.status === 'error') {
        setCloudSyncMessage(null)
        setCloudSyncError(
          t('cloudConnectError', {
            message: result.message,
          }),
        )
        return
      }

      setCloudAuthState(result.authState)
      setCloudProvider(result.authState.provider)
      setCloudSyncError(null)
      setCloudSyncMessage(t('cloudConnectSuccess'))
      setDataAccordionValue('backup-cloud')
      setShouldRevealCloudPanel(true)
      window.location.hash = cloudDataRouteHash
      await tryRestoreCloudBackupAfterConnect(result.authState)
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
    const runMergedBackupSync = async () => {
      setIsCloudSyncLoading(true)
      setCloudSyncError(null)

      try {
        const response = await syncBackupToCloud({
          authState: authStateToUse,
          fileName: cloudBackupFileName,
          content: cloudBackupPayloadContent,
        })
        setCloudAuthState(response.authState)
        setCloudProvider(response.authState.provider)
        setCloudLastSyncAt(response.modifiedAt)
        cloudLastAutoSyncPayloadRef.current = cloudBackupPayloadContent
        setCloudSyncMessage(t('cloudRestoreBackupMergedSynced'))
      } catch (error) {
        setCloudSyncMessage(null)
        setCloudSyncError(
          t('cloudUploadError', {
            message: error instanceof Error ? error.message : t('dataImportInvalid'),
          }),
        )
      } finally {
        setIsCloudSyncLoading(false)
        setPendingCloudMergeSyncAuthState(null)
      }
    }

    void runMergedBackupSync()
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
      const runAutoSync = async () => {
        setIsCloudSyncLoading(true)
        setCloudSyncError(null)

        try {
          const response = await syncBackupToCloud({
            authState: cloudAuthState,
            fileName: cloudBackupFileName,
            content: cloudBackupPayloadContent,
          })
          setCloudAuthState(response.authState)
          setCloudLastSyncAt(response.modifiedAt)
          cloudLastAutoSyncPayloadRef.current = cloudBackupPayloadContent
          setCloudSyncMessage(t('cloudAutoBackupSynced'))
        } catch (error) {
          setCloudSyncMessage(null)
          setCloudSyncError(
            t('cloudUploadError', {
              message: error instanceof Error ? error.message : t('dataImportInvalid'),
            }),
          )
        } finally {
          setIsCloudSyncLoading(false)
        }
      }

      void runAutoSync()
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
