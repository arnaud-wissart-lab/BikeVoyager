import type { ActiveCloudProvider, CloudAuthState } from './cloudSync'

export const isActiveCloudProvider = (
  value: unknown,
): value is ActiveCloudProvider => value === 'onedrive' || value === 'google-drive'

const toRequiredString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const toOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

export const normalizeCloudAuthState = (value: unknown): CloudAuthState | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<CloudAuthState>
  if (!isActiveCloudProvider(candidate.provider)) {
    return null
  }

  const connectedAt = toRequiredString(candidate.connectedAt)
  const expiresAt = toRequiredString(candidate.expiresAt)
  if (!connectedAt || !expiresAt) {
    return null
  }

  return {
    provider: candidate.provider,
    accountEmail: toOptionalString(candidate.accountEmail),
    accountName: toOptionalString(candidate.accountName),
    connectedAt,
    expiresAt,
  }
}
