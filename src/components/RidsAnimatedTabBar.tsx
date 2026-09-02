import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

const ROW_HEIGHT = 60;
const INNER_PADDING = 5;
const INDICATOR_GAP = 3;

const indicatorSpring = {
  damping: 19,
  mass: 0.72,
  stiffness: 185,
};

export function RidsAnimatedTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorStretch = useRef(new Animated.Value(1)).current;
  const hasMeasured = useRef(false);
  const tabWidth = getTabWidth(barWidth, state.routes.length);

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
      onLayout={handleLayout}
      style={[styles.shell, { height: ROW_HEIGHT + bottomInset }]}>
      <BlurView
        blurReductionFactor={3}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        intensity={72}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint="systemThinMaterialLight"
      />
      <View pointerEvents="none" style={styles.glassTint} />
      <View pointerEvents="none" style={styles.glassHighlight} />

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
          const focused = state.index === index;
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
    opacity: focusProgress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
    transform: [
      { scale: focusProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] }) },
    ],
  };

  const color = focused ? ridsPalette.cyanDark : '#536171';

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

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'rgba(238, 248, 250, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 28,
    borderWidth: 1,
    bottom: 8,
    elevation: 12,
    left: 10,
    overflow: 'hidden',
    position: 'absolute',
    right: 10,
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(221, 247, 248, 0.2)',
  },
  glassHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    height: 1,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 1,
  },
  activeIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 24,
    borderWidth: 1,
    height: 50,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: ridsPalette.cyanDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 9,
    top: 5,
  },
  indicatorTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 185, 200, 0.13)',
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
  },
  itemPressed: {
    opacity: 0.58,
  },
});
