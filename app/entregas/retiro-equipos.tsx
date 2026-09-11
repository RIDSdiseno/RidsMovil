import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import { getEquiposCached } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { RidsSectionTitle } from '@/src/components/RidsSectionTitle';
import { Screen } from '@/src/components/Screen';
import { EntregaEnCursoState, loadEntregaState, saveEntregaState } from '@/src/entregas/entrega-state';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
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
    <Screen bottomNavigation={<BottomNavigation />} extendUnderNavigation scroll={false}>
      <RidsFlowHeader
        icon={entregaState.brand === 'econnet' ? 'cube-outline' : 'hardware-chip-outline'}
        label={`${entregaState.brand === 'econnet' ? 'ECONNET' : 'RIDS'} · RETIRO`}
        subtitle={entregaState.empresa?.nombre}
        title={entregaState.brand === 'econnet' ? 'Productos a retirar' : 'Equipos a retirar'}
      />

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
            <RidsSectionTitle title="Agregar producto" />
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

          <View style={styles.countRow}>
            <Text style={styles.countLabel}>Productos agregados</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{entregaState.retiroProductos.length}</Text></View>
          </View>

          <ScrollView contentContainerStyle={styles.list} scrollIndicatorInsets={{ bottom: 84 }} style={styles.listScroll} showsVerticalScrollIndicator={false}>
            {entregaState.retiroProductos.map((producto) => (
              <Pressable key={producto.id} onPress={() => removeProducto(producto.id)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <View style={styles.icon}>
                  <Ionicons color={ridsPalette.cyanDark} name="cube-outline" size={23} />
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
            {!entregaState.retiroProductos.length ? (
              <View style={styles.emptyState}>
                <Ionicons color={ridsPalette.cyanDark} name="cube-outline" size={25} />
                <Text style={styles.emptyTitle}>Sin productos agregados</Text>
                <Text style={styles.emptyText}>Completa el formulario superior para registrar el retiro.</Text>
              </View>
            ) : null}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Ionicons color={ridsPalette.cyanDark} name="search-outline" size={20} />
            <TextInput
              onChangeText={setSearch}
              placeholder="Buscar por serial, marca, modelo o usuario"
              placeholderTextColor="#98A2B3"
              style={styles.searchInput}
              value={search}
            />
            {search ? (
              <Pressable hitSlop={10} onPress={() => setSearch('')}>
                <Ionicons color={ridsPalette.cyanDark} name="close-circle" size={19} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.countRow}>
            <Text style={styles.countLabel}>Equipos disponibles</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{filteredEquipos.length}</Text></View>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
            }
            scrollIndicatorInsets={{ bottom: 84 }}
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
                    <Ionicons color={ridsPalette.cyanDark} name="hardware-chip-outline" size={23} />
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
            {!filteredEquipos.length ? (
              <View style={styles.emptyState}>
                <Ionicons color={ridsPalette.cyanDark} name="hardware-chip-outline" size={25} />
                <Text style={styles.emptyTitle}>Sin equipos disponibles</Text>
                <Text style={styles.emptyText}>No hay equipos asociados a esta empresa.</Text>
              </View>
            ) : null}
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
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  textarea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    paddingVertical: 11,
  },
  countRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  countLabel: {
    color: ridsPalette.charcoal,
    fontSize: 13,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  countText: {
    color: ridsPalette.cyanDark,
    fontSize: 11,
    fontWeight: '900',
  },
  list: {
    gap: 8,
    paddingBottom: 110,
    paddingTop: 14,
  },
  listScroll: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 72,
    padding: 10,
  },
  cardSelected: {
    backgroundColor: ridsPalette.cyanSoft,
    borderColor: ridsPalette.cyanDark,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  icon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
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
    backgroundColor: ridsPalette.cyanDark,
    borderColor: ridsPalette.cyanDark,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
  },
  emptyTitle: {
    color: ridsPalette.charcoal,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },
  emptyText: {
    color: ridsPalette.slate,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
  },
});
