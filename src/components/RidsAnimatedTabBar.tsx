import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
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

const ROW_HEIGHT = 68;
const INNER_PADDING = 6;
const INDICATOR_GAP = 2;

const indicatorSpring = {
  damping: 19,
  mass: 0.72,
  stiffness: 185,
};

export function RidsAnimatedTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom + 8, Platform.OS === 'android' ? 20 : 18);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorStretch = useRef(new Animated.Value(1)).current;
  const hasMeasured = useRef(false);
  const dragStartX = useRef(0);
  const dragIndex = useRef(state.index);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const tabWidth = getTabWidth(barWidth, state.routes.length);
  const visualIndex = draggingIndex ?? state.index;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          tabWidth > 0 && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          tabWidth > 0 && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderGrant: () => {
          indicatorX.stopAnimation();
          indicatorStretch.stopAnimation();
          dragStartX.current = getIndicatorX(barWidth, state.index, state.routes.length);
          dragIndex.current = state.index;
          setDraggingIndex(state.index);
          Animated.spring(indicatorStretch, {
            damping: 18,
            mass: 0.55,
            stiffness: 240,
            toValue: 1.08,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gesture) => {
          const firstX = getIndicatorX(barWidth, 0, state.routes.length);
          const lastX = getIndicatorX(barWidth, state.routes.length - 1, state.routes.length);
          const nextX = clamp(dragStartX.current + gesture.dx, firstX, lastX);
          const nextIndex = clamp(Math.round((nextX - firstX) / tabWidth), 0, state.routes.length - 1);

          indicatorX.setValue(nextX);

          if (nextIndex !== dragIndex.current) {
            dragIndex.current = nextIndex;
            setDraggingIndex(nextIndex);
            void Haptics.selectionAsync().catch(() => undefined);
          }
        },
        onPanResponderRelease: () => {
          const nextIndex = dragIndex.current;

          Animated.spring(indicatorX, {
            ...indicatorSpring,
            toValue: getIndicatorX(barWidth, nextIndex, state.routes.length),
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

          if (nextIndex === state.index) return;

          const route = state.routes[nextIndex];
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          });

          if (!event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        },
        onPanResponderTerminate: () => {
          setDraggingIndex(null);
          Animated.parallel([
            Animated.spring(indicatorX, {
              ...indicatorSpring,
              toValue: getIndicatorX(barWidth, state.index, state.routes.length),
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
    [barWidth, indicatorStretch, indicatorX, navigation, state.index, state.routes, tabWidth],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    setBarWidth(width);

    if (!hasMeasured.current) {
      indicatorX.setValue(getIndicatorX(width, state.index, state.routes.length));
      hasMeasured.current = true;
    }
  }

  useEffect(() => {
    if (!hasMeasured.current || barWidth <= 0) return;

    indicatorStretch.stopAnimation();
    indicatorStretch.setValue(1);

    Animated.parallel([
      Animated.spring(indicatorX, {
        ...indicatorSpring,
        toValue: getIndicatorX(barWidth, state.index, state.routes.length),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(indicatorStretch, {
          duration: 95,
          toValue: 1.12,
          useNativeDriver: true,
        }),
        Animated.spring(indicatorStretch, {
          damping: 14,
          mass: 0.6,
          stiffness: 220,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [barWidth, indicatorStretch, indicatorX, state.index, state.routes.length]);

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={handleLayout}
      style={[styles.shell, { bottom: bottomOffset }]}>
      <BlurView
        blurReductionFactor={3}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        intensity={58}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint="systemThinMaterialLight"
      />
      <View pointerEvents="none" style={styles.glassTint} />

      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            {
              transform: [
                { translateX: indicatorX },
                { scaleX: indicatorStretch },
              ],
              width: tabWidth - INDICATOR_GAP * 2,
            },
          ]}>
          <BlurView
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
            intensity={38}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            tint="systemMaterialLight"
          />
          <View style={styles.indicatorTint} />
        </Animated.View>
      ) : null}

      <View style={styles.itemsRow}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = visualIndex === index;
          const label = getTabLabel(options, route.name);

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: 'tabPress',
            });

            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync().catch(() => undefined);
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ target: route.key, type: 'tabLongPress' });
          };

          return (
            <LiquidGlassTabItem
              accessibilityLabel={options.tabBarAccessibilityLabel}
              focused={focused}
              icon={options.tabBarIcon}
              key={route.key}
              label={label}
              onLongPress={onLongPress}
              onPress={onPress}
              testID={options.tabBarButtonTestID}
            />
          );
        })}
      </View>
    </View>
  );
}

function LiquidGlassTabItem({
  accessibilityLabel,
  focused,
  icon,
  label,
  onLongPress,
  onPress,
  testID,
}: {
  accessibilityLabel?: string;
  focused: boolean;
  icon?: BottomTabNavigationOptions['tabBarIcon'];
  label: string;
  onLongPress: () => void;
  onPress: () => void;
  testID?: string;
}) {
  const focusProgress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(focusProgress, {
      damping: 15,
      mass: 0.58,
      stiffness: 215,
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [focusProgress, focused]);

  const iconStyle = {
    transform: [
      { scale: focusProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] }) },
    ],
  };

  const color = ridsPalette.cyanDark;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="tab"
      accessibilityState={focused ? { selected: true } : {}}
      hitSlop={5}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      testID={testID}>
      <Animated.View style={iconStyle}>
        {icon?.({ color, focused, size: 27 })}
      </Animated.View>
    </Pressable>
  );
}

function getTabLabel(options: BottomTabNavigationOptions, routeName: string) {
  if (typeof options.tabBarLabel === 'string') return options.tabBarLabel;
  if (typeof options.title === 'string') return options.title;
  return routeName;
}

function getTabWidth(width: number, routeCount: number) {
  if (width <= 0 || routeCount <= 0) return 0;
  return (width - INNER_PADDING * 2) / routeCount;
}

function getIndicatorX(width: number, index: number, routeCount: number) {
  const tabWidth = getTabWidth(width, routeCount);
  return INNER_PADDING + tabWidth * index + INDICATOR_GAP;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 26,
    borderWidth: 1,
    elevation: 12,
    height: ROW_HEIGHT,
    left: 10,
    overflow: 'hidden',
    position: 'absolute',
    right: 10,
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(221, 247, 248, 0.08)',
  },
  activeIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    height: 58,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: ridsPalette.cyanDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    top: 5,
  },
  indicatorTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 185, 200, 0.18)',
  },
  itemsRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    paddingHorizontal: INNER_PADDING,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  itemPressed: {
    opacity: 0.58,
  },
});
