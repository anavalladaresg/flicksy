import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarInput } from './CalendarInput';

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

interface RatingPickerModalProps {
  visible: boolean;
  title: string;
  value: number;
  status: string;
  statusOptions: StatusOption[];
  dateMode?: 'single' | 'range';
  watchedAt?: string;
  startedAt: string;
  finishedAt: string;
  onChange: (value: number) => void;
  onChangeStatus: (value: string) => void;
  onChangeWatchedAt?: (value: string) => void;
  onChangeStartedAt: (value: string) => void;
  onChangeFinishedAt: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function iconNameFor(value: number, starIndex: number): 'star' | 'star-half' | 'star-border' {
  if (value >= starIndex) return 'star';
  if (value >= starIndex - 0.5) return 'star-half';
  return 'star-border';
}

function RatingPickerModal({
  visible,
  title,
  value,
  status,
  statusOptions,
  dateMode = 'range',
  watchedAt = '',
  startedAt,
  finishedAt,
  onChange,
  onChangeStatus,
  onChangeWatchedAt,
  onChangeStartedAt,
  onChangeFinishedAt,
  onCancel,
  onConfirm,
}: RatingPickerModalProps) {
  const isDark = useColorScheme() === 'dark';
  const [starsWidth, setStarsWidth] = useState(0);
  const starsTrackRef = useRef<View | null>(null);
  const trackPageXRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const measureTrack = useCallback(() => {
    starsTrackRef.current?.measureInWindow((x) => {
      trackPageXRef.current = x;
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(measureTrack, 0);
    return () => clearTimeout(timer);
  }, [measureTrack, visible]);

  const ratingFromTouchX = useCallback((pageX: number) => {
    if (starsWidth <= 0) return valueRef.current || 0;
    const localX = pageX - trackPageXRef.current;
    const boundedX = Math.max(0, Math.min(starsWidth, localX));
    const pointsPerStep = starsWidth / 20;
    const steps = Math.round(boundedX / pointsPerStep);
    return Math.max(0, Math.min(10, steps * 0.5));
  }, [starsWidth]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const tappedValue = ratingFromTouchX(event.nativeEvent.pageX);
          onChange(tappedValue);
        },
        onPanResponderMove: (_, gestureState) => onChange(ratingFromTouchX(gestureState.moveX)),
      }),
    [onChange, ratingFromTouchX]
  );

  const hasInvalidRange =
    dateMode === 'range' &&
    Boolean(startedAt && finishedAt) &&
    new Date(finishedAt).getTime() < new Date(startedAt).getTime();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, isDark && styles.sheetDark]}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Valora: {title}</Text>

          <View style={styles.statusBlock}>
            <Text style={[styles.sectionLabel, { color: isDark ? '#CBD5E1' : '#334155' }]}>Estado</Text>
            <View style={styles.statusRow}>
              {statusOptions.map((option) => {
                const active = status === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.statusChip,
                      isDark && styles.statusChipDark,
                      { borderColor: option.color, backgroundColor: `${option.color}22` },
                      active && { backgroundColor: `${option.color}66` },
                    ]}
                    onPress={() => onChangeStatus(option.value)}
                  >
                    <Text style={[styles.statusChipText, active && styles.statusChipTextActive, { color: option.color }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text style={[styles.subtitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Mi puntuación {value.toFixed(1)} / 10</Text>

          <View style={styles.starsRow}>
            <View
              ref={starsTrackRef}
              style={styles.starsTrack}
              onLayout={(event) => {
                setStarsWidth(event.nativeEvent.layout.width);
                measureTrack();
              }}
              {...panResponder.panHandlers}
            >
              {Array.from({ length: 10 }, (_, idx) => idx + 1).map((index) => (
                <View key={index} style={styles.starSlot}>
                  <MaterialIcons name={iconNameFor(value, index)} size={23} color="#F59E0B" />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.datesBlock}>
            {dateMode === 'single' ? (
              <CalendarInput
                label="Fecha visualización"
                value={watchedAt}
                onChange={onChangeWatchedAt ?? (() => undefined)}
                placeholder="Seleccionar"
              />
            ) : (
              <View style={styles.datesRow}>
                <View style={styles.dateCol}>
                  <CalendarInput
                    label="Fecha inicio"
                    value={startedAt}
                    onChange={onChangeStartedAt}
                    placeholder="Seleccionar"
                  />
                </View>
                <View style={styles.dateCol}>
                  <CalendarInput
                    label="Fecha fin"
                    value={finishedAt}
                    onChange={onChangeFinishedAt}
                    placeholder="Seleccionar"
                  />
                </View>
              </View>
            )}
          </View>
          {hasInvalidRange && (
            <Text style={styles.rangeError}>
              La fecha de fin no puede ser anterior a la fecha de inicio.
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.cancelButton, isDark && styles.cancelButtonDark]} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, hasInvalidRange && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              disabled={hasInvalidRange}
            >
              <Text style={styles.confirmText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  sheetDark: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  statusBlock: {
    marginTop: 14,
  },
  statusRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  statusChipDark: {
    backgroundColor: '#0F172A',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  statusChipTextActive: {
    color: '#1E293B',
  },
  starsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  starsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datesBlock: {
    marginTop: 14,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateCol: {
    flex: 1,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  rangeError: {
    marginTop: 8,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  cancelButtonDark: {
    backgroundColor: '#1F2937',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  confirmButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0E7490',
  },
  confirmButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export { RatingPickerModal };
export default RatingPickerModal;
