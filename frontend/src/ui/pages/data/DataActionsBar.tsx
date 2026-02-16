import { Group } from '@mantine/core'
import type { ReactNode } from 'react'

type DataActionsBarProps = {
  isDesktop: boolean
  children: ReactNode
}

export default function DataActionsBar({ isDesktop, children }: DataActionsBarProps) {
  return (
    <Group grow={isDesktop} wrap="wrap">
      {children}
    </Group>
  )
}
