import React from 'react';
import { Tabs } from 'expo-router';
import { Home, BarChart3, Users, Wallet } from 'lucide-react-native';
import { COLORS } from '@/constants';
import { TabBar } from '@/components';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.solana,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.cardBackground,
          borderTopColor: COLORS.solana + '30',
        },
      }}
      tabBar={props => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          tabBarAccessibilityLabel: 'Home tab, view your wallet and quick actions',
        }}
      />

      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
          tabBarAccessibilityLabel: 'Market tab, browse and trade tokens',
        }}
      />
      <Tabs.Screen
        name="sosio"
        options={{
          title: 'Sosio',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          tabBarAccessibilityLabel: 'Sosio tab, view social feed and follow traders',
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
          tabBarAccessibilityLabel: 'Portfolio tab, manage your investments and copy trading',
        }}
      />
    </Tabs>
  );
}