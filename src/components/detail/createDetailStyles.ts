import { Platform, StyleSheet } from 'react-native';
import type { DetailPalette } from './detailTheme';

export function createDetailStyles(palette: DetailPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    scrollContent: {
      paddingBottom: Platform.OS === 'web' ? 20 : 28,
    },
    scrollView: {
      ...(Platform.OS === 'web' ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any) : {}),
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 4,
      marginTop: Platform.OS === 'web' ? -24 : -18,
      maxWidth: 1060,
      alignSelf: 'center',
      width: '100%',
    },
    bodyStack: {
      gap: 0,
    },
    bodyGrid: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 28,
      marginTop: 4,
    },
    mainColumn: {
      flex: 1,
      minWidth: 0,
    },
    sidebarColumn: {
      width: 300,
      flexShrink: 0,
      gap: 16,
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: palette.text,
      letterSpacing: 0.1,
      lineHeight: 36,
      marginBottom: 12,
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: palette.brand,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 11,
      marginBottom: 18,
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            transitionDuration: '150ms',
          } as any)
        : {}),
    },
    primaryActionTracked: {
      backgroundColor: palette.dangerBg,
      borderWidth: 1,
      borderColor: palette.dangerBorder,
    },
    primaryActionText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    primaryActionTextTracked: {
      color: palette.danger,
    },
    libraryCard: {
      backgroundColor: palette.surface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 16,
    },
    libraryCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    libraryCardTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: palette.subtext,
    },
    libraryEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    libraryEditText: {
      fontSize: 12,
      fontWeight: '600',
    },
    libraryCardBody: {
      gap: 10,
    },
    libraryRatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    libraryRatingText: {
      fontSize: 15,
      fontWeight: '700',
      color: palette.text,
    },
    libraryDateText: {
      fontSize: 12,
      color: palette.subtext,
      fontWeight: '500',
      lineHeight: 17,
    },
    friendHint: {
      marginBottom: 16,
      backgroundColor: palette.brandMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    friendHintText: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 19,
      color: palette.text,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '700',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      backgroundColor: palette.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    metaChipText: {
      fontSize: 12,
      color: palette.subtext,
      fontWeight: '600',
    },
    trailerButton: {
      marginBottom: 18,
      borderRadius: 12,
      backgroundColor: palette.elevated,
      paddingHorizontal: 16,
      paddingVertical: 11,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: palette.border,
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            transitionDuration: '150ms',
          } as any)
        : {}),
    },
    trailerButtonText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '700',
    },
    sectionBlock: {
      marginBottom: 18,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: palette.subtext,
      marginBottom: 10,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    providerChip: {
      maxWidth: 148,
      backgroundColor: palette.surface,
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            transitionDuration: '150ms',
          } as any)
        : {}),
    },
    providerLogo: {
      width: 24,
      height: 24,
      borderRadius: 6,
      backgroundColor: palette.elevated,
    },
    providerName: {
      flexShrink: 1,
      fontSize: 11,
      fontWeight: '600',
      color: palette.subtext,
    },
    genreTag: {
      backgroundColor: palette.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    genreText: {
      fontSize: 12,
      color: palette.subtext,
      fontWeight: '600',
    },
    platformTag: {
      backgroundColor: palette.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    platformText: {
      fontSize: 12,
      color: palette.subtext,
      fontWeight: '600',
    },
    synopsisBlock: {
      marginBottom: 20,
    },
    synopsisText: {
      fontSize: 15,
      lineHeight: 26,
      color: palette.subtext,
      maxWidth: 720,
    },
    screenshotsRow: {
      gap: 10,
      paddingBottom: 4,
      marginBottom: 6,
    },
    screenshotImage: {
      width: 220,
      height: 124,
      borderRadius: 12,
      backgroundColor: palette.elevated,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 6px 18px rgba(0,0,0,0.22)' } as any)
        : {}),
    },
  });
}
