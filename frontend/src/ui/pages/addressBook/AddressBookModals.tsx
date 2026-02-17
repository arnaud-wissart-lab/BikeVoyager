import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import { IconTrash, IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { parseAddressTagsInput } from '../../../features/data/addressBookUtils'
import type { AddressBookEntry } from '../../../features/data/dataPortability'

const addressBookModalStyles = {
  content: {
    border: '1px solid var(--mantine-color-default-border)',
    boxShadow: 'var(--bikevoyager-panel-shadow)',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--mantine-color-default-border)',
  },
  body: {
    padding: '14px 16px 16px',
  },
} as const

type AddressBookDeleteModalProps = {
  deleteCandidate: AddressBookEntry | null
  onClose: () => void
  onConfirm: () => void
}

export const AddressBookDeleteModal = ({
  deleteCandidate,
  onClose,
  onConfirm,
}: AddressBookDeleteModalProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      opened={deleteCandidate !== null}
      onClose={onClose}
      title={
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon variant="light" color="red" radius="xl" size="md">
            <IconTrash size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {t('addressBookDeleteConfirmTitle')}
          </Text>
        </Group>
      }
      centered
      styles={addressBookModalStyles}
      size="sm"
    >
      <Stack gap="sm">
        <Text size="sm">
          {t('addressBookDeleteConfirmBody', {
            name: deleteCandidate?.name ?? t('addressBookEntryFallbackName'),
          })}
        </Text>
        {deleteCandidate && (
          <Paper withBorder radius="md" p="xs">
            <Stack gap={2}>
              <Text size="sm" fw={600} lineClamp={1}>
                {deleteCandidate.name}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {deleteCandidate.label}
              </Text>
            </Stack>
          </Paper>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="outline" onClick={onClose}>
            {t('commonCancel')}
          </Button>
          <Button
            color="red"
            variant="filled"
            leftSection={<IconTrash size={14} />}
            onClick={onConfirm}
          >
            {t('addressBookDeleteConfirmAction')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

type AddressBookTagModalProps = {
  tagEditorEntry: AddressBookEntry | null
  tagDraftValue: string
  tagDraftError: string | null
  formatTagLabel: (tag: string) => string
  onClose: () => void
  onTagDraftValueChange: (value: string) => void
  onTagDraftErrorChange: (value: string | null) => void
  onAddTag: (entryId: string, tag: string) => void
  onDeleteTag: (entryId: string, tag: string) => void
}

export const AddressBookTagModal = ({
  tagEditorEntry,
  tagDraftValue,
  tagDraftError,
  formatTagLabel,
  onClose,
  onTagDraftValueChange,
  onTagDraftErrorChange,
  onAddTag,
  onDeleteTag,
}: AddressBookTagModalProps) => {
  const { t } = useTranslation()

  const handleAddTag = () => {
    if (!tagEditorEntry) {
      return
    }

    const [parsedTag] = parseAddressTagsInput(tagDraftValue, { maxTags: 1 })
    if (!parsedTag) {
      onTagDraftErrorChange(t('addressBookTagInputInvalid'))
      return
    }

    if (tagEditorEntry.tags.includes(parsedTag)) {
      onTagDraftErrorChange(
        t('addressBookTagAlreadyExists', {
          tag: formatTagLabel(parsedTag),
        }),
      )
      return
    }

    onAddTag(tagEditorEntry.id, parsedTag)
    onTagDraftValueChange('')
    onTagDraftErrorChange(null)
  }

  return (
    <Modal
      opened={tagEditorEntry !== null}
      onClose={onClose}
      title={t('addressBookTagEditorTitle', {
        name: tagEditorEntry?.name ?? t('addressBookEntryFallbackName'),
      })}
      centered
      styles={addressBookModalStyles}
      size="sm"
    >
      <Stack gap="sm">
        {tagEditorEntry && (
          <Text size="xs" c="dimmed">
            {tagEditorEntry.label}
          </Text>
        )}
        <TextInput
          label={t('addressBookTagInputLabel')}
          placeholder={t('addressBookTagInputPlaceholder')}
          value={tagDraftValue}
          onChange={(event) => onTagDraftValueChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return
            }

            event.preventDefault()
            handleAddTag()
          }}
          maxLength={24}
        />
        {tagDraftError && (
          <Text size="xs" c="red.6">
            {tagDraftError}
          </Text>
        )}
        <Button size="sm" variant="light" onClick={handleAddTag}>
          {t('addressBookAddTagAction')}
        </Button>
        {tagEditorEntry && tagEditorEntry.tags.length > 0 ? (
          <Stack gap={6}>
            <Text size="xs" c="dimmed">
              {t('addressBookExistingTagsLabel')}
            </Text>
            <Group gap={6} wrap="wrap">
              {tagEditorEntry.tags.map((tag) => (
                <Badge
                  key={`${tagEditorEntry.id}:${tag}`}
                  size="xs"
                  variant="light"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      onClick={() => {
                        onDeleteTag(tagEditorEntry.id, tag)
                        onTagDraftErrorChange(null)
                      }}
                      aria-label={t('addressBookDeleteTagAction', {
                        tag: formatTagLabel(tag),
                      })}
                      title={t('addressBookDeleteTagAction', {
                        tag: formatTagLabel(tag),
                      })}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  }
                >
                  {formatTagLabel(tag)}
                </Badge>
              ))}
            </Group>
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">
            {t('addressBookNoTags')}
          </Text>
        )}
      </Stack>
    </Modal>
  )
}
