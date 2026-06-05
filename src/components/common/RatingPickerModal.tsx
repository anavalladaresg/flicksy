import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarInput } from './CalendarInput';
import { useEscapeClose } from '../../hooks/use-escape-close';
import { getDetailPalette } from '../detail/detailTheme';

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
  watchedAtApproximate?: boolean;
  startedAt: string;
  finishedAt: string;
  startedAtApproximate?: boolean;
  finishedAtApproximate?: boolean;
  onChange: (value: number) => void;
  onChangeStatus: (value: string) => void;
  onChangeWatchedAt?: (value: string) => void;
  onChangeWatchedAtApproximate?: (value: boolean) => void;
  onChangeStartedAt: (value: string) => void;
  onChangeFinishedAt: (value: string) => void;
  onChangeStartedAtApproximate?: (value: boolean) => void;
  onChangeFinishedAtApproximate?: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmAndGoBack?: () => void;
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
  watchedAtApproximate = false,
  startedAt,
  finishedAt,
  startedAtApproximate = false,
  finishedAtApproximate = false,
  onChange,
  onChangeStatus,
  onChangeWatchedAt,
  onChangeWatchedAtApproximate,
  onChangeStartedAt,
  onChangeFinishedAt,
  onChangeStartedAtApproximate,
  onChangeFinishedAtApproximate,
  onCancel,
  onConfirm,
  onConfirmAndGoBack,
}: RatingPickerModalProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getDetailPalette(isDark);
  const [starsWidth, setStarsWidth] = useState(0);
  const starsTrackRef = useRef<View | null>(null);
  const trackPageXRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEscapeClose(visible, onCancel);

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

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const modalContainer = target.closest('[data-stars-container]') || target.closest('[data-stars-track]');
      if (modalContainer && starsTrackRef.current) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.5 : 0.5;
        const newValue = Math.max(0, Math.min(10, valueRef.current + delta));
        onChange(newValue);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [visible, onChange]);

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
  const isPlanned = status === 'planned';
  const isInProgress = status === 'watching' || status === 'playing';
  const showRangeDates = dateMode === 'range' && status === 'completed';
  const showStartOnlyDate = dateMode === 'range' && (status === 'watching' || status === 'playing');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.elevated,
              borderColor: palette.border,
            },
          ]}
          {...(Platform.OS === 'web' ? { 'data-stars-container': true } : {})}
        >
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            Valora: {title}
          </Text>

          <View style={styles.statusBlock}>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Estado</Text>
            <View style={[styles.segmentedTrack, { backgroundColor: palette.surface }]}>
              {statusOptions.map((option) => {
                const active = status === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.segmentedOption,
                      active && { backgroundColor: palette.brand },
                      Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                    ]}
                    onPress={() => onChangeStatus(option.value)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.segmentedOptionText,
                        { color: active ? '#FFFFFF' : palette.subtext },
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.ratingBlock}>
            <Text style={[styles.ratingLabel, { color: palette.subtext }]}>
              {isInProgress ? 'Mi puntuación provisional' : 'Mi puntuación'}
            </Text>
            <Text style={[styles.ratingValue, { color: palette.text }]}>
              {value.toFixed(1)} <Text style={{ color: palette.subtext, fontWeight: '600' }}>/ 10</Text>
            </Text>
          </View>

          {isPlanned ? (
            <Text style={[styles.dateHintText, { color: palette.subtext }]}>
              En estado Pendiente no puedes añadir puntuación.
            </Text>
          ) : (
            <View style={styles.starsRow}>
              <View
                ref={starsTrackRef}
                style={styles.starsTrack}
                {...(Platform.OS === 'web' ? { 'data-stars-track': true } : {})}
                onLayout={(event) => {
                  setStarsWidth(event.nativeEvent.layout.width);
                  measureTrack();
                }}
                {...panResponder.panHandlers}
              >
                {Array.from({ length: 10 }, (_, idx) => idx + 1).map((index) => (
                  <View key={index} style={styles.starSlot}>
                    <MaterialIcons name={iconNameFor(value, index)} size={20} color="#F59E0B" />
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.datesBlock}>
            {dateMode === 'single' && status === 'completed' ? (
              <CalendarInput
                label="Fecha visualización"
                value={watchedAt}
                onChange={onChangeWatchedAt ?? (() => undefined)}
                approximate={watchedAtApproximate}
                onChangeApproximate={onChangeWatchedAtApproximate}
                placeholder="Seleccionar"
                tone="premium"
              />
            ) : dateMode === 'single' ? (
              <Text style={[styles.dateHintText, { color: palette.subtext }]}>
                Cambia el estado a Completado para añadir fecha.
              </Text>
            ) : showRangeDates ? (
              <CalendarInput
                label="Periodo (inicio y fin)"
                value=""
                onChange={() => undefined}
                mode="range"
                rangeStart={startedAt}
                rangeEnd={finishedAt}
                onChangeRange={(start, end) => {
                  onChangeStartedAt(start);
                  onChangeFinishedAt(end);
                }}
                onChangeApproximateRange={(startApprox, endApprox) => {
                  onChangeStartedAtApproximate?.(startApprox);
                  onChangeFinishedAtApproximate?.(endApprox);
                }}
                placeholder="Seleccionar rango"
                tone="premium"
              />
            ) : showStartOnlyDate ? (
              <CalendarInput
                label="Fecha inicio"
                value={startedAt}
                onChange={onChangeStartedAt}
                approximate={startedAtApproximate}
                onChangeApproximate={onChangeStartedAtApproximate}
                placeholder="Seleccionar"
                tone="premium"
              />
            ) : (
              <Text style={[styles.dateHintText, { color: palette.subtext }]}>
                Cambia el estado a Viendo/Jugando o Completado para añadir fechas.
              </Text>
            )}
          </View>

          {hasInvalidRange ? (
            <Text style={[styles.rangeError, { color: palette.danger }]}>
              La fecha de fin no puede ser anterior a la fecha de inicio.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: palette.surface }]}
              onPress={onCancel}
              activeOpacity={0.85}
            >
              <Text style={[styles.cancelText, { color: palette.subtext }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: palette.brand },
                hasInvalidRange && styles.confirmButtonDisabled,
              ]}
              onPress={() => {
                onConfirm();
                if (onConfirmAndGoBack) {
                  setTimeout(() => {
                    onConfirmAndGoBack();
                  }, 100);
                }
              }}
              disabled={hasInvalidRange}
              activeOpacity={0.85}
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
    backgroundColor: 'rgba(5, 8, 12, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : null),
  },
  sheet: {
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statusBlock: {
    marginTop: 16,
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentedOption: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ratingBlock: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  starsRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  starsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 340,
    gap: 2,
  },
  starSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datesBlock: {
    marginTop: 16,
  },
  dateHintText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 4,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  rangeError: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export { RatingPickerModal };
export default RatingPickerModal;
