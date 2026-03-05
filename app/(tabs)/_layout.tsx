import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="dot.radiowaves.left.and.right" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Live',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="waveform.path.ecg" color={color} />,
        }}
      />
      <Tabs.Screen
        name="plots"
        options={{
          title: 'Plots',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.xyaxis.line" color={color} />,
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: 'Files',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="folder.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
