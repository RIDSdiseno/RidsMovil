import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { Screen } from '@/src/components/Screen';

import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

export default function SolicitantesTabScreen() {
    return (
        <Screen
            bottomNavigation={<BottomNavigation />}
            scroll={false}
        >
            <RidsFlowHeader
                icon="people-outline"
                label="SOLICITANTES"
                subtitle="Administración de usuarios"
                title="Solicitantes"
            />

            <View style={styles.grid}>
                <Pressable
                    onPress={() =>
                        router.push('/solicitantes/sincronizar')
                    }
                    style={({ pressed }) => [
                        styles.card,
                        pressed && styles.pressed,
                    ]}
                >
                    <View style={styles.iconBox}>
                        <Ionicons
                            color={ridsPalette.cyanDark}
                            name="sync-outline"
                            size={24}
                        />
                    </View>

                    <Text style={styles.title}>
                        Sincronizar
                    </Text>

                    <Text style={styles.subtitle}>
                        Actualiza solicitantes desde Microsoft 365 o Google Workspace.
                    </Text>

                    <Ionicons
                        color="#B7C0CE"
                        name="chevron-forward"
                        size={20}
                        style={styles.chevron}
                    />
                </Pressable>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    grid: {
        marginTop: 14,
    },

    card: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 16,
        borderWidth: 1,
        minHeight: 145,
        padding: 16,
    },

    pressed: {
        opacity: 0.85,
    },

    iconBox: {
        alignItems: 'center',
        backgroundColor: ridsPalette.cyanSoft,
        borderRadius: 12,
        height: 44,
        justifyContent: 'center',
        marginBottom: 12,
        width: 44,
    },

    title: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '900',
    },

    subtitle: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 18,
        marginTop: 5,
        paddingRight: 24,
    },

    chevron: {
        bottom: 16,
        position: 'absolute',
        right: 16,
    },
});