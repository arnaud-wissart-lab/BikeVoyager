import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startCloudOAuth } from '../features/cloud/api'
import {
  connectCloudProvider,
  createCloudPkceCodeChallenge,
  parseCloudOAuthCallbackParams,
} from '../features/cloud/controller/oauthFlow'

vi.mock('../features/cloud/api', () => ({
  startCloudOAuth: vi.fn(),
  disconnectCloudSession: vi.fn(),
  completeCloudOAuthCallback: vi.fn(),
  clearOAuthCallbackQueryParams: vi.fn(),
}))

const mockedStartCloudOAuth = vi.mocked(startCloudOAuth)

describe('oauthFlow', () => {
  beforeEach(() => {
    mockedStartCloudOAuth.mockReset()
  })

  it('parse les parametres de callback OAuth avec code et state', () => {
    const parsed = parseCloudOAuthCallbackParams(
      'https://example.org/callback?code=abc123&state=state-42',
    )

    expect(parsed).toEqual({
      code: 'abc123',
      state: 'state-42',
      error: null,
      errorDescription: null,
    })
  })

  it('genere le challenge PKCE RFC7636', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

    const challenge = await createCloudPkceCodeChallenge(verifier)

    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('propage une erreur traduite quand le demarrage OAuth echoue', async () => {
    mockedStartCloudOAuth.mockRejectedValue(new Error('Service indisponible'))

    const setIsCloudAuthLoading = vi.fn()
    const setPendingCloudRestore = vi.fn()
    const setPendingCloudMergeSyncAuthState = vi.fn()
    const setDataAccordionValue = vi.fn()
    const setShouldRevealCloudPanel = vi.fn()
    const setCloudSyncMessage = vi.fn()
    const setCloudSyncError = vi.fn()

    const t = ((key: string, options?: { message?: string }) => {
      if (key === 'cloudConnectError') {
        return `Connexion cloud impossible: ${options?.message ?? ''}`
      }

      if (key === 'dataImportInvalid') {
        return 'Import invalide'
      }

      return key
    }) as never

    await connectCloudProvider({
      provider: 'google-drive',
      cloudDataRouteHash: '#/donnees',
      t,
      setIsCloudAuthLoading,
      setPendingCloudRestore,
      setPendingCloudMergeSyncAuthState,
      setDataAccordionValue,
      setShouldRevealCloudPanel,
      setters: {
        setCloudSyncMessage,
        setCloudSyncError,
      },
    })

    expect(setIsCloudAuthLoading).toHaveBeenNthCalledWith(1, true)
    expect(setIsCloudAuthLoading).toHaveBeenNthCalledWith(2, false)
    expect(setCloudSyncError).toHaveBeenCalledWith(
      'Connexion cloud impossible: Service indisponible',
    )
    expect(setCloudSyncMessage).toHaveBeenCalledWith(null)
  })
})
