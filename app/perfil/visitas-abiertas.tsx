import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  cancelarVisita,
  getVisitasPendientesCache,
  getVisitasPendientesCached,
  invalidarVisitasPendientesCache,
} from '@/src/api/rids';
import { useAuth } from '@/src/auth/AuthContext';
import { Screen } from '@/src/components/Screen';
import { SwipeToCancelCard } from '@/src/components/SwipeToCancelCard';
import { colors, shadow } from '@/src/theme/colors';
import { VisitaPendiente } from '@/src/types/api';
import { startVisitForEmpresa } from '@/src/visitas/start-visit-flow';

// Visitas que quedaron abiertas en el servidor sin rastro en el teléfono: una
// sesión vencida, un cambio de equipo o un fallo al guardar el avance las
// dejaba sin forma de retomarse ni cerrarse. Se tocan para continuarlas y se
// deslizan para cancelarlas, el mismo gesto de la tarjeta de estado actual.

const POR_PAGINA = 20;

export default function VisitasAbiertasScreen() {
  const { tecnico } = useAuth();
  const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;
  // Primera página desde la caché: la pantalla pinta de inmediato al volver a
  // entrar, igual que los otros accesos del perfil.
  const cacheInicial = tecnicoId ? getVisitasPendientesCache(tecnicoId, 1, POR_PAGINA) : null;
  const [visitas, setVisitas] = useState<VisitaPendiente[]>(cacheInicial?.visitas ?? []);
  const [total, setTotal] = useState(cacheInicial?.total ?? 0);
  const [hasMore, setHasMore] = useState(cacheInicial?.hasMore ?? false);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(!cacheInicial);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [procesando, setProcesando] = useState<number | null>(null);

  const cargar = useCallback(async (force = false) => {
    if (!tecnicoId) {
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      const response = await getVisitasPendientesCached(tecnicoId, 1, POR_PAGINA, force);
      setVisitas(response.visitas ?? []);
      setTotal(response.total ?? 0);
      setHasMore(Boolean(response.hasMore));
      setPagina(1);
    } catch (error) {
      Alert.alert('Visitas abiertas', error instanceof Error ? error.message : 'No se pudieron cargar.');
    } finally {
      setCargando(false);
    }
  }, [tecnicoId]);

  const cargarMas = useCallback(async () => {
    if (!tecnicoId || cargandoMas || !hasMore) return;

    try {
      setCargandoMas(true);
      const siguiente = pagina + 1;
      const response = await getVisitasPendientesCached(tecnicoId, siguiente, POR_PAGINA);
      // Se filtra por id porque entre páginas puede cancelarse una visita y
      // correr el resto, lo que dejaría duplicados en la lista acumulada.
      setVisitas((actuales) => {
        const vistos = new Set(actuales.map((item) => item.id_visita));
        return [...actuales, ...(response.visitas ?? []).filter((item) => !vistos.has(item.id_visita))];
      });
      setTotal(response.total ?? 0);
      setHasMore(Boolean(response.hasMore));
      setPagina(siguiente);
    } catch (error) {
      Alert.alert('Visitas abiertas', error instanceof Error ? error.message : 'No se pudieron cargar más.');
    } finally {
      setCargandoMas(false);
    }
  }, [cargandoMas, hasMore, pagina, tecnicoId]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  async function retomar(visita: VisitaPendiente) {
    if (procesando) return;

    if (!visita.empresa?.id_empresa) {
      Alert.alert('Visita', 'Esta visita no tiene una empresa registrada y no puede retomarse desde la app.');
      return;
    }

    try {
      setProcesando(visita.id_visita);
      await startVisitForEmpresa({
        visitaIdExistente: visita.id_visita,
        empresaId: visita.empresa.id_empresa,
        empresaNombre: visita.empresa.nombre,
        empresaRazonSocial: visita.empresa.razonSocial,
        tecnicoId: tecnico?.id_tecnico ?? tecnico?.id ?? null,
        agendaId: visita.agendaId,
        agendaEstado: visita.agendaEstado,
        agendaHoraInicio: visita.agendaHoraInicio,
        direccion: visita.direccion_visita,
        sucursalId: visita.sucursalId,
      });
    } catch (error) {
      Alert.alert('Visita', error instanceof Error ? error.message : 'No se pudo retomar la visita.');
    } finally {
      setProcesando(null);
    }
  }

  function pedirCancelacion(visita: VisitaPendiente) {
    if (procesando) return;

    Alert.alert(
      'Cancelar visita',
      `Se cancelará la visita de ${visita.empresa?.nombre ?? 'esta empresa'} iniciada el ${formatFecha(visita.inicio)}. Queda registrada como cancelada y no se puede deshacer.`,
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Cancelar visita',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcesando(visita.id_visita);
              await cancelarVisita(visita.id_visita);
              invalidarVisitasPendientesCache();
              setVisitas((actuales) => actuales.filter((item) => item.id_visita !== visita.id_visita));
              setTotal((actual) => Math.max(0, actual - 1));
            } catch (error) {
              Alert.alert('Visita', error instanceof Error ? error.message : 'No se pudo cancelar.');
            } finally {
              setProcesando(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen onRefresh={() => cargar(true)} refreshing={cargando}>
      <Text style={styles.title}>Visitas abiertas</Text>
      <Text style={styles.subtitle}>
        Visitas que quedaron sin cerrar. Tócalas para completarlas o deslízalas hacia la derecha para cancelarlas.
      </Text>

      {total > 0 ? (
        <Text style={styles.conteo}>
          {visitas.length} de {total} visita{total === 1 ? '' : 's'} abierta{total === 1 ? '' : 's'}
        </Text>
      ) : null}

      {cargando && visitas.length === 0 ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : visitas.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons color={colors.brand} name="checkmark-circle-outline" size={44} />
          <Text style={styles.vacioTitulo}>No tienes visitas abiertas</Text>
          <Text style={styles.vacioTexto}>Todas tus visitas están completadas o canceladas.</Text>
        </View>
      ) : (
        <View style={styles.lista}>
          {visitas.map((visita) => (
            <SwipeToCancelCard
              disabled={procesando !== null}
              key={visita.id_visita}
              onCancelRequest={() => pedirCancelacion(visita)}
              onPress={() => void retomar(visita)}>
              <View style={styles.card}>
                <View style={styles.icono}>
                  <Ionicons color={colors.brand} name="clipboard-outline" size={22} />
                </View>
                <View style={styles.texto}>
                  <Text numberOfLines={2} style={styles.empresa}>
                    {visita.empresa?.nombre ?? 'Empresa no registrada'}
                  </Text>
                  <Text style={styles.detalle}>Iniciada el {formatFecha(visita.inicio)}</Text>
                  <View style={styles.etiquetaFila}>
                    <View style={styles.etiqueta}>
                      <Text style={styles.etiquetaTexto}>
                        {visita.origen === 'AGENDA' ? 'De agenda' : 'Manual'}
                      </Text>
                    </View>
                  </View>
                </View>
                {procesando === visita.id_visita ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <Ionicons color={colors.muted} name="chevron-forward" size={20} />
                )}
              </View>
            </SwipeToCancelCard>
          ))}

          {hasMore ? (
            <Pressable
              disabled={cargandoMas}
              onPress={() => void cargarMas()}
              style={({ pressed }) => [styles.cargarMas, pressed && styles.cargarMasPressed]}>
              {cargandoMas ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Text style={styles.cargarMasTexto}>Cargar más</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function formatFecha(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'fecha desconocida';
  return fecha.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' });
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 20, marginTop: 6 },
  loader: { marginTop: 40 },
  conteo: { color: colors.muted, fontSize: 13, fontWeight: '700', marginBottom: 12 },
  cargarMas: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
  },
  cargarMasPressed: { opacity: 0.7 },
  cargarMasTexto: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  lista: { gap: 12 },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 84,
    padding: 16,
    ...shadow,
  },
  icono: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 15,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  texto: { flex: 1, gap: 2 },
  empresa: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  detalle: { color: colors.muted, fontSize: 12 },
  etiquetaFila: { flexDirection: 'row', marginTop: 6 },
  etiqueta: {
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  etiquetaTexto: { color: colors.brand, fontSize: 11, fontWeight: '900' },
  vacio: { alignItems: 'center', gap: 8, marginTop: 60 },
  vacioTitulo: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  vacioTexto: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
