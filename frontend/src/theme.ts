import { createTheme } from '@mantine/core'

export const theme = createTheme({
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    fontWeight: '600',
  },
  primaryColor: 'blue',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'md',
  colors: {
    gray: [
      '#f7f8fa',
      '#eef1f4',
      '#d8dde3',
      '#c1c8d0',
      '#aab4bd',
      '#939fad',
      '#7a8898',
      '#606d7f',
      '#485364',
      '#303a49',
    ],
    blue: [
      '#f2f6ff',
      '#e3ecff',
      '#c9d9ff',
      '#aac2ff',
      '#8aa9f2',
      '#6f8fe0',
      '#5976c7',
      '#435da7',
      '#334684',
      '#24325f',
    ],
    green: [
      '#f2f7f4',
      '#e4efe9',
      '#c8ddd1',
      '#aac9b7',
      '#8db59e',
      '#719f84',
      '#588468',
      '#40694f',
      '#2c4b36',
      '#1a2f22',
    ],
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
})
