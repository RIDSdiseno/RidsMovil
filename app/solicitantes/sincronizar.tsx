import { Ionicons } from '@expo/vector-icons';
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
} from '@/src/api/rids';

import {
    SyncProvider,
    SyncSolicitantesResponse,
    syncGoogleSolicitantes,
    syncMicrosoftSolicitantes,
} from '@/src/api/solicitantes-sync';

import { TextInput } from '@/src/components/AppTextInput';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { Screen } from '@/src/components/Screen';

import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

import type {
    Cliente,
} from '@/src/types/api';

export default function SincronizarSolicitantesScreen() {
    const [
        clientes,
        setClientes,
    ] = useState<Cliente[]>([]);

    const [
        empresa,
        setEmpresa,
    ] = useState<Cliente | null>(
        null,
    );

    const [
        domain,
        setDomain,
    ] = useState('');

    const [
        provider,
        setProvider,
    ] =
        useState<SyncProvider>(
            'MICROSOFT',
        );

    const [
        resultado,
        setResultado,
    ] =
        useState<SyncSolicitantesResponse | null>(
            null,
        );

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        refreshing,
        setRefreshing,
    ] = useState(false);

    const [
        syncing,
        setSyncing,
    ] = useState(false);

    const [
        modalOpen,
        setModalOpen,
    ] = useState(false);

    const [
        search,
        setSearch,
    ] = useState('');

    /* =========================================================
       EMPRESAS
    ========================================================= */

    useEffect(() => {
        loadEmpresas();
    }, []);

    async function loadEmpresas(
        force = false,
    ) {
        try {
            setLoading(true);

            const data =
                await getClientesCached(
                    force,
                );

            setClientes(data);
        } catch (error) {
            setClientes([]);

            Alert.alert(
                'Empresas',
                error instanceof Error
                    ? error.message
                    : 'No se pudieron cargar las empresas.',
            );
        } finally {
            setLoading(false);
        }
    }

    async function refreshEmpresas() {
        try {
            setRefreshing(true);

            await loadEmpresas(
                true,
            );
        } finally {
            setRefreshing(false);
        }
    }

    /* =========================================================
       FILTROS
    ========================================================= */

    const filteredClientes =
        useMemo(() => {
            const term =
                search
                    .trim()
                    .toLowerCase();

            const base =
                term
                    ? clientes.filter(
                        (cliente) =>
                            [
                                cliente.nombre,
                                cliente
                                    .detalleEmpresa
                                    ?.rut,
                            ]
                                .filter(Boolean)
                                .join(' ')
                                .toLowerCase()
                                .includes(term),
                    )
                    : clientes;

            return [...base].sort(
                (a, b) =>
                    a.nombre.localeCompare(
                        b.nombre,
                    ),
            );
        }, [
            clientes,
            search,
        ]);

    const dominiosEmpresa =
        useMemo(() => {
            if (!empresa) {
                return [];
            }

            return Array.from(
                new Set(
                    (empresa.dominios ?? [])
                        .map((item) =>
                            item
                                .trim()
                                .toLowerCase(),
                        )
                        .filter(Boolean),
                ),
            );
        }, [empresa]);

    /* =========================================================
       SELECCIÓN EMPRESA
    ========================================================= */

    function seleccionarEmpresa(
        cliente: Cliente,
    ) {
        const dominios =
            Array.from(
                new Set(
                    (cliente.dominios ?? [])
                        .map((item) =>
                            item
                                .trim()
                                .toLowerCase(),
                        )
                        .filter(Boolean),
                ),
            );

        setEmpresa(cliente);

        setDomain(
            dominios[0] ?? '',
        );

        setResultado(null);
        setSearch('');
        setModalOpen(false);
    }

    /* =========================================================
       SINCRONIZAR
    ========================================================= */

    function solicitarSincronizacion() {
        if (!empresa) {
            Alert.alert(
                'Empresa requerida',
                'Debes seleccionar una empresa.',
            );

            return;
        }

        if (
            dominiosEmpresa.length === 0
        ) {
            Alert.alert(
                'Empresa sin dominio',
                'La empresa seleccionada no tiene dominios configurados.',
            );

            return;
        }

        if (
            !domain ||
            !dominiosEmpresa.includes(
                domain,
            )
        ) {
            Alert.alert(
                'Dominio requerido',
                'Selecciona un dominio válido.',
            );

            return;
        }

        const proveedor =
            provider ===
                'MICROSOFT'
                ? 'Microsoft 365'
                : 'Google Workspace';

        Alert.alert(
            'Sincronizar solicitantes',
            `Empresa: ${empresa.nombre}\nDominio: ${domain}\nProveedor: ${proveedor}\n\n¿Deseas continuar?`,
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Sincronizar',
                    onPress:
                        ejecutarSincronizacion,
                },
            ],
        );
    }

    async function ejecutarSincronizacion() {
        if (
            !empresa ||
            !domain
        ) {
            return;
        }

        try {
            setSyncing(true);
            setResultado(null);

            const payload = {
                empresaId:
                    empresa.id_empresa,

                domain,
            };

            const response =
                provider ===
                    'MICROSOFT'
                    ? await syncMicrosoftSolicitantes(
                        payload,
                    )
                    : await syncGoogleSolicitantes(
                        payload,
                    );

            setResultado(
                response,
            );

            Alert.alert(
                'Sincronización completada',
                [
                    `Encontrados: ${response.total ?? 0}`,
                    `Creados: ${response.created ?? 0}`,
                    `Actualizados: ${response.updated ?? 0}`,
                    `Omitidos: ${response.skipped ?? 0}`,
                    `Desactivados: ${response.deactivated ?? 0}`,
                ].join('\n'),
            );
        } catch (error) {
            console.error(
                '[SYNC SOLICITANTES]',
                error,
            );

            Alert.alert(
                'Error',
                error instanceof Error
                    ? error.message
                    : 'No fue posible sincronizar los solicitantes.',
            );
        } finally {
            setSyncing(false);
        }
    }

    return (
        <Screen
            bottomNavigation={
                <BottomNavigation />
            }
            scroll
        >
            <RidsFlowHeader
                icon="sync-outline"
                label="SOLICITANTES"
                subtitle="Microsoft 365 y Google Workspace"
                title="Sincronizar solicitantes"
            />

            {/* =====================================================
          EMPRESA
      ====================================================== */}

            <View
                style={
                    styles.card
                }
            >
                <Text
                    style={
                        styles.sectionTitle
                    }
                >
                    Empresa
                </Text>

                <Text
                    style={
                        styles.sectionSubtitle
                    }
                >
                    Selecciona la empresa cuyos
                    solicitantes deseas actualizar.
                </Text>

                <Pressable
                    onPress={() =>
                        setModalOpen(true)
                    }
                    style={
                        styles.selectButton
                    }
                >
                    <View
                        style={
                            styles.iconBox
                        }
                    >
                        <Ionicons
                            color={
                                ridsPalette.cyanDark
                            }
                            name="business-outline"
                            size={21}
                        />
                    </View>

                    <View
                        style={
                            styles.selectContent
                        }
                    >
                        <Text
                            style={
                                styles.selectLabel
                            }
                        >
                            Empresa
                        </Text>

                        <Text
                            numberOfLines={1}
                            style={
                                empresa
                                    ? styles.selectValue
                                    : styles.placeholder
                            }
                        >
                            {empresa?.nombre ??
                                'Seleccionar empresa'}
                        </Text>
                    </View>

                    <Ionicons
                        color={
                            ridsPalette.slate
                        }
                        name="chevron-forward"
                        size={19}
                    />
                </Pressable>

                {empresa?.detalleEmpresa
                    ?.rut ? (
                    <Text
                        style={
                            styles.meta
                        }
                    >
                        RUT{' '}
                        {
                            empresa
                                .detalleEmpresa
                                .rut
                        }
                    </Text>
                ) : null}
            </View>

            {/* =====================================================
          DOMINIOS
      ====================================================== */}

            {empresa ? (
                <View
                    style={
                        styles.card
                    }
                >
                    <Text
                        style={
                            styles.sectionTitle
                        }
                    >
                        Dominio
                    </Text>

                    <Text
                        style={
                            styles.sectionSubtitle
                        }
                    >
                        Dominio utilizado para
                        consultar los usuarios.
                    </Text>

                    {dominiosEmpresa.length ===
                        0 ? (
                        <View
                            style={
                                styles.warning
                            }
                        >
                            <Ionicons
                                color="#B54708"
                                name="warning-outline"
                                size={20}
                            />

                            <View
                                style={{
                                    flex: 1,
                                }}
                            >
                                <Text
                                    style={
                                        styles.warningTitle
                                    }
                                >
                                    Sin dominio
                                    configurado
                                </Text>

                                <Text
                                    style={
                                        styles.warningText
                                    }
                                >
                                    Debes configurar al
                                    menos un dominio para
                                    esta empresa en la
                                    intranet.
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View
                            style={
                                styles.domainList
                            }
                        >
                            {dominiosEmpresa.map(
                                (item) => {
                                    const selected =
                                        domain === item;

                                    return (
                                        <Pressable
                                            key={
                                                item
                                            }
                                            onPress={() => {
                                                setDomain(
                                                    item,
                                                );

                                                setResultado(
                                                    null,
                                                );
                                            }}
                                            style={[
                                                styles.domainCard,

                                                selected &&
                                                styles.domainSelected,
                                            ]}
                                        >
                                            <View
                                                style={
                                                    styles.domainIcon
                                                }
                                            >
                                                <Ionicons
                                                    color={
                                                        ridsPalette.cyanDark
                                                    }
                                                    name="globe-outline"
                                                    size={20}
                                                />
                                            </View>

                                            <Text
                                                style={
                                                    styles.domainText
                                                }
                                            >
                                                {item}
                                            </Text>

                                            <Ionicons
                                                color={
                                                    selected
                                                        ? ridsPalette.cyanDark
                                                        : '#B7C0CE'
                                                }
                                                name={
                                                    selected
                                                        ? 'checkmark-circle'
                                                        : 'ellipse-outline'
                                                }
                                                size={22}
                                            />
                                        </Pressable>
                                    );
                                },
                            )}
                        </View>
                    )}
                </View>
            ) : null}

            {/* =====================================================
          PROVEEDOR
      ====================================================== */}

            <View
                style={
                    styles.card
                }
            >
                <Text
                    style={
                        styles.sectionTitle
                    }
                >
                    Proveedor
                </Text>

                <Text
                    style={
                        styles.sectionSubtitle
                    }
                >
                    Selecciona desde qué servicio
                    deseas sincronizar.
                </Text>

                <ProviderCard
                    description="Microsoft Graph"
                    icon="logo-microsoft"
                    label="Microsoft 365"
                    onPress={() => {
                        setProvider(
                            'MICROSOFT',
                        );

                        setResultado(null);
                    }}
                    selected={
                        provider ===
                        'MICROSOFT'
                    }
                />

                <ProviderCard
                    description="Google Directory"
                    icon="logo-google"
                    label="Google Workspace"
                    onPress={() => {
                        setProvider(
                            'GOOGLE',
                        );

                        setResultado(null);
                    }}
                    selected={
                        provider ===
                        'GOOGLE'
                    }
                />
            </View>

            {/* =====================================================
          BOTÓN
      ====================================================== */}

            <Pressable
                disabled={
                    syncing ||
                    !empresa ||
                    dominiosEmpresa.length ===
                    0
                }
                onPress={
                    solicitarSincronizacion
                }
                style={[
                    styles.syncButton,

                    (
                        syncing ||
                        !empresa ||
                        dominiosEmpresa.length ===
                        0
                    ) &&
                    styles.syncDisabled,
                ]}
            >
                {syncing ? (
                    <>
                        <ActivityIndicator
                            color={
                                colors.white
                            }
                        />

                        <Text
                            style={
                                styles.syncText
                            }
                        >
                            Sincronizando...
                        </Text>
                    </>
                ) : (
                    <>
                        <Ionicons
                            color={
                                colors.white
                            }
                            name="sync-outline"
                            size={20}
                        />

                        <Text
                            style={
                                styles.syncText
                            }
                        >
                            Sincronizar solicitantes
                        </Text>
                    </>
                )}
            </Pressable>

            {/* =====================================================
          RESULTADO
      ====================================================== */}

            {resultado ? (
                <View
                    style={
                        styles.resultCard
                    }
                >
                    <View
                        style={
                            styles.resultHeader
                        }
                    >
                        <View
                            style={
                                styles.resultIcon
                            }
                        >
                            <Ionicons
                                color={
                                    colors.white
                                }
                                name="checkmark"
                                size={18}
                            />
                        </View>

                        <View>
                            <Text
                                style={
                                    styles.resultTitle
                                }
                            >
                                Sincronización
                                completada
                            </Text>

                            <Text
                                style={
                                    styles.resultDomain
                                }
                            >
                                {resultado.domain}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={
                            styles.resultGrid
                        }
                    >
                        <ResultCard
                            label="Encontrados"
                            value={
                                resultado.total ??
                                0
                            }
                        />

                        <ResultCard
                            label="Creados"
                            value={
                                resultado.created ??
                                0
                            }
                        />

                        <ResultCard
                            label="Actualizados"
                            value={
                                resultado.updated ??
                                0
                            }
                        />

                        <ResultCard
                            label="Omitidos"
                            value={
                                resultado.skipped ??
                                0
                            }
                        />

                        <ResultCard
                            label="Desactivados"
                            value={
                                resultado.deactivated ??
                                0
                            }
                        />
                    </View>
                </View>
            ) : null}

            {/* =====================================================
          MODAL EMPRESAS
      ====================================================== */}

            <Modal
                animationType="slide"
                onRequestClose={() =>
                    setModalOpen(false)
                }
                transparent
                visible={
                    modalOpen
                }
            >
                <View
                    style={
                        styles.modalOverlay
                    }
                >
                    <View
                        style={
                            styles.modalCard
                        }
                    >
                        <View
                            style={
                                styles.modalHeader
                            }
                        >
                            <View>
                                <Text
                                    style={
                                        styles.modalTitle
                                    }
                                >
                                    Seleccionar empresa
                                </Text>

                                <Text
                                    style={
                                        styles.modalSubtitle
                                    }
                                >
                                    {
                                        filteredClientes.length
                                    }{' '}
                                    empresas disponibles
                                </Text>
                            </View>

                            <Pressable
                                hitSlop={10}
                                onPress={() =>
                                    setModalOpen(
                                        false,
                                    )
                                }
                            >
                                <Ionicons
                                    color={
                                        ridsPalette.slate
                                    }
                                    name="close"
                                    size={25}
                                />
                            </Pressable>
                        </View>

                        <View
                            style={
                                styles.searchBox
                            }
                        >
                            <Ionicons
                                color={
                                    ridsPalette.cyanDark
                                }
                                name="search-outline"
                                size={20}
                            />

                            <TextInput
                                onChangeText={
                                    setSearch
                                }
                                placeholder="Buscar empresa o RUT"
                                placeholderTextColor="#98A2B3"
                                style={
                                    styles.searchInput
                                }
                                value={
                                    search
                                }
                            />

                            {search ? (
                                <Pressable
                                    hitSlop={10}
                                    onPress={() =>
                                        setSearch('')
                                    }
                                >
                                    <Ionicons
                                        color={
                                            ridsPalette.slate
                                        }
                                        name="close-circle"
                                        size={19}
                                    />
                                </Pressable>
                            ) : null}
                        </View>

                        {loading ? (
                            <ActivityIndicator
                                color={
                                    colors.brand
                                }
                                style={
                                    styles.loader
                                }
                            />
                        ) : null}

                        <ScrollView
                            contentContainerStyle={
                                styles.companyList
                            }
                            refreshControl={
                                <RefreshControl
                                    colors={[
                                        colors.brand,
                                    ]}
                                    onRefresh={
                                        refreshEmpresas
                                    }
                                    refreshing={
                                        refreshing
                                    }
                                    tintColor={
                                        colors.brand
                                    }
                                />
                            }
                            showsVerticalScrollIndicator={
                                false
                            }
                        >
                            {!loading &&
                                filteredClientes.length ===
                                0 ? (
                                <View
                                    style={
                                        styles.empty
                                    }
                                >
                                    <Ionicons
                                        color={
                                            ridsPalette.cyanDark
                                        }
                                        name="business-outline"
                                        size={26}
                                    />

                                    <Text
                                        style={
                                            styles.emptyTitle
                                        }
                                    >
                                        Sin empresas
                                    </Text>

                                    <Text
                                        style={
                                            styles.emptyText
                                        }
                                    >
                                        No encontramos
                                        resultados.
                                    </Text>
                                </View>
                            ) : null}

                            {filteredClientes.map(
                                (cliente) => {
                                    const selected =
                                        empresa
                                            ?.id_empresa ===
                                        cliente.id_empresa;

                                    return (
                                        <Pressable
                                            key={
                                                cliente.id_empresa
                                            }
                                            onPress={() =>
                                                seleccionarEmpresa(
                                                    cliente,
                                                )
                                            }
                                            style={[
                                                styles.companyCard,

                                                selected &&
                                                styles.companySelected,
                                            ]}
                                        >
                                            <View
                                                style={
                                                    styles.companyIcon
                                                }
                                            >
                                                <Ionicons
                                                    color={
                                                        ridsPalette.cyanDark
                                                    }
                                                    name="business-outline"
                                                    size={21}
                                                />
                                            </View>

                                            <View
                                                style={
                                                    styles.companyContent
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.companyTitle
                                                    }
                                                >
                                                    {
                                                        cliente.nombre
                                                    }
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.companySubtitle
                                                    }
                                                >
                                                    {cliente
                                                        .detalleEmpresa
                                                        ?.rut
                                                        ? `RUT ${cliente.detalleEmpresa.rut}`
                                                        : 'RUT no registrado'}
                                                </Text>

                                                <Text
                                                    numberOfLines={
                                                        1
                                                    }
                                                    style={
                                                        styles.companyDomain
                                                    }
                                                >
                                                    {(cliente.dominios ??
                                                        []).length >
                                                        0
                                                        ? (
                                                            cliente.dominios ??
                                                            []
                                                        ).join(
                                                            ', ',
                                                        )
                                                        : 'Sin dominio configurado'}
                                                </Text>
                                            </View>

                                            <Ionicons
                                                color={
                                                    selected
                                                        ? ridsPalette.cyanDark
                                                        : '#B7C0CE'
                                                }
                                                name={
                                                    selected
                                                        ? 'checkmark-circle'
                                                        : 'chevron-forward'
                                                }
                                                size={21}
                                            />
                                        </Pressable>
                                    );
                                },
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

/* =========================================================
   COMPONENTES
========================================================= */

function ProviderCard({
    label,
    description,
    icon,
    selected,
    onPress,
}: {
    label: string;
    description: string;
    icon:
    | 'logo-microsoft'
    | 'logo-google';
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={
                onPress
            }
            style={[
                styles.provider,

                selected &&
                styles.providerSelected,
            ]}
        >
            <View
                style={
                    styles.providerIcon
                }
            >
                <Ionicons
                    color={
                        ridsPalette.cyanDark
                    }
                    name={icon}
                    size={22}
                />
            </View>

            <View
                style={{
                    flex: 1,
                }}
            >
                <Text
                    style={
                        styles.providerTitle
                    }
                >
                    {label}
                </Text>

                <Text
                    style={
                        styles.providerDescription
                    }
                >
                    {description}
                </Text>
            </View>

            <Ionicons
                color={
                    selected
                        ? ridsPalette.cyanDark
                        : '#B7C0CE'
                }
                name={
                    selected
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                }
                size={22}
            />
        </Pressable>
    );
}

function ResultCard({
    label,
    value,
}: {
    label: string;
    value: number;
}) {
    return (
        <View
            style={
                styles.resultItem
            }
        >
            <Text
                style={
                    styles.resultNumber
                }
            >
                {value}
            </Text>

            <Text
                style={
                    styles.resultLabel
                }
            >
                {label}
            </Text>
        </View>
    );
}

/* =========================================================
   STYLES
========================================================= */

const styles =
    StyleSheet.create({
        card: {
            backgroundColor:
                colors.surface,
            borderColor:
                colors.line,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: 14,
            padding: 16,
        },

        sectionTitle: {
            color:
                colors.ink,
            fontSize: 16,
            fontWeight: '900',
        },

        sectionSubtitle: {
            color:
                colors.muted,
            fontSize: 12,
            lineHeight: 18,
            marginBottom: 14,
            marginTop: 4,
        },

        selectButton: {
            alignItems: 'center',
            borderColor:
                colors.line,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            minHeight: 58,
            paddingHorizontal: 12,
        },

        iconBox: {
            alignItems: 'center',
            backgroundColor:
                ridsPalette.cyanSoft,
            borderRadius: 10,
            height: 38,
            justifyContent:
                'center',
            marginRight: 11,
            width: 38,
        },

        selectContent: {
            flex: 1,
        },

        selectLabel: {
            color:
                colors.muted,
            fontSize: 10,
            fontWeight: '800',
            textTransform:
                'uppercase',
        },

        selectValue: {
            color:
                colors.ink,
            fontSize: 14,
            fontWeight: '900',
            marginTop: 2,
        },

        placeholder: {
            color:
                colors.muted,
            fontSize: 14,
            marginTop: 2,
        },

        meta: {
            color:
                colors.muted,
            fontSize: 11,
            marginTop: 9,
        },

        domainList: {
            gap: 8,
        },

        domainCard: {
            alignItems: 'center',
            borderColor:
                colors.line,
            borderRadius: 13,
            borderWidth: 1,
            flexDirection: 'row',
            minHeight: 54,
            paddingHorizontal: 12,
        },

        domainSelected: {
            backgroundColor:
                ridsPalette.cyanSoft,
            borderColor:
                ridsPalette.cyanDark,
        },

        domainIcon: {
            alignItems: 'center',
            backgroundColor:
                ridsPalette.cyanSoft,
            borderRadius: 9,
            height: 35,
            justifyContent:
                'center',
            marginRight: 10,
            width: 35,
        },

        domainText: {
            color:
                colors.ink,
            flex: 1,
            fontSize: 13,
            fontWeight: '800',
        },

        warning: {
            alignItems:
                'flex-start',
            backgroundColor:
                '#FFFAEB',
            borderColor:
                '#FEDF89',
            borderRadius: 13,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
            padding: 13,
        },

        warningTitle: {
            color:
                '#93370D',
            fontSize: 13,
            fontWeight: '900',
        },

        warningText: {
            color:
                '#B54708',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 2,
        },

        provider: {
            alignItems: 'center',
            borderColor:
                colors.line,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            marginTop: 8,
            minHeight: 62,
            padding: 11,
        },

        providerSelected: {
            backgroundColor:
                ridsPalette.cyanSoft,
            borderColor:
                ridsPalette.cyanDark,
        },

        providerIcon: {
            alignItems: 'center',
            backgroundColor:
                colors.surface,
            borderRadius: 10,
            height: 40,
            justifyContent:
                'center',
            marginRight: 11,
            width: 40,
        },

        providerTitle: {
            color:
                colors.ink,
            fontSize: 14,
            fontWeight: '900',
        },

        providerDescription: {
            color:
                colors.muted,
            fontSize: 11,
            marginTop: 2,
        },

        syncButton: {
            alignItems: 'center',
            backgroundColor:
                ridsPalette.cyanDark,
            borderRadius: 15,
            flexDirection: 'row',
            gap: 8,
            justifyContent:
                'center',
            marginBottom: 16,
            minHeight: 54,
        },

        syncDisabled: {
            opacity: 0.5,
        },

        syncText: {
            color:
                colors.white,
            fontSize: 14,
            fontWeight: '900',
        },

        resultCard: {
            backgroundColor:
                colors.surface,
            borderColor:
                colors.line,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: 40,
            padding: 16,
        },

        resultHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10,
            marginBottom: 14,
        },

        resultIcon: {
            alignItems: 'center',
            backgroundColor:
                ridsPalette.cyanDark,
            borderRadius: 15,
            height: 30,
            justifyContent:
                'center',
            width: 30,
        },

        resultTitle: {
            color:
                colors.ink,
            fontSize: 15,
            fontWeight: '900',
        },

        resultDomain: {
            color:
                colors.muted,
            fontSize: 11,
            marginTop: 2,
        },

        resultGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },

        resultItem: {
            backgroundColor:
                ridsPalette.cyanSoft,
            borderRadius: 12,
            padding: 12,
            width: '48%',
        },

        resultNumber: {
            color:
                ridsPalette.cyanDark,
            fontSize: 20,
            fontWeight: '900',
        },

        resultLabel: {
            color:
                colors.muted,
            fontSize: 10,
            fontWeight: '700',
            marginTop: 3,
        },

        modalOverlay: {
            backgroundColor:
                'rgba(15, 23, 42, 0.45)',
            flex: 1,
            justifyContent:
                'flex-end',
        },

        modalCard: {
            backgroundColor:
                colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '82%',
            minHeight: '62%',
            padding: 18,
        },

        modalHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent:
                'space-between',
            marginBottom: 14,
        },

        modalTitle: {
            color:
                colors.ink,
            fontSize: 18,
            fontWeight: '900',
        },

        modalSubtitle: {
            color:
                colors.muted,
            fontSize: 11,
            marginTop: 3,
        },

        searchBox: {
            alignItems: 'center',
            borderColor:
                colors.line,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
            minHeight: 50,
            paddingHorizontal: 13,
        },

        searchInput: {
            color:
                colors.ink,
            flex: 1,
            fontSize: 14,
            paddingVertical: 11,
        },

        loader: {
            marginVertical: 16,
        },

        companyList: {
            gap: 8,
            paddingBottom: 30,
            paddingTop: 14,
        },

        companyCard: {
            alignItems: 'center',
            borderColor:
                colors.line,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            minHeight: 72,
            padding: 11,
        },

        companySelected: {
            backgroundColor:
                ridsPalette.cyanSoft,
            borderColor:
                ridsPalette.cyanDark,
        },

        companyIcon: {
            alignItems: 'center',
            backgroundColor:
                ridsPalette.cyanSoft,
            borderRadius: 10,
            height: 39,
            justifyContent:
                'center',
            width: 39,
        },

        companyContent: {
            flex: 1,
            marginLeft: 11,
        },

        companyTitle: {
            color:
                colors.ink,
            fontSize: 13,
            fontWeight: '900',
        },

        companySubtitle: {
            color:
                colors.muted,
            fontSize: 11,
            marginTop: 2,
        },

        companyDomain: {
            color:
                ridsPalette.cyanDark,
            fontSize: 10,
            marginTop: 3,
        },

        empty: {
            alignItems: 'center',
            padding: 24,
        },

        emptyTitle: {
            color:
                colors.ink,
            fontSize: 15,
            fontWeight: '900',
            marginTop: 8,
        },

        emptyText: {
            color:
                colors.muted,
            fontSize: 12,
            marginTop: 4,
        },
    });