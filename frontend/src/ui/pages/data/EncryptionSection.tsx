import { Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export default function EncryptionSection() {
  const { t } = useTranslation()

  return (
    <Stack gap={2}>
      <Text size="xs" fw={600}>
        {t('cloudSecurityTitle')}
      </Text>
      <Text size="xs" c="dimmed">
        {t('cloudSecurityItem1')}
      </Text>
      <Text size="xs" c="dimmed">
        {t('cloudSecurityItem2')}
      </Text>
      <Text size="xs" c="dimmed">
        {t('cloudSecurityItem3')}
      </Text>
    </Stack>
  )
}
