import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import { crearEquipo } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { EditableSelect } from '@/src/components/EditableSelect';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { RidsSectionTitle } from '@/src/components/RidsSectionTitle';
import { Screen } from '@/src/components/Screen';
import {
  ESTADO_EQUIPO_OPTIONS,
  MARCAS_SUGERIDAS,
  PROCESADORES_SUGERIDOS,
  PROPIEDAD_EQUIPO_OPTIONS,
  PropiedadEquipo,
  TIPO_EQUIPO_OPTIONS,
  TIPOS_SIN_ESPECIFICACIONES,
} from '@/src/equipos/equipo-opciones';
import { clearEquipoState, EquipoNuevoState, loadEquipoState } from '@/src/equipos/equipo-state';
import { colors, shadow } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { getSolicitanteId } from '@/src/visitas/visita-utils';

type EquipoAdicionalForm = {
  tipo: string;
  descripcion: string;
  cantidad: string;
  serialAdicional: string;
};

type EquipoForm = {
  serial: string;
  marca: string;
  modelo: string;
  tipo: string;
  estado: string;
  anioPc: string;
  procesador: string;
  ram: string;
  disco: string;
  propiedad: PropiedadEquipo;
  propietarioExterno: string;
  observaciones: string;
  macWifi: string;
  redEthernet: string;
  so: string;
  tipoDd: string;
  estadoAlm: string;
  office: string;
  teamViewer: string;
  claveTv: string;
  revisado: string;
  adminRidsUsuario: string;
  adminRidsPassword: string;
  usuarioEmpresa: string;
  passwordEmpresa: string;
  usuarioPersonal: string;
  passwordPersonal: string;
  adicionales: EquipoAdicionalForm[];
};

const initialForm: EquipoForm = {
  serial: '',
  marca: '',
  modelo: '',
  tipo: 'GENERICO',
  estado: 'ACTIVO',
  anioPc: '',
  procesador: '',
  ram: '',
  disco: '',
  propiedad: 'Empresa',
  observaciones: '',
  propietarioExterno: '',
  macWifi: '',
  redEthernet: '',
  so: '',
  tipoDd: '',
  estadoAlm: '',
  office: '',
  teamViewer: '',
  claveTv: '',
  revisado: '',
  adminRidsUsuario: '',
  adminRidsPassword: '',
  usuarioEmpresa: '',
  passwordEmpresa: '',
  usuarioPersonal: '',
  passwordPersonal: '',
  adicionales: [],
};

export default function AgregarEquipoFormularioScreen() {
  const [equipoState, setEquipoState] = useState<EquipoNuevoState | null>(null);
  const [form, setForm] = useState<EquipoForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pickerOpen, setPickerOpen] = useState<'tipo' | 'estado' | 'propiedad' | null>(null);

  const requiereEspecificaciones = !TIPOS_SIN_ESPECIFICACIONES.has(form.tipo);

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.serial.trim().length >= 2 &&
        form.marca.trim().length >= 2 &&
        form.modelo.trim().length >= 2 &&
        (form.propiedad !== 'Externo' || form.propietarioExterno.trim().length > 0),
      ),
    [form.marca, form.modelo, form.serial, form.propiedad, form.propietarioExterno],
  );

  useEffect(() => {
    async function boot() {
      const saved = await loadEquipoState();
      if (!saved.empresa || !saved.solicitante) {
        router.replace('/equipos/agregar/empresa');
        return;
      }

      setEquipoState(saved);
      setLoading(false);
    }

    boot();
  }, []);

  function updateField(key: Exclude<keyof EquipoForm, 'adicionales' | 'propiedad'>, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updatePropiedad(value: PropiedadEquipo) {
    setForm((current) => ({
      ...current,
      propiedad: value,
      propietarioExterno: value === 'Externo' ? current.propietarioExterno : '',
    }));
  }

  function addAdicional() {
    setForm((current) => ({
      ...current,
      adicionales: [...current.adicionales, { tipo: '', descripcion: '', cantidad: '1', serialAdicional: '' }],
    }));
  }

  function updateAdicional(index: number, key: keyof EquipoAdicionalForm, value: string) {
    setForm((current) => ({
      ...current,
      adicionales: current.adicionales.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  }

  function removeAdicional(index: number) {
    setForm((current) => ({
      ...current,
      adicionales: current.adicionales.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function guardarEquipo() {
    if (!equipoState?.empresa || !equipoState.solicitante) return;

    if (!canSubmit) {
      Alert.alert('Equipo', 'Completa serial, marca y modelo.');
      return;
    }

    const idSolicitante = getSolicitanteId(equipoState.solicitante);
    if (!idSolicitante) {
      Alert.alert('Equipo', 'No se pudo identificar el solicitante.');
      return;
    }

    try {
      setSubmitting(true);
      await crearEquipo({
        idSolicitante,
        serial: form.serial.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        tipo: form.tipo,
        estado: form.estado,
        ...(form.anioPc.trim() && { anioPc: Number(form.anioPc.trim()) }),
        procesador: form.procesador.trim(),
        ram: form.ram.trim(),
        disco: form.disco.trim(),
        propiedad: form.propiedad,
        propietarioExterno: form.propiedad === 'Externo' ? form.propietarioExterno.trim() : undefined,
        observaciones: form.observaciones.trim() || null,
        macWifi: form.macWifi.trim(),
        redEthernet: form.redEthernet.trim(),
        so: form.so.trim(),
        tipoDd: form.tipoDd.trim(),
        estadoAlm: form.estadoAlm.trim(),
        office: form.office.trim(),
        teamViewer: form.teamViewer.trim(),
        claveTv: form.claveTv.trim(),
        revisado: form.revisado.trim(),
        adminRidsUsuario: form.adminRidsUsuario.trim(),
        adminRidsPassword: form.adminRidsPassword.trim(),
        usuarioEmpresa: form.usuarioEmpresa.trim(),
        passwordEmpresa: form.passwordEmpresa.trim(),
        usuarioPersonal: form.usuarioPersonal.trim(),
        passwordPersonal: form.passwordPersonal.trim(),
        adicionales: normalizeAdicionales(form.adicionales),
      });

      await clearEquipoState();

      router.replace('/equipos/gestionar');

      Alert.alert(
        'Equipo',
        `Equipo creado para ${equipoState.solicitante.nombre}.`,
      );
    } catch (error) {
      Alert.alert('Equipo', error instanceof Error ? error.message : 'No se pudo crear el equipo.');
    } finally {
      setSubmitting(false);
    }
  }

  function cancelarRegistro() {
    Alert.alert('Cancelar registro', 'Se eliminara el estado actual del registro de equipo.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar registro',
        style: 'destructive',
        onPress: async () => {
          await clearEquipoState();
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  if (loading || !equipoState) {
    return (
      <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomNavigation={<BottomNavigation />}>
      <RidsFlowHeader
        icon="hardware-chip-outline"
        label="NUEVO EQUIPO · PASO 3 DE 3"
        subtitle={equipoState.empresa?.nombre}
        title="Completa los datos del equipo"
      />

      <Pressable
        onPress={() => router.replace('/equipos/agregar/solicitante')}
        style={({ pressed }) => [styles.summaryCard, pressed && styles.cardPressed]}>
        <View style={styles.summaryIcon}>
          <Ionicons color={ridsPalette.cyanDark} name="person-outline" size={23} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{equipoState.solicitante?.nombre}</Text>
          <Text style={styles.summaryText}>{equipoState.empresa?.nombre}</Text>
        </View>
        <Ionicons color="#B7C0CE" name="chevron-forward" size={18} />
      </Pressable>

      <Section title="Informacion requerida">
        <Field label="Serial" onChangeText={(value) => updateField('serial', value)} value={form.serial} />
        <EditableSelect
          label="Marca"
          onChangeText={(value) => updateField('marca', value)}
          options={MARCAS_SUGERIDAS}
          value={form.marca}
        />
        <Field label="Modelo" onChangeText={(value) => updateField('modelo', value)} value={form.modelo} />
      </Section>

      <Section title="Tipo y estado">
        <Text style={styles.fieldLabel}>Tipo de equipo</Text>
        <Pressable onPress={() => setPickerOpen('tipo')} style={styles.pickerButton}>
          <Text style={styles.pickerButtonText}>
            {TIPO_EQUIPO_OPTIONS.find((o) => o.value === form.tipo)?.label ?? 'Selecciona tipo'}
          </Text>
          <Ionicons color="#98A2B3" name="chevron-down" size={18} />
        </Pressable>

        <Text style={styles.fieldLabel}>Estado del equipo</Text>
        <Pressable onPress={() => setPickerOpen('estado')} style={styles.pickerButton}>
          <Text style={styles.pickerButtonText}>
            {ESTADO_EQUIPO_OPTIONS.find((o) => o.value === form.estado)?.label ?? 'Selecciona estado'}
          </Text>
          <Ionicons color="#98A2B3" name="chevron-down" size={18} />
        </Pressable>

        <Field
          keyboardType="numeric"
          label="Año PC (opcional, se calcula automatico si se deja vacio)"
          onChangeText={(value) => updateField('anioPc', value)}
          value={form.anioPc}
        />
      </Section>

      <Section title="Informacion adicional">
        {requiereEspecificaciones ? (
          <>
            <EditableSelect
              autoCapitalize="none"
              label="Procesador"
              onChangeText={(value) => updateField('procesador', value)}
              options={PROCESADORES_SUGERIDOS}
              value={form.procesador}
            />
            <Field label="RAM" onChangeText={(value) => updateField('ram', value)} value={form.ram} />
            <Field label="Disco" onChangeText={(value) => updateField('disco', value)} value={form.disco} />
          </>
        ) : (
          <Text style={styles.helperText}>
            Este tipo de equipo no requiere procesador, RAM ni disco.
          </Text>
        )}

        <Text style={styles.fieldLabel}>Propiedad</Text>
        <View style={styles.segmented}>
          {PROPIEDAD_EQUIPO_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => updatePropiedad(opt.value)}
              style={[styles.segmentOption, form.propiedad === opt.value && styles.segmentOptionActive]}>
              <Text style={[styles.segmentText, form.propiedad === opt.value && styles.segmentTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        {form.propiedad === 'Externo' && (
          <Field
            label="Dueño externo (nombre o RUT)"
            onChangeText={(value) => updateField('propietarioExterno', value)}
            value={form.propietarioExterno}
          />
        )}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Observaciones</Text>

          <TextInput
            multiline
            maxLength={1000}
            numberOfLines={5}
            onChangeText={(value) => updateField('observaciones', value)}
            placeholder="Observaciones generales del equipo"
            placeholderTextColor="#98A2B3"
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={form.observaciones}
          />

          <Text style={styles.characterCounter}>
            {form.observaciones.length}/1000
          </Text>
        </View>
      </Section>

      <Modal animationType="slide" onRequestClose={() => setPickerOpen(null)} transparent visible={pickerOpen !== null}>
        <Pressable onPress={() => setPickerOpen(null)} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {pickerOpen === 'tipo' ? 'Selecciona el tipo de equipo' : 'Selecciona el estado del equipo'}
            </Text>
            <FlatList
              data={pickerOpen === 'tipo' ? TIPO_EQUIPO_OPTIONS : ESTADO_EQUIPO_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (pickerOpen === 'tipo') updateField('tipo', item.value);
                    if (pickerOpen === 'estado') updateField('estado', item.value);
                    setPickerOpen(null);
                  }}
                  style={styles.modalOption}>
                  <Text style={styles.modalOptionText}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Section title="Detalles tecnicos">
        <Field label="MAC WiFi" onChangeText={(value) => updateField('macWifi', value)} value={form.macWifi} />
        <Field label="Red Ethernet (MAC)" onChangeText={(value) => updateField('redEthernet', value)} value={form.redEthernet} />
        <Field label="Sistema operativo" onChangeText={(value) => updateField('so', value)} value={form.so} />
        <Field label="Tipo disco" onChangeText={(value) => updateField('tipoDd', value)} value={form.tipoDd} />
        <Field label="Estado almacenamiento" onChangeText={(value) => updateField('estadoAlm', value)} value={form.estadoAlm} />
        <Field label="Office" onChangeText={(value) => updateField('office', value)} value={form.office} />
        <Field label="TeamViewer ID" onChangeText={(value) => updateField('teamViewer', value)} value={form.teamViewer} />
        <Field label="Clave TeamViewer" onChangeText={(value) => updateField('claveTv', value)} secureTextEntry value={form.claveTv} />
      </Section>

      <Section title="Credenciales">
        <Field label="Admin RIDS Usuario" onChangeText={(value) => updateField('adminRidsUsuario', value)} value={form.adminRidsUsuario} />
        <Field
          label="Admin RIDS Password"
          onChangeText={(value) => updateField('adminRidsPassword', value)}
          secureTextEntry
          value={form.adminRidsPassword}
        />
        <Field label="Usuario Empresa" onChangeText={(value) => updateField('usuarioEmpresa', value)} value={form.usuarioEmpresa} />
        <Field
          label="Password Empresa"
          onChangeText={(value) => updateField('passwordEmpresa', value)}
          secureTextEntry
          value={form.passwordEmpresa}
        />
        <Field label="Usuario Personal" onChangeText={(value) => updateField('usuarioPersonal', value)} value={form.usuarioPersonal} />
        <Field
          label="Password Personal"
          onChangeText={(value) => updateField('passwordPersonal', value)}
          secureTextEntry
          value={form.passwordPersonal}
        />
      </Section>

      <Section title="Adicionales">
        {form.adicionales.map((adicional, index) => (
          <View key={index} style={styles.adicionalCard}>
            <View style={styles.adicionalHeader}>
              <Text style={styles.adicionalTitle}>Adicional {index + 1}</Text>
              <Pressable onPress={() => removeAdicional(index)} style={styles.removeButton}>
                <Ionicons color="#DC2626" name="trash-outline" size={18} />
              </Pressable>
            </View>
            <Field label="Tipo" onChangeText={(value) => updateAdicional(index, 'tipo', value)} value={adicional.tipo} />
            <Field
              keyboardType="numeric"
              label="Cantidad"
              onChangeText={(value) => updateAdicional(index, 'cantidad', value)}
              value={adicional.cantidad}
            />
            <Field
              label="Descripcion"
              onChangeText={(value) => updateAdicional(index, 'descripcion', value)}
              value={adicional.descripcion}
            />
            <Field
              label="Serial adicional"
              onChangeText={(value) => updateAdicional(index, 'serialAdicional', value)}
              value={adicional.serialAdicional}
            />
          </View>
        ))}
        <AppButton onPress={addAdicional} title="Agregar adicional" variant="secondary" />
      </Section>

      <Section title="Revision">
        <Field
          label="Fecha de revisión (AAAA-MM-DD)"
          onChangeText={(value) => updateField('revisado', value)}
          value={form.revisado}
        />
        <Pressable
          onPress={() => updateField('revisado', new Date().toISOString().slice(0, 10))}
          style={styles.chip}>
          <Text style={styles.chipText}>Usar fecha de hoy</Text>
        </Pressable>
      </Section>

      <View style={styles.actions}>
        <AppButton disabled={!canSubmit} loading={submitting} onPress={guardarEquipo} title="Guardar equipo" />
        <AppButton
          disabled={submitting}
          onPress={cancelarRegistro}
          style={styles.cancelButton}
          textStyle={styles.cancelButtonText}
          title="Cancelar registro"
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <RidsSectionTitle title={title} />
      {children}
    </View>
  );
}

function Field({
  keyboardType,
  label,
  onChangeText,
  secureTextEntry,
  value,
}: {
  keyboardType?: 'default' | 'numeric';
  label: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="characters"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#98A2B3"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function normalizeAdicionales(adicionales: EquipoAdicionalForm[]) {
  return adicionales
    .filter((item) => item.tipo.trim())
    .map((item) => ({
      tipo: item.tipo.trim(),
      descripcion: item.descripcion.trim() || null,
      cantidad: Math.max(1, Number(item.cantidad) || 1),
      serialAdicional: item.serialAdicional.trim() || null,
    }));
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    marginTop: -4,
  },
  chip: {
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    color: ridsPalette.cyanDark,
    fontSize: 12,
    fontWeight: '800',
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  pickerButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
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
    maxHeight: '70%',
    paddingBottom: 24,
    paddingTop: 16,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  modalOption: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalOptionText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
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
    ...shadow,
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
    fontSize: 16,
    fontWeight: '900',
  },
  summaryText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  section: {
    marginBottom: 24,
  },
  adicionalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 11,
  },
  adicionalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  adicionalTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  segmented: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 6,
  },
  segmentOption: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  segmentOptionActive: {
    backgroundColor: ridsPalette.cyanDark,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.white,
  },
  checkField: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
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
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },

  characterCounter: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
});
