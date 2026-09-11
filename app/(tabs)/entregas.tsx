import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import { crearClienteEconnet, getClientesCached, getClientesPickupEconnetCached } from '@/src/api/rids';
import { useAuth } from '@/src/auth/AuthContext';
import { AppButton } from '@/src/components/AppButton';
import { RidsModuleBanner } from '@/src/components/RidsModuleBanner';
import { Screen } from '@/src/components/Screen';
import { EmpresaOrigen, ordenarEmpresasConFavoritas, useEmpresasFavoritas } from '@/src/empresas/empresas-favoritas';
import { EntregaBrand, getInitialEntregaState, loadEntregaState, PickUpOperation, saveEntregaState } from '@/src/entregas/entrega-state';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { Cliente } from '@/src/types/api';

// Clave única de empresa: el id_empresa puede repetirse entre RIDS y econnet.
const empresaKey = (empresa: Cliente) => `${empresa.origen ?? 'RIDS'}:${empresa.id_empresa}`;

export default function EntregasScreen() {
  const { tecnico } = useAuth();
  const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;
  const [empresas, setEmpresas] = useState<Cliente[]>([]);
  const [operation, setOperation] = useState<PickUpOperation>('entrega');
  const [selectedBrand, setSelectedBrand] = useState<EntregaBrand | null>(null);
  // La empresa seleccionada se identifica por origen+id porque el id_empresa de
  // econnet (EntidadGestioo) puede coincidir con el de una empresa RIDS distinta.
  const [selectedEmpresaKey, setSelectedEmpresaKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewEmpresa, setShowNewEmpresa] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const { favoritos, isFavorita, isPending, sincronizar: sincronizarFavoritos, toggleFavorita } = useEmpresasFavoritas(tecnicoId);
  const [newEmpresa, setNewEmpresa] = useState<{
    correo: string;
    direccion: string;
    nombre: string;
    rut: string;
    telefono: string;
    tipo: 'EMPRESA' | 'PERSONA';
  }>({
    correo: '',
    direccion: '',
    nombre: '',
    rut: '',
    telefono: '',
    tipo: 'EMPRESA',
  });

  const filteredEmpresas = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? empresas.filter((empresa) =>
          [empresa.nombre, empresa.razonSocial, empresa.detalleEmpresa?.rut]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term),
        )
      : empresas;

    const fallbackOrigen: EmpresaOrigen = selectedBrand === 'econnet' ? 'ECONNET' : 'RIDS';
    return ordenarEmpresasConFavoritas(base, favoritos, fallbackOrigen);
  }, [empresas, favoritos, search, selectedBrand]);

  useEffect(() => {
    async function boot() {
      await hydrateEntrega();
      setLoading(false);
    }

    boot();
  }, []);

  async function hydrateEntrega() {
    const saved = await loadEntregaState();
    setSelectedBrand(null);
    setSelectedEmpresaKey(saved.empresa ? empresaKey(saved.empresa) : null);
  }

  async function loadEmpresas(brand: EntregaBrand | null = selectedBrand, force = false) {
    try {
      setLoading(true);
      setEmpresas(brand === 'econnet' ? await getClientesPickupEconnetCached(force) : await getClientesCached(force));
    } catch (error) {
      Alert.alert('PickUP', error instanceof Error ? error.message : 'No se pudieron cargar las empresas.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await Promise.all([loadEmpresas(selectedBrand, true), sincronizarFavoritos()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function selectEmpresa(empresa: Cliente) {
    if (!selectedBrand) return;
    const nextState = {
      ...getInitialEntregaState(),
      brand: selectedBrand,
      empresa,
      operation,
      selectedEquipos: [],
    };
    await saveEntregaState(nextState);
    setSelectedEmpresaKey(empresaKey(empresa));
    setSearch('');
    router.push(operation === 'retiro' ? '/entregas/retiro-equipos' : '/entregas/formulario');
  }

  async function toggleFavorito(empresa: Cliente) {
    try {
      const fallbackOrigen: EmpresaOrigen = selectedBrand === 'econnet' ? 'ECONNET' : 'RIDS';
      await toggleFavorita(empresa, fallbackOrigen);
    } catch {
      Alert.alert('Favoritos', 'No se pudo actualizar la empresa favorita.');
    }
  }

  async function selectBrand(brand: EntregaBrand) {
    setSelectedBrand(brand);
    setSelectedEmpresaKey(null);
    setSearch('');
    setShowNewEmpresa(false);
    await loadEmpresas(brand);
  }

  function updateNewEmpresaField(key: keyof typeof newEmpresa, value: string) {
    setNewEmpresa((current) => ({
      ...current,
      [key]: key === 'rut' ? formatRut(value) : value,
    }));
  }

  async function saveNewEmpresa() {
    if (!newEmpresa.nombre.trim()) {
      Alert.alert('Nueva empresa', 'Ingresa el nombre de la empresa.');
      return;
    }
    if (newEmpresa.rut && !isValidRut(newEmpresa.rut)) {
      Alert.alert('RUT invalido', 'Ingresa un RUT chileno valido para la empresa.');
      return;
    }
    if (newEmpresa.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmpresa.correo.trim())) {
      Alert.alert('Correo invalido', 'Ingresa un correo valido para la empresa.');
      return;
    }

    try {
      setSavingEmpresa(true);
      const created = await crearClienteEconnet({
        correo: newEmpresa.correo.trim() || null,
        direccion: newEmpresa.direccion.trim() || null,
        nombre: newEmpresa.nombre.trim(),
        rut: newEmpresa.rut.trim() || null,
        telefono: newEmpresa.telefono.trim() || null,
        tipo: newEmpresa.tipo,
      });
      setEmpresas((current) => [created, ...current].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNewEmpresa({ correo: '', direccion: '', nombre: '', rut: '', telefono: '', tipo: 'EMPRESA' });
      setShowNewEmpresa(false);
      await selectEmpresa(created);
    } catch (error) {
      Alert.alert('Nueva empresa', error instanceof Error ? error.message : 'No se pudo crear la empresa.');
    } finally {
      setSavingEmpresa(false);
    }
  }

  return (
    <Screen extendUnderNavigation scroll={false}>
      <RidsModuleBanner
        icon="cube-outline"
        label="ENTREGAS Y RETIROS"
        title="¿Qué empresa atenderás?"
      />

      {!selectedBrand ? (
        <>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>Selecciona empresa</Text>
            <View style={styles.selectionLine} />
          </View>
          <View style={styles.brandGrid}>
            <BrandCard brand="rids" logo={require('../../assets/images/logo-rids.png')} onPress={selectBrand} />
            <BrandCard brand="econnet" logo={require('../../assets/images/logo-econnet.png')} onPress={selectBrand} />
          </View>
        </>
      ) : (
        <>
          <Pressable onPress={() => setSelectedBrand(null)} style={styles.brandSelected}>
            <Text style={styles.brandSelectedText}>{selectedBrand === 'econnet' ? 'Econnet' : 'RIDS'}</Text>
            <Ionicons color={ridsPalette.cyanDark} name="swap-horizontal-outline" size={18} />
          </Pressable>

          <View style={styles.searchBox}>
            <Ionicons color={ridsPalette.cyanDark} name="search-outline" size={20} />
            <TextInput
              onChangeText={setSearch}
              placeholder="Buscar empresa o RUT"
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

          <View style={styles.operationTabs}>
            <OperationTab label="Entrega" onPress={() => setOperation('entrega')} selected={operation === 'entrega'} />
            <OperationTab label="Retiro" onPress={() => setOperation('retiro')} selected={operation === 'retiro'} />
          </View>

          {selectedBrand === 'econnet' ? (
            <View style={styles.newEmpresaBlock}>
              <AppButton
                onPress={() => setShowNewEmpresa(true)}
                title="Nueva Empresa"
                style={styles.newEmpresaButton}
                textStyle={styles.newEmpresaButtonText}
                variant="secondary"
              />
            </View>
          ) : null}

          <Modal
            animationType="slide"
            onRequestClose={() => setShowNewEmpresa(false)}
            transparent
            visible={showNewEmpresa}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Nueva entidad</Text>
                  <Pressable hitSlop={10} onPress={() => setShowNewEmpresa(false)}>
                    <Ionicons color={ridsPalette.cyanDark} name="close" size={22} />
                  </Pressable>
                </View>
                <ScrollView
                  contentContainerStyle={styles.newEmpresaForm}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}>
                  <View style={styles.tipoRow}>
                    {(['EMPRESA', 'PERSONA'] as const).map((opt) => (
                      <Pressable
                        key={opt}
                        onPress={() => setNewEmpresa((current) => ({ ...current, tipo: opt }))}
                        style={[styles.tipoOption, newEmpresa.tipo === opt && styles.tipoOptionActive]}>
                        <Text style={[styles.tipoText, newEmpresa.tipo === opt && styles.tipoTextActive]}>
                          {opt === 'EMPRESA' ? 'Empresa' : 'Persona'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    onChangeText={(value) => updateNewEmpresaField('nombre', value)}
                    placeholder={newEmpresa.tipo === 'PERSONA' ? 'Nombre completo' : 'Nombre empresa'}
                    placeholderTextColor="#98A2B3"
                    style={styles.input}
                    value={newEmpresa.nombre}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={(value) => updateNewEmpresaField('rut', value)}
                    placeholder={newEmpresa.tipo === 'PERSONA' ? 'Rut personal' : 'RUT empresa'}
                    placeholderTextColor="#98A2B3"
                    style={[styles.input, newEmpresa.rut && !isValidRut(newEmpresa.rut) && styles.inputError]}
                    value={newEmpresa.rut}
                  />
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={(value) => updateNewEmpresaField('correo', value)}
                    placeholder={newEmpresa.tipo === 'PERSONA' ? 'Correo personal' : 'Correo empresa'}
                    placeholderTextColor="#98A2B3"
                    style={styles.input}
                    value={newEmpresa.correo}
                  />
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={(value) => updateNewEmpresaField('telefono', value)}
                    placeholder="Telefono"
                    placeholderTextColor="#98A2B3"
                    style={styles.input}
                    value={newEmpresa.telefono}
                  />
                  <TextInput
                    onChangeText={(value) => updateNewEmpresaField('direccion', value)}
                    placeholder="Direccion"
                    placeholderTextColor="#98A2B3"
                    style={styles.input}
                    value={newEmpresa.direccion}
                  />
                  <AppButton loading={savingEmpresa} onPress={saveNewEmpresa} title="Crear empresa" />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {loading ? <ActivityIndicator color={ridsPalette.cyanDark} style={styles.loader} /> : null}

          <View style={styles.countRow}>
            <Text style={styles.countTitle}>Empresas disponibles</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredEmpresas.length}</Text>
            </View>
          </View>

          <FlatList
            columnWrapperStyle={styles.companyRow}
            contentContainerStyle={styles.companyList}
            data={filteredEmpresas}
            keyExtractor={(empresa) => `${empresa.origen ?? 'RIDS'}:${empresa.id_empresa}`}
            numColumns={2}
            refreshControl={
              <RefreshControl colors={[ridsPalette.cyanDark]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={ridsPalette.cyanDark} />
            }
            renderItem={({ item: empresa }) => (
              <Pressable
                onPress={() => selectEmpresa(empresa)}
                style={({ pressed }) => [
                  styles.companyCard,
                  selectedEmpresaKey === empresaKey(empresa) && styles.companyCardSelected,
                  pressed && styles.companyPressed,
                ]}>
                <View style={styles.companyHeader}>
                  <View style={styles.companyIcon}>
                    <Ionicons color={ridsPalette.cyanDark} name="business-outline" size={21} />
                  </View>
                  <View style={styles.companyActions}>
                    <Pressable
                      accessibilityLabel={isFavorita(empresa, selectedBrand === 'econnet' ? 'ECONNET' : 'RIDS') ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      disabled={isPending(empresa, selectedBrand === 'econnet' ? 'ECONNET' : 'RIDS')}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        void toggleFavorito(empresa);
                      }}
                      style={styles.favoriteButton}>
                      {isPending(empresa, selectedBrand === 'econnet' ? 'ECONNET' : 'RIDS') ? (
                        <ActivityIndicator color={ridsPalette.cyanDark} size="small" />
                      ) : (
                        <Ionicons
                          color={ridsPalette.cyanDark}
                          name={isFavorita(empresa, selectedBrand === 'econnet' ? 'ECONNET' : 'RIDS') ? 'star' : 'star-outline'}
                          size={19}
                        />
                      )}
                    </Pressable>
                    {selectedEmpresaKey === empresaKey(empresa) ? (
                      <View style={styles.companyCheck}>
                        <Ionicons color={colors.white} name="checkmark" size={14} />
                      </View>
                    ) : (
                      <View style={styles.companyChevron}>
                        <Ionicons color={ridsPalette.cyanDark} name="chevron-forward" size={17} />
                      </View>
                    )}
                  </View>
                </View>
                <Text numberOfLines={2} style={styles.companyTitle}>{empresa.nombre}</Text>
                <Text numberOfLines={1} style={styles.companySubtitle}>
                  {empresa.detalleEmpresa?.rut ? `RUT ${empresa.detalleEmpresa.rut}` : 'RUT no registrado'}
                </Text>
              </Pressable>
            )}
            scrollIndicatorInsets={{ bottom: 84 }}
            style={styles.companyScroll}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </Screen>
  );
}

function BrandCard({
  brand,
  logo,
  onPress,
}: {
  brand: EntregaBrand;
  logo: number;
  onPress: (brand: EntregaBrand) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(brand)}
      style={({ pressed }) => [
        styles.brandCard,
        pressed && styles.companyPressed,
      ]}>
      <Image contentFit="contain" source={logo} style={styles.brandLogo} />
    </Pressable>
  );
}

function OperationTab({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.operationTab, selected && styles.operationTabActive]}>
      <Text style={[styles.operationText, selected && styles.operationTextActive]}>{label}</Text>
    </Pressable>
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
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

const styles = StyleSheet.create({
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
  newEmpresaBlock: {
    gap: 10,
    marginTop: 12,
  },
  newEmpresaForm: {
    gap: 10,
    paddingBottom: 24,
  },
  modalOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  tipoRow: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 6,
  },
  tipoOption: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  tipoOptionActive: {
    backgroundColor: ridsPalette.cyanDark,
  },
  tipoText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  tipoTextActive: {
    color: colors.white,
  },
  operationTabs: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 6,
  },
  operationTab: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  operationTabActive: {
    backgroundColor: ridsPalette.cyanDark,
  },
  operationText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '900',
  },
  operationTextActive: {
    color: colors.white,
  },
  brandGrid: {
    gap: 12,
  },
  selectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  selectionTitle: {
    color: ridsPalette.charcoal,
    fontSize: 15,
    fontWeight: '900',
  },
  selectionLine: {
    backgroundColor: colors.line,
    flex: 1,
    height: 1,
  },
  brandCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 142,
    overflow: 'hidden',
    padding: 20,
  },
  brandLogo: {
    height: 86,
    width: '86%',
  },
  brandSelected: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  brandSelectedText: {
    color: ridsPalette.cyanDark,
    fontSize: 13,
    fontWeight: '900',
  },
  loader: {
    marginVertical: 14,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: ridsPalette.charcoal,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingVertical: 10,
  },
  countRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  countTitle: {
    color: ridsPalette.charcoal,
    fontSize: 15,
    fontWeight: '900',
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 13,
    minWidth: 32,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  countText: {
    color: ridsPalette.cyanDark,
    fontSize: 12,
    fontWeight: '900',
  },
  companyList: {
    gap: 8,
    paddingBottom: 110,
    paddingTop: 12,
  },
  companyRow: {
    justifyContent: 'space-between',
  },
  companyScroll: {
    flex: 1,
    marginTop: 0,
  },
  companyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 124,
    padding: 10,
    width: '48.5%',
  },
  companyCardSelected: {
    backgroundColor: ridsPalette.cyanSoft,
    borderColor: ridsPalette.cyan,
    borderWidth: 2,
  },
  companyPressed: {
    transform: [{ scale: 0.98 }],
  },
  companyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  companyActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  favoriteButton: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 10,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  companyIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  companyCheck: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanDark,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  companyTitle: {
    color: ridsPalette.charcoal,
    // Los nombres de Econnet se guardan en mayusculas y son mas anchos, asi
    // que se acota el cuerpo y se limita a dos lineas para que todas las
    // tarjetas midan lo mismo.
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  companySubtitle: {
    color: ridsPalette.slate,
    fontSize: 12,
    // Ancla el RUT al pie: el titulo ocupa una o dos lineas segun la empresa y
    // sin esto quedaba a distinta altura en cada tarjeta.
    marginTop: 'auto',
    paddingTop: 5,
  },
  companyChevron: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 11,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  newEmpresaButton: {
    backgroundColor: ridsPalette.cyanSoft,
  },
  newEmpresaButtonText: {
    color: ridsPalette.cyanDark,
  },
});
