import { Tabs } from 'expo-router';
import React from 'react';

import { Ionicons } from '@expo/vector-icons';

import { RidsAnimatedTabBar } from '@/src/components/RidsAnimatedTabBar';
import { ridsPalette } from '@/src/theme/rids-palette';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <RidsAnimatedTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: ridsPalette.cyanDark,
        tabBarInactiveTintColor: '#8A96A8',
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="visitas"
        options={{
          title: 'Visitas',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'clipboard' : 'clipboard-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="equipos"
        options={{
          title: 'Equipos',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'hardware-chip' : 'hardware-chip-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="entregas"
        options={{
          title: 'PickUP',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'cube' : 'cube-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color} name={focused ? 'person-circle' : 'person-circle-outline'} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
