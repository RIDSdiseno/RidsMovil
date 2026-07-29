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
import { Screen } from '@/src/components/Screen';
import { EntregaEnCursoState, loadEntregaState, saveEntregaState } from '@/src/entregas/entrega-state';
import { colors, shadow } from '@/src/theme/colors';
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

  return (
    <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={24}
        style={styles.keyboardAvoider}>
        <Text style={styles.title}>{entregaState.operation === 'retiro' ? 'Responsable de retiro' : 'Quien recibe'}</Text>
        <Text style={styles.subtitle}>{entregaState.empresa?.nombre}</Text>

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
            scrollIndicatorInsets={{ bottom: 190 }}
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
            <TextInput
              onChangeText={setSearch}
              placeholder="Buscar usuario por nombre, correo o RUT"
              placeholderTextColor="#98A2B3"
              style={styles.input}
              value={search}
            />
            <Text style={styles.helperText}>
              {entregaState.receptor
                ? `Seleccionado: ${entregaState.receptor.nombre}`
                : entregaState.operation === 'retiro'
                  ? 'Selecciona la persona que entrega los equipos.'
                  : 'Selecciona quien recibe la entrega.'}
            </Text>
          </>
        )}

        {!entregaState.usarReceptorManual ? (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
            }
            scrollIndicatorInsets={{ bottom: 150 }}
            style={styles.listScroll}
            showsVerticalScrollIndicator={false}>
            {filteredSolicitantes.map((solicitante) => {
                const id = getSolicitanteId(solicitante);
                const selected = entregaState.receptor && getSolicitanteId(entregaState.receptor) === id;

                return (
                  <Pressable
                    key={id}
                    onPress={() => selectSolicitante(solicitante)}
                    style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}>
                    <View style={styles.icon}>
                      <Ionicons color={colors.brand} name="person-outline" size={24} />
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
  keyboardAvoider: {
    flex: 1,
  },
  manualToggle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    padding: 14,
    ...shadow,
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
    paddingBottom: 210,
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
    minHeight: 76,
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
  check: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 12,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
});
