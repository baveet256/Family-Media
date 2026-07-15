import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { loading, token, needsProfile, needsFamily, families } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const group = segments[0];
    const screen = segments[1];
    const inAuth = group === '(auth)';
    const hasActiveFamily = families.some(
      (f) => f.status === 'active' || f.role === 'admin',
    );

    if (!token && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (!token) return;

    if (needsProfile && screen !== 'profile-setup') {
      router.replace('/(auth)/profile-setup');
      return;
    }

    if (
      !needsProfile &&
      needsFamily &&
      !hasActiveFamily &&
      screen !== 'create-family' &&
      screen !== 'join-code'
    ) {
      router.replace('/(auth)/create-family');
    }
  }, [loading, token, needsProfile, needsFamily, families, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
        }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="family/invite"
          options={{ title: 'Invite', presentation: 'modal' }}
        />
        <Stack.Screen
          name="family/join-requests"
          options={{ title: 'Join requests', presentation: 'modal' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
