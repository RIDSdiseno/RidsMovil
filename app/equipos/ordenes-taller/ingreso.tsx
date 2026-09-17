// app/equipos/taller/ingreso.tsx

import { Ionicons } from '@expo/vector-icons';
import {
    router,
    useLocalSearchParams,
} from 'expo-router';

import {
    useEffect,
    useRef,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Alert,
    FlatList,
    InteractionManager,
    Modal,
    Pressable,
    Image as RNImage,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';

import {
    crearIngresoTaller,
    enviarPdfIngresoTaller,
    listarEntidadesTaller,
    listarSolicitantesTaller,
    solicitarFirmaEntradaTaller,
    type EntidadTaller,
    type PrioridadTaller
} from '@/src/api/ordenes-taller';

import {
    AppButton,
} from '@/src/components/AppButton';

import {
    TextInput,
} from '@/src/components/AppTextInput';

import {
    BottomNavigation,
} from '@/src/components/BottomNavigation';

import {
    RidsFlowHeader,
} from '@/src/components/RidsFlowHeader';

import {
    RidsSectionTitle,
} from '@/src/components/RidsSectionTitle';

import {
    Screen,
} from '@/src/components/Screen';

import {
    colors,
    shadow,
} from '@/src/theme/colors';

import {
    ridsPalette,
} from '@/src/theme/rids-palette';

import type {
    EquipoDetalle,
    Solicitante,
} from '@/src/types/api';

import {
    getEquipoDetalle,
    uploadToCloudinary,
} from '@/src/api/rids';

import {
    SignaturePad,
    type SignaturePadRef,
} from '../../../components/SignaturePad';

import * as FileSystem from 'expo-file-system/legacy';

import {
    captureRef,
} from 'react-native-view-shot';

type PrioridadOption = {
    value: PrioridadTaller;
    label: string;
};

const PRIORIDADES: PrioridadOption[] = [
    {
        value: 'BAJA',
        label: 'Baja',
    },
    {
        value: 'NORMAL',
        label: 'Normal',
    },
    {
        value: 'ALTA',
        label: 'Alta',
    },
];

export default function IngresoTallerScreen() {
    const {
        equipoId,
    } =
        useLocalSearchParams<{
            equipoId?: string;
        }>();

    const [
        equipo,
        setEquipo,
    ] =
        useState<EquipoDetalle | null>(
            null,
        );

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        submitting,
        setSubmitting,
    ] =
        useState(false);

    const [
        entidades,
        setEntidades,
    ] =
        useState<EntidadTaller[]>(
            [],
        );

    const [
        entidadSeleccionada,
        setEntidadSeleccionada,
    ] =
        useState<EntidadTaller | null>(
            null,
        );

    const [
        entidadModalOpen,
        setEntidadModalOpen,
    ] =
        useState(false);

    const [
        entidadSearch,
        setEntidadSearch,
    ] =
        useState('');

    const [
        tipoTrabajo,
        setTipoTrabajo,
    ] =
        useState('');

    const [
        descripcion,
        setDescripcion,
    ] =
        useState('');

    const [
        prioridad,
        setPrioridad,
    ] =
        useState<PrioridadTaller>(
            'NORMAL',
        );

    const [
        incluyeCargador,
        setIncluyeCargador,
    ] =
        useState(false);

    const [
        notas,
        setNotas,
    ] =
        useState('');

    const [
        solicitantesFirmante,
        setSolicitantesFirmante,
    ] =
        useState<Solicitante[]>([]);

    const [
        solicitanteFirmante,
        setSolicitanteFirmante,
    ] =
        useState<Solicitante | null>(
            null,
        );

    const [
        solicitanteModalOpen,
        setSolicitanteModalOpen,
    ] =
        useState(false);

    const [
        solicitanteSearch,
        setSolicitanteSearch,
    ] =
        useState('');

    const [
        tieneFirmaEntrada,
        setTieneFirmaEntrada,
    ] =
        useState(false);

    const [
        isSigning,
        setIsSigning,
    ] =
        useState(false);

    const signatureRef =
        useRef<SignaturePadRef>(
            null,
        );

    const pdfReceiptRef =
        useRef<View>(
            null,
        );

    const [
        firmaPdfUri,
        setFirmaPdfUri,
    ] =
        useState<string | null>(
            null,
        );

    const [
        ordenPdf,
        setOrdenPdf,
    ] =
        useState<{
            id: number;
            numeroOrden:
            string | null;
        } | null>(
            null,
        );

    const [
        fechaPdf,
        setFechaPdf,
    ] =
        useState<string | null>(
            null,
        );
    /* =========================================================
       CARGAR EQUIPO
    ========================================================= */

    useEffect(() => {
        async function boot() {
            const id =
                Number(
                    equipoId,
                );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                Alert.alert(
                    'Taller',
                    'No se pudo identificar el equipo seleccionado.',
                    [
                        {
                            text: 'Volver',

                            onPress: () => {
                                router.back();
                            },
                        },
                    ],
                );

                setLoading(false);

                return;
            }

            try {
                setLoading(true);

                const [
                    fresh,
                    entidadesResult,
                    solicitantesResult,
                ] =
                    await Promise.all([
                        getEquipoDetalle(
                            id,
                        ),

                        listarEntidadesTaller(),

                        listarSolicitantesTaller(),
                    ]);

                setEquipo(
                    fresh,
                );

                setEntidades(
                    entidadesResult.entidades,
                );

                setSolicitantesFirmante(
                    solicitantesResult.solicitantes,
                );
            } catch (error) {
                Alert.alert(
                    'Taller',
                    error instanceof Error
                        ? error.message
                        : 'No se pudo cargar la información del equipo.',
                    [
                        {
                            text: 'Volver',

                            onPress: () => {
                                router.back();
                            },
                        },
                    ],
                );
            } finally {
                setLoading(false);
            }
        }

        void boot();
    }, [equipoId]);

    /* =========================================================
       VALIDACIONES
    ========================================================= */

    const emailFirmante =
        solicitanteFirmante?.email
            ?.trim()
            .toLowerCase() ??
        '';

    const emailFirmanteValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                emailFirmante,
            );

    const canSubmit =
        Boolean(
            equipo &&
            entidadSeleccionada &&
            solicitanteFirmante &&
            emailFirmanteValido &&
            tipoTrabajo.trim() &&
            descripcion.trim() &&
            tieneFirmaEntrada &&
            !submitting,
        );

    function seleccionarEntidad(
        entidad: EntidadTaller,
    ) {
        setEntidadSeleccionada(
            entidad,
        );

        setEntidadModalOpen(
            false,
        );

        setEntidadSearch(
            '',
        );
    }

    async function buildTallerPdfFile(
        ordenId: number,
        numeroOrden:
            string | null,
    ) {
        if (
            !pdfReceiptRef.current
        ) {
            throw new Error(
                'No se pudo preparar el comprobante de Taller.',
            );
        }

        /*
         * Esperar a que React renderice
         * ordenPdf + firmaPdfUri + fechaPdf.
         */
        await new Promise<void>(
            (
                resolve,
            ) => {
                requestAnimationFrame(
                    () => {
                        requestAnimationFrame(
                            () => {
                                InteractionManager
                                    .runAfterInteractions(
                                        () =>
                                            resolve(),
                                    );
                            },
                        );
                    },
                );
            },
        );

        const receiptImageUri =
            await captureRef(
                pdfReceiptRef,
                {
                    format:
                        'jpg',

                    quality:
                        0.92,

                    result:
                        'tmpfile',
                },
            );

        const imageBase64 =
            await FileSystem
                .readAsStringAsync(
                    receiptImageUri,
                    {
                        encoding:
                            FileSystem
                                .EncodingType
                                .Base64,
                    },
                );

        const {
            width,
            height,
        } =
            await getImageSize(
                receiptImageUri,
            );

        const pdfBase64 =
            createSingleImagePdfBase64(
                imageBase64,
                width,
                height,
            );

        const baseName =
            numeroOrden ||
            `Orden-Taller-${ordenId}`;

        const fileName =
            `${sanitizeFileName(baseName)}.pdf`;

        const uri =
            `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem
            .writeAsStringAsync(
                uri,
                pdfBase64,
                {
                    encoding:
                        FileSystem
                            .EncodingType
                            .Base64,
                },
            );

        const info =
            await FileSystem
                .getInfoAsync(
                    uri,
                );

        if (!info.exists) {
            throw new Error(
                'No se pudo generar el comprobante PDF.',
            );
        }

        return {
            bytes:
                typeof info.size ===
                    'number'
                    ? info.size
                    : 1,

            mimeType:
                'application/pdf',

            name:
                fileName,

            uri,
        };
    }

    /* =========================================================
       REGISTRAR INGRESO
    ========================================================= */

    async function registrarIngreso() {
        if (
            !equipo ||
            submitting
        ) {
            return;
        }

        if (
            !entidadSeleccionada
        ) {
            Alert.alert(
                'Entidad',
                'Debes seleccionar una entidad.',
            );

            return;
        }

        const tipo =
            tipoTrabajo.trim();

        const motivo =
            descripcion.trim();

        const observaciones =
            notas.trim();

        if (!solicitanteFirmante) {
            Alert.alert(
                'Confirmación',
                'Debes seleccionar la persona que firmará la recepción.',
            );

            return;
        }

        const firmante =
            solicitanteFirmante.nombre
                ?.trim() ??
            '';

        const emailFirmante =
            solicitanteFirmante.email
                ?.trim()
                .toLowerCase() ??
            '';

        if (!tipo) {
            Alert.alert(
                'Tipo de trabajo',
                'Debes indicar el tipo de trabajo.',
            );

            return;
        }

        if (!motivo) {
            Alert.alert(
                'Motivo del ingreso',
                'Debes indicar el motivo del ingreso.',
            );

            return;
        }

        if (
            !signatureRef.current
                ?.hasSignature()
        ) {
            Alert.alert(
                'Confirmación',
                'Debes registrar la firma de recepción.',
            );

            return;
        }

        if (!firmante) {
            Alert.alert(
                'Confirmación',
                'El solicitante seleccionado no tiene un nombre válido.',
            );

            return;
        }

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(
                    emailFirmante,
                )
        ) {
            Alert.alert(
                'Confirmación',
                'El solicitante seleccionado no tiene un correo válido.',
            );

            return;
        }

        try {
            setSubmitting(true);

            /*
             * 1. Capturar firma
             */
            const firmaUri =
                await signatureRef.current
                    .capture();

            setFirmaPdfUri(
                firmaUri,
            );

            /*
             * 2. Pedir firma Cloudinary
             */
            const uploadSignature =
                await solicitarFirmaEntradaTaller(
                    equipo.id_equipo,
                );

            /*
             * 3. Preparar archivo
             */
            const firmaFileName =
                `firma-entrada-${equipo.id_equipo}-${Date.now()}.png`;

            const firmaFile = {
                name:
                    firmaFileName,

                type:
                    'image/png',

                uri:
                    firmaUri,
            };

            /*
             * 4. Subir imagen
             */
            const cloudinaryResp =
                await uploadToCloudinary(
                    uploadSignature,
                    firmaFile,
                    firmaFileName,
                );

            const firmaEntradaUrl =
                cloudinaryResp
                    ?.secure_url ||
                cloudinaryResp
                    ?.url;

            const firmaEntradaPublicId =
                cloudinaryResp
                    ?.public_id ||
                cloudinaryResp
                    ?.publicId;

            if (
                !firmaEntradaUrl ||
                !firmaEntradaPublicId
            ) {
                throw new Error(
                    'Cloudinary no confirmó la subida de la firma.',
                );
            }

            /*
             * 5. Crear OT
             */
            const result =
                await crearIngresoTaller({
                    equipoId:
                        equipo.id_equipo,

                    entidadId:
                        entidadSeleccionada.id,

                    tipoTrabajo:
                        tipo,

                    descripcion:
                        motivo,

                    prioridad,

                    incluyeCargador,

                    notas:
                        observaciones ||
                        null,

                    solicitanteFirmanteEntradaId:
                        solicitanteFirmante.id_solicitante,

                    nombreFirmanteEntrada:
                        firmante,

                    emailFirmanteEntrada:
                        emailFirmante,

                    firmaEntradaUrl,

                    firmaEntradaPublicId,

                    firmaEntradaAt:
                        new Date()
                            .toISOString(),
                });

            const ordenId =
                result.orden.id;

            const numeroOrden =
                result.orden.numeroOrden;

            const fechaComprobante =
                result.orden.fecha ??
                new Date()
                    .toISOString();

            /*
             * Preparar la vista del PDF.
             */
            setOrdenPdf({
                id:
                    ordenId,

                numeroOrden,
            });

            setFirmaPdfUri(
                firmaUri,
            );

            setFechaPdf(
                fechaComprobante,
            );

            /*
             * Desde este punto la OT YA EXISTE.
             *
             * Por eso el error de PDF/correo
             * se trata por separado.
             */
            let comprobanteEnviado =
                false;

            let errorComprobante:
                string | null =
                null;

            try {
                const pdfFile =
                    await buildTallerPdfFile(
                        ordenId,
                        numeroOrden,
                    );

                const emailResult =
                    await enviarPdfIngresoTaller(
                        ordenId,
                        {
                            mimeType:
                                pdfFile.mimeType,

                            name:
                                pdfFile.name,

                            uri:
                                pdfFile.uri,
                        },
                    );

                comprobanteEnviado =
                    true;
            } catch (
            emailError
            ) {
                console.error(
                    '[TALLER][EMAIL ERROR]',
                    emailError,
                );

                errorComprobante =
                    emailError instanceof Error
                        ? emailError.message
                        : 'No se pudo enviar el comprobante.';
            }

            /*
             * La OT ya fue creada.
             * Nunca indicar que falló el ingreso
             * solamente porque falló el correo.
             */
            if (
                comprobanteEnviado
            ) {
                Alert.alert(
                    'Ingreso registrado',
                    numeroOrden
                        ? `El equipo fue ingresado correctamente a Taller.\n\nOrden #${ordenId}\nCódigo: ${numeroOrden}\n\nEl comprobante quedó en proceso de envío al firmante con copia para el técnico.`
                        : `El equipo fue ingresado correctamente a Taller.\n\nOrden #${ordenId}\n\nEl comprobante quedó en proceso de envío al firmante con copia para el técnico.`,
                    [
                        {
                            text:
                                'Aceptar',

                            onPress:
                                () => {
                                    router.back();
                                },
                        },
                    ],
                );
            } else {
                Alert.alert(
                    'Ingreso registrado',
                    numeroOrden
                        ? `La Orden fue creada correctamente.\n\nOrden #${ordenId}\nCódigo: ${numeroOrden}\n\nNo se pudo enviar el comprobante por correo.\n\n${errorComprobante ?? ''}`
                        : `La Orden fue creada correctamente.\n\nOrden #${ordenId}\n\nNo se pudo enviar el comprobante por correo.\n\n${errorComprobante ?? ''}`,
                    [
                        {
                            text:
                                'Aceptar',

                            onPress:
                                () => {
                                    router.back();
                                },
                        },
                    ],
                );
            }
        } catch (error) {
            console.error(
                '[TALLER][ERROR]',
                error,
            );

            if (
                error instanceof Error
            ) {
                console.error(
                    '[TALLER][ERROR DETAIL]',
                    {
                        name:
                            error.name,

                        message:
                            error.message,

                        stack:
                            error.stack,
                    },
                );
            }

            Alert.alert(
                'Taller',
                error instanceof Error
                    ? error.message
                    : 'No se pudo registrar el ingreso del equipo.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    /* =========================================================
       LOADING
    ========================================================= */

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
                    style={
                        styles.center
                    }
                >
                    <ActivityIndicator
                        color={
                            colors.brand
                        }
                        size="large"
                    />

                    <Text
                        style={
                            styles.loadingText
                        }
                    >
                        Cargando equipo...
                    </Text>
                </View>
            </Screen>
        );
    }

    /* =========================================================
       INFORMACIÓN DERIVADA DEL EQUIPO
    ========================================================= */

    const nombreEquipo =
        [
            equipo.marca,
            equipo.modelo,
        ]
            .filter(Boolean)
            .join(' ') ||
        'Equipo';

    const serial =
        equipo.serial ||
        'Sin serial';

    const solicitante =
        equipo.nombreSolicitante ||
        'Sin solicitante';

    const estadoActual =
        equipo.estado ||
        'Sin estado';

    /* =========================================================
       UI
    ========================================================= */

    return (
        <Screen
            bottomNavigation={
                <BottomNavigation />
            }
            scrollEnabled={
                !isSigning
            }
        >
            <RidsFlowHeader
                icon="construct-outline"
                label="TALLER"
                subtitle="Registra la recepción del equipo para revisión técnica"
                title="Ingreso de equipo"
            />

            {/* =====================================================
          EQUIPO SELECCIONADO
      ===================================================== */}

            <View
                style={
                    styles.equipoCard
                }
            >
                <View
                    style={
                        styles.equipoIcon
                    }
                >
                    <Ionicons
                        color={
                            ridsPalette.cyanDark
                        }
                        name="desktop-outline"
                        size={24}
                    />
                </View>

                <View
                    style={
                        styles.equipoCopy
                    }
                >
                    <Text
                        style={
                            styles.equipoLabel
                        }
                    >
                        EQUIPO SELECCIONADO
                    </Text>

                    <Text
                        style={
                            styles.equipoTitle
                        }
                    >
                        {
                            nombreEquipo
                        }
                    </Text>

                    <Text
                        style={
                            styles.equipoMeta
                        }
                    >
                        S/N: {
                            serial
                        }
                    </Text>

                    <Text
                        style={
                            styles.equipoMeta
                        }
                    >
                        Solicitante: {
                            solicitante
                        }
                    </Text>

                    <View
                        style={
                            styles.estadoRow
                        }
                    >
                        <Text
                            style={
                                styles.equipoMeta
                            }
                        >
                            Estado actual:
                        </Text>

                        <View
                            style={
                                styles.estadoBadge
                            }
                        >
                            <Text
                                style={
                                    styles.estadoBadgeText
                                }
                            >
                                {
                                    estadoActual
                                }
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            <Section
                title="Entidad"
            >
                <Text
                    style={
                        styles.helperText
                    }
                >
                    Selecciona la entidad que quedará asociada a la Orden de Taller.
                </Text>

                <Pressable
                    onPress={() => {
                        setEntidadModalOpen(
                            true,
                        );
                    }}
                    style={({ pressed }) => [
                        styles.entitySelector,

                        pressed &&
                        styles.entitySelectorPressed,
                    ]}
                >
                    <View
                        style={
                            styles.entitySelectorIcon
                        }
                    >
                        <Ionicons
                            color={
                                ridsPalette.cyanDark
                            }
                            name={
                                entidadSeleccionada?.tipo ===
                                    'PERSONA'
                                    ? 'person-outline'
                                    : 'business-outline'
                            }
                            size={21}
                        />
                    </View>

                    <View
                        style={
                            styles.entitySelectorCopy
                        }
                    >
                        {entidadSeleccionada ? (
                            <>
                                <Text
                                    style={
                                        styles.entitySelectorTitle
                                    }
                                >
                                    {
                                        entidadSeleccionada.nombre
                                    }
                                </Text>

                                <Text
                                    style={
                                        styles.entitySelectorMeta
                                    }
                                >
                                    {
                                        entidadSeleccionada.tipo
                                    }
                                    {' · '}
                                    {
                                        entidadSeleccionada.origen
                                    }
                                    {
                                        entidadSeleccionada.rut
                                            ? ` · ${entidadSeleccionada.rut}`
                                            : ''
                                    }
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text
                                    style={
                                        styles.entitySelectorPlaceholder
                                    }
                                >
                                    Seleccionar entidad
                                </Text>

                                <Text
                                    style={
                                        styles.entitySelectorMeta
                                    }
                                >
                                    Obligatorio para generar la orden
                                </Text>
                            </>
                        )}
                    </View>

                    <Ionicons
                        color={
                            ridsPalette.cyanDark
                        }
                        name="chevron-down"
                        size={19}
                    />
                </Pressable>
            </Section>

            {/* =====================================================
          INFORMACIÓN DEL INGRESO
      ===================================================== */}

            <Section
                title="Información del ingreso"
            >
                <View
                    style={
                        styles.field
                    }
                >
                    <Text
                        style={
                            styles.fieldLabel
                        }
                    >
                        Tipo de trabajo *
                    </Text>

                    <TextInput
                        autoCapitalize="sentences"
                        maxLength={150}
                        onChangeText={
                            setTipoTrabajo
                        }
                        placeholder="Ej: Revisión, reparación, diagnóstico..."
                        placeholderTextColor="#98A2B3"
                        style={
                            styles.input
                        }
                        value={
                            tipoTrabajo
                        }
                    />

                    <Text
                        style={
                            styles.characterCounter
                        }
                    >
                        {
                            tipoTrabajo.length
                        }
                        /150
                    </Text>
                </View>

                <View
                    style={
                        styles.field
                    }
                >
                    <Text
                        style={
                            styles.fieldLabel
                        }
                    >
                        Motivo del ingreso *
                    </Text>

                    <TextInput
                        autoCapitalize="sentences"
                        maxLength={1000}
                        multiline
                        numberOfLines={5}
                        onChangeText={
                            setDescripcion
                        }
                        placeholder="Describe la falla o motivo por el que ingresa el equipo"
                        placeholderTextColor="#98A2B3"
                        style={[
                            styles.input,
                            styles.textArea,
                        ]}
                        textAlignVertical="top"
                        value={
                            descripcion
                        }
                    />

                    <Text
                        style={
                            styles.characterCounter
                        }
                    >
                        {
                            descripcion.length
                        }
                        /1000
                    </Text>
                </View>
            </Section>

            {/* =====================================================
          PRIORIDAD
      ===================================================== */}

            <Section
                title="Prioridad"
            >
                <Text
                    style={
                        styles.helperText
                    }
                >
                    Define la urgencia con la que debería revisarse el equipo.
                </Text>

                <View
                    style={
                        styles.segmented
                    }
                >
                    {PRIORIDADES.map(
                        (option) => {
                            const active =
                                prioridad ===
                                option.value;

                            return (
                                <Pressable
                                    key={
                                        option.value
                                    }
                                    onPress={() => {
                                        setPrioridad(
                                            option.value,
                                        );
                                    }}
                                    style={({ pressed }) => [
                                        styles.segmentOption,

                                        active &&
                                        styles.segmentOptionActive,

                                        pressed &&
                                        styles.segmentOptionPressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.segmentText,

                                            active &&
                                            styles.segmentTextActive,
                                        ]}
                                    >
                                        {
                                            option.label
                                        }
                                    </Text>
                                </Pressable>
                            );
                        },
                    )}
                </View>
            </Section>

            {/* =====================================================
          ACCESORIOS
      ===================================================== */}

            <Section
                title="Accesorios"
            >
                <View
                    style={
                        styles.switchRow
                    }
                >
                    <View
                        style={
                            styles.switchIcon
                        }
                    >
                        <Ionicons
                            color={
                                ridsPalette.cyanDark
                            }
                            name="battery-charging-outline"
                            size={22}
                        />
                    </View>

                    <View
                        style={
                            styles.switchCopy
                        }
                    >
                        <Text
                            style={
                                styles.switchTitle
                            }
                        >
                            Incluye cargador
                        </Text>

                        <Text
                            style={
                                styles.switchDescription
                            }
                        >
                            Marca esta opción si el equipo fue recibido junto con su cargador.
                        </Text>
                    </View>

                    <Switch
                        onValueChange={
                            setIncluyeCargador
                        }
                        value={
                            incluyeCargador
                        }
                    />
                </View>
            </Section>

            {/* =====================================================
          OBSERVACIONES
      ===================================================== */}

            <Section
                title="Observaciones"
            >
                <View
                    style={
                        styles.field
                    }
                >
                    <Text
                        style={
                            styles.fieldLabel
                        }
                    >
                        Notas adicionales
                    </Text>

                    <TextInput
                        autoCapitalize="sentences"
                        maxLength={1000}
                        multiline
                        numberOfLines={4}
                        onChangeText={
                            setNotas
                        }
                        placeholder="Ej: equipo recibido sin golpes, usuario informa falla intermitente..."
                        placeholderTextColor="#98A2B3"
                        style={[
                            styles.input,
                            styles.textAreaSmall,
                        ]}
                        textAlignVertical="top"
                        value={
                            notas
                        }
                    />

                    <Text
                        style={
                            styles.characterCounter
                        }
                    >
                        {
                            notas.length
                        }
                        /1000
                    </Text>
                </View>
            </Section>

            <Modal
                animationType="slide"
                onRequestClose={() => {
                    setEntidadModalOpen(
                        false,
                    );
                }}
                transparent
                visible={
                    entidadModalOpen
                }
            >
                <View
                    style={
                        styles.modalOverlay
                    }
                >
                    <View
                        style={
                            styles.modalSheet
                        }
                    >
                        <View
                            style={
                                styles.modalHeader
                            }
                        >
                            <View
                                style={{
                                    flex: 1,
                                    paddingRight: 12,
                                }}
                            >
                                <Text
                                    style={
                                        styles.modalTitle
                                    }
                                >
                                    Seleccionar entidad
                                </Text>

                                <Text
                                    style={
                                        styles.modalSubtitle
                                    }
                                >
                                    Selecciona la entidad que quedará asociada a la Orden de Taller.
                                </Text>
                            </View>

                            <Pressable
                                onPress={() => {
                                    setEntidadModalOpen(
                                        false,
                                    );
                                }}
                                style={
                                    styles.modalCloseButton
                                }
                            >
                                <Ionicons
                                    color={
                                        colors.ink
                                    }
                                    name="close"
                                    size={22}
                                />
                            </Pressable>
                        </View>

                        <TextInput
                            autoCapitalize="none"
                            onChangeText={
                                setEntidadSearch
                            }
                            placeholder="Buscar por nombre o RUT"
                            placeholderTextColor="#98A2B3"
                            style={[
                                styles.input,
                                styles.entitySearchInput,
                            ]}
                            value={
                                entidadSearch
                            }
                        />

                        <FlatList
                            data={
                                entidades.filter(
                                    (
                                        item,
                                    ) => {
                                        const search =
                                            entidadSearch
                                                .trim()
                                                .toLowerCase();

                                        if (!search) {
                                            return true;
                                        }

                                        return (
                                            item.nombre
                                                .toLowerCase()
                                                .includes(
                                                    search,
                                                ) ||
                                            (
                                                item.rut ??
                                                ''
                                            )
                                                .toLowerCase()
                                                .includes(
                                                    search,
                                                )
                                        );
                                    },
                                )
                            }
                            keyExtractor={(
                                item,
                            ) =>
                                String(
                                    item.id,
                                )
                            }
                            ListEmptyComponent={
                                <Text
                                    style={
                                        styles.emptyText
                                    }
                                >
                                    No se encontraron entidades.
                                </Text>
                            }
                            renderItem={({
                                item,
                            }) => {
                                const selected =
                                    entidadSeleccionada
                                        ?.id ===
                                    item.id;

                                return (
                                    <Pressable
                                        onPress={() => {
                                            seleccionarEntidad(
                                                item,
                                            );
                                        }}
                                        style={({ pressed }) => [
                                            styles.entityOption,

                                            selected &&
                                            styles.entityOptionSelected,

                                            pressed &&
                                            styles.entityOptionPressed,
                                        ]}
                                    >
                                        <View
                                            style={
                                                styles.entityOptionIcon
                                            }
                                        >
                                            <Ionicons
                                                color={
                                                    ridsPalette.cyanDark
                                                }
                                                name={
                                                    item.tipo ===
                                                        'PERSONA'
                                                        ? 'person-outline'
                                                        : 'business-outline'
                                                }
                                                size={19}
                                            />
                                        </View>

                                        <View
                                            style={
                                                styles.entityOptionCopy
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.entityOptionTitle
                                                }
                                            >
                                                {
                                                    item.nombre
                                                }
                                            </Text>

                                            <Text
                                                style={
                                                    styles.entityOptionMeta
                                                }
                                            >
                                                {
                                                    item.tipo
                                                }
                                                {' · '}
                                                {
                                                    item.origen
                                                }

                                                {item.rut
                                                    ? ` · ${item.rut}`
                                                    : ''}
                                            </Text>
                                        </View>

                                        {selected && (
                                            <Ionicons
                                                color={
                                                    ridsPalette.cyanDark
                                                }
                                                name="checkmark-circle"
                                                size={21}
                                            />
                                        )}
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            <Section
                title="Confirmación de recepción"
            >
                <View
                    style={
                        styles.field
                    }
                >
                    <Text
                        style={
                            styles.fieldLabel
                        }
                    >
                        Persona que firma *
                    </Text>

                    <Pressable
                        disabled={
                            submitting
                        }
                        onPress={() => {
                            setSolicitanteModalOpen(
                                true,
                            );
                        }}
                        style={({ pressed }) => [
                            styles.entitySelector,

                            pressed &&
                            styles.entitySelectorPressed,
                        ]}
                    >
                        <View
                            style={
                                styles.entitySelectorIcon
                            }
                        >
                            <Ionicons
                                color={
                                    ridsPalette.cyanDark
                                }
                                name="person-outline"
                                size={21}
                            />
                        </View>

                        <View
                            style={
                                styles.entitySelectorCopy
                            }
                        >
                            {solicitanteFirmante ? (
                                <>
                                    <Text
                                        style={
                                            styles.entitySelectorTitle
                                        }
                                    >
                                        {
                                            solicitanteFirmante.nombre
                                        }
                                    </Text>

                                    <Text
                                        style={
                                            styles.entitySelectorMeta
                                        }
                                    >
                                        {
                                            solicitanteFirmante.email ||
                                            'Sin correo registrado'
                                        }
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text
                                        style={
                                            styles.entitySelectorPlaceholder
                                        }
                                    >
                                        Seleccionar solicitante
                                    </Text>

                                    <Text
                                        style={
                                            styles.entitySelectorMeta
                                        }
                                    >
                                        Persona que firmará la recepción
                                    </Text>
                                </>
                            )}
                        </View>

                        <Ionicons
                            color={
                                ridsPalette.cyanDark
                            }
                            name="chevron-down"
                            size={19}
                        />
                    </Pressable>

                    {solicitanteFirmante &&
                        !emailFirmanteValido && (
                            <Text
                                style={
                                    styles.validationError
                                }
                            >
                                Este solicitante no tiene un correo válido registrado.
                            </Text>
                        )}
                </View>

                <Text
                    style={
                        styles.fieldLabel
                    }
                >
                    Firma de recepción *
                </Text>

                <SignaturePad
                    ref={
                        signatureRef
                    }
                    hint="Firma dentro del recuadro para confirmar la entrega del equipo y sus accesorios."
                    onChange={
                        setTieneFirmaEntrada
                    }
                    onSigningChange={
                        setIsSigning
                    }
                />

                {tieneFirmaEntrada && (
                    <View
                        style={
                            styles.signatureConfirmed
                        }
                    >
                        <Ionicons
                            color="#15803D"
                            name="checkmark-circle"
                            size={
                                18
                            }
                        />

                        <Text
                            style={
                                styles.signatureConfirmedText
                            }
                        >
                            Firma registrada
                        </Text>
                    </View>
                )}
            </Section>

            {/* =====================================================
          INFORMACIÓN DEL PROCESO
      ===================================================== */}

            <View
                style={
                    styles.infoCard
                }
            >
                <View
                    style={
                        styles.infoIcon
                    }
                >
                    <Ionicons
                        color={
                            ridsPalette.cyanDark
                        }
                        name="information-circle-outline"
                        size={22}
                    />
                </View>

                <View
                    style={
                        styles.infoCopy
                    }
                >
                    <Text
                        style={
                            styles.infoTitle
                        }
                    >
                        ¿Qué ocurrirá al registrar?
                    </Text>

                    <Text
                        style={
                            styles.infoText
                        }
                    >
                        Se generará automáticamente una Orden de Taller asociada a este equipo.
                    </Text>

                    <Text
                        style={
                            styles.infoText
                        }
                    >
                        La persona seleccionada quedará registrada como firmante de la recepción.
                    </Text>

                    <Text
                        style={
                            styles.infoText
                        }
                    >
                        El comprobante será enviado al correo registrado del firmante.
                    </Text>

                    <Text
                        style={
                            styles.infoText
                        }
                    >
                        El equipo cambiará automáticamente a estado EN_RIDS.
                    </Text>

                    <Text
                        style={
                            styles.infoText
                        }
                    >
                        La gestión posterior de la orden se realizará desde la Intranet.
                    </Text>
                </View>
            </View>

            <Modal
                animationType="slide"
                onRequestClose={() => {
                    setSolicitanteModalOpen(
                        false,
                    );
                }}
                transparent
                visible={
                    solicitanteModalOpen
                }
            >
                <View
                    style={
                        styles.modalOverlay
                    }
                >
                    <View
                        style={
                            styles.modalSheet
                        }
                    >
                        <View
                            style={
                                styles.modalHeader
                            }
                        >
                            <View
                                style={{
                                    flex: 1,
                                    paddingRight: 12,
                                }}
                            >
                                <Text
                                    style={
                                        styles.modalTitle
                                    }
                                >
                                    Seleccionar firmante
                                </Text>

                                <Text
                                    style={
                                        styles.modalSubtitle
                                    }
                                >
                                    Selecciona la persona que firmará y recibirá el comprobante.
                                </Text>
                            </View>

                            <Pressable
                                onPress={() => {
                                    setSolicitanteModalOpen(
                                        false,
                                    );
                                }}
                                style={
                                    styles.modalCloseButton
                                }
                            >
                                <Ionicons
                                    color={
                                        colors.ink
                                    }
                                    name="close"
                                    size={22}
                                />
                            </Pressable>
                        </View>

                        <TextInput
                            autoCapitalize="none"
                            onChangeText={
                                setSolicitanteSearch
                            }
                            placeholder="Buscar por nombre, correo o RUT"
                            placeholderTextColor="#98A2B3"
                            style={[
                                styles.input,
                                styles.entitySearchInput,
                            ]}
                            value={
                                solicitanteSearch
                            }
                        />

                        <FlatList
                            data={
                                solicitantesFirmante.filter(
                                    (
                                        item,
                                    ) => {
                                        const search =
                                            solicitanteSearch
                                                .trim()
                                                .toLowerCase();

                                        if (!search) {
                                            return true;
                                        }

                                        return (
                                            (
                                                item.nombre ??
                                                ''
                                            )
                                                .toLowerCase()
                                                .includes(
                                                    search,
                                                ) ||

                                            (
                                                item.email ??
                                                ''
                                            )
                                                .toLowerCase()
                                                .includes(
                                                    search,
                                                ) ||

                                            (
                                                item.rut ??
                                                ''
                                            )
                                                .toLowerCase()
                                                .includes(
                                                    search,
                                                )

                                        );
                                    },
                                )
                            }
                            keyExtractor={(
                                item,
                            ) =>
                                String(
                                    item.id_solicitante,
                                )
                            }
                            ListEmptyComponent={
                                <Text
                                    style={
                                        styles.emptyText
                                    }
                                >
                                    No se encontraron solicitantes activos.
                                </Text>
                            }
                            renderItem={({
                                item,
                            }) => {
                                const selected =
                                    solicitanteFirmante
                                        ?.id_solicitante ===
                                    item.id_solicitante;

                                const tieneCorreo =
                                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                                        .test(
                                            item.email
                                                ?.trim() ??
                                            '',
                                        );

                                return (
                                    <Pressable
                                        onPress={() => {
                                            if (
                                                !tieneCorreo
                                            ) {
                                                Alert.alert(
                                                    'Solicitante sin correo',
                                                    'Este solicitante no tiene un correo válido registrado.',
                                                );

                                                return;
                                            }

                                            setSolicitanteFirmante(
                                                item,
                                            );

                                            setSolicitanteModalOpen(
                                                false,
                                            );

                                            setSolicitanteSearch(
                                                '',
                                            );
                                        }}
                                        style={({ pressed }) => [
                                            styles.entityOption,

                                            selected &&
                                            styles.entityOptionSelected,

                                            pressed &&
                                            styles.entityOptionPressed,

                                            !tieneCorreo &&
                                            styles.optionDisabled,
                                        ]}
                                    >
                                        <View
                                            style={
                                                styles.entityOptionIcon
                                            }
                                        >
                                            <Ionicons
                                                color={
                                                    ridsPalette.cyanDark
                                                }
                                                name="person-outline"
                                                size={19}
                                            />
                                        </View>

                                        <View
                                            style={
                                                styles.entityOptionCopy
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.entityOptionTitle
                                                }
                                            >
                                                {
                                                    item.nombre ||
                                                    'Sin nombre'
                                                }
                                            </Text>

                                            <Text
                                                style={[
                                                    styles.entityOptionMeta,

                                                    !tieneCorreo &&
                                                    styles.invalidEmailText,
                                                ]}
                                            >
                                                {
                                                    item.email ||
                                                    'Sin correo registrado'
                                                }

                                                {item.empresa?.nombre
                                                    ? ` · ${item.empresa.nombre}`
                                                    : ''}
                                            </Text>
                                        </View>

                                        {selected && (
                                            <Ionicons
                                                color={
                                                    ridsPalette.cyanDark
                                                }
                                                name="checkmark-circle"
                                                size={21}
                                            />
                                        )}
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* =====================================================
          ACCIONES
      ===================================================== */}

            <View
                style={
                    styles.actions
                }
            >
                <AppButton
                    disabled={
                        !canSubmit
                    }
                    loading={
                        submitting
                    }
                    onPress={
                        registrarIngreso
                    }
                    title="Registrar ingreso"
                />

                <AppButton
                    disabled={
                        submitting
                    }
                    onPress={() => {
                        router.back();
                    }}
                    title="Cancelar"
                    variant="ghost"
                />
            </View>
            <View
                pointerEvents="none"
                style={
                    styles.pdfReceiptWrapper
                }
            >
                <View
                    collapsable={
                        false
                    }
                    ref={
                        pdfReceiptRef
                    }
                    style={
                        styles.pdfReceipt
                    }
                >
                    <View
                        style={
                            styles.pdfHeader
                        }
                    >
                        <View>
                            <Text
                                style={
                                    styles.pdfBrand
                                }
                            >
                                RIDS
                            </Text>

                            <Text
                                style={
                                    styles.pdfTitle
                                }
                            >
                                Comprobante de ingreso a Taller
                            </Text>

                            <Text
                                style={
                                    styles.pdfSubtitle
                                }
                            >
                                {ordenPdf?.numeroOrden
                                    ? `Código ${ordenPdf.numeroOrden}`
                                    : ordenPdf
                                        ? `Orden #${ordenPdf.id}`
                                        : 'Orden de Taller'}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={
                            styles.pdfDivider
                        }
                    />

                    <Text
                        style={
                            styles.pdfSectionTitle
                        }
                    >
                        Datos de la Orden
                    </Text>

                    <PdfInfoRow
                        label="Entidad"
                        value={
                            entidadSeleccionada
                                ?.nombre ??
                            '—'
                        }
                    />

                    <PdfInfoRow
                        label="Equipo"
                        value={
                            nombreEquipo
                        }
                    />

                    <PdfInfoRow
                        label="Serial"
                        value={
                            serial
                        }
                    />

                    <PdfInfoRow
                        label="Trabajo"
                        value={
                            tipoTrabajo ||
                            '—'
                        }
                    />

                    <PdfInfoRow
                        label="Motivo"
                        value={
                            descripcion ||
                            '—'
                        }
                    />

                    <PdfInfoRow
                        label="Prioridad"
                        value={
                            prioridad
                        }
                    />

                    <PdfInfoRow
                        label="Cargador"
                        value={
                            incluyeCargador
                                ? 'Sí'
                                : 'No'
                        }
                    />

                    {notas.trim() ? (
                        <PdfInfoRow
                            label="Notas"
                            value={
                                notas.trim()
                            }
                        />
                    ) : null}

                    <PdfInfoRow
                        label="Fecha"
                        value={
                            fechaPdf
                                ? new Date(
                                    fechaPdf,
                                ).toLocaleString(
                                    'es-CL',
                                )
                                : '—'
                        }
                    />

                    <View
                        style={
                            styles.pdfDivider
                        }
                    />

                    <Text
                        style={
                            styles.pdfSectionTitle
                        }
                    >
                        Confirmación de recepción
                    </Text>

                    <PdfInfoRow
                        label="Firmante"
                        value={
                            solicitanteFirmante
                                ?.nombre ??
                            '—'
                        }
                    />

                    <PdfInfoRow
                        label="Correo"
                        value={
                            solicitanteFirmante
                                ?.email ??
                            '—'
                        }
                    />

                    {solicitanteFirmante
                        ?.empresa
                        ?.nombre ? (
                        <PdfInfoRow
                            label="Empresa"
                            value={
                                solicitanteFirmante
                                    .empresa
                                    .nombre
                            }
                        />
                    ) : null}

                    <View
                        style={
                            styles.pdfSignatureArea
                        }
                    >
                        {firmaPdfUri ? (
                            <RNImage
                                resizeMode="contain"
                                source={{
                                    uri:
                                        firmaPdfUri.startsWith(
                                            'file://',
                                        )
                                            ? firmaPdfUri
                                            : `file://${firmaPdfUri}`,
                                }}
                                style={
                                    styles.pdfSignature
                                }
                            />
                        ) : null}
                    </View>

                    <View
                        style={
                            styles.pdfSignatureLine
                        }
                    />

                    <Text
                        style={
                            styles.pdfSignatureLabel
                        }
                    >
                        Firma de quien entrega el equipo
                    </Text>

                    <Text
                        style={
                            styles.pdfFooter
                        }
                    >
                        Comprobante generado electrónicamente por RIDS
                    </Text>
                </View>
            </View>
        </Screen>
    );
}

/* =========================================================
   SECTION
========================================================= */

function Section({
    children,
    title,
}: {
    children:
    React.ReactNode;
    title:
    string;
}) {
    return (
        <View
            style={
                styles.section
            }
        >
            <RidsSectionTitle
                title={
                    title
                }
            />

            {
                children
            }
        </View>
    );
}

function PdfInfoRow({
    label,
    value,
}: {
    label:
    string;

    value:
    string;
}) {
    return (
        <View
            style={
                styles.pdfInfoRow
            }
        >
            <Text
                style={
                    styles.pdfInfoLabel
                }
            >
                {label}
            </Text>

            <Text
                style={
                    styles.pdfInfoValue
                }
            >
                {value}
            </Text>
        </View>
    );
}

function sanitizeFileName(
    value: string,
) {
    const cleaned =
        value
            .normalize(
                'NFD',
            )
            .replace(
                /[\u0300-\u036f]/g,
                '',
            )
            .replace(
                /[\\/:*?"<>|]/g,
                '-',
            )
            .replace(
                /\s+/g,
                ' ',
            )
            .trim();

    return (
        cleaned ||
        'comprobante'
    ).slice(
        0,
        80,
    );
}

function getImageSize(
    uri: string,
): Promise<{
    width: number;
    height: number;
}> {
    return new Promise(
        (
            resolve,
            reject,
        ) => {
            RNImage.getSize(
                uri,

                (
                    width,
                    height,
                ) =>
                    resolve({
                        width,
                        height,
                    }),

                reject,
            );
        },
    );
}

function createSingleImagePdfBase64(
    imageBase64: string,
    imageWidth: number,
    imageHeight: number,
) {
    const imageBytes =
        base64ToBytes(
            imageBase64,
        );

    const pageWidth =
        595.28;

    const pageHeight =
        841.89;

    const content =
        `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;

    const chunks:
        Uint8Array[] =
        [];

    const offsets:
        number[] =
        [];

    let length =
        0;

    const addString =
        (
            value:
                string,
        ) => {
            const bytes =
                asciiToBytes(
                    value,
                );

            chunks.push(
                bytes,
            );

            length +=
                bytes.length;
        };

    const addBytes =
        (
            bytes:
                Uint8Array,
        ) => {
            chunks.push(
                bytes,
            );

            length +=
                bytes.length;
        };

    const addObject =
        (
            id:
                number,

            body:
                | string
                | Uint8Array,

            prefix =
                '',

            suffix =
                '',
        ) => {
            offsets[id] =
                length;

            addString(
                `${id} 0 obj\n`,
            );

            if (prefix) {
                addString(
                    prefix,
                );
            }

            if (
                typeof body ===
                'string'
            ) {
                addString(
                    body,
                );
            } else {
                addBytes(
                    body,
                );
            }

            if (suffix) {
                addString(
                    suffix,
                );
            }

            addString(
                '\nendobj\n',
            );
        };

    addString(
        '%PDF-1.4\n',
    );

    addObject(
        1,
        '<< /Type /Catalog /Pages 2 0 R >>',
    );

    addObject(
        2,
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    );

    addObject(
        3,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
    );

    addObject(
        4,
        imageBytes,
        `<< /Type /XObject /Subtype /Image /Width ${Math.round(
            imageWidth,
        )} /Height ${Math.round(
            imageHeight,
        )} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
        '\nendstream',
    );

    addObject(
        5,
        content,
        `<< /Length ${asciiToBytes(
            content,
        ).length} >>\nstream\n`,
        'endstream',
    );

    const xrefOffset =
        length;

    addString(
        'xref\n0 6\n0000000000 65535 f \n',
    );

    for (
        let i = 1;
        i <= 5;
        i += 1
    ) {
        addString(
            `${String(
                offsets[i],
            ).padStart(
                10,
                '0',
            )} 00000 n \n`,
        );
    }

    addString(
        `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    );

    return bytesToBase64(
        concatBytes(
            chunks,
            length,
        ),
    );
}

function asciiToBytes(
    value:
        string,
) {
    const bytes =
        new Uint8Array(
            value.length,
        );

    for (
        let i = 0;
        i <
        value.length;
        i += 1
    ) {
        bytes[i] =
            value.charCodeAt(
                i,
            ) &
            0xff;
    }

    return bytes;
}

function concatBytes(
    chunks:
        Uint8Array[],

    length:
        number,
) {
    const output =
        new Uint8Array(
            length,
        );

    let offset =
        0;

    chunks.forEach(
        (
            chunk,
        ) => {
            output.set(
                chunk,
                offset,
            );

            offset +=
                chunk.length;
        },
    );

    return output;
}

function base64ToBytes(
    base64:
        string,
) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    const clean =
        base64.replace(
            /[^A-Za-z0-9+/=]/g,
            '',
        );

    const bytes:
        number[] =
        [];

    for (
        let i = 0;
        i <
        clean.length;
        i += 4
    ) {
        const enc1 =
            chars.indexOf(
                clean[i],
            );

        const enc2 =
            chars.indexOf(
                clean[
                i + 1
                ],
            );

        const enc3 =
            clean[
                i + 2
            ] === '='
                ? -1
                : chars.indexOf(
                    clean[
                    i + 2
                    ],
                );

        const enc4 =
            clean[
                i + 3
            ] === '='
                ? -1
                : chars.indexOf(
                    clean[
                    i + 3
                    ],
                );

        bytes.push(
            (
                enc1 <<
                2
            ) |
            (
                enc2 >>
                4
            ),
        );

        if (
            enc3 >= 0
        ) {
            bytes.push(
                (
                    (
                        enc2 &
                        15
                    ) <<
                    4
                ) |
                (
                    enc3 >>
                    2
                ),
            );
        }

        if (
            enc4 >= 0
        ) {
            bytes.push(
                (
                    (
                        enc3 &
                        3
                    ) <<
                    6
                ) |
                enc4,
            );
        }
    }

    return new Uint8Array(
        bytes,
    );
}

function bytesToBase64(
    bytes:
        Uint8Array,
) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    let output =
        '';

    for (
        let i = 0;
        i <
        bytes.length;
        i += 3
    ) {
        const b1 =
            bytes[i];

        const b2 =
            i + 1 <
                bytes.length
                ? bytes[
                i + 1
                ]
                : 0;

        const b3 =
            i + 2 <
                bytes.length
                ? bytes[
                i + 2
                ]
                : 0;

        output +=
            chars[
            b1 >>
            2
            ];

        output +=
            chars[
            (
                (
                    b1 &
                    3
                ) <<
                4
            ) |
            (
                b2 >>
                4
            )
            ];

        output +=
            i + 1 <
                bytes.length
                ? chars[
                (
                    (
                        b2 &
                        15
                    ) <<
                    2
                ) |
                (
                    b3 >>
                    6
                )
                ]
                : '=';

        output +=
            i + 2 <
                bytes.length
                ? chars[
                b3 &
                63
                ]
                : '=';
    }

    return output;
}

/* =========================================================
   STYLES
========================================================= */

const styles =
    StyleSheet.create({
        center: {
            alignItems:
                'center',
            flex: 1,
            justifyContent:
                'center',
        },

        loadingText: {
            color:
                colors.muted,
            fontSize: 13,
            marginTop: 10,
        },

        section: {
            marginBottom: 24,
        },

        equipoCard: {
            alignItems:
                'center',
            backgroundColor:
                colors.surface,
            borderColor:
                colors.line,
            borderRadius: 16,
            borderWidth: 1,
            flexDirection:
                'row',
            gap: 12,
            marginBottom: 22,
            padding: 14,
            ...shadow,
        },

        equipoIcon: {
            alignItems:
                'center',
            backgroundColor:
                ridsPalette.cyanSoft,
            borderRadius: 12,
            height: 44,
            justifyContent:
                'center',
            width: 44,
        },

        equipoCopy: {
            flex: 1,
        },

        equipoLabel: {
            color:
                ridsPalette.cyanDark,
            fontSize: 10,
            fontWeight:
                '900',
            letterSpacing: 0.5,
            marginBottom: 4,
        },

        equipoTitle: {
            color:
                colors.ink,
            fontSize: 16,
            fontWeight:
                '900',
        },

        equipoMeta: {
            color:
                colors.muted,
            fontSize: 12,
            lineHeight: 18,
            marginTop: 2,
        },

        estadoRow: {
            alignItems:
                'center',
            flexDirection:
                'row',
            gap: 7,
            marginTop: 2,
        },

        estadoBadge: {
            backgroundColor:
                ridsPalette.cyanSoft,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
        },

        estadoBadgeText: {
            color:
                ridsPalette.cyanDark,
            fontSize: 10,
            fontWeight:
                '900',
        },

        field: {
            marginBottom: 12,
        },

        fieldLabel: {
            color:
                colors.ink,
            fontSize: 13,
            fontWeight:
                '800',
            marginBottom: 6,
        },

        input: {
            backgroundColor:
                colors.surface,
            borderColor:
                colors.line,
            borderRadius: 14,
            borderWidth: 1,
            color:
                colors.ink,
            fontSize: 15,
            minHeight: 52,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },

        textArea: {
            minHeight: 120,
            paddingTop: 12,
        },

        textAreaSmall: {
            minHeight: 95,
            paddingTop: 12,
        },

        characterCounter: {
            color:
                colors.muted,
            fontSize: 11,
            marginTop: 4,
            textAlign:
                'right',
        },

        helperText: {
            color:
                colors.muted,
            fontSize: 12,
            lineHeight: 18,
            marginBottom: 10,
        },

        segmented: {
            backgroundColor:
                colors.surface,
            borderColor:
                colors.line,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection:
                'row',
            gap: 8,
            padding: 6,
        },

        segmentOption: {
            alignItems:
                'center',
            borderRadius: 10,
            flex: 1,
            justifyContent:
                'center',
            minHeight: 42,
        },

        segmentOptionActive: {
            backgroundColor:
                ridsPalette.cyanDark,
        },

        segmentOptionPressed: {
            opacity: 0.85,
        },

        segmentText: {
            color:
                colors.muted,
            fontSize: 13,
            fontWeight:
                '800',
        },

        segmentTextActive: {
            color:
                colors.white,
        },

        switchRow: {
            alignItems:
                'center',
            backgroundColor:
                colors.surface,
            borderColor:
                colors.line,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection:
                'row',
            gap: 12,
            padding: 14,
        },

        switchIcon: {
            alignItems:
                'center',
            backgroundColor:
                ridsPalette.cyanSoft,
            borderRadius: 11,
            height: 40,
            justifyContent:
                'center',
            width: 40,
        },

        switchCopy: {
            flex: 1,
        },

        switchTitle: {
            color:
                colors.ink,
            fontSize: 14,
            fontWeight:
                '900',
        },

        switchDescription: {
            color:
                colors.muted,
            fontSize: 12,
            lineHeight: 17,
            marginTop: 3,
        },

        infoCard: {
            alignItems:
                'flex-start',
            backgroundColor:
                ridsPalette.cyanSoft,
            borderColor:
                '#BDE9EC',
            borderRadius: 14,
            borderWidth: 1,
            flexDirection:
                'row',
            gap: 10,
            marginBottom: 22,
            padding: 13,
        },

        infoIcon: {
            alignItems:
                'center',
            justifyContent:
                'center',
            paddingTop: 1,
        },

        infoCopy: {
            flex: 1,
        },

        infoTitle: {
            color:
                colors.ink,
            fontSize: 13,
            fontWeight:
                '900',
            marginBottom: 5,
        },

        infoText: {
            color:
                colors.muted,
            fontSize: 12,
            lineHeight: 18,
            marginBottom: 2,
        },

        actions: {
            gap: 10,
            marginBottom: 20,
        },

        entitySelector: {
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 12,
            minHeight: 62,
            paddingHorizontal: 14,
            paddingVertical: 10,
        },

        entitySelectorPressed: {
            opacity: 0.85,
        },

        entitySelectorIcon: {
            alignItems: 'center',
            backgroundColor: ridsPalette.cyanSoft,
            borderRadius: 10,
            height: 38,
            justifyContent: 'center',
            width: 38,
        },

        entitySelectorCopy: {
            flex: 1,
        },

        entitySelectorTitle: {
            color: colors.ink,
            fontSize: 14,
            fontWeight: '900',
        },

        entitySelectorPlaceholder: {
            color: colors.muted,
            fontSize: 14,
            fontWeight: '800',
        },

        entitySelectorMeta: {
            color: colors.muted,
            fontSize: 11,
            marginTop: 3,
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
            maxHeight: '82%',
            minHeight: '55%',
            paddingBottom: 24,
            paddingHorizontal: 18,
            paddingTop: 18,
        },

        modalHeader: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 14,
        },

        modalTitle: {
            color: colors.ink,
            fontSize: 18,
            fontWeight: '900',
        },

        modalSubtitle: {
            color: colors.muted,
            fontSize: 12,
            marginTop: 3,
        },

        modalCloseButton: {
            alignItems: 'center',
            backgroundColor: colors.surfaceAlt,
            borderRadius: 10,
            height: 36,
            justifyContent: 'center',
            width: 36,
        },

        entitySearchInput: {
            marginBottom: 12,
        },

        entityLoading: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 28,
        },

        entityOption: {
            alignItems: 'center',
            borderBottomColor: colors.line,
            borderBottomWidth: 1,
            flexDirection: 'row',
            gap: 10,
            paddingVertical: 12,
        },

        entityOptionSelected: {
            backgroundColor: ridsPalette.cyanSoft,
        },

        entityOptionPressed: {
            opacity: 0.8,
        },

        entityOptionIcon: {
            alignItems: 'center',
            backgroundColor: ridsPalette.cyanSoft,
            borderRadius: 9,
            height: 34,
            justifyContent: 'center',
            width: 34,
        },

        entityOptionCopy: {
            flex: 1,
        },

        entityOptionTitle: {
            color: colors.ink,
            fontSize: 13,
            fontWeight: '800',
        },

        entityOptionMeta: {
            color: colors.muted,
            fontSize: 11,
            marginTop: 3,
        },

        emptyText: {
            color: colors.muted,
            fontSize: 13,
            paddingVertical: 24,
            textAlign: 'center',
        },

        signatureConfirmed: {
            alignItems:
                'center',

            flexDirection:
                'row',

            gap:
                6,

            marginTop:
                8,
        },

        signatureConfirmedText: {
            color:
                '#15803D',

            fontSize:
                12,

            fontWeight:
                '800',
        },
        validationError: {
            color:
                '#B42318',

            fontSize:
                11,

            fontWeight:
                '700',

            marginTop:
                6,
        },

        optionDisabled: {
            opacity:
                0.55,
        },

        invalidEmailText: {
            color:
                '#B42318',
        },

        pdfReceiptWrapper: {
            left:
                0,

            opacity:
                0.01,

            position:
                'absolute',

            top:
                0,

            zIndex:
                -1,
        },

        pdfReceipt: {
            backgroundColor:
                '#FFFFFF',

            height:
                842,

            padding:
                32,

            width:
                595,
        },

        pdfHeader: {
            marginBottom:
                4,
        },

        pdfBrand: {
            color:
                ridsPalette.cyanDark,

            fontSize:
                18,

            fontWeight:
                '900',

            marginBottom:
                6,
        },

        pdfTitle: {
            color:
                '#101828',

            fontSize:
                24,

            fontWeight:
                '900',
        },

        pdfSubtitle: {
            color:
                '#667085',

            fontSize:
                13,

            fontWeight:
                '700',

            marginTop:
                4,
        },

        pdfDivider: {
            backgroundColor:
                '#D0D5DD',

            height:
                1,

            marginBottom:
                18,

            marginTop:
                18,
        },

        pdfSectionTitle: {
            color:
                '#101828',

            fontSize:
                17,

            fontWeight:
                '900',

            marginBottom:
                12,
        },

        pdfInfoRow: {
            flexDirection:
                'row',

            gap:
                14,

            marginBottom:
                9,
        },

        pdfInfoLabel: {
            color:
                '#667085',

            fontSize:
                13,

            fontWeight:
                '800',

            width:
                90,
        },

        pdfInfoValue: {
            color:
                '#101828',

            flex:
                1,

            fontSize:
                13,

            fontWeight:
                '700',
        },

        pdfSignatureArea: {
            alignItems:
                'center',

            height:
                140,

            justifyContent:
                'flex-end',

            marginTop:
                10,
        },

        pdfSignature: {
            height:
                130,

            width:
                380,
        },

        pdfSignatureLine: {
            alignSelf:
                'center',

            backgroundColor:
                '#344054',

            height:
                1,

            width:
                360,
        },

        pdfSignatureLabel: {
            color:
                '#475467',

            fontSize:
                11,

            marginTop:
                6,

            textAlign:
                'center',
        },

        pdfFooter: {
            color:
                '#98A2B3',

            fontSize:
                10,

            marginTop:
                28,

            textAlign:
                'center',
        },

    });