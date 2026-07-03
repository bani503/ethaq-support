import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#FDFBF7',
    surface: '#FFFFFF',
    primary: '#0F4C3A',
    primaryHover: '#0A3629',
    primaryLight: '#E7F0EC',
    gold: '#D4AF37',
    goldLight: '#F5E9C4',
    textPrimary: '#1A1C18',
    textSecondary: '#5C6656',
    textMuted: '#8E9686',
    border: '#E8EAE3',
    divider: '#F0EEE8',
    danger: '#C05540',
    night: '#1E2A2B',
    overlay: 'rgba(0,0,0,0.35)',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    full: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fonts: {
    // Use system Arabic fonts for reliable rendering everywhere
    ar: Platform.select({ ios: 'Damascus', android: undefined, default: undefined }),
    serif: Platform.select({ ios: 'Amiri', android: 'serif', default: 'serif' }),
  },
};
