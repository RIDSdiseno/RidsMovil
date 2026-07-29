import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import { getEquiposCached } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { Screen } from '@/src/components/Screen';
import { EntregaEnCursoState, loadEntregaState, saveEntregaState } from '@/src/entregas/entrega-state';
import { colors, shadow } from '@/src/theme/colors';
import { Equipo } from '@/src/types/api';

export default function RetiroEquiposScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [entregaState, setEntregaState] = useState<EntregaEnCursoState | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [productoForm, setProductoForm] = useState({
    cantidad: '1',
    descripcion: '',
    nombre: '',
    serial: '',
  });

  const selectedIds = useMemo(
    () => new Set((entregaState?.selectedEquipos ?? []).map((equipo) => equipo.id_equipo)),
    [entregaState?.selectedEquipos],
  );

  const filteredEquipos = useMemo(() => {
    const empresaId = entregaState?.empresa?.id_empresa;
    const term = search.trim().toLowerCase();
    const byEmpresa = equipos.filter((equipo) => equipo.empresaId === empresaId);
    if (!term) return byEmpresa;

    return byEmpresa.filter((equipo) =>
      [equipo.serial, equipo.marca, equipo.modelo, equipo.nombreSolicitante, equipo.solicitante?.nombre]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [entregaState?.empresa?.id_empresa, equipos, search]);

  useEffect(() => {
    loadScreen();
  }, []);

  async function loadScreen(force = false) {
    const saved = await loadEntregaState();
    if (!saved.empresa || saved.operation !== 'retiro') {
      router.replace('/(tabs)/entregas');
      return;
    }

    try {
      setLoading(true);
      setEntregaState(saved);
      if (saved.brand === 'econnet') {
        setEquipos([]);
      } else {
        const response = await getEquiposCached(force);
        setEquipos(response.equipos ?? []);
      }
    } catch (error) {
      Alert.alert('Retiro', error instanceof Error ? error.message : 'No se pudieron cargar los equipos.');
    } finally {
      setLoading(false);
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

  async function toggleEquipo(equipo: Equipo) {
    if (!entregaState) return;
    const isSelected = selectedIds.has(equipo.id_equipo);
    const selectedEquipos = isSelected
      ? entregaState.selectedEquipos.filter((item) => item.id_equipo !== equipo.id_equipo)
      : [...entregaState.selectedEquipos, equipo];
    const nextState = { ...entregaState, selectedEquipos };

    setEntregaState(nextState);
    await saveEntregaState(nextState);
  }

  function continuar() {
    const destination = returnTo === 'formulario' ? '/entregas/formulario' : '/entregas/receptor';

    if (entregaState?.brand === 'econnet') {
      if (!entregaState.retiroProductos.length) {
        Alert.alert('Producto a retirar', 'Agrega al menos un producto para retirar.');
        return;
      }

      router.replace(destination);
      return;
    }

    if (!entregaState?.selectedEquipos.length) {
      Alert.alert('Retiro', 'Selecciona al menos un equipo para retirar.');
      return;
    }

    router.replace(destination);
  }

  async function addProducto() {
    if (!entregaState) return;
    if (!productoForm.nombre.trim()) {
      Alert.alert('Producto a retirar', 'Ingresa el nombre del producto.');
      return;
    }

    const nextState = {
      ...entregaState,
      retiroProductos: [
        ...entregaState.retiroProductos,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          cantidad: productoForm.cantidad.trim() || '1',
          descripcion: productoForm.descripcion.trim(),
          nombre: productoForm.nombre.trim(),
          serial: productoForm.serial.trim(),
        },
      ],
    };

    setEntregaState(nextState);
    await saveEntregaState(nextState);
    setProductoForm({ cantidad: '1', descripcion: '', nombre: '', serial: '' });
  }

  async function removeProducto(id: string) {
    if (!entregaState) return;
    const nextState = {
      ...entregaState,
      retiroProductos: entregaState.retiroProductos.filter((producto) => producto.id !== id),
    };

    setEntregaState(nextState);
    await saveEntregaState(nextState);
  }

  if (loading || !entregaState) {
    return (
      <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
      <Text style={styles.title}>{entregaState.brand === 'econnet' ? 'Producto a retirar' : 'Equipos a retirar'}</Text>
      <Text style={styles.subtitle}>{entregaState.empresa?.nombre}</Text>

      <View style={styles.actions}>
        <AppButton
          onPress={continuar}
          title={`Continuar (${entregaState.brand === 'econnet' ? entregaState.retiroProductos.length : entregaState.selectedEquipos.length})`}
        />
        <AppButton onPress={() => router.replace('/(tabs)/entregas')} title="Cambiar empresa" variant="ghost" />
      </View>

      {entregaState.brand === 'econnet' ? (
        <>
          <View style={styles.productForm}>
            <TextInput
              onChangeText={(value) => setProductoForm((current) => ({ ...current, nombre: value }))}
              placeholder="Nombre producto"
              placeholderTextColor="#98A2B3"
              style={styles.input}
              value={productoForm.nombre}
            />
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => setProductoForm((current) => ({ ...current, cantidad: value.replace(/[^0-9]/g, '') }))}
              placeholder="Cantidad"
              placeholderTextColor="#98A2B3"
              style={styles.input}
              value={productoForm.cantidad}
            />
            <TextInput
              onChangeText={(value) => setProductoForm((current) => ({ ...current, serial: value }))}
              placeholder="Serie / identificador"
              placeholderTextColor="#98A2B3"
              style={styles.input}
              value={productoForm.serial}
            />
            <TextInput
              multiline
              onChangeText={(value) => setProductoForm((current) => ({ ...current, descripcion: value }))}
              placeholder="Descripcion"
              placeholderTextColor="#98A2B3"
              style={[styles.input, styles.textarea]}
              value={productoForm.descripcion}
            />
            <AppButton onPress={addProducto} title="Agregar producto" variant="secondary" />
          </View>

          <ScrollView contentContainerStyle={styles.list} scrollIndicatorInsets={{ bottom: 150 }} style={styles.listScroll} showsVerticalScrollIndicator={false}>
            {entregaState.retiroProductos.map((producto) => (
              <Pressable key={producto.id} onPress={() => removeProducto(producto.id)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <View style={styles.icon}>
                  <Ionicons color={colors.brand} name="cube-outline" size={24} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.cardTitle}>{producto.nombre}</Text>
                  <Text style={styles.cardText}>Cantidad: {producto.cantidad || '1'}</Text>
                  {producto.serial ? <Text style={styles.cardText}>Serie: {producto.serial}</Text> : null}
                  {producto.descripcion ? <Text style={styles.cardText}>{producto.descripcion}</Text> : null}
                </View>
                <Ionicons color="#DC2626" name="trash-outline" size={20} />
              </Pressable>
            ))}
            {!entregaState.retiroProductos.length ? <Text style={styles.emptyText}>Agrega los productos que se retiraran.</Text> : null}
          </ScrollView>
        </>
      ) : (
        <>
          <TextInput
            onChangeText={setSearch}
            placeholder="Buscar por serial, marca, modelo o usuario"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            value={search}
          />

          <Text style={styles.helperText}>
            {filteredEquipos.length} equipo{filteredEquipos.length === 1 ? '' : 's'} disponible
            {filteredEquipos.length === 1 ? '' : 's'}
          </Text>

          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
            }
            scrollIndicatorInsets={{ bottom: 150 }}
            style={styles.listScroll}
            showsVerticalScrollIndicator={false}>
            {filteredEquipos.map((equipo) => {
              const selected = selectedIds.has(equipo.id_equipo);

              return (
                <Pressable
                  key={equipo.id_equipo}
                  onPress={() => toggleEquipo(equipo)}
                  style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}>
                  <View style={styles.icon}>
                    <Ionicons color={colors.brand} name="hardware-chip-outline" size={24} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.cardTitle}>{formatEquipoTitle(equipo)}</Text>
                    <Text style={styles.cardText}>Serial: {equipo.serial || 'Sin serial'}</Text>
                    <Text style={styles.cardText}>Usuario: {equipo.nombreSolicitante || equipo.solicitante?.nombre || 'No asignado'}</Text>
                  </View>
                  <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                    {selected ? <Ionicons color={colors.white} name="checkmark" size={16} /> : null}
                  </View>
                </Pressable>
              );
            })}
            {!filteredEquipos.length ? <Text style={styles.emptyText}>No hay equipos para esta empresa.</Text> : null}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}

function formatEquipoTitle(equipo: Equipo) {
  return [equipo.marca, equipo.modelo].filter(Boolean).join(' ') || `Equipo #${equipo.id_equipo}`;
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
    marginBottom: 18,
    marginTop: 6,
  },
  actions: {
    gap: 10,
    marginBottom: 14,
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
  productForm: {
    gap: 10,
  },
  textarea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  list: {
    gap: 12,
    paddingBottom: 190,
    paddingTop: 14,
  },
  listScroll: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 92,
    padding: 14,
    ...shadow,
  },
  cardSelected: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
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
  checkbox: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  checkboxActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    paddingTop: 18,
    textAlign: 'center',
  },
});
