import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getSolicitantesListCached } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { TextInput } from '@/src/components/AppTextInput';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { Screen } from '@/src/components/Screen';
import { EntregaEnCursoState, loadEntregaState, saveEntregaState } from '@/src/entregas/entrega-state';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { Solicitante } from '@/src/types/api';
import { getSolicitanteId } from '@/src/visitas/visita-utils';

export default function EntregaReceptorScreen() {
  const [entregaState, setEntregaState] = useState<EntregaEnCursoState | null>(null);
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredSolicitantes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return solicitantes;
    return solicitantes.filter((solicitante) =>
      [solicitante.nombre, solicitante.email, solicitante.rut].filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [search, solicitantes]);

  useEffect(() => {
    loadScreen();
  }, []);

  async function loadScreen(force = false) {
    const saved = await loadEntregaState();
    if (!saved.empresa) {
      router.replace('/(tabs)/entregas');
      return;
    }

    if (saved.brand === 'econnet') {
      const nextState = saved.usarReceptorManual ? saved : { ...saved, receptor: null, usarReceptorManual: true };
      if (!saved.usarReceptorManual) await saveEntregaState(nextState);
      setEntregaState(nextState);
      setSolicitantes([]);
      setLoading(false);
      return;
    }

    const freshSolicitantes = await getSolicitantesListCached(saved.empresa.id_empresa, force).catch(() => []);
    const selectedStillExists = saved.receptor
      ? freshSolicitantes.some((item) => getSolicitanteId(item) === getSolicitanteId(saved.receptor!))
      : true;
    const nextState = selectedStillExists ? saved : { ...saved, receptor: null };

    if (!selectedStillExists) await saveEntregaState(nextState);
    setEntregaState(nextState);
    setSolicitantes(freshSolicitantes);
    setLoading(false);
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await loadScreen(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function updateState(updates: Partial<EntregaEnCursoState>) {
    if (!entregaState) return;
    const nextState = { ...entregaState, ...updates };
    setEntregaState(nextState);
    await saveEntregaState(nextState);
  }

  async function selectSolicitante(solicitante: Solicitante) {
    const id = getSolicitanteId(solicitante);
    const isSelected = entregaState?.receptor && getSolicitanteId(entregaState.receptor) === id;
    await updateState({
      receptor: isSelected ? null : solicitante,
      usarReceptorManual: false,
    });
  }

  async function toggleManual() {
    if (!entregaState) return;
    await updateState({
      receptor: null,
      usarReceptorManual: !entregaState.usarReceptorManual,
    });
  }

  async function updateManualField(key: 'nombre' | 'apellidos' | 'email' | 'rut', value: string) {
    if (!entregaState) return;
    const nextValue = key === 'rut' ? formatRut(value) : value;
    await updateState({
      receptorManual: {
        ...entregaState.receptorManual,
        [key]: nextValue,
      },
      receptor: null,
      usarReceptorManual: true,
    });
  }

  function continuar() {
    if (!entregaState) return;
    const manualName = [entregaState.receptorManual.nombre, entregaState.receptorManual.apellidos].join(' ').trim();
    const hasManual = entregaState.usarReceptorManual && manualName.length >= 3;
    const isRetiro = entregaState.operation === 'retiro';

    if (!entregaState.receptor && !hasManual) {
      Alert.alert(isRetiro ? 'Responsable de retiro' : 'Quien recibe', 'Selecciona un usuario o ingresa los datos manualmente.');
      return;
    }
    if (entregaState.usarReceptorManual && !isValidRut(entregaState.receptorManual.rut)) {
      Alert.alert('RUT invalido', `Ingresa un RUT chileno valido para ${isRetiro ? 'el responsable' : 'quien recibe'}.`);
      return;
    }
    if (entregaState.usarReceptorManual && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entregaState.receptorManual.email.trim())) {
      Alert.alert('Correo invalido', `Ingresa un correo valido para ${isRetiro ? 'el responsable' : 'quien recibe'}.`);
      return;
    }
    if (isRetiro && entregaState.brand === 'econnet' && !entregaState.retiroProductos.length) {
      Alert.alert('Retiro', 'Agrega los productos que se retiraran.');
      router.replace('/entregas/retiro-equipos');
      return;
    }
    if (isRetiro && entregaState.brand !== 'econnet' && !entregaState.selectedEquipos.length) {
      Alert.alert('Retiro', 'Selecciona los equipos que se retiraran.');
      router.replace('/entregas/retiro-equipos');
      return;
    }

    router.replace('/entregas/formulario');
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

  const isRetiro = entregaState.operation === 'retiro';
  const brandName = entregaState.brand === 'econnet' ? 'ECONNET' : 'RIDS';

  return (
    <Screen bottomNavigation={<BottomNavigation />} extendUnderNavigation scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={24}
        style={styles.keyboardAvoider}>
        <RidsFlowHeader
          icon={isRetiro ? 'person-remove-outline' : 'person-add-outline'}
          label={`${brandName} · ${isRetiro ? 'RETIRO' : 'ENTREGA'}`}
          subtitle={entregaState.empresa?.nombre}
          title={isRetiro ? 'Responsable de retiro' : 'Quién recibe'}
        />

        <View style={styles.actions}>
          <AppButton onPress={continuar} title={entregaState.operation === 'retiro' ? 'Usar responsable' : 'Usar receptor'} />
          <AppButton onPress={() => router.back()} title="Volver" variant="ghost" />
        </View>

        <Pressable disabled={entregaState.brand === 'econnet'} onPress={toggleManual} style={styles.manualToggle}>
          <View style={[styles.checkbox, entregaState.usarReceptorManual && styles.checkboxActive]}>
            {entregaState.usarReceptorManual ? <Ionicons color={colors.white} name="checkmark" size={16} /> : null}
          </View>
          <View style={styles.manualCopy}>
            <Text style={styles.manualTitle}>{entregaState.brand === 'econnet' ? 'Datos obligatorios' : 'Persona nueva'}</Text>
            <Text style={styles.manualText}>Ingresar nombre, apellidos, RUT y correo manualmente.</Text>
          </View>
        </Pressable>

        {entregaState.usarReceptorManual ? (
          <ScrollView
            contentContainerStyle={styles.manualScroll}
            keyboardShouldPersistTaps="handled"
            scrollIndicatorInsets={{ bottom: 84 }}
            showsVerticalScrollIndicator={false}>
            <View style={styles.manualForm}>
              <TextInput
                onChangeText={(value) => updateManualField('nombre', value)}
                placeholder="Nombres"
                placeholderTextColor="#98A2B3"
                returnKeyType="next"
                style={styles.input}
                value={entregaState.receptorManual.nombre}
              />
              <TextInput
                onChangeText={(value) => updateManualField('apellidos', value)}
                placeholder="Apellidos"
                placeholderTextColor="#98A2B3"
                returnKeyType="next"
                style={styles.input}
                value={entregaState.receptorManual.apellidos}
              />
              <TextInput
                autoCapitalize="characters"
                keyboardType="default"
                onChangeText={(value) => updateManualField('rut', value)}
                placeholder="RUT"
                placeholderTextColor="#98A2B3"
                returnKeyType="next"
                style={[
                  styles.input,
                  entregaState.receptorManual.rut && !isValidRut(entregaState.receptorManual.rut) && styles.inputError,
                ]}
                value={entregaState.receptorManual.rut}
              />
              {entregaState.receptorManual.rut && !isValidRut(entregaState.receptorManual.rut) ? (
                <Text style={styles.errorText}>Formato esperado: 12.345.678-5</Text>
              ) : null}
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(value) => updateManualField('email', value)}
                placeholder="Correo"
                placeholderTextColor="#98A2B3"
                returnKeyType="done"
                style={styles.input}
                value={entregaState.receptorManual.email}
              />
            </View>
          </ScrollView>
        ) : (
          <>
            <View style={styles.searchBox}>
              <Ionicons color={ridsPalette.cyanDark} name="search-outline" size={20} />
              <TextInput
                onChangeText={setSearch}
                placeholder="Buscar por nombre, correo o RUT"
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
            <View style={styles.selectionRow}>
              <Text style={styles.helperText}>{isRetiro ? 'Responsable seleccionado' : 'Receptor seleccionado'}</Text>
              <Text numberOfLines={1} style={styles.selectedName}>{entregaState.receptor?.nombre || 'Ninguno'}</Text>
            </View>
          </>
        )}

        {!entregaState.usarReceptorManual ? (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
            }
            scrollIndicatorInsets={{ bottom: 84 }}
            style={styles.listScroll}
            showsVerticalScrollIndicator={false}>
            {filteredSolicitantes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons color={ridsPalette.cyanDark} name="people-outline" size={25} />
                <Text style={styles.emptyTitle}>Sin personas disponibles</Text>
                <Text style={styles.emptyText}>Usa “Persona nueva” para ingresar los datos manualmente.</Text>
              </View>
            ) : null}
            {filteredSolicitantes.map((solicitante) => {
                const id = getSolicitanteId(solicitante);
                const selected = entregaState.receptor && getSolicitanteId(entregaState.receptor) === id;

                return (
                  <Pressable
                    key={id}
                    onPress={() => selectSolicitante(solicitante)}
                    style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}>
                    <View style={styles.icon}>
                      <Ionicons color={ridsPalette.cyanDark} name="person-outline" size={23} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={styles.cardTitle}>{solicitante.nombre}</Text>
                      <Text style={styles.cardText}>{solicitante.email || 'Correo no registrado'}</Text>
                      <Text style={styles.cardText}>{solicitante.rut ? formatRut(solicitante.rut) : 'RUT no registrado'}</Text>
                    </View>
                    {selected ? (
                      <View style={styles.check}>
                        <Ionicons color={colors.white} name="checkmark" size={16} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
          </ScrollView>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function cleanRut(value: string) {
  return value.replace(/[^0-9kK]/g, '').toUpperCase();
}

function calculateRutDv(body: string) {
  let multiplier = 2;
  let sum = 0;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rest = 11 - (sum % 11);
  if (rest === 11) return '0';
  if (rest === 10) return 'K';
  return String(rest);
}

function isValidRut(value: string) {
  const cleaned = cleanRut(value);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  return calculateRutDv(body) === dv;
}

function formatRut(value: string) {
  const cleaned = cleanRut(value).slice(0, 9);
  if (cleaned.length <= 1) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
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
  keyboardAvoider: {
    flex: 1,
  },
  manualToggle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    padding: 10,
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
  manualCopy: {
    flex: 1,
  },
  manualTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  manualText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  manualForm: {
    gap: 10,
  },
  manualScroll: {
    paddingBottom: 110,
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
  selectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 10,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -4,
  },
  helperText: {
    color: ridsPalette.charcoal,
    fontSize: 13,
    fontWeight: '800',
  },
  selectedName: {
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    color: ridsPalette.cyanDark,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    maxWidth: '58%',
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    minHeight: 64,
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
    fontSize: 14,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  check: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanDark,
    borderRadius: 12,
    height: 26,
    justifyContent: 'center',
    width: 26,
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
