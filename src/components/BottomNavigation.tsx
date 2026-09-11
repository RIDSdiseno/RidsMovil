import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
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

const ROW_HEIGHT = 68;
const INNER_PADDING = 6;
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

  const bottomOffset = Math.max(
    insets.bottom + 8,
    Platform.OS === 'android'
      ? 20
      : 18,
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

  const dragStartX =
    useRef(0);

  const dragIndex =
    useRef(activeIndex);

  const [draggingIndex, setDraggingIndex] =
    useState<number | null>(null);

  const tabWidth =
    getTabWidth(
      barWidth,
      items.length,
    );

  const visualIndex =
    draggingIndex ??
    activeIndex;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          tabWidth > 0 &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          tabWidth > 0 &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderGrant: () => {
          if (activeIndex < 0) return;

          indicatorX.stopAnimation();
          indicatorStretch.stopAnimation();
          dragStartX.current = getIndicatorX(barWidth, activeIndex, items.length);
          dragIndex.current = activeIndex;
          setDraggingIndex(activeIndex);

          Animated.spring(indicatorStretch, {
            damping: 18,
            mass: 0.55,
            stiffness: 240,
            toValue: 1.08,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gesture) => {
          if (activeIndex < 0) return;

          const firstX = getIndicatorX(barWidth, 0, items.length);
          const lastX = getIndicatorX(barWidth, items.length - 1, items.length);
          const nextX = clamp(dragStartX.current + gesture.dx, firstX, lastX);
          const nextIndex = clamp(Math.round((nextX - firstX) / tabWidth), 0, items.length - 1);

          indicatorX.setValue(nextX);

          if (nextIndex !== dragIndex.current) {
            dragIndex.current = nextIndex;
            setDraggingIndex(nextIndex);
            void Haptics.selectionAsync().catch(() => undefined);
          }
        },
        onPanResponderRelease: () => {
          if (activeIndex < 0) return;

          const nextIndex = dragIndex.current;

          Animated.spring(indicatorX, {
            ...indicatorSpring,
            toValue: getIndicatorX(barWidth, nextIndex, items.length),
            useNativeDriver: true,
          }).start();
          Animated.spring(indicatorStretch, {
            damping: 15,
            mass: 0.6,
            stiffness: 220,
            toValue: 1,
            useNativeDriver: true,
          }).start();

          setDraggingIndex(null);

          if (nextIndex !== activeIndex) {
            router.replace(items[nextIndex].route);
          }
        },
        onPanResponderTerminate: () => {
          if (activeIndex < 0) return;

          setDraggingIndex(null);
          Animated.parallel([
            Animated.spring(indicatorX, {
              ...indicatorSpring,
              toValue: getIndicatorX(barWidth, activeIndex, items.length),
              useNativeDriver: true,
            }),
            Animated.spring(indicatorStretch, {
              damping: 15,
              mass: 0.6,
              stiffness: 220,
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [activeIndex, barWidth, indicatorStretch, indicatorX, tabWidth],
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
      {...panResponder.panHandlers}
      onLayout={handleLayout}
      style={[
        styles.shell,
        {
          bottom:
            bottomOffset,
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
        intensity={58}
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
              visualIndex;

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
    ridsPalette.cyanDark;

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
          size={27}
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

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles =
  StyleSheet.create({
    shell: {
      backgroundColor:
        'transparent',

      borderColor:
        'rgba(255, 255, 255, 0.94)',

      borderRadius: 26,

      borderWidth: 1,

      elevation: 12,

      height: ROW_HEIGHT,

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

      shadowOpacity: 0.18,

      shadowRadius: 20,
    },

    glassTint: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(221, 247, 248, 0.08)',
    },

    activeIndicator: {
      backgroundColor:
        'rgba(255, 255, 255, 0.5)',

      borderColor:
        'rgba(255, 255, 255, 0.92)',

      borderRadius: 20,

      borderWidth: 1,

      height: 58,

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

      shadowOpacity: 0.18,

      shadowRadius: 10,

      top: 5,
    },

    indicatorTint: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(45, 185, 200, 0.18)',
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

      paddingHorizontal: 2,
    },

    itemPressed: {
      opacity: 0.58,
    },
  });
