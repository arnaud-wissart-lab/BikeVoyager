export const addressBookFilterAll = '__all__'
export const addressBookSuggestedTags = ['home', 'client', 'work', 'delivery'] as const
export const maxAddressBookTagsPerEntry = 8
export const maxAddressBookTagLength = 24

export const parseAddressTagsInput = (
  rawValue: string,
  options: {
    maxTags?: number
    maxTagLength?: number
  } = {},
): string[] => {
  if (rawValue.trim().length === 0) {
    return []
  }

  const maxTags = options.maxTags ?? maxAddressBookTagsPerEntry
  const maxTagLength = options.maxTagLength ?? maxAddressBookTagLength
  const parsed: string[] = []

  for (const rawTag of rawValue.split(/[,\n;]+/)) {
    const normalized = rawTag.trim().toLowerCase()
    if (!normalized) {
      continue
    }

    const limited = normalized.slice(0, maxTagLength)
    if (parsed.includes(limited)) {
      continue
    }

    parsed.push(limited)
    if (parsed.length >= maxTags) {
      break
    }
  }

  return parsed
}

export const toggleAddressTagInInput = (rawValue: string, tag: string): string => {
  const parsed = parseAddressTagsInput(rawValue)
  const nextTags = parsed.includes(tag)
    ? parsed.filter((item) => item !== tag)
    : [...parsed, tag]

  return nextTags.slice(0, maxAddressBookTagsPerEntry).join(', ')
}

export const formatAddressTagFallbackLabel = (tag: string) =>
  tag.length === 0 ? tag : tag.charAt(0).toUpperCase() + tag.slice(1)

export const reorderIdsByDragAndDrop = (
  ids: string[],
  sourceId: string,
  targetId: string,
): string[] => {
  if (sourceId === targetId) {
    return ids
  }

  const fromIndex = ids.indexOf(sourceId)
  const toIndex = ids.indexOf(targetId)
  if (fromIndex < 0 || toIndex < 0) {
    return ids
  }

  const next = [...ids]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export const moveIdByDirection = (
  ids: string[],
  id: string,
  direction: -1 | 1,
): string[] => {
  const index = ids.indexOf(id)
  if (index < 0) {
    return ids
  }

  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= ids.length) {
    return ids
  }

  const next = [...ids]
  const [moved] = next.splice(index, 1)
  next.splice(nextIndex, 0, moved)
  return next
}
