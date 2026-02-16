import type { TFunction } from 'i18next'
import { isEncryptedBikeVoyagerPayload } from '../dataEncryption'

export const assertPayloadIsImportable = (payload: unknown, t: TFunction) => {
  if (isEncryptedBikeVoyagerPayload(payload)) {
    throw new Error(t('dataImportEncryptedUnsupported'))
  }
}
