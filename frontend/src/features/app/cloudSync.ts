import type { CloudProvider } from './dataPortability'
import { apiPaths } from './apiPaths'

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

const isActiveProvider = (value: unknown): value is ActiveCloudProvider =>
  value === 'onedrive' || value === 'google-drive'

const parseApiError = async (response: Response) => {
  const fallback = `${response.status} ${response.statusText}`.trim()
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        message?: string
        error?: string | { message?: string }
        error_description?: string
      }

      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim()
      }

      if (
        payload.error &&
        typeof payload.error === 'object' &&
        typeof payload.error.message === 'string' &&
        payload.error.message.trim()
      ) {
        return payload.error.message.trim()
      }

      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim()
      }

      if (typeof payload.error_description === 'string' && payload.error_description.trim()) {
        return payload.error_description.trim()
      }
    }

    const text = (await response.text()).trim()
    if (text) {
      return text.slice(0, 240)
    }
  } catch {
    return fallback
  }

  return fallback
}

const normalizeAuthState = (value: unknown): CloudAuthState | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<CloudAuthState>
  if (!isActiveProvider(candidate.provider)) {
    return null
  }

  const connectedAt =
    typeof candidate.connectedAt === 'string' && candidate.connectedAt.trim().length > 0
      ? candidate.connectedAt
      : null
  const expiresAt =
    typeof candidate.expiresAt === 'string' && candidate.expiresAt.trim().length > 0
      ? candidate.expiresAt
      : null

  if (!connectedAt || !expiresAt) {
    return null
  }

  return {
    provider: candidate.provider,
    accountEmail:
      typeof candidate.accountEmail === 'string' && candidate.accountEmail.trim().length > 0
        ? candidate.accountEmail
        : null,
    accountName:
      typeof candidate.accountName === 'string' && candidate.accountName.trim().length > 0
        ? candidate.accountName
        : null,
    connectedAt,
    expiresAt,
  }
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
  return {
    onedrive: payload.providers?.onedrive === true,
    'google-drive': payload.providers?.googleDrive === true,
  }
}

export const loadCloudSession = async (): Promise<CloudAuthState | null> => {
  const response = await fetch(apiPaths.cloudSession)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudSessionResponse
  if (!payload.connected) {
    return null
  }

  return normalizeAuthState(payload.authState)
}

export const fetchCloudDiagnostics = async (): Promise<CloudDiagnostics> => {
  const response = await fetch(apiPaths.cloudStatus)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const payload = (await response.json()) as CloudStatusResponse
  const authState = normalizeAuthState(payload.session?.authState)

  const cache = payload.cache
  const distributedCacheType =
    typeof cache?.distributedCacheType === 'string' && cache.distributedCacheType.trim()
      ? cache.distributedCacheType
      : 'unknown'

  return {
    providers: {
      onedrive: payload.providers?.onedrive === true,
      'google-drive': payload.providers?.googleDrive === true,
    },
    session: {
      connected: payload.session?.connected === true,
      authState,
    },
    cache: {
      distributedCacheType,
      healthy: cache?.healthy === true,
      message:
        typeof cache?.message === 'string' && cache.message.trim().length > 0
          ? cache.message
          : null,
      fallback:
        typeof cache?.fallback === 'string' && cache.fallback.trim().length > 0
          ? cache.fallback
          : null,
    },
    serverTimeUtc:
      typeof payload.serverTimeUtc === 'string' && payload.serverTimeUtc.trim()
        ? payload.serverTimeUtc
        : null,
  }
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
  const authState = normalizeAuthState(payload.authState)
  if (!authState) {
    return {
      status: 'error',
      message: 'Cloud auth state is invalid',
    }
  }

  return {
    status: 'success',
    authState,
    returnHash: typeof payload.returnHash === 'string' ? payload.returnHash : '',
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
  const authState = normalizeAuthState(payload.authState)
  if (!authState) {
    throw new Error('Cloud session missing after upload')
  }

  return {
    authState,
    modifiedAt:
      typeof payload.modifiedAt === 'string' && payload.modifiedAt.trim()
        ? payload.modifiedAt
        : new Date().toISOString(),
  }
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
  const authState = normalizeAuthState(payload.authState)
  if (!authState) {
    throw new Error('Cloud session missing after restore')
  }

  if (typeof payload.content !== 'string') {
    throw new Error('Cloud restore payload is invalid')
  }

  return {
    authState,
    content: payload.content,
    modifiedAt:
      typeof payload.modifiedAt === 'string' && payload.modifiedAt.trim()
        ? payload.modifiedAt
        : null,
  }
}

export const defaultCloudProviderAvailabilityState = defaultProviderAvailability

export const listCloudProviders = (): ActiveCloudProvider[] => [...cloudProviderValues]
