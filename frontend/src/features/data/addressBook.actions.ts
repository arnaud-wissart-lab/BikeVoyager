import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import {
  formatAddressTagFallbackLabel,
  maxAddressBookTagsPerEntry,
  parseAddressTagsInput,
} from './addressBookUtils'
import {
  createAddressBookEntry,
  sortAndLimitAddressBook,
  upsertAddressBookEntry,
  type AddressBookEntry,
} from './dataPortability'
import type { PlaceCandidate } from '../routing/domain'

type ToastHandler = (message: string, options?: { title?: string; durationMs?: number }) => void

export type AddressBookActionsStoreSlice = Pick<
  AppStore,
  | 'addressBook'
  | 'addressBookNameValue'
  | 'addressBookTagsValue'
  | 'addressBookPlaceCandidate'
  | 'setAddressBook'
  | 'setAddressBookNameValue'
  | 'setAddressBookPlaceValue'
  | 'setAddressBookTagsValue'
  | 'setAddressBookPlaceCandidate'
>

type CreateAddressBookActionsParams = {
  store: AddressBookActionsStoreSlice
  t: TFunction
  addressBookById: Map<string, AddressBookEntry>
  showSuccessToast: ToastHandler
  showErrorToast: ToastHandler
}

export const createAddressBookActions = ({
  store,
  t,
  addressBookById,
  showSuccessToast,
  showErrorToast,
}: CreateAddressBookActionsParams) => {
  const {
    addressBook,
    addressBookNameValue,
    addressBookTagsValue,
    addressBookPlaceCandidate,
    setAddressBook,
    setAddressBookNameValue,
    setAddressBookPlaceValue,
    setAddressBookTagsValue,
    setAddressBookPlaceCandidate,
  } = store

  const isPlaceAlreadySavedInAddressBook = (place: PlaceCandidate | null) => {
    if (!place) {
      return false
    }

    return addressBook.some(
      (entry) =>
        Math.abs(entry.lat - place.lat) < 0.00001 && Math.abs(entry.lon - place.lon) < 0.00001,
    )
  }

  const formatAddressTagLabel = (tag: string) => {
    if (tag === 'home') {
      return t('addressBookTagHome')
    }
    if (tag === 'client') {
      return t('addressBookTagClient')
    }
    if (tag === 'work') {
      return t('addressBookTagWork')
    }
    if (tag === 'delivery') {
      return t('addressBookTagDelivery')
    }

    return formatAddressTagFallbackLabel(tag)
  }

  const savePlaceInAddressBook = (place: PlaceCandidate, customName?: string, tags?: string[]) => {
    const prepared = createAddressBookEntry({
      name: customName ?? place.label,
      place,
      tags,
    })
    const resolvedName = prepared.name
    setAddressBook((current) => upsertAddressBookEntry(current, prepared))
    showSuccessToast(
      t('addressBookSavedSuccess', {
        name: resolvedName,
      }),
    )
  }

  const handleSaveAddressBookEntry = () => {
    if (!addressBookPlaceCandidate) {
      showErrorToast(t('addressBookMissingPlace'))
      return
    }

    const customName = addressBookNameValue.trim()
    const tags = parseAddressTagsInput(addressBookTagsValue)
    savePlaceInAddressBook(
      addressBookPlaceCandidate,
      customName.length > 0 ? customName : undefined,
      tags,
    )
    setAddressBookNameValue('')
    setAddressBookPlaceValue('')
    setAddressBookTagsValue('')
    setAddressBookPlaceCandidate(null)
  }

  const handleSaveQuickAddress = (place: PlaceCandidate | null) => {
    if (!place || isPlaceAlreadySavedInAddressBook(place)) {
      return
    }

    savePlaceInAddressBook(place)
  }

  const handleDeleteAddressBookEntry = (entryId: string) => {
    const existing = addressBookById.get(entryId)
    setAddressBook((current) => current.filter((entry) => entry.id !== entryId))
    showSuccessToast(
      t('addressBookDeletedSuccess', {
        name: existing?.name ?? t('addressBookEntryFallbackName'),
      }),
    )
  }

  const handleDeleteAddressBookTag = (entryId: string, tagToDelete: string) => {
    const existing = addressBookById.get(entryId)
    if (!existing || !existing.tags.includes(tagToDelete)) {
      return
    }

    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                tags: entry.tags.filter((tag) => tag !== tagToDelete),
                updatedAt: now,
              }
            : entry,
        ),
      ),
    )
    showSuccessToast(
      t('addressBookTagDeletedSuccess', {
        name: existing.name,
        tag: formatAddressTagLabel(tagToDelete),
      }),
    )
  }

  const handleAddAddressBookTag = (entryId: string, tagToAdd: string) => {
    const existing = addressBookById.get(entryId)
    const [parsedTag] = parseAddressTagsInput(tagToAdd, { maxTags: 1 })
    if (!existing || !parsedTag) {
      return
    }

    if (existing.tags.includes(parsedTag)) {
      return
    }

    if (existing.tags.length >= maxAddressBookTagsPerEntry) {
      showErrorToast(
        t('addressBookTagLimitReached', {
          max: maxAddressBookTagsPerEntry,
        }),
      )
      return
    }

    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                tags: [...entry.tags, parsedTag],
                updatedAt: now,
              }
            : entry,
        ),
      ),
    )
    showSuccessToast(
      t('addressBookTagAddedSuccess', {
        name: existing.name,
        tag: formatAddressTagLabel(parsedTag),
      }),
    )
  }

  return {
    isPlaceAlreadySavedInAddressBook,
    formatAddressTagLabel,
    handleSaveAddressBookEntry,
    handleSaveQuickAddress,
    handleDeleteAddressBookEntry,
    handleDeleteAddressBookTag,
    handleAddAddressBookTag,
  }
}
