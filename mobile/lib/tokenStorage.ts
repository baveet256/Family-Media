import { Platform } from 'react-native';

const TOKEN_KEY = 'family_media_access_token';

async function nativeStore() {
  // Lazy-load so web never touches the empty SecureStore native stub.
  return import('expo-secure-store');
}

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }

  try {
    const SecureStore = await nativeStore();
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (!token) {
        globalThis.localStorage?.removeItem(TOKEN_KEY);
      } else {
        globalThis.localStorage?.setItem(TOKEN_KEY, token);
      }
    } catch {
      // ignore quota / private mode
    }
    return;
  }

  const SecureStore = await nativeStore();
  if (!token) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
