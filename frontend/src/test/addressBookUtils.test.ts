import {
  formatAddressTagFallbackLabel,
  moveIdByDirection,
  parseAddressTagsInput,
  reorderIdsByDragAndDrop,
  toggleAddressTagInInput,
} from '../features/data/addressBookUtils'

describe('addressBookUtils', () => {
  it('normalise et dedup les tags saisis', () => {
    const tags = parseAddressTagsInput(' Home,client;home\nWORK ')
    expect(tags).toEqual(['home', 'client', 'work'])
  })

  it('active puis desactive un tag dans le brouillon', () => {
    const withTag = toggleAddressTagInInput('home, client', 'work')
    expect(withTag).toBe('home, client, work')

    const withoutTag = toggleAddressTagInInput(withTag, 'client')
    expect(withoutTag).toBe('home, work')
  })

  it('reordonne les ids sur drag and drop', () => {
    const reordered = reorderIdsByDragAndDrop(['a', 'b', 'c'], 'a', 'c')
    expect(reordered).toEqual(['b', 'c', 'a'])
  })

  it('deplace un id vers le haut ou le bas', () => {
    const movedUp = moveIdByDirection(['a', 'b', 'c'], 'b', -1)
    expect(movedUp).toEqual(['b', 'a', 'c'])

    const movedDown = moveIdByDirection(['a', 'b', 'c'], 'b', 1)
    expect(movedDown).toEqual(['a', 'c', 'b'])
  })

  it('formate un fallback lisible pour les tags', () => {
    expect(formatAddressTagFallbackLabel('delivery')).toBe('Delivery')
  })
})
