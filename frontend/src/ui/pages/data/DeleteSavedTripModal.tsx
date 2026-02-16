import { Button, Group, Modal, Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { SavedTripRecord } from '../../../features/data/dataPortability'

type DeleteSavedTripModalProps = {
  candidate: SavedTripRecord | null
  isFrench: boolean
  onClose: () => void
  onConfirm: () => void
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

export default function DeleteSavedTripModal({
  candidate,
  isFrench,
  onClose,
  onConfirm,
}: DeleteSavedTripModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      opened={candidate !== null}
      onClose={onClose}
      title={
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon variant="light" color="red" radius="xl" size="md">
            <IconTrash size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {t('dataSavedTripDeleteConfirmTitle')}
          </Text>
        </Group>
      }
      centered
      styles={modalStyles}
      size="sm"
    >
      <Stack gap="sm">
        <Text size="sm">
          {t('dataSavedTripDeleteConfirmBody', {
            name: candidate?.name ?? '',
          })}
        </Text>
        {candidate && (
          <Paper withBorder radius="md" p="xs">
            <Stack gap={2}>
              <Text size="sm" fw={600} lineClamp={1}>
                {candidate.name}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {new Date(candidate.savedAt).toLocaleString(isFrench ? 'fr-FR' : 'en-US')}
              </Text>
            </Stack>
          </Paper>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="outline" onClick={onClose}>
            {t('commonCancel')}
          </Button>
          <Button color="red" variant="filled" leftSection={<IconTrash size={14} />} onClick={onConfirm}>
            {t('dataSavedTripDeleteConfirmAction')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
