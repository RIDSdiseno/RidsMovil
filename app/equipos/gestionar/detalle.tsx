// app/equipos/gestionar/detalle.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  actualizarEquipo,
  cambiarAsignacionEquipo,
  getEquipoDetalle,
} from '@/src/api/rids';

import { AppButton } from '@/src/components/AppButton';
import { TextInput } from '@/src/components/AppTextInput';
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
import {
  clearGestionarEquipoState,
  loadGestionarEquipoState,
  saveGestionarEquipoState,
} from '@/src/equipos/gestionar-state';
import { colors, shadow } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { EquipoDetalle, Solicitante } from '@/src/types/api';
import { getSolicitanteId } from '@/src/visitas/visita-utils';

type EquipoAdicionalForm = {
  tipo: string;
  descripcion: string;
  cantidad: string;
  serialAdicional: string;
};

type EquipoEditForm = {
  serial: string;
  marca: string;
  modelo: string;
  tipo: string;
  estado: string;
  anioPc: string;
  disco: string;
  procesador: string;
  ram: string;
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

const initialForm: EquipoEditForm = {
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
  propietarioExterno: '',
  observaciones: '',
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

const editableFields: Exclude<keyof EquipoEditForm, 'adicionales' | 'propiedad' | 'anioPc'>[] = [
  'serial',
  'marca',
  'modelo',
  'tipo',
  'estado',
  'procesador',
  'ram',
  'disco',
  'propietarioExterno',
  'observaciones',
  'macWifi',
  'redEthernet',
  'so',
  'tipoDd',
  'estadoAlm',
  'office',
  'teamViewer',
  'claveTv',
  'revisado',
  'adminRidsUsuario',
  'adminRidsPassword',
  'usuarioEmpresa',
  'passwordEmpresa',
  'usuarioPersonal',
  'passwordPersonal',
];

function formToState(equipo: EquipoDetalle): EquipoEditForm {
  return {
    serial: equipo.serial ?? '',
    marca: equipo.marca ?? '',
    modelo: equipo.modelo ?? '',
    tipo: equipo.tipo ?? 'GENERICO',
    estado: equipo.estado ?? 'ACTIVO',
    anioPc: equipo.anioPc != null ? String(equipo.anioPc) : '',
    procesador: equipo.procesador ?? '',
    ram: equipo.ram ?? '',
    disco: equipo.disco ?? '',
    propiedad: (equipo.propiedad as PropiedadEquipo) ?? 'Empresa',
    propietarioExterno: equipo.propietarioExterno ?? '',
    observaciones: equipo.observaciones ?? '',
    macWifi: equipo.macWifi ?? '',
    redEthernet: equipo.redEthernet ?? '',
    so: equipo.so ?? '',
    tipoDd: equipo.tipoDd ?? '',
    estadoAlm: equipo.estadoAlm ?? '',
    office: equipo.office ?? '',
    teamViewer: equipo.teamViewer ?? '',
    claveTv: equipo.claveTv ?? '',
    revisado: equipo.revisado ?? '',
    adminRidsUsuario: equipo.adminRidsUsuario ?? '',
    adminRidsPassword: equipo.adminRidsPassword ?? '',
    usuarioEmpresa: equipo.usuarioEmpresa ?? '',
    passwordEmpresa: equipo.passwordEmpresa ?? '',
    usuarioPersonal: equipo.usuarioPersonal ?? '',
    passwordPersonal: equipo.passwordPersonal ?? '',
    adicionales: (equipo.adicionales ?? []).map((item) => ({
      tipo: item.tipo ?? '',
      descripcion: item.descripcion ?? '',
      cantidad: String(item.cantidad ?? 1),
      serialAdicional: item.serialAdicional ?? '',
    })),
  };
}

export default function GestionarEquipoDetalleScreen() {
  const [equipo, setEquipo] = useState<EquipoDetalle | null>(null);
  const [form, setForm] = useState<EquipoEditForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<'tipo' | 'estado' | null>(null);

  const [nuevaEmpresaId, setNuevaEmpresaId] =
    useState<number | null>(null);

  const [nuevoSolicitante, setNuevoSolicitante] =
    useState<Solicitante | null>(null);

  const [asignacionModificada, setAsignacionModificada] =
    useState(false);

  const [softwareExpanded, setSoftwareExpanded] = useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

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

  const hasChanges = useMemo(() => {
    if (!equipo) return false;

    const changedFields = editableFields.some(
      (field) =>
        form[field].trim() !==
        String(
          equipo[
          field as keyof EquipoDetalle
          ] ?? '',
        ).trim(),
    );

    const changedAnioPc =
      form.anioPc.trim() !==
      (
        equipo.anioPc != null
          ? String(equipo.anioPc)
          : ''
      );

    const changedPropiedad =
      form.propiedad !==
      (equipo.propiedad ?? 'Empresa');

    const changedAdicionales =
      JSON.stringify(
        normalizeAdicionales(
          form.adicionales,
        ),
      ) !==
      JSON.stringify(
        (equipo.adicionales ?? []).map(
          (item) => ({
            tipo:
              item.tipo,

            descripcion:
              item.descripcion ??
              null,

            cantidad:
              item.cantidad,

            serialAdicional:
              item.serialAdicional ??
              null,
          }),
        ),
      );

    const changedAsignacion =
      asignacionModificada;

    return (
      changedFields ||
      changedAnioPc ||
      changedPropiedad ||
      changedAdicionales ||
      changedAsignacion
    );
  }, [
    equipo,
    form,
    asignacionModificada,
  ]);

  useEffect(() => {
    async function boot() {
      const saved = await loadGestionarEquipoState();
      if (!saved.equipo) {
        router.replace('/equipos/gestionar');
        return;
      }

      setNuevaEmpresaId(
        saved.asignacionModificada
          ? saved.nuevaEmpresaId
          : saved.equipo?.empresaId ?? null,
      );

      setNuevoSolicitante(
        saved.asignacionModificada
          ? saved.nuevoSolicitante
          : null,
      );

      setAsignacionModificada(
        saved.asignacionModificada ?? false,
      );

      try {
        const fresh = await getEquipoDetalle(saved.equipo.id_equipo);
        setEquipo(fresh);
        setForm(formToState(fresh));
      } catch (error) {
        Alert.alert('Equipo', error instanceof Error ? error.message : 'No se pudo cargar el equipo.');
        setEquipo(saved.equipo as EquipoDetalle);
        setForm(formToState(saved.equipo as EquipoDetalle));
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, []);

  async function ejecutarRefresh() {
    if (!equipo) return;

    try {
      setRefreshing(true);

      const fresh =
        await getEquipoDetalle(
          equipo.id_equipo,
        );

      setEquipo(fresh);
      setForm(
        formToState(fresh),
      );

      /*
       * Restablecemos la asignación a la
       * información real recién consultada.
       */
      setNuevaEmpresaId(
        fresh.empresaId ?? null,
      );

      setNuevoSolicitante(null);

      setAsignacionModificada(false);

      /*
       * Actualizamos también el estado temporal
       * para que, si se navega a otra pantalla,
       * no vuelva información antigua.
       */
      await saveGestionarEquipoState({
        equipo: fresh,

        nuevaEmpresaId:
          fresh.empresaId ?? null,

        nuevoSolicitante: null,

        asignacionModificada: false,
      });

    } catch (error) {
      Alert.alert(
        'Equipo',
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la información del equipo.',
      );
    } finally {
      setRefreshing(false);
    }
  }

  function refreshEquipo() {
    /*
     * Si existen cambios sin guardar,
     * evitamos eliminarlos accidentalmente.
     */
    if (hasChanges) {
      Alert.alert(
        'Actualizar equipo',
        'Hay cambios sin guardar. Si actualizas, estos cambios se perderán.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Actualizar',
            style: 'destructive',
            onPress: () => {
              void ejecutarRefresh();
            },
          },
        ],
      );

      return;
    }

    void ejecutarRefresh();
  }

  function updateField(key: Exclude<keyof EquipoEditForm, 'adicionales' | 'propiedad'>, value: string) {
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

  async function goCambiarAsignacion() {
    if (!equipo) return;

    await saveGestionarEquipoState({
      equipo,

      nuevaEmpresaId:
        asignacionModificada
          ? nuevaEmpresaId
          : equipo.empresaId ?? null,

      nuevoSolicitante,

      asignacionModificada,
    });

    router.push(
      '/equipos/gestionar/asignacion',
    );
  }

  async function goIngresarTaller() {
    if (!equipo) return;

    /*
     * La OT se generará con los datos que
     * actualmente existen en backend.
     *
     * Si hay modificaciones locales sin guardar,
     * evitamos que el usuario piense que esos
     * cambios formarán parte del ingreso.
     */
    if (hasChanges) {
      Alert.alert(
        'Cambios sin guardar',
        'Tienes cambios pendientes en este equipo. Guarda los cambios antes de ingresarlo a Taller.',
        [
          {
            text: 'Aceptar',
            style: 'cancel',
          },
        ],
      );

      return;
    }

    router.push({
      pathname: '/equipos/ordenes-taller/ingreso',
      params: {
        equipoId: String(equipo.id_equipo),
      },
    });
  }

  async function guardarCambios() {
    if (!equipo) return;

    if (!canSubmit) {
      Alert.alert('Equipo', 'Completa serial, marca y modelo.');
      return;
    }

    try {
      setSubmitting(true);
      await actualizarEquipo(equipo.id_equipo, {
        serial: form.serial.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        tipo: form.tipo,
        estado: form.estado,
        ...(form.anioPc.trim() && { anioPc: Number(form.anioPc.trim()) }),
        disco: form.disco.trim(),
        procesador: form.procesador.trim(),
        ram: form.ram.trim(),
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

      if (asignacionModificada) {
        const solicitanteSeleccionadoId =
          nuevoSolicitante
            ? getSolicitanteId(
              nuevoSolicitante,
            )
            : null;

        await cambiarAsignacionEquipo(
          equipo.id_equipo,
          {
            empresaId:
              nuevaEmpresaId,

            solicitanteId:
              solicitanteSeleccionadoId,
          },
        );
      }

      await clearGestionarEquipoState();
      router.replace('/equipos/gestionar');
      Alert.alert('Equipo', 'Equipo actualizado correctamente.');
    } catch (error) {
      Alert.alert('Equipo', error instanceof Error ? error.message : 'No se pudo actualizar el equipo.');
    } finally {
      setSubmitting(false);
    }
  }

  function cancelarEdicion() {
    Alert.alert('Cancelar edicion', 'Se eliminara el estado actual de la edicion del equipo.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar edicion',
        style: 'destructive',
        onPress: async () => {
          await clearGestionarEquipoState();
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  async function volverASeleccionarEquipo() {
    await clearGestionarEquipoState();
    router.replace('/equipos/gestionar');
  }

  if (loading || !equipo) {
    return (
      <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const solicitanteActual =
    asignacionModificada
      ? nuevoSolicitante?.nombre ?? 'Sin solicitante'
      : equipo.nombreSolicitante ?? 'Sin solicitante';

  return (
    <Screen
      bottomNavigation={
        <BottomNavigation />
      }
      onRefresh={
        refreshEquipo
      }
      refreshing={
        refreshing
      }
    >
      <RidsFlowHeader
        icon="create-outline"
        label="EDICIÓN DE EQUIPO"
        subtitle="Actualiza especificaciones, credenciales y asignación"
        title={equipo.serial || 'Equipo sin serial'}
      />

      <Pressable onPress={volverASeleccionarEquipo} style={({ pressed }) => [styles.summaryCard, pressed && styles.cardPressed]}>
        <View style={styles.summaryIcon}>
          <Ionicons color={ridsPalette.cyanDark} name="laptop-outline" size={23} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{[equipo.marca, equipo.modelo].filter(Boolean).join(' ') || 'Equipo'}</Text>
          <Text style={styles.summaryText}>Asignado a {solicitanteActual}</Text>
        </View>
        <Ionicons color={ridsPalette.cyanDark} name="chevron-forward" size={18} />
      </Pressable>

      {(
        equipo.creadoEn ||
        equipo.creadoPor ||
        equipo.ultimaEdicion ||
        equipo.updatedAt ||
        equipo.ultimaMantencion
      ) && (
          <View style={styles.auditCard}>
            <Text style={styles.auditTitle}>Registro</Text>

            {equipo.creadoEn && (
              <Text style={styles.auditText}>
                Creado el{' '}
                {new Date(equipo.creadoEn).toLocaleDateString('es-CL')}
                {equipo.creadoPor
                  ? ` por ${equipo.creadoPor.nombre}`
                  : ''}
                {!equipo.creacionAuditada
                  ? ' (fecha estimada, sin auditoría detallada)'
                  : ''}
              </Text>
            )}

            {(equipo.ultimaEdicion || equipo.updatedAt) && (
              <Text style={styles.auditText}>
                Última edición:{' '}
                {new Date(
                  equipo.ultimaEdicion ?? equipo.updatedAt!,
                ).toLocaleString('es-CL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {' · '}
                {equipo.ultimaEdicionPor?.nombre ?? 'Agente / Sistema'}
              </Text>
            )}

            {equipo.ultimaMantencion && (
              <Text style={styles.auditText}>
                Última mantención:{' '}
                {new Date(
                  equipo.ultimaMantencion,
                ).toLocaleString('es-CL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {' · '}
                {equipo.ultimaMantencionPor?.nombre ?? 'Agente / Sistema'}
              </Text>
            )}
          </View>
        )}

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
          <Ionicons color={ridsPalette.cyanDark} name="chevron-down" size={18} />
        </Pressable>

        <Text style={styles.fieldLabel}>Estado del equipo</Text>
        <Pressable onPress={() => setPickerOpen('estado')} style={styles.pickerButton}>
          <Text style={styles.pickerButtonText}>
            {ESTADO_EQUIPO_OPTIONS.find((o) => o.value === form.estado)?.label ?? 'Selecciona estado'}
          </Text>
          <Ionicons color={ridsPalette.cyanDark} name="chevron-down" size={18} />
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
            onChangeText={(value) =>
              updateField('observaciones', value)
            }
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

      {(equipo.diskTotalGb != null && equipo.diskTotalGb > 0) && (
        <Section title="Uso de disco">
          {(() => {
            const total = equipo.diskTotalGb ?? 0;
            const libre = equipo.diskFreeGb ?? 0;
            const usado = Math.max(0, total - libre);
            const porcentaje = total > 0 ? Math.min(100, Math.round((usado / total) * 100)) : 0;
            const barColor = porcentaje >= 90 ? '#DC2626' : porcentaje >= 75 ? '#F59E0B' : colors.brand;
            return (
              <View>
                <View style={styles.diskBarTrack}>
                  <View style={[styles.diskBarFill, { backgroundColor: barColor, width: `${porcentaje}%` }]} />
                </View>
                <Text style={styles.diskText}>
                  {libre.toFixed(1)} GB libres de {total.toFixed(1)} GB ({porcentaje}% usado)
                </Text>
              </View>
            );
          })()}
        </Section>
      )}

      {(equipo.antivirusNombre || equipo.antivirusActivo != null || equipo.firewallActivo != null || equipo.bitlockerEstado || equipo.windowsUpdate) && (
        <Section title="Seguridad y estado">
          {(equipo.antivirusNombre || equipo.antivirusActivo != null) && (
            <InfoRow label="Antivirus" value={equipo.antivirusNombre ?? 'Sin nombre reportado'} badge={equipo.antivirusActivo} />
          )}
          {equipo.firewallActivo != null && (
            <InfoRow label="Firewall" value="" badge={equipo.firewallActivo} />
          )}
          {equipo.bitlockerEstado != null && <InfoRow label="BitLocker" value={equipo.bitlockerEstado} />}
          {equipo.windowsUpdate != null && <InfoRow label="Windows Update" value={equipo.windowsUpdate} />}
        </Section>
      )}

      {equipo.softwares && equipo.softwares.length > 0 && (
        <View style={styles.softwareSection}>
          <Pressable
            onPress={() => setSoftwareExpanded((current) => !current)}
            style={({ pressed }) => [
              styles.softwareHeader,
              pressed && styles.softwareHeaderPressed,
            ]}
          >
            <View style={styles.softwareHeaderLeft}>
              <View style={styles.softwareHeaderIcon}>
                <Ionicons
                  color={colors.brand}
                  name="apps-outline"
                  size={20}
                />
              </View>

              <View style={styles.softwareHeaderCopy}>
                <Text style={styles.softwareHeaderTitle}>
                  Software instalado
                </Text>

                <Text style={styles.softwareHeaderSubtitle}>
                  {equipo.softwares.length}{' '}
                  {equipo.softwares.length === 1
                    ? 'aplicación detectada'
                    : 'aplicaciones detectadas'}
                </Text>
              </View>
            </View>

            <Ionicons
              color={ridsPalette.cyanDark}
              name={softwareExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
            />
          </Pressable>

          {softwareExpanded && (
            <View style={styles.softwareList}>
              {equipo.softwares.map((sw, index) => (
                <View
                  key={sw.id}
                  style={[
                    styles.softwareRow,
                    index === equipo.softwares!.length - 1 &&
                    styles.softwareRowLast,
                  ]}
                >
                  <Text style={styles.softwareNombre}>
                    {sw.nombre}
                  </Text>

                  <Text style={styles.softwareMeta}>
                    {[sw.version, sw.publisher]
                      .filter(Boolean)
                      .join(' · ') || 'Sin datos adicionales'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <AppButton
          onPress={goCambiarAsignacion}
          title="Cambiar asignación"
          variant="secondary"
        />

        <AppButton
          disabled={submitting}
          onPress={goIngresarTaller}
          title="Ingresar Orden de Taller"
          variant="secondary"
        />

        <AppButton
          disabled={!hasChanges || !canSubmit}
          loading={submitting}
          onPress={guardarCambios}
          title="Guardar"
        />

        <AppButton
          disabled={submitting}
          onPress={cancelarEdicion}
          style={styles.cancelButton}
          textStyle={styles.cancelButtonText}
          title="Cancelar edicion"
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

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: boolean | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <View style={styles.infoRowValueGroup}>
        {badge != null && (
          <View style={[styles.badge, badge ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={[styles.badgeText, badge ? styles.badgeTextOk : styles.badgeTextWarn]}>
              {badge ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        )}
        <Text style={styles.infoRowValue}>{value}</Text>
      </View>
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
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
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
  auditCard: {
    backgroundColor: ridsPalette.cyanSoft,
    borderColor: '#BDE9EC',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
    padding: 10,
  },
  auditTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  auditText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
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
  diskBarTrack: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  diskBarFill: {
    borderRadius: 999,
    height: '100%',
  },
  diskText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
  infoRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  infoRowLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  infoRowValueGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  infoRowValue: {
    color: colors.muted,
    fontSize: 13,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeOk: {
    backgroundColor: '#DCFCE7',
  },
  badgeWarn: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeTextOk: {
    color: '#15803D',
  },
  badgeTextWarn: {
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
  softwareSection: {
    marginBottom: 24,
  },

  softwareHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },

  softwareHeaderPressed: {
    opacity: 0.8,
  },

  softwareHeaderLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },

  softwareHeaderIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  softwareHeaderCopy: {
    flex: 1,
  },

  softwareHeaderTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },

  softwareHeaderSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },

  softwareList: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderColor: colors.line,
    borderTopWidth: 0,
    borderWidth: 1,
    marginTop: -1,
    paddingHorizontal: 14,
  },

  softwareRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: 11,
  },

  softwareRowLast: {
    borderBottomWidth: 0,
  },

  softwareNombre: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },

  softwareMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
});
