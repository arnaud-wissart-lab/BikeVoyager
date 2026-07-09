import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { IconDeviceFloppy, IconPlus, IconStar, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  savedTripMaxTags,
  savedTripNameMaxLength,
  savedTripNotesMaxLength,
  savedTripTagMaxLength,
  type SavedTripMetadataInput,
} from '../../../features/data/dataPortability'

type SavedTripMetadataDialogProps = {
  opened: boolean
  title: string
  submitLabel: string
  initialValues: SavedTripMetadataInput
  onClose: () => void
  onSubmit: (metadata: SavedTripMetadataInput) => void
}

const modalStyles = {
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

const normalizeTagDraft = (value: string) =>
  value.trim().toLowerCase().slice(0, savedTripTagMaxLength)

export default function SavedTripMetadataDialog({
  opened,
  title,
  submitLabel,
  initialValues,
  onClose,
  onSubmit,
}: SavedTripMetadataDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialValues.name)
  const [notes, setNotes] = useState(initialValues.notes ?? '')
  const [tags, setTags] = useState(initialValues.tags ?? [])
  const [favorite, setFavorite] = useState(initialValues.favorite === true)
  const [tagDraft, setTagDraft] = useState('')

  useEffect(() => {
    if (!opened) {
      return
    }

    setName(initialValues.name)
    setNotes(initialValues.notes ?? '')
    setTags(initialValues.tags ?? [])
    setFavorite(initialValues.favorite === true)
    setTagDraft('')
  }, [initialValues, opened])

  const canSubmit = name.trim().length > 0
  const addTag = () => {
    const nextTag = normalizeTagDraft(tagDraft)
    if (!nextTag || tags.includes(nextTag) || tags.length >= savedTripMaxTags) {
      setTagDraft('')
      return
    }

    setTags((current) => [...current, nextTag])
    setTagDraft('')
  }

  const submit = () => {
    if (!canSubmit) {
      return
    }

    onSubmit({
      name,
      notes,
      tags,
      favorite,
    })
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs" wrap="nowrap">
          <IconDeviceFloppy size={16} />
          <Text size="sm" fw={600}>
            {title}
          </Text>
        </Group>
      }
      centered
      styles={modalStyles}
      size="md"
    >
      <Stack gap="sm">
        <TextInput
          label={t('dataSavedTripNameLabel')}
          aria-label={t('dataSavedTripNameLabel')}
          value={name}
          maxLength={savedTripNameMaxLength}
          onChange={(event) => setName(event.currentTarget.value)}
          required
        />
        <Textarea
          label={t('dataSavedTripNotesLabel')}
          aria-label={t('dataSavedTripNotesLabel')}
          value={notes}
          maxLength={savedTripNotesMaxLength}
          autosize
          minRows={3}
          maxRows={6}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            {t('dataSavedTripTagsLabel')}
          </Text>
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput
              value={tagDraft}
              maxLength={savedTripTagMaxLength}
              placeholder={t('dataSavedTripAddTag')}
              onChange={(event) => setTagDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTag()
                }
              }}
              style={{ flex: 1 }}
            />
            <ActionIcon
              variant="light"
              size="lg"
              onClick={addTag}
              disabled={tags.length >= savedTripMaxTags}
              aria-label={t('dataSavedTripAddTag')}
              title={t('dataSavedTripAddTag')}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Group>
          {tags.length > 0 && (
            <Group gap={6}>
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="light"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      aria-label={t('dataSavedTripRemoveTag', { tag })}
                      onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  }
                >
                  {tag}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
        <Checkbox
          checked={favorite}
          label={t('dataSavedTripFavoriteLabel')}
          icon={IconStar}
          onChange={(event) => setFavorite(event.currentTarget.checked)}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="outline" onClick={onClose}>
            {t('commonCancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            leftSection={<IconDeviceFloppy size={16} />}
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
