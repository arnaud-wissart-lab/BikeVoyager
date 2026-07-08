import { Button, Tooltip } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { appDisplayName } from '../../features/app/versionInfo'

type AppVersionBadgeProps = {
  onClick: () => void
}

export default function AppVersionBadge({ onClick }: AppVersionBadgeProps) {
  const { t } = useTranslation()
  const label = t('releaseNotesTooltip')

  return (
    <Tooltip label={label} withArrow>
      <Button
        variant="subtle"
        color="gray"
        radius="xl"
        size="compact-sm"
        leftSection={<IconSparkles size={14} />}
        onClick={onClick}
        aria-label={label}
        title={label}
        style={{ flexShrink: 0 }}
      >
        {appDisplayName}
      </Button>
    </Tooltip>
  )
}
