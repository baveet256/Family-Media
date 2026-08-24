import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { fonts, theme } from '@/lib/theme';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.tint,
        tabBarInactiveTintColor: c.tabIconDefault,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: 'Tree',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'leaf.fill',
                android: 'account_tree',
                web: 'account_tree',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: 'Games',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'gamecontroller.fill',
                android: 'sports_esports',
                web: 'sports_esports',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'bubble.left.and.bubble.right.fill',
                android: 'chat',
                web: 'chat',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'person.circle.fill',
                android: 'person',
                web: 'person',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.paperElevated,
    borderTopColor: theme.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 88 : 64,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontFamily: fonts.bodyMed,
    fontSize: 11,
    marginBottom: Platform.OS === 'ios' ? 0 : 6,
  },
  tabItem: {
    paddingTop: 2,
  },
});
