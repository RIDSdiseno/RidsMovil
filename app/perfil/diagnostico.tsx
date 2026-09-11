import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { Screen } from '@/src/components/Screen';
import { colors, shadow } from '@/src/theme/colors';
import { isWithinDailyTrackingWindow } from '@/src/visitas/daily-tracking-window';
import {
  checkAgendaLocationPermissions,
  isAgendaLocationTrackingActive,
} from '@/src/visitas/location-tracking';
import {
  inspectQueueHealth,
  OfflineLocationQueueHealth,
} from '@/src/visitas/offline-location-queue';
import { BACKGROUND_LOCATION_SUPPORTED } from '@/src/visitas/tracking-mode';
import {
  clearTrackingLog,
  formatTrackingLog,
  getTrackingLog,
  TrackingEvent,
} from '@/src/visitas/tracking-log';

// Pantalla de diagnóstico del tracking. Existe para la ronda de validación en
// TestFlight: el técnico no puede describir qué pasó mientras la app estaba en
// segundo plano, así que esta pantalla le permite mandar el detalle exacto.

type Estado = {
  activo: boolean;
  agendaId: number | null;
  inconsistencia: string | null;
  permisos: string;
  modo: string;
  degradado: boolean;
  cola: OfflineLocationQueueHealth | null;
};

export default function DiagnosticoScreen() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [eventos, setEventos] = useState<TrackingEvent[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [tracking, permisos, cola, log] = await Promise.all([
        isAgendaLocationTrackingActive(),
        checkAgendaLocationPermissions(),
        inspectQueueHealth(),
        getTrackingLog(),
      ]);

      // El modo efectivo depende del permiso concedido, no solo del binario:
      // con "Al usar la app" la captura queda limitada a primer plano.
      const soloPrimerPlano = permisos.granted && permisos.modo === 'foreground';

      setEstado({
        activo: tracking.active,
        agendaId: tracking.context?.agendaId ?? null,
        inconsistencia: tracking.inconsistency,
        permisos: permisos.granted
          ? soloPrimerPlano
            ? 'Solo "Al usar la app"'
            : 'Siempre'
          : `Faltan (${permisos.reason})`,
        modo: !BACKGROUND_LOCATION_SUPPORTED
          ? 'Expo Go (solo primer plano)'
          : soloPrimerPlano
            ? 'Solo primer plano'
            : 'Segundo plano',
        degradado: soloPrimerPlano,
        cola,
      });
      setEventos(log);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function compartir() {
    const encabezado = [
      `Modo: ${estado?.modo ?? '—'}`,
      `Tracking activo: ${estado?.activo ? 'sí' : 'no'}`,
      `Contexto: ${estado?.agendaId === null ? 'jornada' : `agenda ${estado?.agendaId}`}`,
      `Inconsistencia: ${estado?.inconsistencia ?? 'ninguna'}`,
      `Permisos: ${estado?.permisos ?? '—'}`,
      `Dentro de jornada: ${isWithinDailyTrackingWindow() ? 'sí' : 'no'}`,
      `Cola pendiente: ${estado?.cola?.pendingCount ?? 0}`,
      `Punto más antiguo: ${estado?.cola?.oldestCapturedAt ?? '—'}`,
      `Último error de cola: ${estado?.cola?.lastError ?? 'ninguno'}`,
      `Descartados: ${estado?.cola?.discardedCount ?? 0}`,
      '',
      '--- Bitácora ---',
    ].join('\n');

    await Share.share({ message: `${encabezado}\n${formatTrackingLog(eventos)}` });
  }

  function limpiar() {
    Alert.alert('Borrar bitácora', '¿Borrar los eventos registrados en este teléfono?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await clearTrackingLog();
          await cargar();
        },
      },
    ]);
  }

  return (
    <Screen onRefresh={cargar} refreshing={cargando}>
      <Text style={styles.title}>Diagnóstico de ubicación</Text>
      <Text style={styles.subtitle}>
        Estado del seguimiento y bitácora local. Compártela si algo no funcionó.
      </Text>

      <View style={styles.card}>
        <Fila etiqueta="Modo" valor={estado?.modo ?? '—'} destacar={estado?.degradado} />
        <Fila etiqueta="Tracking activo" valor={estado?.activo ? 'Sí' : 'No'} destacar={!estado?.activo} />
        <Fila
          etiqueta="Contexto"
          valor={estado?.agendaId === null ? 'Jornada laboral' : `Agenda ${estado?.agendaId}`}
        />
        <Fila etiqueta="Permisos" valor={estado?.permisos ?? '—'} destacar={estado?.permisos?.startsWith('Faltan')} />
        <Fila etiqueta="Dentro de jornada" valor={isWithinDailyTrackingWindow() ? 'Sí' : 'No'} />
        {estado?.inconsistencia ? (
          <Fila etiqueta="Inconsistencia" valor={estado.inconsistencia} destacar />
        ) : null}
      </View>

      <Text style={styles.section}>Cola de envío</Text>
      <View style={styles.card}>
        <Fila etiqueta="Pendientes" valor={String(estado?.cola?.pendingCount ?? 0)} />
        <Fila etiqueta="Más antiguo" valor={formatFecha(estado?.cola?.oldestCapturedAt)} />
        <Fila etiqueta="Último error" valor={estado?.cola?.lastError ?? 'Ninguno'} destacar={Boolean(estado?.cola?.lastError)} />
        <Fila etiqueta="Descartados" valor={String(estado?.cola?.discardedCount ?? 0)} />
        <Fila etiqueta="Sin técnico" valor={String(estado?.cola?.inconsistentOwnerCount ?? 0)} destacar={Boolean(estado?.cola?.inconsistentOwnerCount)} />
      </View>

      <Text style={styles.section}>Bitácora ({eventos.length})</Text>
      <View style={styles.card}>
        {eventos.length === 0 ? (
          <Text style={styles.vacio}>Sin eventos registrados todavía.</Text>
        ) : (
          eventos.slice(0, 40).map((evento, index) => (
            <View key={`${evento.at}-${index}`} style={styles.evento}>
              <Ionicons color={colorEvento(evento)} name={iconoEvento(evento)} size={16} />
              <View style={styles.eventoTexto}>
                <Text style={styles.eventoTitulo}>
                  {evento.evento} · {evento.agendaId === null ? 'jornada' : `agenda ${evento.agendaId}`}
                </Text>
                <Text style={styles.eventoDetalle}>
                  {formatFecha(evento.at)}
                  {evento.detalle ? ` — ${evento.detalle}` : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.acciones}>
        <AppButton onPress={compartir} title="Compartir diagnóstico" />
        <AppButton onPress={limpiar} title="Borrar bitácora" variant="secondary" />
      </View>
    </Screen>
  );
}

function Fila({ etiqueta, valor, destacar }: { etiqueta: string; valor: string; destacar?: boolean }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.filaValor, destacar && styles.filaValorAlerta]}>{valor}</Text>
    </View>
  );
}

function formatFecha(valor?: string | null) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
}

function iconoEvento(evento: TrackingEvent): keyof typeof Ionicons.glyphMap {
  if (evento.evento === 'start') return 'play-circle-outline';
  if (evento.evento === 'stop') return 'stop-circle-outline';
  if (evento.evento === 'start-error' || evento.evento === 'permiso') return 'alert-circle-outline';
  if (evento.evento === 'flush') return 'cloud-upload-outline';
  return 'sync-outline';
}

function colorEvento(evento: TrackingEvent) {
  if (evento.evento === 'start-error' || evento.evento === 'permiso') return '#c0392b';
  return colors.brand;
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 20,
    marginTop: 6,
  },
  section: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    gap: 7,
    padding: 12,
    ...shadow,
  },
  fila: {
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'space-between',
  },
  filaEtiqueta: {
    color: colors.muted,
    fontSize: 12,
  },
  filaValor: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  filaValorAlerta: {
    color: '#c0392b',
  },
  evento: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  eventoTexto: {
    flex: 1,
  },
  eventoTitulo: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  eventoDetalle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  vacio: {
    color: colors.muted,
    fontSize: 14,
  },
  acciones: {
    gap: 12,
    marginTop: 22,
  },
});
