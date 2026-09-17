import {
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';

import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import 'react-native-reanimated';

import {
  AuthProvider,
  useAuth,
} from '@/src/auth/AuthContext';

import {
  colors,
} from '@/src/theme/colors';

import '@/src/visitas/background-location-task';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView
      style={styles.root}
    >
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const {
    isLoading,
    isSignedIn,
  } = useAuth();

  const theme =
    useMemo<Theme>(
      () => ({
        dark: false,

        colors: {
          primary:
            colors.brand,

          background:
            colors.surfaceAlt,

          card:
            colors.surface,

          text:
            colors.ink,

          border:
            colors.line,

          notification:
            colors.accent,
        },

        fonts: {
          regular: {
            fontFamily:
              'System',
            fontWeight:
              '400',
          },

          medium: {
            fontFamily:
              'System',
            fontWeight:
              '500',
          },

          bold: {
            fontFamily:
              'System',
            fontWeight:
              '700',
          },

          heavy: {
            fontFamily:
              'System',
            fontWeight:
              '800',
          },
        },
      }),
      [],
    );

  return (
    <ThemeProvider
      value={theme}
    >
      {isLoading ? (
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            color={
              colors.brand
            }
          />
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerShown:
              false,
          }}
        >
          <Stack.Protected
            guard={
              !isSignedIn
            }
          >
            <Stack.Screen
              name="index"
            />
          </Stack.Protected>

          <Stack.Protected
            guard={
              isSignedIn
            }
          >
            <Stack.Screen
              name="(tabs)"
            />

            <Stack.Screen
              name="agenda/index"
            />

            <Stack.Screen
              name="entregas/formulario"
            />

            <Stack.Screen
              name="entregas/receptor"
            />

            <Stack.Screen
              name="entregas/retiro-equipos"
            />

            <Stack.Screen
              name="equipos/agregar/empresa"
            />

            <Stack.Screen
              name="equipos/agregar/formulario"
            />

            <Stack.Screen
              name="equipos/agregar/solicitante"
            />

            <Stack.Screen
              name="equipos/gestionar/asignacion"
            />

            <Stack.Screen
              name="equipos/gestionar/detalle"
            />

            <Stack.Screen
              name="equipos/gestionar/index"
            />

            <Stack.Screen
              name="equipos/ordenes-taller/ingreso"
            />

            <Stack.Screen
              name="perfil/historial-entregas"
            />

            <Stack.Screen
              name="perfil/historial-visitas"
            />

            <Stack.Screen
              name="visitas/formulario"
            />

            <Stack.Screen
              name="visitas/solicitantes"
            />

            <Stack.Screen
              name="visitas/sucursal"
            />
          </Stack.Protected>
        </Stack>
      )}

      <StatusBar
        style="dark"
      />
    </ThemeProvider>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
    },

    loading: {
      alignItems:
        'center',

      backgroundColor:
        colors.surfaceAlt,

      flex: 1,

      justifyContent:
        'center',
    },
  });