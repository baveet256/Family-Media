import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function OnboardingLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#15241c' },
          animation: 'fade',
        }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
