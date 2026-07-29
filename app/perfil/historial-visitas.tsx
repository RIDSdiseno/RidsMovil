import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getHistorialPorTecnicoCached } from '@/src/api/rids';
import { useAuth } from '@/src/auth/AuthContext';
import { AppButton } from '@/src/components/AppButton';
import { Screen } from '@/src/components/Screen';
import { colors, shadow } from '@/src/theme/colors';
import { HistorialVisita } from '@/src/types/api';

export default function HistorialVisitasScreen() {
  const { tecnico } = useAuth();
  const [historial, setHistorial] = useState<HistorialVisita[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;

  useEffect(() => {
    loadScreen();
    // Se recarga cuando cambia el tecnico autenticado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tecnicoId]);

  async function loadScreen() {
    if (!tecnicoId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getHistorialPorTecnicoCached(tecnicoId, 1, 100);
      setHistorial(response.historial ?? response.data ?? response.visitas ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function refreshScreen() {
    if (!tecnicoId) return;

    try {
      setRefreshing(true);
      const response = await getHistorialPorTecnicoCached(tecnicoId, 1, 100, true);
      setHistorial(response.historial ?? response.data ?? response.visitas ?? []);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Historial de visitas</Text>
      <Text style={styles.subtitle}>Visitas finalizadas por tu usuario.</Text>

      <AppButton onPress={() => router.back()} title="Volver" variant="ghost" />

      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
        }
        showsVerticalScrollIndicator={false}>
        {historial.map((item) => (
          <View key={item.id ?? item.id_historial ?? `${item.empresaId}-${item.fin}`} style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons color={colors.brand} name="clipboard-outline" size={22} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.empresa?.nombre || 'Empresa sin nombre'}</Text>
              <Text style={styles.cardText}>
                {item.solicitanteRef?.nombre || item.solicitante || 'Solicitante'} · {formatDate(item.fin || item.inicio)}
              </Text>
              {item.realizado ? <Text style={styles.realizado}>{item.realizado}</Text> : null}
              {item.sucursal?.nombre ? <Text style={styles.meta}>Sucursal: {item.sucursal.nombre}</Text> : null}
            </View>
          </View>
        ))}

        {!loading && historial.length === 0 ? <Text style={styles.emptyText}>No hay visitas registradas.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function formatDate(value?: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CL');
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 12,
    marginTop: 6,
  },
  loader: {
    marginVertical: 14,
  },
  list: {
    gap: 12,
    paddingBottom: 120,
    paddingTop: 18,
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    ...shadow,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  realizado: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
