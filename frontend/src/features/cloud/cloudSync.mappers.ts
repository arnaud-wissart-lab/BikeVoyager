import type { CloudAuthState, CloudDiagnostics, CloudProviderAvailability } from './cloudSync'
import { normalizeCloudAuthState } from './cloudSync.validators'

type ProvidersPayload =
  | {
      onedrive?: boolean
      googleDrive?: boolean
    }
  | undefined

export const mapCloudProviderAvailability = (
  providers: ProvidersPayload,
): CloudProviderAvailability => ({
  onedrive: providers?.onedrive === true,
  'google-drive': providers?.googleDrive === true,
})

type SessionPayload = {
  connected?: boolean
  authState?: unknown
}

export const mapCloudSession = (payload: SessionPayload): CloudAuthState | null =>
  payload.connected ? normalizeCloudAuthState(payload.authState) : null

type DiagnosticsPayload = {
  providers?: ProvidersPayload
  session?: SessionPayload
  cache?: {
    distributedCacheType?: string
    healthy?: boolean
    message?: string
    fallback?: string
  }
  serverTimeUtc?: string
}

const toOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

export const mapCloudDiagnostics = (payload: DiagnosticsPayload): CloudDiagnostics => {
  const cache = payload.cache
  const distributedCacheType =
    typeof cache?.distributedCacheType === 'string' && cache.distributedCacheType.trim()
      ? cache.distributedCacheType
      : 'unknown'

  return {
    providers: mapCloudProviderAvailability(payload.providers),
    session: {
      connected: payload.session?.connected === true,
      authState: normalizeCloudAuthState(payload.session?.authState),
    },
    cache: {
      distributedCacheType,
      healthy: cache?.healthy === true,
      message: toOptionalString(cache?.message),
      fallback: toOptionalString(cache?.fallback),
    },
    serverTimeUtc: toOptionalString(payload.serverTimeUtc),
  }
}

type OAuthCallbackPayload = {
  authState?: unknown
  returnHash?: string
}

export const mapCloudOAuthCallback = (payload: OAuthCallbackPayload) => ({
  authState: normalizeCloudAuthState(payload.authState),
  returnHash: typeof payload.returnHash === 'string' ? payload.returnHash : '',
})

type CloudUploadPayload = {
  authState?: unknown
  modifiedAt?: string
}

export const mapCloudUpload = (payload: CloudUploadPayload) => {
  const authState = normalizeCloudAuthState(payload.authState)
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

type CloudRestorePayload = {
  authState?: unknown
  content?: string
  modifiedAt?: string | null
}

export const mapCloudRestore = (payload: CloudRestorePayload) => {
  const authState = normalizeCloudAuthState(payload.authState)
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
