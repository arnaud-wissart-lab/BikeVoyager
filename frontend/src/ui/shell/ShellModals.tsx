import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import InstallPrompt from '../../components/InstallPrompt'

type ShellModalsProps = {
  pendingCloudRestoreModifiedAt: string | null
  isOpen: boolean
  isFrench: boolean
  onCancelPendingCloudRestore: () => void
  onApplyPendingCloudRestore: (mode: 'merge' | 'replace') => void
}

export default function ShellModals({
  pendingCloudRestoreModifiedAt,
  isOpen,
  isFrench,
  onCancelPendingCloudRestore,
  onApplyPendingCloudRestore,
}: ShellModalsProps) {
  const { t } = useTranslation()

  return (
    <>
      <Modal
        opened={isOpen}
        onClose={onCancelPendingCloudRestore}
        title={t('cloudRestoreDecisionTitle')}
        centered
        radius="md"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {pendingCloudRestoreModifiedAt
              ? t('cloudRestoreDecisionBodyWithDate', {
                  value: new Date(pendingCloudRestoreModifiedAt).toLocaleString(
                    isFrench ? 'fr-FR' : 'en-US',
                  ),
                })
              : t('cloudRestoreDecisionBody')}
          </Text>
          <Group justify="flex-end" wrap="wrap">
            <Button variant="default" onClick={onCancelPendingCloudRestore}>
              {t('cloudRestoreDecisionCancel')}
            </Button>
            <Button variant="light" onClick={() => onApplyPendingCloudRestore('merge')}>
              {t('cloudRestoreDecisionMerge')}
            </Button>
            <Button onClick={() => onApplyPendingCloudRestore('replace')}>
              {t('cloudRestoreDecisionReplace')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <InstallPrompt />
    </>
  )
}
