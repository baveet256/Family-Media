import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#15241c' },
          animation: 'fade',
        }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="create-family" />
        <Stack.Screen name="join-code" />
      </Stack>
    </>
  );
}
