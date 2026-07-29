import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { getSucursalesPorEmpresaCached } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { Screen } from '@/src/components/Screen';
import { colors, shadow } from '@/src/theme/colors';
import { Sucursal } from '@/src/types/api';
import { loadVisitaState, saveVisitaState, VisitaEnCursoState } from '@/src/visitas/visita-state';
import { getSucursalId } from '@/src/visitas/visita-utils';

export default function SucursalScreen() {
  const [visitaState, setVisitaState] = useState<VisitaEnCursoState | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function boot() {
      await loadScreen();
    }

    boot();
  }, []);

  async function loadScreen(force = false) {
    const saved = await loadVisitaState();
    if (!saved.empresaId) {
      router.replace('/(tabs)/visitas');
      return;
    }

    setVisitaState(saved);
    const response = await getSucursalesPorEmpresaCached(saved.empresaId, force).catch(() => ({ sucursales: [] }));
    const list = response.sucursales ?? [];
    setSucursales(list);
    setLoading(false);

    if (list.length === 0) {
      router.replace('/visitas/solicitantes');
    }
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await loadScreen(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function selectSucursal(sucursal: Sucursal) {
    if (!visitaState) return;

    const sucursalId = getSucursalId(sucursal);
    const nextState = {
      ...visitaState,
      sucursalId: visitaState.sucursalId === sucursalId ? null : sucursalId,
    };
    setVisitaState(nextState);
    await saveVisitaState(nextState);
  }

  function continuar() {
    if (!visitaState?.sucursalId) {
      Alert.alert('Sucursal', 'Selecciona una sucursal para continuar.');
      return;
    }

    router.push('/visitas/solicitantes');
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

  return (
    <Screen bottomNavigation={<BottomNavigation />} onRefresh={refreshScreen} refreshing={refreshing}>
      <Text style={styles.title}>Sucursal</Text>
      <Text style={styles.subtitle}>{visitaState.empresaNombre}</Text>

      <View style={styles.list}>
        {sucursales.map((sucursal) => {
          const sucursalId = getSucursalId(sucursal);
          const selected = sucursalId === visitaState.sucursalId;

          return (
            <Pressable
              key={sucursalId}
              onPress={() => selectSucursal(sucursal)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}>
              <View style={styles.icon}>
                <Ionicons color={colors.brand} name="storefront-outline" size={24} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{sucursal.nombre}</Text>
                <Text style={styles.cardText}>{sucursal.direccion || 'Sucursal registrada'}</Text>
              </View>
              {selected ? (
                <View style={styles.check}>
                  <Ionicons color={colors.white} name="checkmark" size={16} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <AppButton disabled={!visitaState.sucursalId} onPress={continuar} title="Continuar" />
        <AppButton onPress={() => router.replace('/(tabs)/visitas')} title="Volver" variant="ghost" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 22,
    marginTop: 6,
  },
  list: {
    gap: 12,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    ...shadow,
  },
  cardSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  copy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  cardText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  check: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 13,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  actions: {
    gap: 10,
    marginTop: 24,
  },
});
