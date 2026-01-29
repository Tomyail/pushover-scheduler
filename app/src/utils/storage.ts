import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  API_URL: 'api_url',
} as const;

export const storage = {
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
  },

  async getApiUrl(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.API_URL);
  },

  async setApiUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.API_URL, url);
  },
};
