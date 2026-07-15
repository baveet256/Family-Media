import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fafafa' },
        contentStyle: { backgroundColor: '#fafafa' },
      }}>
      <Stack.Screen name="login" options={{ title: 'Sign in' }} />
      <Stack.Screen name="otp" options={{ title: 'Enter code' }} />
      <Stack.Screen name="profile-setup" options={{ title: 'Your name' }} />
      <Stack.Screen name="create-family" options={{ title: 'Create family' }} />
      <Stack.Screen name="join-code" options={{ title: 'Join with code' }} />
    </Stack>
  );
}
