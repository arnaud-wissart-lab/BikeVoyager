import { fetchPoisAroundRoute } from '../features/pois/api'

describe('API POI', () => {
  it('extrait le message d’une réponse Problem Details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://tools.ietf.org/html/rfc9110#section-15.6.5',
            title: 'Gateway Timeout',
            status: 504,
            detail: 'Le service POI a mis trop de temps à répondre.',
            message: 'Le service POI a mis trop de temps à répondre.',
          }),
          {
            status: 504,
            headers: { 'content-type': 'application/problem+json; charset=utf-8' },
          },
        ),
      ),
    )

    const result = await fetchPoisAroundRoute({
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3, 48.8],
          [2.4, 48.9],
        ],
      },
      categories: ['monuments'],
      distance: 500,
      language: 'fr',
      signal: new AbortController().signal,
    })

    expect(result).toEqual({
      ok: false,
      message: 'Le service POI a mis trop de temps à répondre.',
    })
  })
})
