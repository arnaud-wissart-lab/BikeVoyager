import { buildGoogleStreetViewUrl } from '../components/cesium/googleStreetView'

describe('googleStreetView', () => {
  it("construit l'URL Street View sans cap", () => {
    const url = buildGoogleStreetViewUrl(48.8566, 2.3522)
    const parsedUrl = new URL(url)

    expect(parsedUrl.origin).toBe('https://www.google.com')
    expect(parsedUrl.pathname).toBe('/maps/@')
    expect(parsedUrl.searchParams.get('api')).toBe('1')
    expect(parsedUrl.searchParams.get('map_action')).toBe('pano')
    expect(parsedUrl.searchParams.get('viewpoint')).toBe('48.8566,2.3522')
    expect(parsedUrl.searchParams.has('heading')).toBe(false)
    expect(parsedUrl.searchParams.get('pitch')).toBe('0')
    expect(parsedUrl.searchParams.get('fov')).toBe('80')
    expect(url).toContain('viewpoint=48.8566%2C2.3522')
  })

  it('ajoute un cap normalisé quand il est disponible', () => {
    const url = buildGoogleStreetViewUrl(43.2965, 5.3698, -45)
    const parsedUrl = new URL(url)

    expect(parsedUrl.searchParams.get('heading')).toBe('315')
  })

  it('ignore un cap non fini', () => {
    const url = buildGoogleStreetViewUrl(45.764, 4.8357, Number.NaN)
    const parsedUrl = new URL(url)

    expect(parsedUrl.searchParams.has('heading')).toBe(false)
  })
})
