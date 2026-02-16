import {
  decryptBikeVoyagerPayload,
  encryptBikeVoyagerPayload,
  isEncryptedBikeVoyagerPayload,
} from '../features/app/dataEncryption'

describe('dataEncryption', () => {
  it('chiffre et dechiffre une sauvegarde', async () => {
    const payload = {
      format: 'bikevoyager-backup',
      version: 1,
      value: 'hello',
      nested: { count: 2 },
    }

    const encrypted = await encryptBikeVoyagerPayload(
      payload,
      'motdepasse-solide',
      'bikevoyager-backup',
    )

    expect(isEncryptedBikeVoyagerPayload(encrypted)).toBe(true)
    expect(encrypted.wrappedFormat).toBe('bikevoyager-backup')

    const decrypted = await decryptBikeVoyagerPayload(
      encrypted,
      'motdepasse-solide',
    )

    expect(decrypted).toEqual(payload)
  })

  it('echoue avec un mot de passe invalide', async () => {
    const encrypted = await encryptBikeVoyagerPayload(
      { format: 'bikevoyager-trip', version: 1 },
      'motdepasse-solide',
      'bikevoyager-trip',
    )

    await expect(
      decryptBikeVoyagerPayload(encrypted, 'mauvais-motdepasse'),
    ).rejects.toThrow()
  })
})

