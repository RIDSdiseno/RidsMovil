// app/equipos/gestionar/asignacion.tsx

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getClientesCached,
  getSolicitantesListCached,
} from '@/src/api/rids';

import { AppButton } from '@/src/components/AppButton';
import { TextInput } from '@/src/components/AppTextInput';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { Screen } from '@/src/components/Screen';

import {
  loadGestionarEquipoState,
  saveGestionarEquipoState,
} from '@/src/equipos/gestionar-state';

import { colors, shadow } from '@/src/theme/colors';

import {
  Cliente,
  Equipo,
  Solicitante,
} from '@/src/types/api';

import { getSolicitanteId } from '@/src/visitas/visita-utils';

export default function CambiarAsignacionEquipoScreen() {
  const [equipo, setEquipo] =
    useState<Equipo | null>(null);

  const [clientes, setClientes] =
    useState<Cliente[]>([]);

  const [empresaId, setEmpresaId] =
    useState<number | null>(null);

  const [selected, setSelected] =
    useState<Solicitante | null>(null);

  const [solicitantes, setSolicitantes] =
    useState<Solicitante[]>([]);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [loadingSolicitantes, setLoadingSolicitantes] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [empresaModalOpen, setEmpresaModalOpen] =
    useState(false);

  const empresaSeleccionada =
    useMemo(
      () =>
        clientes.find(
          (cliente) =>
            cliente.id_empresa === empresaId,
        ) ?? null,
      [clientes, empresaId],
    );

  const filteredSolicitantes =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return solicitantes;
      }

      return solicitantes.filter(
        (solicitante) =>
          [
            solicitante.nombre,
            solicitante.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term),
      );
    }, [
      search,
      solicitantes,
    ]);

  useEffect(() => {
    loadScreen();
  }, []);

  async function cargarSolicitantes(
    idEmpresa: number | null,
    force = false,
  ) {
    if (!idEmpresa) {
      setSolicitantes([]);
      return;
    }

    try {
      setLoadingSolicitantes(true);

      const lista =
        await getSolicitantesListCached(
          idEmpresa,
          force,
        );

      setSolicitantes(lista);
    } catch {
      setSolicitantes([]);
    } finally {
      setLoadingSolicitantes(false);
    }
  }

  async function loadScreen(
    force = false,
  ) {
    try {
      const saved =
        await loadGestionarEquipoState();

      if (!saved.equipo) {
        router.replace(
          '/equipos/gestionar',
        );

        return;
      }

      const empresas =
        await getClientesCached(force);

      setClientes(empresas);
      setEquipo(saved.equipo);

      const empresaInicial =
        saved.asignacionModificada
          ? saved.nuevaEmpresaId
          : saved.equipo.empresaId ?? null;

      setEmpresaId(empresaInicial);

      let freshSolicitantes: Solicitante[] = [];

      if (empresaInicial) {
        freshSolicitantes =
          await getSolicitantesListCached(
            empresaInicial,
            force,
          ).catch(() => []);
      }

      setSolicitantes(freshSolicitantes);

      if (saved.asignacionModificada) {
        /*
         * Ya existe una selección temporal.
         * null aquí puede significar expresamente
         * "Sin solicitante".
         */
        setSelected(
          saved.nuevoSolicitante,
        );
      } else {
        /*
         * Primera entrada a Cambiar asignación:
         * precargamos el solicitante real del equipo.
         */
        const solicitanteActual =
          freshSolicitantes.find(
            (solicitante) =>
              getSolicitanteId(solicitante) ===
              saved.equipo?.idSolicitante,
          ) ?? null;

        setSelected(
          solicitanteActual,
        );
      }

    } catch (error) {
      Alert.alert(
        'Asignacion',
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la asignacion.',
      );
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

  async function seleccionarEmpresa(
    nuevaEmpresaId: number | null,
  ) {
    if (!equipo) {
      return;
    }

    /*
     * Si cambia empresa, eliminamos
     * automáticamente el solicitante actual,
     * porque puede pertenecer a otra empresa.
     */
    const cambioEmpresa =
      nuevaEmpresaId !==
      empresaId;

    setEmpresaId(
      nuevaEmpresaId,
    );

    if (cambioEmpresa) {
      setSelected(null);
    }

    setSearch('');
    setEmpresaModalOpen(false);

    await cargarSolicitantes(
      nuevaEmpresaId,
    );
  }

  function selectSolicitante(
    solicitante: Solicitante,
  ) {
    const id =
      getSolicitanteId(
        solicitante,
      );

    const isSelected =
      selected &&
      getSolicitanteId(
        selected,
      ) === id;

    const nextSelected =
      isSelected
        ? null
        : solicitante;

    setSelected(
      nextSelected,
    );
  }

  function quitarSolicitante() {
    setSelected(null);
  }

  async function continuar() {
    if (!equipo) {
      return;
    }

    /*
     * Se permite:
     *
     * empresa + solicitante
     * empresa + sin solicitante
     * sin empresa + sin solicitante
     *
     * No permitimos:
     * sin empresa + solicitante
     */
    if (
      empresaId === null &&
      selected !== null
    ) {
      Alert.alert(
        'Asignacion',
        'No puedes asignar un solicitante sin seleccionar una empresa.',
      );

      return;
    }

    await saveGestionarEquipoState({
      equipo,

      nuevaEmpresaId:
        empresaId,

      nuevoSolicitante:
        selected,

      asignacionModificada:
        true,
    });

    router.replace(
      '/equipos/gestionar/detalle',
    );
  }

  if (
    loading ||
    !equipo
  ) {
    return (
      <Screen
        bottomNavigation={
          <BottomNavigation />
        }
        scroll={false}
      >
        <View
          style={styles.center}
        >
          <ActivityIndicator
            color={colors.brand}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      bottomNavigation={
        <BottomNavigation />
      }
      scroll={false}
    >
      <Text
        style={styles.title}
      >
        Cambiar asignacion
      </Text>

      <Text
        style={styles.subtitle}
      >
        {equipo.serial ||
          'Equipo sin serial'}
      </Text>

      {/* =========================
          EMPRESA
      ========================= */}

      <Text
        style={styles.label}
      >
        Empresa
      </Text>

      <Pressable
        onPress={() =>
          setEmpresaModalOpen(true)
        }
        style={
          styles.selectorButton
        }
      >
        <Text
          style={
            styles.selectorText
          }
        >
          {empresaSeleccionada
            ?.nombre ??
            'Sin empresa'}
        </Text>

        <Ionicons
          color="#98A2B3"
          name="chevron-down"
          size={18}
        />
      </Pressable>

      {/* =========================
          SOLICITANTE
      ========================= */}

      <Text
        style={styles.label}
      >
        Solicitante
      </Text>

      {!empresaId ? (
        <View
          style={styles.emptyBox}
        >
          <Text
            style={
              styles.emptyText
            }
          >
            Selecciona una empresa para ver sus solicitantes.
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            onChangeText={
              setSearch
            }
            placeholder="Buscar solicitante"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            value={search}
          />

          <View
            style={
              styles.selectedBox
            }
          >
            <Text
              style={
                styles.helperText
              }
            >
              {selected
                ? `Seleccionado: ${selected.nombre}`
                : 'Sin solicitante'}
            </Text>

            {selected ? (
              <Pressable
                onPress={
                  quitarSolicitante
                }
              >
                <Text
                  style={
                    styles.clearText
                  }
                >
                  Quitar
                </Text>
              </Pressable>
            ) : null}
          </View>

          {loadingSolicitantes ? (
            <ActivityIndicator
              color={colors.brand}
              style={
                styles.loader
              }
            />
          ) : null}

          <ScrollView
            contentContainerStyle={
              styles.list
            }
            refreshControl={
              <RefreshControl
                colors={[
                  colors.brand,
                ]}
                onRefresh={
                  refreshScreen
                }
                refreshing={
                  refreshing
                }
                tintColor={
                  colors.brand
                }
              />
            }
            scrollIndicatorInsets={{
              bottom: 150,
            }}
            style={
              styles.listScroll
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            {filteredSolicitantes.map(
              (
                solicitante,
              ) => {
                const id =
                  getSolicitanteId(
                    solicitante,
                  );

                const isSelected =
                  Boolean(
                    selected &&
                    getSolicitanteId(
                      selected,
                    ) === id,
                  );

                const isCurrent =
                  id ===
                  equipo.idSolicitante;

                return (
                  <Pressable
                    key={id}
                    onPress={() =>
                      selectSolicitante(
                        solicitante,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                        styles.card,

                        isSelected &&
                        styles.cardSelected,

                        pressed &&
                        styles.cardPressed,
                      ]}
                  >
                    <View
                      style={
                        styles.icon
                      }
                    >
                      <Ionicons
                        color={
                          colors.brand
                        }
                        name="person-outline"
                        size={24}
                      />
                    </View>

                    <View
                      style={
                        styles.copy
                      }
                    >
                      <Text
                        style={
                          styles.cardTitle
                        }
                      >
                        {
                          solicitante.nombre
                        }
                      </Text>

                      <Text
                        style={
                          styles.cardText
                        }
                      >
                        {isCurrent
                          ? 'Asignacion actual'
                          : solicitante.email ||
                          'Solicitante'}
                      </Text>
                    </View>

                    {isSelected ? (
                      <View
                        style={
                          styles.check
                        }
                      >
                        <Ionicons
                          color={
                            colors.white
                          }
                          name="checkmark"
                          size={16}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                );
              },
            )}
          </ScrollView>
        </>
      )}

      {/* =========================
          ACCIONES
      ========================= */}

      <View
        style={styles.actions}
      >
        <AppButton
          onPress={
            continuar
          }
          title="Usar asignacion"
        />

        <AppButton
          onPress={() =>
            router.back()
          }
          title="Volver"
          variant="ghost"
        />
      </View>

      {/* =========================
          MODAL EMPRESA
      ========================= */}

      <Modal
        animationType="slide"
        onRequestClose={() =>
          setEmpresaModalOpen(false)
        }
        transparent
        visible={
          empresaModalOpen
        }
      >
        <Pressable
          onPress={() =>
            setEmpresaModalOpen(false)
          }
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalSheet
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Selecciona la empresa
            </Text>

            <ScrollView>
              <Pressable
                onPress={() =>
                  seleccionarEmpresa(
                    null,
                  )
                }
                style={
                  styles.modalOption
                }
              >
                <Text
                  style={[
                    styles.modalOptionText,

                    empresaId ===
                    null &&
                    styles.modalOptionTextActive,
                  ]}
                >
                  Sin empresa
                </Text>

                {empresaId ===
                  null ? (
                  <Ionicons
                    color={
                      colors.brand
                    }
                    name="checkmark"
                    size={18}
                  />
                ) : null}
              </Pressable>

              {clientes.map(
                (cliente) => {
                  const active =
                    empresaId ===
                    cliente.id_empresa;

                  return (
                    <Pressable
                      key={
                        cliente.id_empresa
                      }
                      onPress={() =>
                        seleccionarEmpresa(
                          cliente.id_empresa,
                        )
                      }
                      style={
                        styles.modalOption
                      }
                    >
                      <Text
                        style={[
                          styles.modalOptionText,

                          active &&
                          styles.modalOptionTextActive,
                        ]}
                      >
                        {
                          cliente.nombre
                        }
                      </Text>

                      {active ? (
                        <Ionicons
                          color={
                            colors.brand
                          }
                          name="checkmark"
                          size={18}
                        />
                      ) : null}
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    center: {
      alignItems: 'center',
      flex: 1,
      justifyContent:
        'center',
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

    label: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 6,
      marginTop: 8,
    },

    selectorButton: {
      alignItems: 'center',
      backgroundColor:
        colors.surface,
      borderColor:
        colors.line,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      minHeight: 52,
      paddingHorizontal: 14,
    },

    selectorText: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '700',
    },

    input: {
      backgroundColor:
        colors.surface,
      borderColor:
        colors.line,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 15,
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },

    selectedBox: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginTop: 10,
    },

    helperText: {
      color: colors.muted,
      fontSize: 13,
    },

    clearText: {
      color: '#DC2626',
      fontSize: 12,
      fontWeight: '800',
    },

    emptyBox: {
      backgroundColor:
        colors.surfaceAlt,
      borderRadius: 14,
      marginTop: 4,
      padding: 14,
    },

    emptyText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },

    loader: {
      marginTop: 14,
    },

    list: {
      gap: 12,
      paddingBottom: 20,
      paddingTop: 14,
    },

    listScroll: {
      flex: 1,
    },

    card: {
      alignItems: 'center',
      backgroundColor:
        colors.surface,
      borderColor:
        colors.line,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      padding: 16,
      ...shadow,
    },

    cardSelected: {
      backgroundColor:
        colors.brandSoft,
      borderColor:
        colors.brand,
    },

    cardPressed: {
      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    icon: {
      alignItems: 'center',
      backgroundColor:
        colors.brandSoft,
      borderRadius: 16,
      height: 48,
      justifyContent:
        'center',
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
      backgroundColor:
        colors.brand,
      borderRadius: 13,
      height: 28,
      justifyContent:
        'center',
      width: 28,
    },

    actions: {
      gap: 10,
      marginTop: 14,
      marginBottom: 18,
    },

    modalOverlay: {
      backgroundColor:
        'rgba(15, 23, 42, 0.45)',
      flex: 1,
      justifyContent:
        'flex-end',
    },

    modalSheet: {
      backgroundColor:
        colors.white,
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
      alignItems: 'center',
      borderBottomColor:
        colors.line,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },

    modalOptionText: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '600',
    },

    modalOptionTextActive: {
      color: colors.brand,
      fontWeight: '800',
    },
  });