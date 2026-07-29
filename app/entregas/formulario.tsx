import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image as RNImage, InteractionManager, PanResponder, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import {
  confirmarEvidencia,
  crearEntrega,
  enviarPdfEntrega,
  solicitarFirmaSubida,
  uploadToCloudinary,
} from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { Screen } from '@/src/components/Screen';
import {
  clearEntregaState,
  EntregaEnCursoState,
  EntregaPhoto,
  getEntregaReceptorEmail,
  getEntregaReceptorNombre,
  getEntregaReceptorRut,
  loadEntregaState,
  saveEntregaState,
} from '@/src/entregas/entrega-state';
import { colors, shadow } from '@/src/theme/colors';

type SignaturePoint = {
  x: number;
  y: number;
};

type SignatureStroke = SignaturePoint[];

const signatureHeight = 210;
const pdfReceiptWidth = 595;
const pdfReceiptHeight = 842;
const pdfSignatureWidth = pdfReceiptWidth - 64;
const pdfSignatureHeight = 120;
const ridsLogo = require('../../assets/images/logo-rids.png');
const ridsStamp = require('../../assets/images/Timbre-rids.png');
const econnetLogo = require('../../assets/images/logo-econnet.png');
const econnetStamp = require('../../assets/images/Timbre-econnet.png');

export default function EntregaFormularioScreen() {
  const [entregaState, setEntregaState] = useState<EntregaEnCursoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureStrokes, setSignatureStrokes] = useState<SignatureStroke[]>([]);
  const [signatureWidth, setSignatureWidth] = useState(0);
  const signatureRef = useRef<View>(null);
  const pdfReceiptRef = useRef<View>(null);

  const receptorNombre = useMemo(
    () => (entregaState ? getEntregaReceptorNombre(entregaState) : ''),
    [entregaState],
  );
  const receptorEmail = useMemo(
    () => (entregaState ? getEntregaReceptorEmail(entregaState) : ''),
    [entregaState],
  );
  const receptorRut = useMemo(
    () => (entregaState ? formatRut(getEntregaReceptorRut(entregaState)) : ''),
    [entregaState],
  );
  const hasSignature = signatureStrokes.some((stroke) => stroke.length > 1);
  const brand = entregaState?.brand === 'econnet' ? 'econnet' : 'rids';
  const isRetiro = entregaState?.operation === 'retiro';
  const operationLabel = isRetiro ? 'retiro' : 'entrega';
  const selectedEquipos = entregaState?.selectedEquipos ?? [];
  const retiroProductos = entregaState?.retiroProductos ?? [];
  const empresaRut = useMemo(
    () => (entregaState?.empresa?.detalleEmpresa?.rut ? formatRut(entregaState.empresa.detalleEmpresa.rut) : ''),
    [entregaState?.empresa?.detalleEmpresa?.rut],
  );
  const canSubmit =
    Boolean(entregaState?.empresa && receptorNombre.trim() && entregaState?.photo && hasSignature && !submitting) &&
    (!isRetiro || (brand === 'econnet' ? retiroProductos.length > 0 : selectedEquipos.length > 0));
  const brandLogo = brand === 'econnet' ? econnetLogo : ridsLogo;
  const brandStamp = brand === 'econnet' ? econnetStamp : ridsStamp;
  const brandName = brand === 'econnet' ? 'Econnet' : 'RIDS';

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setIsSigning(true);
          const { locationX, locationY } = event.nativeEvent;
          setSignatureStrokes((current) => [...current, [{ x: locationX, y: locationY }]]);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          setSignatureStrokes((current) => {
            if (!current.length) return [[{ x: locationX, y: locationY }]];
            const next = [...current];
            const last = next[next.length - 1] ?? [];
            next[next.length - 1] = [...last, { x: locationX, y: locationY }];
            return next;
          });
        },
        onPanResponderRelease: () => setIsSigning(false),
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => setIsSigning(false),
      }),
    [],
  );

  useEffect(() => {
    async function boot() {
      const saved = await loadEntregaState();
      if (!saved.empresa) {
        router.replace('/(tabs)/entregas');
        return;
      }

      setEntregaState(saved);
      setLoading(false);
    }

    boot();
  }, []);

  async function updateEntrega(updates: Partial<EntregaEnCursoState>) {
    if (!entregaState) return;
    const nextState = { ...entregaState, ...updates };
    setEntregaState(nextState);
    await saveEntregaState(nextState);
  }

  async function seleccionarFoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Foto', 'Activa los permisos de fotos para seleccionar una evidencia.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.78,
    });

    if (result.canceled || !result.assets[0]) return;
    await updateEntrega({ photo: mapPickerAsset(result.assets[0]) });
  }

  async function tomarFoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camara', 'Activa los permisos de camara para tomar la evidencia.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.78,
    });

    if (result.canceled || !result.assets[0]) return;
    await updateEntrega({ photo: mapPickerAsset(result.assets[0]) });
  }

  async function uploadEvidence(
    entregaId: number,
    tipo: 'pdf',
    file: { bytes: number; formato: string; mimeType: string; name: string; uri: string },
  ) {
    const signature = await solicitarFirmaSubida(entregaId, {
      tipo,
      formato: file.formato,
      bytes: file.bytes,
      nombreArchivo: tipo === 'pdf' ? file.name : undefined,
    });

    const cloudinaryResp = await uploadToCloudinary(
      signature,
      {
        name: file.name,
        type: file.mimeType,
        uri: file.uri,
      } as unknown as Blob,
      file.name,
    );

    const url = cloudinaryResp?.secure_url || cloudinaryResp?.url;
    const publicId = cloudinaryResp?.public_id || cloudinaryResp?.publicId;
    const bytes = Number(cloudinaryResp?.bytes) || file.bytes || 1;

    if (!url || !publicId) {
      throw new Error('Cloudinary no confirmo la subida de evidencia.');
    }

    await confirmarEvidencia(entregaId, {
      tipo,
      formato: file.formato,
      bytes,
      url,
      publicId,
    });
  }

  async function buildPdfFile(entregaId: number): Promise<EntregaPhoto> {
    if (!pdfReceiptRef.current) {
      throw new Error('No se pudo preparar el PDF.');
    }

    // Esperar a que terminen animaciones/renders pendientes antes de capturar,
    // en vez de un delay fijo (evita capturas en blanco en equipos lentos).
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    const receiptImageUri = await captureRef(pdfReceiptRef, {
      format: 'jpg',
      quality: 0.92,
      result: 'tmpfile',
    });
    const imageBase64 = await FileSystem.readAsStringAsync(receiptImageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { width, height } = await getImageSize(receiptImageUri);
    const pdfBase64 = createSingleImagePdfBase64(imageBase64, width, height);
    const fileName = buildPdfFileName(entregaState?.empresa?.nombre || 'empresa', receptorNombre || 'receptor', operationLabel);
    const uri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(uri, pdfBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const info = await FileSystem.getInfoAsync(uri);

    return {
      bytes: info.exists && typeof info.size === 'number' ? info.size : 1,
      formato: 'pdf',
      mimeType: 'application/pdf',
      name: fileName,
      uri,
    };
  }

  async function sharePdf(uri: string) {
    await Share.share({
      title: `Comprobante de ${operationLabel}`,
      message: `Comprobante de ${operationLabel} ${brandName}`,
      url: uri,
    });
  }

  function showSuccessModal(pdfFile: EntregaPhoto) {
    Alert.alert(
      isRetiro ? 'Retiro registrado' : 'Entrega registrada',
      `El comprobante fue generado y el correo quedo en proceso de envio para ${isRetiro ? 'el responsable' : 'el receptor'} con copia para ti. Puedes compartir el PDF ahora.`,
      [
        {
          text: 'Compartir PDF',
          onPress: async () => {
            try {
              await sharePdf(pdfFile.uri);
            } finally {
              router.replace('/(tabs)');
            }
          },
        },
        {
          text: 'Ir al inicio',
          onPress: () => router.replace('/(tabs)'),
          style: 'cancel',
        },
      ],
      { cancelable: false },
    );
  }

  async function registrarEntrega() {
    if (!entregaState?.empresa || !entregaState.photo || !receptorNombre.trim()) {
      Alert.alert(isRetiro ? 'Retiro' : 'Entrega', `Selecciona empresa, ${isRetiro ? 'responsable' : 'quien recibe'} y foto.`);
      return;
    }
    if (isRetiro && brand !== 'econnet' && !selectedEquipos.length) {
      Alert.alert('Retiro', 'Selecciona los equipos que se retiraran.');
      router.replace('/entregas/retiro-equipos');
      return;
    }
    if (isRetiro && brand === 'econnet' && !retiroProductos.length) {
      Alert.alert('Retiro', 'Agrega los productos que se retiraran.');
      router.replace('/entregas/retiro-equipos');
      return;
    }
    if (!hasSignature) {
      Alert.alert('Firma', `Solicita la firma ${isRetiro ? 'del responsable de retiro' : 'de quien recibe'}.`);
      return;
    }

    try {
      setSubmitting(true);
      const entregaResp = await crearEntrega({
        empresaNombre: entregaState.empresa.nombre,
        receptorNombre: receptorNombre.trim(),
        fecha: new Date().toISOString(),
        origen: brand,
        tipo: operationLabel,
      });
      const entregaId = entregaResp.entrega.id_entrega;

      const pdfFile = await buildPdfFile(entregaId);
      await uploadEvidence(entregaId, 'pdf', pdfFile);
      if (!receptorEmail) {
        throw new Error('El receptor no tiene correo registrado para enviar el PDF.');
      }
      await enviarPdfEntrega(entregaId, {
        brand,
        operation: operationLabel,
        pdfFile: {
          mimeType: pdfFile.mimeType,
          name: pdfFile.name,
          uri: pdfFile.uri,
        },
        receptorEmail,
      });

      await clearEntregaState();
      setEntregaState(null);
      setSignatureStrokes([]);
      showSuccessModal(pdfFile);
    } catch (error) {
      Alert.alert(isRetiro ? 'Retiro' : 'Entrega', error instanceof Error ? error.message : `No se pudo registrar ${isRetiro ? 'el retiro' : 'la entrega'}.`);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelarEntrega() {
    Alert.alert(`Cancelar ${operationLabel}`, `Se eliminara el estado actual de este ${operationLabel}.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: `Cancelar ${operationLabel}`,
        style: 'destructive',
        onPress: async () => {
          await clearEntregaState();
          setEntregaState(null);
          setSignatureStrokes([]);
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  if (loading || !entregaState || !entregaState.empresa) {
    return (
      <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }
  const empresa = entregaState.empresa;

  return (
    <Screen bottomNavigation={<BottomNavigation />} scrollEnabled={!isSigning}>
      <Text style={styles.title}>{isRetiro ? 'Nuevo retiro' : 'Nueva entrega'}</Text>
      <Text style={styles.subtitle}>{empresa.nombre}</Text>

      <Section icon="business-outline" title="Empresa">
        <InfoRow label="Empresa seleccionada" value={empresa.nombre} />
        {empresaRut ? <InfoRow label="RUT empresa" value={empresaRut} /> : null}
        <AppButton onPress={() => router.replace('/(tabs)/entregas')} title="Cambiar empresa" variant="secondary" />
      </Section>

      <Section icon="person-outline" title={isRetiro ? 'Responsable de retiro' : 'Datos del receptor'}>
        <Pressable onPress={() => router.push('/entregas/receptor')} style={styles.receptorButton}>
          <View style={styles.receptorIcon}>
            <Ionicons color={colors.brand} name="person-add-outline" size={24} />
          </View>
          <View style={styles.receptorCopy}>
            <Text style={styles.receptorTitle}>{receptorNombre || (isRetiro ? 'Responsable' : 'Quien recibe')}</Text>
            <Text style={styles.receptorText}>{receptorEmail || 'Selecciona usuario o ingreso manual'}</Text>
            {receptorRut ? <Text style={styles.receptorText}>RUT: {receptorRut}</Text> : null}
          </View>
          <Ionicons color={colors.muted} name="chevron-forward" size={20} />
        </Pressable>
      </Section>

      {isRetiro ? (
        <Section icon={brand === 'econnet' ? 'cube-outline' : 'hardware-chip-outline'} title={brand === 'econnet' ? 'Productos seleccionados' : 'Equipos seleccionados'}>
          {brand === 'econnet'
            ? retiroProductos.map((producto) => (
                <InfoRow
                  key={producto.id}
                  label={producto.nombre}
                  value={`Cantidad: ${producto.cantidad || '1'}${producto.serial ? ` · Serie: ${producto.serial}` : ''}`}
                />
              ))
            : selectedEquipos.map((equipo) => (
                <InfoRow key={equipo.id_equipo} label={formatEquipoTitle(equipo)} value={`Serial: ${equipo.serial || 'Sin serial'}`} />
              ))}
          <AppButton
            onPress={() => router.push({ pathname: '/entregas/retiro-equipos', params: { returnTo: 'formulario' } })}
            title={brand === 'econnet' ? 'Cambiar productos' : 'Cambiar equipos'}
            variant="secondary"
          />
        </Section>
      ) : null}

      <Section icon="camera-outline" title={isRetiro ? 'Fotografia de retiro' : 'Fotografia de entrega'}>
        <View style={styles.photoCard}>
          <View style={styles.photoPreview}>
            {entregaState.photo ? (
              <Image contentFit="cover" source={{ uri: entregaState.photo.uri }} style={styles.photoImage} />
            ) : (
              <Ionicons color={colors.brand} name="image-outline" size={34} />
            )}
          </View>
          <View style={styles.photoCopy}>
            <Text style={styles.photoTitle}>{entregaState.photo ? entregaState.photo.name : 'Sin evidencia'}</Text>
            <Text style={styles.photoText}>
              {entregaState.photo ? `${entregaState.photo.formato.toUpperCase()} · ${formatBytes(entregaState.photo.bytes)}` : 'Toma o selecciona una foto.'}
            </Text>
          </View>
        </View>
        <View style={styles.photoActions}>
          <AppButton onPress={tomarFoto} title="Tomar foto" variant="secondary" />
          <AppButton onPress={seleccionarFoto} title="Galeria" variant="secondary" />
        </View>
      </Section>

      <Section icon="create-outline" title={isRetiro ? 'Firma del responsable' : 'Firma de quien recibe'}>
        <Text style={styles.signatureHint}>
          Firma dentro del recuadro para confirmar {isRetiro ? 'el retiro de equipos.' : 'la recepcion.'}
        </Text>
        <View
          ref={signatureRef}
          collapsable={false}
          onLayout={(event) => setSignatureWidth(event.nativeEvent.layout.width)}
          style={styles.signatureBox}
          {...panResponder.panHandlers}>
          <Svg height={signatureHeight} width={signatureWidth || 1}>
            {signatureStrokes.map((stroke, index) => (
              <Polyline
                fill="none"
                key={`${index}-${stroke.length}`}
                points={stroke.map((point) => `${point.x},${point.y}`).join(' ')}
                stroke={colors.ink}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
              />
            ))}
          </Svg>
        </View>
        <AppButton
          disabled={!hasSignature}
          onPress={() => setSignatureStrokes([])}
          title="Limpiar firma"
          variant="ghost"
        />
      </Section>

      <View style={styles.actions}>
        <AppButton disabled={!canSubmit} loading={submitting} onPress={registrarEntrega} title={isRetiro ? 'Registrar retiro' : 'Registrar entrega'} />
        <AppButton
          disabled={submitting}
          onPress={cancelarEntrega}
          style={styles.cancelButton}
          textStyle={styles.cancelButtonText}
          title={isRetiro ? 'Cancelar retiro' : 'Cancelar entrega'}
          variant="ghost"
        />
      </View>

      <View pointerEvents="none" style={styles.pdfReceiptWrapper}>
        <View ref={pdfReceiptRef} collapsable={false} style={styles.pdfReceipt}>
          <View style={styles.pdfHeader}>
            <Image contentFit="contain" source={brandLogo} style={styles.pdfLogo} />
            <View style={styles.pdfHeaderCopy}>
              <Text style={styles.pdfTitle}>Comprobante de {operationLabel}</Text>
              <Text style={styles.pdfSubtitle}>{isRetiro ? 'Registro de retiro' : 'Registro de recepcion'} {brandName}</Text>
            </View>
          </View>
          <View style={styles.pdfDivider} />
          <PdfInfoRow label="Empresa" value={empresa.nombre} />
          {empresaRut ? <PdfInfoRow label="RUT emp." value={empresaRut} /> : null}
          <PdfInfoRow label={isRetiro ? 'Responsable' : 'Recibe'} value={receptorNombre} />
          {receptorRut ? <PdfInfoRow label="RUT" value={receptorRut} /> : null}
          <PdfInfoRow label="Fecha" value={new Date().toLocaleString('es-CL')} />
          {receptorEmail ? <PdfInfoRow label="Correo" value={receptorEmail} /> : null}

          {isRetiro ? (
            <>
              <Text style={styles.pdfSectionTitle}>{brand === 'econnet' ? 'Productos retirados' : 'Equipos retirados'}</Text>
              <View style={styles.pdfEquipmentList}>
                {brand === 'econnet'
                  ? retiroProductos.slice(0, 8).map((producto) => (
                      <View key={producto.id} style={styles.pdfEquipmentRow}>
                        <Text numberOfLines={1} style={styles.pdfEquipmentName}>{producto.nombre}</Text>
                        <Text numberOfLines={1} style={styles.pdfEquipmentMeta}>
                          Cantidad: {producto.cantidad || '1'}{producto.serial ? ` · Serie: ${producto.serial}` : ''}
                        </Text>
                        {producto.descripcion ? <Text numberOfLines={1} style={styles.pdfEquipmentMeta}>{producto.descripcion}</Text> : null}
                      </View>
                    ))
                  : selectedEquipos.slice(0, 8).map((equipo) => (
                      <View key={equipo.id_equipo} style={styles.pdfEquipmentRow}>
                        <Text numberOfLines={1} style={styles.pdfEquipmentName}>{formatEquipoTitle(equipo)}</Text>
                        <Text numberOfLines={1} style={styles.pdfEquipmentMeta}>Serial: {equipo.serial || 'Sin serial'}</Text>
                      </View>
                    ))}
                {(brand === 'econnet' ? retiroProductos.length : selectedEquipos.length) > 8 ? (
                  <Text style={styles.pdfEquipmentMore}>+ {(brand === 'econnet' ? retiroProductos.length : selectedEquipos.length) - 8} item(s) adicional(es)</Text>
                ) : null}
              </View>
            </>
          ) : null}

          <Text style={styles.pdfSectionTitle}>Foto de evidencia</Text>
          <View style={[styles.pdfPhotoFrame, isRetiro && styles.pdfPhotoFrameRetiro]}>
            {entregaState.photo ? (
              <Image contentFit="contain" source={{ uri: entregaState.photo.uri }} style={styles.pdfPhoto} />
            ) : null}
          </View>

          <Text style={styles.pdfSectionTitle}>{isRetiro ? 'Firma responsable de retiro' : 'Firma de recepcion'}</Text>
          <View style={styles.pdfSignatureFrame}>
            <Svg height={pdfSignatureHeight} width={pdfSignatureWidth}>
              {signatureStrokes.map((stroke, index) => (
                <Polyline
                  fill="none"
                  key={`pdf-${index}-${stroke.length}`}
                  points={scaleStrokePoints(stroke, signatureWidth || pdfSignatureWidth, signatureHeight, pdfSignatureWidth, pdfSignatureHeight)}
                  stroke={colors.ink}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.4}
                />
              ))}
            </Svg>
            <Image contentFit="contain" source={brandStamp} style={styles.pdfStamp} />
          </View>
          <Text style={styles.pdfSignatureLabel}>{isRetiro ? 'Firma responsable' : 'Firma receptor'}</Text>
        </View>
      </View>
    </Screen>
  );
}

function Section({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons color={colors.brand} name={icon} size={20} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PdfInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pdfInfoRow}>
      <Text style={styles.pdfInfoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.pdfInfoValue}>{value}</Text>
    </View>
  );
}

function mapPickerAsset(asset: ImagePicker.ImagePickerAsset): EntregaPhoto {
  const mimeType = asset.mimeType || 'image/jpeg';
  const rawFormat = mimeType.split('/').pop()?.toLowerCase() || 'jpeg';
  const formato = rawFormat === 'jpg' ? 'jpeg' : rawFormat;
  const name = asset.fileName || `entrega-${Date.now()}.${formato === 'jpeg' ? 'jpg' : formato}`;

  return {
    bytes: asset.fileSize || 1,
    formato,
    mimeType,
    name,
    uri: asset.uri,
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildPdfFileName(empresa: string, receptor: string, operation: string) {
  return `${sanitizeFileName(operation)} - ${sanitizeFileName(empresa)} - ${sanitizeFileName(receptor)}.pdf`;
}

function formatEquipoTitle(equipo: EntregaEnCursoState['selectedEquipos'][number]) {
  return [equipo.marca, equipo.modelo].filter(Boolean).join(' ') || `Equipo #${equipo.id_equipo}`;
}

function cleanRut(value: string) {
  return value.replace(/[^0-9kK]/g, '').toUpperCase();
}

function formatRut(value: string) {
  const cleaned = cleanRut(value).slice(0, 9);
  if (cleaned.length <= 1) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || 'comprobante').slice(0, 80);
}

function scaleStrokePoints(
  stroke: SignatureStroke,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const scaleX = targetWidth / Math.max(1, sourceWidth);
  const scaleY = targetHeight / Math.max(1, sourceHeight);
  return stroke.map((point) => `${point.x * scaleX},${point.y * scaleY}`).join(' ');
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

function createSingleImagePdfBase64(imageBase64: string, imageWidth: number, imageHeight: number) {
  const imageBytes = base64ToBytes(imageBase64);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const addString = (value: string) => {
    const bytes = asciiToBytes(value);
    chunks.push(bytes);
    length += bytes.length;
  };
  const addBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const addObject = (id: number, body: string | Uint8Array, prefix = '', suffix = '') => {
    offsets[id] = length;
    addString(`${id} 0 obj\n`);
    if (prefix) addString(prefix);
    if (typeof body === 'string') addString(body);
    else addBytes(body);
    if (suffix) addString(suffix);
    addString('\nendobj\n');
  };

  addString('%PDF-1.4\n');
  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
  );
  addObject(
    4,
    imageBytes,
    `<< /Type /XObject /Subtype /Image /Width ${Math.round(imageWidth)} /Height ${Math.round(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    '\nendstream',
  );
  addObject(5, content, `<< /Length ${asciiToBytes(content).length} >>\nstream\n`, 'endstream');

  const xrefOffset = length;
  addString('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i += 1) {
    addString(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  addString(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return bytesToBase64(concatBytes(chunks, length));
}

function asciiToBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function concatBytes(chunks: Uint8Array[], length: number) {
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function base64ToBytes(base64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = clean[i + 2] === '=' ? -1 : chars.indexOf(clean[i + 2]);
    const enc4 = clean[i + 3] === '=' ? -1 : chars.indexOf(clean[i + 3]);

    bytes.push((enc1 << 2) | (enc2 >> 4));
    if (enc3 >= 0) bytes.push(((enc2 & 15) << 4) | (enc3 >> 2));
    if (enc4 >= 0) bytes.push(((enc3 & 3) << 6) | enc4);
  }

  return new Uint8Array(bytes);
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    output += chars[b1 >> 2];
    output += chars[((b1 & 3) << 4) | (b2 >> 4)];
    output += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    output += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }

  return output;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pdfReceiptWrapper: {
    left: 0,
    opacity: 0.01,
    position: 'absolute',
    top: 0,
    zIndex: -1,
  },
  pdfReceipt: {
    backgroundColor: colors.surface,
    height: pdfReceiptHeight,
    padding: 32,
    width: pdfReceiptWidth,
  },
  pdfHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  pdfLogo: {
    height: 58,
    width: 118,
  },
  pdfHeaderCopy: {
    flex: 1,
  },
  pdfTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  pdfSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  pdfDivider: {
    backgroundColor: colors.line,
    height: 1,
    marginBottom: 22,
    marginTop: 18,
  },
  pdfInfoRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 9,
  },
  pdfInfoLabel: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '800',
    width: 82,
  },
  pdfInfoValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  pdfSectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 18,
  },
  pdfPhotoFrame: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 350,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  pdfPhotoFrameRetiro: {
    height: 220,
  },
  pdfPhoto: {
    height: '100%',
    width: '100%',
  },
  pdfEquipmentList: {
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pdfEquipmentRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pdfEquipmentName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  pdfEquipmentMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  pdfEquipmentMore: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    padding: 10,
    textAlign: 'center',
  },
  pdfSignatureFrame: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    height: pdfSignatureHeight,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  pdfStamp: {
    bottom: 6,
    height: 82,
    position: 'absolute',
    right: 14,
    transform: [{ rotate: '-10deg' }],
    width: 102,
    // El sello "firma validada" debe quedar SIEMPRE por delante de la firma:
    // react-native-svg (los trazos de la firma) tiende a componerse encima de
    // los hermanos posteriores, y sin esto el trazo del cliente tapaba el sello.
    // elevation (Android) + zIndex (iOS) fuerzan que el sello quede al frente.
    zIndex: 10,
    elevation: 10,
  },
  pdfSignatureLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
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
    marginBottom: 22,
    marginTop: 6,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  infoRow: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    ...shadow,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  receptorButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 78,
    padding: 14,
    ...shadow,
  },
  receptorIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  receptorCopy: {
    flex: 1,
  },
  receptorTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  receptorText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  photoCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    ...shadow,
  },
  photoPreview: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 16,
    height: 82,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 82,
  },
  photoImage: {
    height: '100%',
    width: '100%',
  },
  photoCopy: {
    flex: 1,
  },
  photoTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  photoText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
  },
  photoActions: {
    gap: 10,
    marginTop: 12,
  },
  signatureHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  signatureBox: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    height: signatureHeight,
    overflow: 'hidden',
    ...shadow,
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
});
