import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getEntregasCached, getEvidenciasPorEntregaCached } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { Screen } from '@/src/components/Screen';
import { colors, shadow } from '@/src/theme/colors';
import { Entrega, EvidenciaEntrega } from '@/src/types/api';

export default function HistorialEntregasScreen() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [evidenciasByEntrega, setEvidenciasByEntrega] = useState<Record<number, Entrega['evidencias']>>({});
  const [expandedEntregaId, setExpandedEntregaId] = useState<number | null>(null);
  const [loadingEvidenciasId, setLoadingEvidenciasId] = useState<number | null>(null);
  const [sharingEvidenciaId, setSharingEvidenciaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadScreen();
  }, []);

  async function loadScreen() {
    try {
      setLoading(true);
      const response = await getEntregasCached();
      setEntregas(response.entregas ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      const response = await getEntregasCached(true);
      setEntregas(response.entregas ?? []);
      setEvidenciasByEntrega({});
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleEntrega(entregaId: number) {
    const nextExpanded = expandedEntregaId === entregaId ? null : entregaId;
    setExpandedEntregaId(nextExpanded);

    if (!nextExpanded || evidenciasByEntrega[entregaId]) return;

    try {
      setLoadingEvidenciasId(entregaId);
      const response = await getEvidenciasPorEntregaCached(entregaId);
      setEvidenciasByEntrega((current) => ({
        ...current,
        [entregaId]: response.evidencias ?? [],
      }));
    } finally {
      setLoadingEvidenciasId(null);
    }
  }

  async function compartirEvidencia(evidencia: EvidenciaEntrega) {
    try {
      setSharingEvidenciaId(evidencia.id);

      const disponible = await Sharing.isAvailableAsync();
      if (!disponible) {
        Alert.alert('Compartir', 'Este dispositivo no permite compartir archivos.');
        return;
      }

      const extension = evidencia.formato || (evidencia.tipo === 'pdf' ? 'pdf' : 'jpg');
      const destino = `${FileSystem.cacheDirectory}entrega-${evidencia.entregaId}-${evidencia.id}.${extension}`;
      const descarga = await FileSystem.downloadAsync(evidencia.url, destino);

      await Sharing.shareAsync(descarga.uri, {
        dialogTitle: 'Compartir comprobante',
        mimeType: evidencia.tipo === 'pdf' ? 'application/pdf' : undefined,
        UTI: evidencia.tipo === 'pdf' ? 'com.adobe.pdf' : undefined,
      });
    } catch {
      Alert.alert('Compartir', 'No se pudo compartir el archivo. Intenta nuevamente.');
    } finally {
      setSharingEvidenciaId(null);
    }
  }

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Historial de entregas</Text>
      <Text style={styles.subtitle}>Entregas registradas por tu usuario.</Text>

      <AppButton onPress={() => router.back()} title="Volver" variant="ghost" />

      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
        }
        showsVerticalScrollIndicator={false}>
        {entregas.map((entrega) => {
          const expanded = expandedEntregaId === entrega.id_entrega;
          return (
            <View key={entrega.id_entrega} style={styles.card}>
              <Pressable
                onPress={() => toggleEntrega(entrega.id_entrega)}
                style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons color={colors.brand} name="cube-outline" size={22} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{entrega.empresaNombre}</Text>
                  <Text style={styles.cardText}>
                    Recibe {entrega.receptorNombre} · {new Date(entrega.fecha).toLocaleDateString('es-CL')}
                  </Text>
                </View>
                <Ionicons color={colors.muted} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
              </Pressable>

              {expanded ? (
                <View style={styles.evidencias}>
                  {loadingEvidenciasId === entrega.id_entrega ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (evidenciasByEntrega[entrega.id_entrega] ?? entrega.evidencias ?? []).length ? (
                    (evidenciasByEntrega[entrega.id_entrega] ?? entrega.evidencias ?? []).map((evidencia) => (
                      <View key={evidencia.id} style={styles.evidenciaRow}>
                        <Pressable
                          onPress={() => Linking.openURL(evidencia.url)}
                          style={styles.evidenciaInfo}>
                          <Ionicons color={colors.brand} name={getEvidenciaIcon(evidencia.tipo)} size={18} />
                          <Text style={styles.evidenciaText}>{getEvidenciaLabel(evidencia.tipo)}</Text>
                        </Pressable>
                        <Pressable
                          disabled={sharingEvidenciaId === evidencia.id}
                          hitSlop={10}
                          onPress={() => compartirEvidencia(evidencia)}
                          style={styles.shareButton}>
                          {sharingEvidenciaId === evidencia.id ? (
                            <ActivityIndicator color={colors.brand} size="small" />
                          ) : (
                            <Ionicons color={colors.brand} name="share-social-outline" size={20} />
                          )}
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Sin evidencias registradas.</Text>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}

        {!loading && entregas.length === 0 ? <Text style={styles.emptyText}>No hay entregas registradas.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function getEvidenciaIcon(tipo: string) {
  const normalized = tipo.trim().toLowerCase();
  if (normalized === 'pdf') return 'document-text-outline';
  if (normalized === 'firma') return 'create-outline';
  return 'image-outline';
}

function getEvidenciaLabel(tipo: string) {
  const normalized = tipo.trim().toLowerCase();
  if (normalized === 'pdf') return 'Comprobante PDF';
  if (normalized === 'firma') return 'Firma digital';
  return 'Fotografia';
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 12,
    marginTop: 6,
  },
  loader: {
    marginVertical: 14,
  },
  list: {
    gap: 12,
    paddingBottom: 120,
    paddingTop: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  cardCopy: {
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
  evidencias: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    padding: 14,
  },
  evidenciaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 34,
  },
  evidenciaInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  shareButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  evidenciaText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
