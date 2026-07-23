import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fafafa' },
        contentStyle: { backgroundColor: '#fafafa' },
      }}>
      <Stack.Screen
        name="index"
        options={{ title: 'Place yourself', headerBackVisible: false }}
      />
    </Stack>
  );
}
