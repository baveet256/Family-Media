import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'fm:cache:';

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${PREFIX}${key}`,
      JSON.stringify({ savedAt: Date.now(), value }),
    );
  } catch {
    // ignore cache write failures
  }
}

export async function cacheGet<T>(
  key: string,
): Promise<{ savedAt: number; value: T } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as { savedAt: number; value: T };
  } catch {
    return null;
  }
}

export async function cacheRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // ignore
  }
}
