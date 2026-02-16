import type { CloudProvider } from '../data/dataPortability'
import { apiPaths } from '../routing/apiPaths'
import { parseApiError } from './cloudSync.helpers'
import {
  mapCloudDiagnostics,
  mapCloudOAuthCallback,
  mapCloudProviderAvailability,
  mapCloudRestore,
  mapCloudSession,
  mapCloudUpload,
} from './cloudSync.mappers'

export type ActiveCloudProvider = Exclude<CloudProvider, 'none'>

export class CloudBackupNotFoundError extends Error {
  constructor() {
    super('Cloud backup not found')
    this.name = 'CloudBackupNotFoundError'
  }
}

const cloudProviderValues: ActiveCloudProvider[] = ['onedrive', 'google-drive']

export type CloudAuthState = {
  provider: ActiveCloudProvider
  accountEmail: string | null
  accountName: string | null
  connectedAt: string
  expiresAt: string
}

export type CloudProviderAvailability = Record<ActiveCloudProvider, boolean>

export type CloudCacheDiagnostics = {
  distributedCacheType: string
  healthy: boolean
  message: string | null
  fallback: string | null
}

export type CloudDiagnostics = {
  providers: CloudProviderAvailability
  session: {
    connected: boolean
    authState: CloudAuthState | null
  }
  cache: CloudCacheDiagnostics
  serverTimeUtc: string | null
}

export type CloudOAuthCallbackResult =
  | {
      status: 'none'
    }
  | {
      status: 'error'
      message: string
    }
  | {
      status: 'success'
      authState: CloudAuthState
      returnHash: string
    }

type CloudProvidersResponse = {
  providers?: {
    onedrive?: boolean
    googleDrive?: boolean
  }
}

type CloudSessionResponse = {
  connected?: boolean
  authState?: unknown
}

type CloudOAuthStartResponse = {
  authorizationUrl?: string
}

type CloudOAuthCallbackResponse = {
  authState?: unknown
  returnHash?: string
}

type CloudUploadResponse = {
  authState?: unknown
  modifiedAt?: string
}

type CloudRestoreResponse = {
  authState?: unknown
  content?: string
  modifiedAt?: string | null
}

type CloudStatusResponse = {
  providers?: {
    onedrive?: boolean
    googleDrive?: boolean
  }
  session?: {
    connected?: boolean
    authState?: unknown
  }
  cache?: {
    distributedCacheType?: string
    healthy?: boolean
    message?: string
    fallback?: string
  }
  serverTimeUtc?: string
}

const defaultProviderAvailability: CloudProviderAvailability = {
  onedrive: false,
  'google-drive': false,
}

export const clearOAuthCallbackQueryParams = () => {
  if (typeof window === 'undefined') {
    return
  }

  const { origin, pathname, hash } = window.location
  window.history.replaceState({}, document.title, `${origin}${pathname}${hash}`)
}

export const fetchCloudProviderAvailability = async (): Promise<CloudProviderAvailability> => {
  const response = await fetch(apiPaths.cloudProviders)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudProvidersResponse
  return mapCloudProviderAvailability(payload.providers)
}

export const loadCloudSession = async (): Promise<CloudAuthState | null> => {
  const response = await fetch(apiPaths.cloudSession)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudSessionResponse
  return mapCloudSession(payload)
}

export const fetchCloudDiagnostics = async (): Promise<CloudDiagnostics> => {
  const response = await fetch(apiPaths.cloudStatus)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudStatusResponse
  return mapCloudDiagnostics(payload)
}

export const isCloudProviderConfigured = (
  provider: ActiveCloudProvider,
  availability: CloudProviderAvailability,
) => availability[provider] ?? false

export const startCloudOAuth = async (
  provider: ActiveCloudProvider,
  options?: { redirectUri?: string; returnHash?: string },
) => {
  const params = new URLSearchParams({
    provider,
    redirectUri:
      options?.redirectUri ?? `${window.location.origin}${window.location.pathname}`,
    returnHash: options?.returnHash ?? window.location.hash,
  })

  const response = await fetch(`${apiPaths.cloudOAuthStart}?${params.toString()}`)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudOAuthStartResponse
  if (typeof payload.authorizationUrl !== 'string' || !payload.authorizationUrl.trim()) {
    throw new Error('Cloud authorization URL is missing')
  }

  return payload.authorizationUrl
}

export const completeCloudOAuthCallback = async (): Promise<CloudOAuthCallbackResult> => {
  if (typeof window === 'undefined') {
    return { status: 'none' }
  }

  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  if (!code && !error) {
    return { status: 'none' }
  }

  const response = await fetch(apiPaths.cloudOAuthCallback, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      state,
      error,
      errorDescription,
    }),
  })

  if (!response.ok) {
    return {
      status: 'error',
      message: await parseApiError(response),
    }
  }

  const payload = (await response.json()) as CloudOAuthCallbackResponse
  const mapped = mapCloudOAuthCallback(payload)
  if (!mapped.authState) {
    return {
      status: 'error',
      message: 'Cloud auth state is invalid',
    }
  }

  return {
    status: 'success',
    authState: mapped.authState,
    returnHash: mapped.returnHash,
  }
}

export const disconnectCloudSession = async () => {
  const response = await fetch(apiPaths.cloudDisconnect, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
}

export const syncBackupToCloud = async (params: {
  authState: CloudAuthState
  fileName: string
  content: string
}) => {
  const response = await fetch(apiPaths.cloudBackupUpload, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: params.fileName,
      content: params.content,
    }),
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudUploadResponse
  return mapCloudUpload(payload)
}

export const restoreBackupFromCloud = async (params: {
  authState: CloudAuthState
  fileName: string
}) => {
  const search = new URLSearchParams({ fileName: params.fileName }).toString()
  const response = await fetch(`${apiPaths.cloudBackupRestore}?${search}`)
  if (response.status === 404) {
    throw new CloudBackupNotFoundError()
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudRestoreResponse
  return mapCloudRestore(payload)
}

export const defaultCloudProviderAvailabilityState = defaultProviderAvailability

export const listCloudProviders = (): ActiveCloudProvider[] => [...cloudProviderValues]
