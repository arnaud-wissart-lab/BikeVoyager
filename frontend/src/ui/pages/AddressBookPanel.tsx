import {
  ActionIcon,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconMapPinPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../../components/PlaceSearchInput'
import type { AddressBookEntry } from '../../features/data/dataPortability'
import type { PlaceCandidate } from '../../features/routing/domain'
import { AddressBookDeleteModal, AddressBookTagModal } from './addressBook/AddressBookModals'

type AddressBookPanelProps = {
  isDesktop: boolean
  entries: AddressBookEntry[]
  visibleEntries: AddressBookEntry[]
  visibleCount: number
  filterTag: string
  filterAllValue: string
  filterOptions: string[]
  nameValue: string
  placeValue: string
  tagsValue: string
  canSave: boolean
  formatTagLabel: (tag: string) => string
  onNameChange: (value: string) => void
  onPlaceValueChange: (value: string) => void
  onPlaceSelect: (place: PlaceCandidate | null) => void
  onTagsChange: (value: string) => void
  onSave: () => void
  onFilterChange: (tag: string) => void
  onDelete: (entryId: string) => void
  onAddTag: (entryId: string, tag: string) => void
  onDeleteTag: (entryId: string, tag: string) => void
}

export default function AddressBookPanel({
  isDesktop,
  entries,
  visibleEntries,
  visibleCount,
  filterTag,
  filterAllValue,
  filterOptions,
  nameValue,
  placeValue,
  tagsValue,
  canSave,
  formatTagLabel,
  onNameChange,
  onPlaceValueChange,
  onPlaceSelect,
  onTagsChange,
  onSave,
  onFilterChange,
  onDelete,
  onAddTag,
  onDeleteTag,
}: AddressBookPanelProps) {
  const { t } = useTranslation()
  const [deleteCandidate, setDeleteCandidate] = useState<AddressBookEntry | null>(null)
  const [tagEditorEntryId, setTagEditorEntryId] = useState<string | null>(null)
  const [tagDraftValue, setTagDraftValue] = useState('')
  const [tagDraftError, setTagDraftError] = useState<string | null>(null)
  const tagEditorEntry = tagEditorEntryId
    ? entries.find((entry) => entry.id === tagEditorEntryId) ?? null
    : null

  const closeDeleteModal = () => {
    setDeleteCandidate(null)
  }

  const confirmDelete = () => {
    if (!deleteCandidate) {
      return
    }

    onDelete(deleteCandidate.id)
    setDeleteCandidate(null)
  }

  const openTagEditor = (entryId: string) => {
    setTagEditorEntryId(entryId)
    setTagDraftValue('')
    setTagDraftError(null)
  }

  const closeTagEditor = () => {
    setTagEditorEntryId(null)
    setTagDraftValue('')
    setTagDraftError(null)
  }

  return (
    <Stack gap={6}>
      <AddressBookDeleteModal
        deleteCandidate={deleteCandidate}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
      />
      <AddressBookTagModal
        tagEditorEntry={tagEditorEntry}
        tagDraftValue={tagDraftValue}
        tagDraftError={tagDraftError}
        formatTagLabel={formatTagLabel}
        onClose={closeTagEditor}
        onTagDraftValueChange={setTagDraftValue}
        onTagDraftErrorChange={setTagDraftError}
        onAddTag={onAddTag}
        onDeleteTag={onDeleteTag}
      />
      <TextInput
        label={t('addressBookNameLabel')}
        placeholder={t('addressBookNamePlaceholder')}
        value={nameValue}
        onChange={(event) => onNameChange(event.currentTarget.value)}
        maxLength={80}
      />
      <PlaceSearchInput
        label={t('addressBookPlaceLabel')}
        placeholder={t('addressBookPlacePlaceholder')}
        value={placeValue}
        onValueChange={onPlaceValueChange}
        onPlaceSelect={onPlaceSelect}
        testId="address-book-place"
      />
      <TextInput
        label={t('addressBookTagsLabel')}
        description={t('addressBookTagsHint')}
        placeholder={t('addressBookTagsPlaceholder')}
        value={tagsValue}
        onChange={(event) => onTagsChange(event.currentTarget.value)}
        maxLength={180}
      />
      {canSave && (
        <Button
          size="sm"
          variant="light"
          leftSection={<IconMapPinPlus size={16} />}
          onClick={onSave}
        >
          {t('addressBookSaveAction')}
        </Button>
      )}
      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          {t('addressBookFilterLabel')}
        </Text>
        <Group gap="xs" wrap="wrap">
          <Button
            size="xs"
            variant={filterTag === filterAllValue ? 'filled' : 'light'}
            onClick={() => onFilterChange(filterAllValue)}
          >
            {t('addressBookFilterAll')}
          </Button>
          {filterOptions.map((tag) => (
            <Button
              key={tag}
              size="xs"
              variant={filterTag === tag ? 'filled' : 'light'}
              onClick={() => onFilterChange(tag)}
            >
              {formatTagLabel(tag)}
            </Button>
          ))}
        </Group>
      </Stack>
      {entries.length > 0 && (
        <Text size="xs" c="dimmed">
          {t('addressBookFilterResultCount', {
            visible: visibleCount,
            total: entries.length,
          })}
        </Text>
      )}
      {entries.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('addressBookEmpty')}
        </Text>
      ) : visibleEntries.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('addressBookFilterNoMatch')}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={isDesktop ? 260 : 220} offsetScrollbars>
          <Stack gap={6}>
            {visibleEntries.map((entry) => {
              return (
                <Paper
                  key={entry.id}
                  withBorder
                  radius="md"
                  p="xs"
                  onClick={() => openTagEditor(entry.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                    <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {entry.name}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {entry.label}
                      </Text>
                    </Stack>
                    <Group gap={6} wrap="nowrap" align="center">
                      {entry.tags.length > 0 && (
                        <Text size="xs" c="dimmed">
                          {t('addressBookTagCount', { count: entry.tags.length })}
                        </Text>
                      )}
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleteCandidate(entry)
                        }}
                        aria-label={t('addressBookDeleteAction')}
                        title={t('addressBookDeleteAction')}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              )
            })}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Stack>
  )
}

