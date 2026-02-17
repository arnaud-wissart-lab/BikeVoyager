const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const defaultPbkdf2Iterations = 250000

const toBase64 = (value: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < value.length; index += chunkSize) {
    const chunk = value.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

const generateRandomBytes = (length: number) => {
  const value = new Uint8Array(length)
  crypto.getRandomValues(value)
  return value
}

const deriveAesKey = async (
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) => {
  const imported = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt,
    },
    imported,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export type EncryptedBikeVoyagerPayload = {
  format: 'bikevoyager-encrypted'
  version: 1
  exportedAt: string
  wrappedFormat: string
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt_b64: string
  }
  cipher: {
    name: 'AES-GCM'
    iv_b64: string
    payload_b64: string
  }
}

export const isEncryptedBikeVoyagerPayload = (
  value: unknown,
): value is EncryptedBikeVoyagerPayload => {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (value as Record<string, unknown>).format === 'bikevoyager-encrypted'
}

export const encryptBikeVoyagerPayload = async (
  payload: unknown,
  password: string,
  wrappedFormat: string,
): Promise<EncryptedBikeVoyagerPayload> => {
  const trimmedPassword = password.trim()
  if (trimmedPassword.length < 8) {
    throw new Error('Password too short')
  }

  const salt = generateRandomBytes(16)
  const iv = generateRandomBytes(12)
  const key = await deriveAesKey(trimmedPassword, salt, defaultPbkdf2Iterations)
  const plaintext = textEncoder.encode(JSON.stringify(payload))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    format: 'bikevoyager-encrypted',
    version: 1,
    exportedAt: new Date().toISOString(),
    wrappedFormat,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: defaultPbkdf2Iterations,
      salt_b64: toBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv_b64: toBase64(iv),
      payload_b64: toBase64(new Uint8Array(encrypted)),
    },
  }
}

export const decryptBikeVoyagerPayload = async (
  payload: EncryptedBikeVoyagerPayload,
  password: string,
): Promise<unknown> => {
  if (payload.format !== 'bikevoyager-encrypted' || payload.version !== 1) {
    throw new Error('Unsupported encrypted payload format')
  }

  const trimmedPassword = password.trim()
  if (!trimmedPassword) {
    throw new Error('Password required')
  }

  const salt = fromBase64(payload.kdf.salt_b64)
  const iv = fromBase64(payload.cipher.iv_b64)
  const encrypted = fromBase64(payload.cipher.payload_b64)
  const key = await deriveAesKey(trimmedPassword, salt, payload.kdf.iterations)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)

  return JSON.parse(textDecoder.decode(decrypted)) as unknown
}
