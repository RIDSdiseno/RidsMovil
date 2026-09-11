import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const ROW_HEIGHT = 60;
const INNER_PADDING = 5;
const INDICATOR_GAP = 2;

const indicatorSpring = {
  damping: 19,
  mass: 0.72,
  stiffness: 185,
};

/* =========================================================
   TIPOS
========================================================= */

type TabRoute =
  | '/(tabs)'
  | '/(tabs)/visitas'
  | '/(tabs)/equipos'
  | '/(tabs)/solicitantes'
  | '/(tabs)/entregas'
  | '/(tabs)/perfil';

type BottomNavigationItem = {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  match: string;
  route: TabRoute;
};

/* =========================================================
   ITEMS
========================================================= */

const items: BottomNavigationItem[] = [
  {
    icon: 'home-outline',
    activeIcon: 'home',
    label: 'Inicio',
    match: '/',
    route: '/(tabs)',
  },
  {
    icon: 'clipboard-outline',
    activeIcon: 'clipboard',
    label: 'Visitas',
    match: '/visitas',
    route: '/(tabs)/visitas',
  },
  {
    icon: 'hardware-chip-outline',
    activeIcon: 'hardware-chip',
    label: 'Equipos',
    match: '/equipos',
    route: '/(tabs)/equipos',
  },
  {
    icon: 'people-outline',
    activeIcon: 'people',
    label: 'Solicitantes',
    match: '/solicitantes',
    route: '/(tabs)/solicitantes',
  },
  {
    icon: 'cube-outline',
    activeIcon: 'cube',
    label: 'PickUP',
    match: '/entregas',
    route: '/(tabs)/entregas',
  },
  {
    icon: 'person-circle-outline',
    activeIcon: 'person-circle',
    label: 'Perfil',
    match: '/perfil',
    route: '/(tabs)/perfil',
  },
];

/* =========================================================
   BOTTOM NAVIGATION
========================================================= */

export function BottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === 'android'
      ? 12
      : 0,
  );

  const [barWidth, setBarWidth] =
    useState(0);

  const indicatorX =
    useRef(
      new Animated.Value(0),
    ).current;

  const indicatorStretch =
    useRef(
      new Animated.Value(1),
    ).current;

  const hasMeasured =
    useRef(false);

  const activeIndex =
    getActiveIndex(pathname);

  const tabWidth =
    getTabWidth(
      barWidth,
      items.length,
    );

  /* =======================================================
     MEDICIÓN INICIAL
  ======================================================= */

  function handleLayout(
    event: LayoutChangeEvent,
  ) {
    const width =
      event.nativeEvent.layout.width;

    setBarWidth(width);

    if (
      !hasMeasured.current &&
      activeIndex >= 0
    ) {
      indicatorX.setValue(
        getIndicatorX(
          width,
          activeIndex,
          items.length,
        ),
      );

      hasMeasured.current =
        true;
    }
  }

  /* =======================================================
     ANIMACIÓN DEL INDICADOR
  ======================================================= */

  useEffect(() => {
    if (
      !hasMeasured.current ||
      barWidth <= 0 ||
      activeIndex < 0
    ) {
      return;
    }

    indicatorStretch.stopAnimation();
    indicatorStretch.setValue(1);

    Animated.parallel([
      Animated.spring(
        indicatorX,
        {
          ...indicatorSpring,

          toValue:
            getIndicatorX(
              barWidth,
              activeIndex,
              items.length,
            ),

          useNativeDriver: true,
        },
      ),

      Animated.sequence([
        Animated.timing(
          indicatorStretch,
          {
            duration: 95,
            toValue: 1.12,
            useNativeDriver: true,
          },
        ),

        Animated.spring(
          indicatorStretch,
          {
            damping: 14,
            mass: 0.6,
            stiffness: 220,
            toValue: 1,
            useNativeDriver: true,
          },
        ),
      ]),
    ]).start();
  }, [
    activeIndex,
    barWidth,
    indicatorStretch,
    indicatorX,
  ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.shell,
        {
          height:
            ROW_HEIGHT +
            bottomInset,
        },
      ]}
    >
      {/* ===============================================
          BLUR PRINCIPAL
      =============================================== */}

      <BlurView
        blurReductionFactor={3}
        experimentalBlurMethod={
          Platform.OS === 'android'
            ? 'dimezisBlurView'
            : 'none'
        }
        intensity={72}
        pointerEvents="none"
        style={
          StyleSheet.absoluteFill
        }
        tint="systemThinMaterialLight"
      />

      {/* ===============================================
          TINT GLASS
      =============================================== */}

      <View
        pointerEvents="none"
        style={styles.glassTint}
      />

      {/* ===============================================
          REFLEJO SUPERIOR
      =============================================== */}

      <View
        pointerEvents="none"
        style={
          styles.glassHighlight
        }
      />

      {/* ===============================================
          INDICADOR ACTIVO
      =============================================== */}

      {tabWidth > 0 &&
        activeIndex >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            {
              width:
                tabWidth -
                INDICATOR_GAP * 2,

              transform: [
                {
                  translateX:
                    indicatorX,
                },
                {
                  scaleX:
                    indicatorStretch,
                },
              ],
            },
          ]}
        >
          <BlurView
            experimentalBlurMethod={
              Platform.OS ===
                'android'
                ? 'dimezisBlurView'
                : 'none'
            }
            intensity={38}
            pointerEvents="none"
            style={
              StyleSheet.absoluteFill
            }
            tint="systemMaterialLight"
          />

          <View
            style={
              styles.indicatorTint
            }
          />
        </Animated.View>
      ) : null}

      {/* ===============================================
          ITEMS
      =============================================== */}

      <View style={styles.itemsRow}>
        {items.map(
          (item, index) => {
            const focused =
              index ===
              activeIndex;

            return (
              <LiquidGlassNavigationItem
                activeIcon={
                  item.activeIcon
                }
                focused={
                  focused
                }
                icon={item.icon}
                key={item.route}
                label={item.label}
                onPress={() => {
                  if (focused) {
                    return;
                  }

                  void Haptics
                    .selectionAsync()
                    .catch(
                      () =>
                        undefined,
                    );

                  router.replace(
                    item.route,
                  );
                }}
              />
            );
          },
        )}
      </View>
    </View>
  );
}

/* =========================================================
   ITEM INDIVIDUAL
========================================================= */

function LiquidGlassNavigationItem({
  activeIcon,
  focused,
  icon,
  label,
  onPress,
}: {
  activeIcon:
  keyof typeof Ionicons.glyphMap;

  focused: boolean;

  icon:
  keyof typeof Ionicons.glyphMap;

  label: string;

  onPress: () => void;
}) {
  const focusProgress =
    useRef(
      new Animated.Value(
        focused ? 1 : 0,
      ),
    ).current;

  useEffect(() => {
    Animated.spring(
      focusProgress,
      {
        damping: 15,
        mass: 0.58,
        stiffness: 215,
        toValue:
          focused ? 1 : 0,

        useNativeDriver: true,
      },
    ).start();
  }, [
    focusProgress,
    focused,
  ]);

  const iconStyle = {
    opacity:
      focusProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [
          0.72,
          1,
        ],
      }),

    transform: [
      {
        scale:
          focusProgress.interpolate(
            {
              inputRange: [
                0,
                1,
              ],

              outputRange: [
                1,
                1.08,
              ],
            },
          ),
      },
    ],
  };

  const color =
    focused
      ? ridsPalette.cyanDark
      : '#536171';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={
        focused
          ? {
            selected: true,
          }
          : {}
      }
      hitSlop={5}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,

        pressed &&
        styles.itemPressed,
      ]}
    >
      <Animated.View
        style={iconStyle}
      >
        <Ionicons
          color={color}
          name={
            focused
              ? activeIcon
              : icon
          }
          size={24}
        />
      </Animated.View>
    </Pressable>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getActiveIndex(
  pathname: string,
) {
  return items.findIndex(
    (item) => {
      if (
        item.match === '/'
      ) {
        return (
          pathname === '/' ||
          pathname ===
          '/(tabs)'
        );
      }

      return pathname.startsWith(
        item.match,
      );
    },
  );
}

function getTabWidth(
  width: number,
  routeCount: number,
) {
  if (
    width <= 0 ||
    routeCount <= 0
  ) {
    return 0;
  }

  return (
    width -
    INNER_PADDING * 2
  ) / routeCount;
}

function getIndicatorX(
  width: number,
  index: number,
  routeCount: number,
) {
  const tabWidth =
    getTabWidth(
      width,
      routeCount,
    );

  return (
    INNER_PADDING +
    tabWidth * index +
    INDICATOR_GAP
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles =
  StyleSheet.create({
    shell: {
      backgroundColor:
        'rgba(238, 248, 250, 0.58)',

      borderColor:
        'rgba(255, 255, 255, 0.82)',

      borderRadius: 28,

      borderWidth: 1,

      bottom: 8,

      elevation: 12,

      left: 10,

      overflow: 'hidden',

      position: 'absolute',

      right: 10,

      shadowColor:
        colors.brandDark,

      shadowOffset: {
        width: 0,
        height: 10,
      },

      shadowOpacity: 0.2,

      shadowRadius: 22,
    },

    glassTint: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(221, 247, 248, 0.2)',
    },

    glassHighlight: {
      backgroundColor:
        'rgba(255, 255, 255, 0.9)',

      height: 1,

      left: 18,

      position:
        'absolute',

      right: 18,

      top: 1,
    },

    activeIndicator: {
      backgroundColor:
        'rgba(255, 255, 255, 0.42)',

      borderColor:
        'rgba(255, 255, 255, 0.7)',

      borderRadius: 24,

      borderWidth: 1,

      height: 50,

      left: 0,

      overflow: 'hidden',

      position:
        'absolute',

      shadowColor:
        ridsPalette.cyanDark,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity: 0.13,

      shadowRadius: 9,

      top: 5,
    },

    indicatorTint: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(45, 185, 200, 0.13)',
    },

    itemsRow: {
      flexDirection: 'row',

      height: ROW_HEIGHT,

      paddingHorizontal:
        INNER_PADDING,
    },

    item: {
      alignItems: 'center',

      flex: 1,

      justifyContent:
        'center',

      minWidth: 0,
    },

    itemPressed: {
      opacity: 0.58,
    },
  });