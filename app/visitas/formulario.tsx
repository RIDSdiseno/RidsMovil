import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import {
  cancelarVisita,
  completarVisita,
  crearVisita,
  finalizarVisitaAsignada,
  getVisitaAsignadaPorAgenda,
} from '@/src/api/rids';
import { useAuth } from '@/src/auth/AuthContext';
import { AppButton } from '@/src/components/AppButton';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { RidsSectionTitle } from '@/src/components/RidsSectionTitle';
import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { ActividadesVisita } from '@/src/types/api';
import {
  clearVisitaState,
  defaultActividades,
  loadVisitaState,
  saveVisitaState,
  VisitaEnCursoState,
} from '@/src/visitas/visita-state';
import {
  flushPendingLocationsForCurrentSession,
  getPendingLocationCount,
} from '@/src/visitas/offline-location-queue';
import { formatCoords } from '@/src/visitas/visita-utils';

type ActivityItem = {
  key: keyof ActividadesVisita;
  label: string;
};

const activityItems: ActivityItem[] = [
  { key: 'ccleaner', label: 'CCleaner' },
  { key: 'actualizaciones', label: 'Actualizaciones' },
  { key: 'antivirus', label: 'Antivirus' },
  { key: 'estadoDisco', label: 'Estado del Disco' },
  { key: 'licenciaWindows', label: 'Licencia Windows' },
  { key: 'licenciaOffice', label: 'Licencia Office' },
  { key: 'rendimientoEquipo', label: 'Rendimiento del equipo' },
  { key: 'mantenimientoReloj', label: 'Mantenimiento de reloj' },
  { key: 'ecografo', label: 'Ecografo' },
];

const configurationItems: ActivityItem[] = [
  { key: 'impresoras', label: 'Impresoras' },
  { key: 'telefonos', label: 'Telefonos' },
  { key: 'pie', label: 'Pie de Firma' },
  { key: 'otros', label: 'Otros' },
];

export default function FormularioVisitaScreen() {
  const { tecnico } = useAuth();
  const [visitaState, setVisitaState] = useState<VisitaEnCursoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function boot() {
      await loadScreen();
    }

    boot();
  }, []);

  async function loadScreen() {
    const saved = await loadVisitaState();
    if (!saved.empresaId) {
      router.replace('/(tabs)/visitas');
      return;
    }

    setVisitaState(saved);
    setLoading(false);
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await loadScreen();
    } finally {
      setRefreshing(false);
    }
  }

  async function updateState(updates: Partial<VisitaEnCursoState>) {
    if (!visitaState) return;
    const nextState = { ...visitaState, ...updates };
    setVisitaState(nextState);
    await saveVisitaState(nextState);
  }

  async function toggleActividad(key: keyof ActividadesVisita) {
    if (!visitaState) return;
    await updateState({
      actividades: {
        ...visitaState.actividades,
        [key]: !visitaState.actividades[key],
      },
    });
  }

  async function obtenerUbicacion() {
    if (!visitaState) return;

    try {
      setLoadingLocation(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Ubicacion', 'Activa los permisos de ubicacion para registrar la visita.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = position.coords;
      const direccion = await getDireccionAproximada(latitude, longitude);

      await updateState({
        coordenadas: { lat: latitude, lon: longitude },
        direccionVisita: direccion,
      });
    } catch (error) {
      Alert.alert('Ubicacion', error instanceof Error ? error.message : 'No se pudo obtener la ubicacion.');
    } finally {
      setLoadingLocation(false);
    }
  }

  async function getDireccionAproximada(lat: number, lon: number) {
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const parts = [place?.street, place?.streetNumber, place?.district, place?.city, place?.region]
        .filter(Boolean)
        .join(', ');
      return parts || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  }

  function validate() {
    if (!visitaState) return false;

    if (!formatCoords(visitaState.coordenadas.lat, visitaState.coordenadas.lon)) {
      Alert.alert('Visita', 'Obtiene la ubicacion antes de guardar.');
      return false;
    }

    if (!visitaState.solicitantes.length) {
      Alert.alert('Visita', 'Selecciona al menos un solicitante.');
      return false;
    }

    if (visitaState.actividades.otros && !visitaState.otrosDetalle.trim()) {
      Alert.alert('Visita', 'Describe el detalle de otros trabajos realizados.');
      return false;
    }

    return true;
  }

  async function crearYGuardarVisita() {
    if (submitting || !visitaState) return;

    if (visitaState.agendaCierrePendiente && visitaState.agendaId && visitaState.origen === 'AGENDA') {
      await reintentarCierreAgenda(visitaState);
      return;
    }

    if (!validate()) return;

    const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id;
    if (!tecnicoId) {
      Alert.alert('Sesion', 'No se encontro el tecnico autenticado. Inicia sesion nuevamente.');
      return;
    }

    const actividades = { ...defaultActividades, ...visitaState.actividades };
    const direccionVisita = formatCoords(visitaState.coordenadas.lat, visitaState.coordenadas.lon);

    try {
      setSubmitting(true);
      let pendingLocationsAfterClose = 0;
      let visitaId = visitaState.visitaId;
      const isAgendaVisit = typeof visitaState.agendaId === 'number' && visitaState.origen === 'AGENDA';
      let shouldCompleteForm = !visitaState.agendaCierrePendiente;

      if (!visitaId) {
        if (isAgendaVisit && visitaState.agendaId) {
          const existingResponse = await getVisitaAsignadaPorAgenda(visitaState.agendaId);
          visitaId = existingResponse.visita?.id_visita ?? null;
          if (String(existingResponse.visita?.status ?? '').toUpperCase() === 'COMPLETADA') {
            shouldCompleteForm = false;
          }
        }
      }

      if (!visitaId) {
        const response = await crearVisita({
          empresaId: visitaState.empresaId!,
          inicio: visitaState.inicio ?? undefined,
          tecnicoId,
          sucursalId: visitaState.sucursalId,
          solicitante: visitaState.solicitantes,
          latitud: visitaState.coordenadas.lat,
          longitud: visitaState.coordenadas.lon,
          agendaId: isAgendaVisit ? visitaState.agendaId : null,
        });
        visitaId = response.visita.id_visita;
        if (String(response.visita.status ?? '').toUpperCase() === 'COMPLETADA') {
          shouldCompleteForm = false;
        }
        const nextState: VisitaEnCursoState = {
          ...visitaState,
          visitaId,
          origen: isAgendaVisit ? 'AGENDA' : visitaState.origen ?? 'MANUAL',
        };
        setVisitaState(nextState);
        await saveVisitaState(nextState);
        shouldCompleteForm = true;
      } else if (visitaId !== visitaState.visitaId) {
        const nextState: VisitaEnCursoState = {
          ...visitaState,
          visitaId,
          origen: isAgendaVisit ? 'AGENDA' : visitaState.origen ?? 'MANUAL',
        };
        setVisitaState(nextState);
        await saveVisitaState(nextState);
      }

      if (shouldCompleteForm) {
        await completarVisita(visitaId, {
          confImpresoras: actividades.impresoras,
          confTelefonos: actividades.telefonos,
          confPiePagina: actividades.pie,
          otros: actividades.otros,
          ccleaner: actividades.ccleaner,
          actualizaciones: actividades.actualizaciones,
          antivirus: actividades.antivirus,
          estadoDisco: actividades.estadoDisco,
          licenciaWindows: actividades.licenciaWindows,
          licenciaOffice: actividades.licenciaOffice,
          rendimientoEquipo: actividades.rendimientoEquipo,
          mantenimientoReloj: actividades.mantenimientoReloj,
          ecografo: actividades.ecografo,
          otrosDetalle: visitaState.otrosDetalle.trim(),
          realizado: visitaState.otrosDetalle.trim(),
          solicitantes: visitaState.solicitantes,
          direccion_visita: direccionVisita,
          sucursalId: visitaState.sucursalId,
        });
      }

      if (isAgendaVisit && visitaState.agendaId) {
        await confirmarVisitaCompletada(visitaState.agendaId, visitaId);

        const pendingState: VisitaEnCursoState = {
          ...visitaState,
          visitaId,
          agendaCierrePendiente: true,
          origen: 'AGENDA',
        };
        setVisitaState(pendingState);
        await saveVisitaState(pendingState);

        const agendaResponse = await finalizarVisitaAsignada(visitaState.agendaId);
        confirmarAgendaCompletada(agendaResponse.visita.estado);
        // La ubicación ya no se detiene al guardar la visita: se comparte
        // durante toda la jornada laboral (08:00-18:30), independiente de
        // esta visita puntual.
        pendingLocationsAfterClose = await flushUbicacionesAntesDeCerrar(tecnicoId);
      }

      await clearVisitaState();
      router.replace('/(tabs)');
      Alert.alert(
        'Visita',
        pendingLocationsAfterClose > 0
          ? `Visita guardada correctamente. Quedaron ${pendingLocationsAfterClose} ubicaciones pendientes que se reintentarán automáticamente.`
          : 'Visita guardada correctamente.',
      );
    } catch (error) {
      const isAgendaVisit = typeof visitaState.agendaId === 'number' && visitaState.origen === 'AGENDA';
      const message = error instanceof Error ? error.message : 'No se pudo guardar la visita.';
      Alert.alert(
        isAgendaVisit ? 'Visita pendiente' : 'Visita',
        isAgendaVisit ? `${message} La ubicación continuará activa para que puedas reintentar.` : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function reintentarCierreAgenda(state: VisitaEnCursoState) {
    if (!state.agendaId || !state.visitaId || state.origen !== 'AGENDA') {
      Alert.alert('Agenda', 'No hay una agenda pendiente valida para sincronizar.');
      return;
    }

    try {
      setSubmitting(true);
      const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;
      await confirmarVisitaCompletada(state.agendaId, state.visitaId);
      const agendaResponse = await finalizarVisitaAsignada(state.agendaId);
      confirmarAgendaCompletada(agendaResponse.visita.estado);
      const pendingLocationsAfterClose = await flushUbicacionesAntesDeCerrar(tecnicoId);
      await clearVisitaState();
      router.replace('/(tabs)');
      Alert.alert(
        'Visita',
        pendingLocationsAfterClose > 0
          ? `Visita guardada correctamente. Quedaron ${pendingLocationsAfterClose} ubicaciones pendientes que se reintentarán automáticamente.`
          : 'Visita guardada correctamente.',
      );
    } catch (error) {
      const pendingState: VisitaEnCursoState = {
        ...state,
        agendaCierrePendiente: true,
        origen: 'AGENDA',
      };
      setVisitaState(pendingState);
      await saveVisitaState(pendingState);
      Alert.alert(
        'Agenda',
        `${error instanceof Error
          ? error.message
          : 'La visita fue guardada, pero no se pudo cerrar la agenda. Intenta sincronizar nuevamente.'} La ubicación continuará activa.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function flushUbicacionesAntesDeCerrar(tecnicoId: number | null) {
    if (!tecnicoId) return 0;

    try {
      const result = await flushPendingLocationsForCurrentSession(tecnicoId, {
        maxPoints: 50,
        timeoutMs: 25_000,
      });
      return result.pendingCount;
    } catch {
      return getPendingLocationCount(tecnicoId).catch(() => 0);
    }
  }

  function confirmarCancelarVisita() {
    const isAgendaVisit = typeof visitaState?.agendaId === 'number' && visitaState.origen === 'AGENDA';

    if (isAgendaVisit) {
      Alert.alert(
        'Salir del formulario',
        'La visita seguirá iniciada y podrás continuarla más tarde.',
        [
          { text: 'Seguir aquí', style: 'cancel' },
          { text: 'Salir', onPress: () => router.replace('/agenda') },
        ],
      );
      return;
    }

    Alert.alert('Cancelar visita', 'Se eliminara el estado actual de esta visita.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar visita',
        style: 'destructive',
        onPress: async () => {
          try {
            if (visitaState?.visitaId) {
              await cancelarVisita(visitaState.visitaId);
            }
            await clearVisitaState();
            router.replace('/(tabs)');
          } catch (error) {
            Alert.alert('Cancelar visita', error instanceof Error ? error.message : 'No se pudo cancelar la visita en el servidor.');
          }
        },
      },
    ]);
  }

  if (loading || !visitaState) {
    return (
      <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const hasLocation = Boolean(formatCoords(visitaState.coordenadas.lat, visitaState.coordenadas.lon));

  return (
    <Screen bottomNavigation={<BottomNavigation />} onRefresh={refreshScreen} refreshing={refreshing}>
      <RidsFlowHeader
        icon="clipboard-outline"
        label="FORMULARIO DE VISITA"
        subtitle="Completa las actividades realizadas"
        title={visitaState.empresaNombre || 'Visita técnica'}
      />

      <Pressable
        onPress={() => router.replace('/visitas/solicitantes')}
        style={({ pressed }) => [styles.summaryCard, pressed && styles.cardPressed]}>
        <View style={styles.summaryIcon}>
          <Ionicons color={ridsPalette.cyanDark} name="people-outline" size={23} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{visitaState.solicitantes.length} solicitante(s)</Text>
          <Text style={styles.summaryText}>{visitaState.solicitantes.map((s) => s.nombre).join(', ')}</Text>
        </View>
        <Ionicons color="#B7C0CE" name="chevron-forward" size={18} />
      </Pressable>

      <Section title="Ubicacion">
        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <Ionicons color={ridsPalette.cyanDark} name={hasLocation ? 'location' : 'location-outline'} size={23} />
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationTitle}>{hasLocation ? 'Ubicacion registrada' : 'Sin ubicacion'}</Text>
            <Text style={styles.locationText}>
              {visitaState.direccionVisita || 'Obtiene la ubicacion actual antes de guardar la visita.'}
            </Text>
          </View>
        </View>
        <AppButton
          loading={loadingLocation}
          onPress={obtenerUbicacion}
          title={hasLocation ? 'Actualizar ubicacion' : 'Obtener ubicacion'}
          variant="secondary"
        />
      </Section>

      <Section title="Actividades">
        <View style={styles.activities}>
          {activityItems.map((item) => (
            <Pressable key={item.key} onPress={() => toggleActividad(item.key)} style={styles.activityPill}>
              <View style={[styles.checkbox, visitaState.actividades[item.key] && styles.checkboxActive]}>
                {visitaState.actividades[item.key] ? (
                  <Ionicons color={colors.white} name="checkmark" size={14} />
                ) : null}
              </View>
              <Text style={styles.activityText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="Configuraciones">
        <View style={styles.activities}>
          {configurationItems.map((item) => (
            <Pressable key={item.key} onPress={() => toggleActividad(item.key)} style={styles.activityPill}>
              <View style={[styles.checkbox, visitaState.actividades[item.key] && styles.checkboxActive]}>
                {visitaState.actividades[item.key] ? (
                  <Ionicons color={colors.white} name="checkmark" size={14} />
                ) : null}
              </View>
              <Text style={styles.activityText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {visitaState.actividades.otros ? (
          <TextInput
            multiline
            onChangeText={(value) => updateState({ otrosDetalle: value })}
            placeholder="Detalle de otros trabajos"
            placeholderTextColor="#98A2B3"
            style={[styles.input, styles.textarea]}
            value={visitaState.otrosDetalle}
          />
        ) : null}
      </Section>

      <View style={styles.actions}>
        <AppButton disabled={submitting} loading={submitting} onPress={crearYGuardarVisita} title="Guardar visita" />
        <AppButton
          disabled={submitting}
          onPress={confirmarCancelarVisita}
          style={styles.cancelButton}
          textStyle={styles.cancelButtonText}
          title={visitaState.origen === 'AGENDA' ? 'Salir del formulario' : 'Cancelar visita'}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

async function confirmarVisitaCompletada(agendaId: number, visitaId: number) {
  const response = await getVisitaAsignadaPorAgenda(agendaId);
  if (!response.visita || response.visita.id_visita !== visitaId) {
    throw new Error('No se pudo confirmar la visita vinculada a la agenda. Intenta guardar nuevamente.');
  }

  if (String(response.visita.status ?? '').toUpperCase() !== 'COMPLETADA') {
    throw new Error('La visita todavía no figura como completada. Intenta guardar nuevamente.');
  }
}

function confirmarAgendaCompletada(estado: string) {
  if (String(estado ?? '').toUpperCase() !== 'COMPLETADA') {
    throw new Error('La agenda todavía no figura como completada. Intenta sincronizar nuevamente.');
  }
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <RidsSectionTitle title={title} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    padding: 11,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  summaryText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  locationCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 9,
    padding: 10,
  },
  locationIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  locationCopy: {
    flex: 1,
  },
  locationTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  locationText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  activities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  activityPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkboxActive: {
    backgroundColor: ridsPalette.cyanDark,
    borderColor: ridsPalette.cyanDark,
  },
  activityText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actions: {
    gap: 10,
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
  },
  cancelButtonText: {
    color: '#DC2626',
  },
});
