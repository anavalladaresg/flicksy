import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CalendarInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function parseDate(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toHumanDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function CalendarInput({ label, value, onChange, placeholder = 'Seleccionar fecha' }: CalendarInputProps) {
  const isDark = useColorScheme() === 'dark';
  const [open, setOpen] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const initial = parseDate(value);
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const selected = value ? parseDate(value) : null;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const offset = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= last.getDate(); day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const cellSize = useMemo(() => {
    if (!gridWidth) return 36;
    return Math.min(38, Math.floor(gridWidth / 7));
  }, [gridWidth]);

  function onGridLayout(event: LayoutChangeEvent) {
    setGridWidth(event.nativeEvent.layout.width);
  }

  return (
    <View>
      <Text style={[styles.label, { color: isDark ? '#CBD5E1' : '#334155' }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.inputLike,
          {
            borderColor: isDark ? '#334155' : '#CBD5E1',
            backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
          },
        ]}
        onPress={() => setOpen(true)}
      >
        <MaterialIcons name="calendar-today" size={16} color={isDark ? '#94A3B8' : '#475569'} />
        <Text style={[styles.inputText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{toHumanDate(value) || placeholder}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))}>
                <MaterialIcons name="chevron-left" size={22} color={isDark ? '#E5E7EB' : '#0F172A'} />
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))}>
                <MaterialIcons name="chevron-right" size={22} color={isDark ? '#E5E7EB' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={[styles.weekday, { color: isDark ? '#94A3B8' : '#64748B' }]}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid} onLayout={onGridLayout}>
              {days.map((date, idx) => {
                if (!date) return <View key={`empty-${idx}`} style={styles.dayCell} />;
                const selectedMatch =
                  selected &&
                  date.getFullYear() === selected.getFullYear() &&
                  date.getMonth() === selected.getMonth() &&
                  date.getDate() === selected.getDate();
                return (
                  <TouchableOpacity
                    key={toDateString(date)}
                    style={[
                      styles.dayCell,
                      { width: cellSize, height: cellSize },
                    ]}
                    onPress={() => {
                      onChange(toDateString(date));
                      setOpen(false);
                    }}
                  >
                    <View style={[styles.dayInner, selectedMatch && styles.dayInnerSelected]}>
                      <Text style={[styles.dayText, { color: isDark ? '#E5E7EB' : '#0F172A' }, selectedMatch && styles.dayTextSelected]}>
                        {date.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onChange('')}>
                <Text style={[styles.actionText, { color: isDark ? '#93C5FD' : '#0369A1' }]}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={[styles.actionText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputLike: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputText: {
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    maxWidth: 38 * 7,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInnerSelected: {
    backgroundColor: '#0E7490',
  },
  dayText: {
    fontSize: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export { CalendarInput };
export default CalendarInput;
