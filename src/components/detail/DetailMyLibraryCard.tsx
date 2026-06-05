import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import type { createDetailStyles } from './createDetailStyles';
import type { DetailPalette } from './detailTheme';

type DetailStyles = ReturnType<typeof createDetailStyles>;

type StatusTone = { color: string; bg: string; border: string };

type DetailMyLibraryCardProps = {
  palette: DetailPalette;
  styles: DetailStyles;
  statusLabel: string;
  statusTone: StatusTone;
  ratingText: string;
  dateText: string;
  onEdit: () => void;
};

export default function DetailMyLibraryCard({
  palette,
  styles,
  statusLabel,
  statusTone,
  ratingText,
  dateText,
  onEdit,
}: DetailMyLibraryCardProps) {
  return (
    <View style={styles.libraryCard}>
      <View style={styles.libraryCardHeader}>
        <Text style={styles.libraryCardTitle}>Tu biblioteca</Text>
        <TouchableOpacity
          onPress={onEdit}
          style={[styles.libraryEditBtn, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="edit" size={14} color={palette.brand} />
          <Text style={[styles.libraryEditText, { color: palette.brand }]}>Editar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.libraryCardBody}>
        <View
          style={[
            styles.statusPill,
            {
              borderColor: statusTone.border,
              backgroundColor: statusTone.bg,
            },
          ]}
        >
          <MaterialIcons name="flag" size={12} color={statusTone.color} />
          <Text style={[styles.statusPillText, { color: statusTone.color }]}>{statusLabel}</Text>
        </View>

        <View style={styles.libraryRatingRow}>
          <MaterialIcons name="star" size={15} color={palette.brand} />
          <Text style={styles.libraryRatingText}>{ratingText}</Text>
        </View>

        <Text style={styles.libraryDateText}>{dateText}</Text>
      </View>
    </View>
  );
}
