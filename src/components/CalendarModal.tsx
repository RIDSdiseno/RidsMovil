import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toIsoDate(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function parseIsoDate(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month: month - 1, day };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

type CalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (isoDate: string) => void;
  value?: string;
  title?: string;
};

export function CalendarModal({ visible, onClose, onSelect, value, title }: CalendarModalProps) {
  const seleccionInicial = parseIsoDate(value);
  const [cursor, setCursor] = useState({ year: seleccionInicial.year, month: seleccionInicial.month });

  const dias = useMemo(() => {
    const primerDiaMes = new Date(cursor.year, cursor.month, 1).getDay();
    const offset = (primerDiaMes + 6) % 7;
    const totalDias = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const celdas: (number | null)[] = Array.from({ length: offset }, () => null);
    for (let dia = 1; dia <= totalDias; dia += 1) celdas.push(dia);
    return celdas;
  }, [cursor]);

  const isoSeleccionado = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

  function cambiarMes(delta: number) {
    setCursor((current) => {
      const fecha = new Date(current.year, current.month + delta, 1);
      return { year: fecha.getFullYear(), month: fecha.getMonth() };
    });
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.overlay}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          {title ? <Text style={styles.title}>{title}</Text> : null}

          <View style={styles.header}>
            <Pressable hitSlop={10} onPress={() => cambiarMes(-1)}>
              <Ionicons color={colors.brand} name="chevron-back" size={22} />
            </Pressable>
            <Text style={styles.headerText}>{MESES[cursor.month]} {cursor.year}</Text>
            <Pressable hitSlop={10} onPress={() => cambiarMes(1)}>
              <Ionicons color={colors.brand} name="chevron-forward" size={22} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {DIAS_SEMANA.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekDay}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {dias.map((dia, index) => {
              if (dia == null) return <View key={`empty-${index}`} style={styles.cell} />;
              const iso = toIsoDate(cursor.year, cursor.month, dia);
              const seleccionado = iso === isoSeleccionado;
              return (
                <Pressable
                  key={iso}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                  style={[styles.cell, styles.dayCell, seleccionado && styles.dayCellSelected]}>
                  <Text style={[styles.dayText, seleccionado && styles.dayTextSelected]}>{dia}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            {isoSeleccionado ? (
              <Pressable
                onPress={() => {
                  onSelect('');
                  onClose();
                }}
                style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Quitar fecha</Text>
              </Pressable>
            ) : <View />}
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    width: '100%',
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekDay: {
    color: colors.muted,
    flexBasis: `${100 / 7}%`,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    alignItems: 'center',
    flexBasis: `${100 / 7}%`,
    height: 38,
    justifyContent: 'center',
  },
  dayCell: {
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: colors.brand,
  },
  dayText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  clearButton: {
    paddingVertical: 6,
  },
  clearButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  closeButton: {
    paddingVertical: 6,
  },
  closeButtonText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
  },
});
