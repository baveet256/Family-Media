import { theme } from '@/lib/theme';

export default {
  light: {
    text: theme.ink,
    background: theme.paper,
    tint: theme.accent,
    tabIconDefault: theme.faint,
    tabIconSelected: theme.accent,
  },
  dark: {
    text: '#f5e6c8',
    background: '#15241c',
    tint: '#e8d5a3',
    tabIconDefault: 'rgba(232,213,163,0.35)',
    tabIconSelected: '#e8d5a3',
  },
};
