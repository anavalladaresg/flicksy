export const DETAIL_COLORS = {
  dark: {
    bg: '#0B0F14',
    surface: '#121821',
    elevated: '#1A2330',
    text: '#E6EDF3',
    subtext: '#9FB0C3',
    border: '#2A3545',
    brand: '#7C9EFF',
    brandMuted: 'rgba(124, 158, 255, 0.14)',
    danger: '#FF5C8A',
    dangerBg: 'rgba(255, 92, 138, 0.12)',
    dangerBorder: 'rgba(255, 92, 138, 0.35)',
    success: '#5BE7A9',
    heroFade: 'rgba(11, 15, 20, 0.92)',
  },
  light: {
    bg: '#F1EFEA',
    surface: '#F8F6F1',
    elevated: '#ECE8E0',
    text: '#0F172A',
    subtext: '#625F59',
    border: '#DED8CC',
    brand: '#0A7EA4',
    brandMuted: 'rgba(10, 126, 164, 0.1)',
    danger: '#BE123C',
    dangerBg: 'rgba(190, 18, 60, 0.08)',
    dangerBorder: 'rgba(190, 18, 60, 0.28)',
    success: '#0F9F6E',
    heroFade: 'rgba(241, 239, 234, 0.94)',
  },
} as const;

export type DetailPalette = (typeof DETAIL_COLORS)[keyof typeof DETAIL_COLORS];

export function getDetailPalette(dark: boolean): DetailPalette {
  return dark ? DETAIL_COLORS.dark : DETAIL_COLORS.light;
}
