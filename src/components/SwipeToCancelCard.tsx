import * as Haptics from 'expo-haptics';
import { PropsWithChildren, useCallback, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/src/theme/colors';

const SWIPE_LIMIT = 116;
const CANCEL_THRESHOLD = 76;

type SwipeToCancelCardProps = PropsWithChildren<{
  disabled?: boolean;
  onCancelRequest: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

export function SwipeToCancelCard({
  children,
  disabled = false,
  onCancelRequest,
  onPress,
  style,
}: SwipeToCancelCardProps) {
  const translateX = useSharedValue(0);
  const thresholdReached = useSharedValue(false);

  const notifyThreshold = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, []);

  const requestCancellation = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    onCancelRequest();
  }, [onCancelRequest]);

  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-7, 7])
        .failOffsetY([-24, 24])
        .onUpdate((event) => {
          translateX.value = Math.max(-SWIPE_LIMIT, Math.min(0, event.translationX));
          const reached = translateX.value <= -CANCEL_THRESHOLD;

          if (reached && !thresholdReached.value) {
            thresholdReached.value = true;
            runOnJS(notifyThreshold)();
          } else if (!reached) {
            thresholdReached.value = false;
          }
        })
        .onEnd(() => {
          const shouldCancel = translateX.value <= -CANCEL_THRESHOLD;
          translateX.value = withTiming(0, { duration: 180 });
          thresholdReached.value = false;

          if (shouldCancel) {
            runOnJS(requestCancellation)();
          }
        })
        .onFinalize(() => {
          if (translateX.value !== 0) {
            translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
          thresholdReached.value = false;
        }),
    [disabled, notifyThreshold, requestCancellation, thresholdReached, translateX],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((_event, success) => {
        if (success) runOnJS(handlePress)();
      }),
    [handlePress],
  );

  const gesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-translateX.value, [0, 42, CANCEL_THRESHOLD], [0, 0.7, 1], 'clamp'),
    transform: [
      { scale: interpolate(-translateX.value, [0, CANCEL_THRESHOLD], [0.76, 1], 'clamp') },
    ],
  }));

  return (
    <View style={[styles.outer, style]}>
      <View style={styles.container}>
        {!disabled ? (
          <View style={styles.cancelBackground}>
            <Animated.View style={[styles.cancelAction, actionStyle]}>
              <View style={styles.cancelIcon}>
                <Ionicons color={colors.white} name="close" size={30} />
              </View>
            </Animated.View>
          </View>
        ) : null}
        <GestureDetector gesture={gesture}>
          <Animated.View style={cardStyle}>{children}</Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 20,
  },
  container: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cancelBackground: {
    alignItems: 'flex-end',
    backgroundColor: '#C62828',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  cancelAction: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: SWIPE_LIMIT,
  },
  cancelIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
