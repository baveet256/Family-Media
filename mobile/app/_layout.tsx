import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
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
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
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
  const {
    loading,
    token,
    needsProfile,
    needsFamily,
    needsOnboarding,
    onboardingJoinRequestId,
    families,
  } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const group = segments[0];
    const screen = segments[1];
    const inAuth = group === '(auth)';
    const inOnboarding = group === 'onboarding';
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
      return;
    }

    if (
      !needsProfile &&
      needsOnboarding &&
      onboardingJoinRequestId &&
      !inOnboarding
    ) {
      router.replace({
        pathname: '/onboarding',
        params: { joinRequestId: onboardingJoinRequestId },
      });
    }
  }, [
    loading,
    token,
    needsProfile,
    needsFamily,
    needsOnboarding,
    onboardingJoinRequestId,
    families,
    segments,
    router,
  ]);

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
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="family/invite"
          options={{ title: 'Invite', presentation: 'modal' }}
        />
        <Stack.Screen
          name="family/join-requests"
          options={{ title: 'Join requests', presentation: 'modal' }}
        />
        <Stack.Screen
          name="feed/create"
          options={{ title: 'New post', presentation: 'modal' }}
        />
        <Stack.Screen name="feed/[id]" options={{ title: 'Post' }} />
        <Stack.Screen
          name="stories/create"
          options={{ title: 'New story', presentation: 'modal' }}
        />
        <Stack.Screen
          name="stories/viewer"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="stories/viewers"
          options={{ title: 'Viewers', presentation: 'modal' }}
        />
        <Stack.Screen
          name="chat/new"
          options={{ title: 'New chat', presentation: 'modal' }}
        />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="chat/info" options={{ title: 'Info' }} />
        <Stack.Screen
          name="games/new"
          options={{ title: 'New round', presentation: 'modal' }}
        />
        <Stack.Screen name="games/[id]" options={{ title: 'Round' }} />
        <Stack.Screen name="calendar/index" options={{ title: 'Coming up' }} />
        <Stack.Screen
          name="calendar/new"
          options={{ title: 'Add a date', presentation: 'modal' }}
        />
        <Stack.Screen
          name="connections/index"
          options={{ title: 'Connections' }}
        />
        <Stack.Screen
          name="connections/invite"
          options={{ title: 'Invite family', presentation: 'modal' }}
        />
        <Stack.Screen
          name="connections/[id]"
          options={{ title: 'Connection' }}
        />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen
          name="family/relationship-requests"
          options={{ title: 'Tree corrections' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
