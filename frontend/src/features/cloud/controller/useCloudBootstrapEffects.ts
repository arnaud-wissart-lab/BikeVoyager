import { useEffect } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../../state/appStore'
import type { RouteKey } from '../../routing/domain'
import { fetchCloudProviderAvailability, isCloudProviderConfigured, loadCloudSession } from '../api'
import type { CloudAuthState } from '../cloudSync'
import { processCloudOAuthCallback } from './oauthFlow'
import { cloudDataRouteHash } from './providers'

type UseCloudBootstrapEffectsParams = {
  store: AppStore
  route: RouteKey
  t: TFunction
  loadCloudDiagnostics: (options?: { quiet?: boolean }) => Promise<void>
  tryRestoreCloudBackupAfterConnect: (authState: CloudAuthState) => Promise<void>
}

export const useCloudBootstrapEffects = ({
  store,
  route,
  t,
  loadCloudDiagnostics,
  tryRestoreCloudBackupAfterConnect,
}: UseCloudBootstrapEffectsParams) => {
  const {
    cloudAuthState,
    cloudProviderAvailability,
    cloudProvider,
    dataAccordionValue,
    shouldRevealCloudPanel,
    cloudOAuthCallbackHandledRef,
    cloudLastAutoSyncPayloadRef,
    setCloudAuthState,
    setCloudProviderAvailability,
    setCloudProvider,
    setDataAccordionValue,
    setShouldRevealCloudPanel,
    setCloudSyncMessage,
    setCloudSyncError,
    cloudDiagnostics,
    isCloudDiagnosticsLoading,
  } = store

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
        const hasOAuthQuery = pageUrl.searchParams.has('code') || pageUrl.searchParams.has('error')
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
        if (preferredProvider === 'none' || availability[preferredProvider] !== true) {
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
    if (cloudProvider === 'none') {
      return
    }

    if (!isCloudProviderConfigured(cloudProvider, cloudProviderAvailability)) {
      setCloudProvider('none')
    }
  }, [cloudProvider, cloudProviderAvailability, setCloudProvider])
}
