import { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';

type ScreenProps = PropsWithChildren<{
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  scrollEnabled?: boolean;
  bottomNavigation?: ReactNode;
  extendUnderNavigation?: boolean;
}>;

export function Screen({
  bottomNavigation,
  children,
  extendUnderNavigation = false,
  onRefresh,
  refreshing = false,
  scroll = true,
  scrollEnabled = true,
}: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, extendUnderNavigation && styles.extendedContent]}>{children}</View>
        {bottomNavigation}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl colors={[colors.brand]} onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.brand} />
          ) : undefined
        }
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {bottomNavigation}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.surfaceAlt,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 120,
  },
  extendedContent: {
    paddingBottom: 0,
  },
});
