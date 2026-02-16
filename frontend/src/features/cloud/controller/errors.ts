import type { TFunction } from 'i18next'

export const resolveCloudErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback

export const translateCloudError = (params: {
  t: TFunction
  key: string
  error: unknown
  fallbackKey?: string
}) =>
  params.t(params.key, {
    message: resolveCloudErrorMessage(
      params.error,
      params.t(params.fallbackKey ?? 'dataImportInvalid'),
    ),
  })
