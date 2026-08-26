import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_STORAGE_KEY = "confidence-trivia:device-id";
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateDeviceId(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = globalThis.crypto;

  let generatedSecurely = false;
  if (cryptoApi?.getRandomValues) {
    try {
      cryptoApi.getRandomValues(bytes);
      generatedSecurely = true;
    } catch {
      // Some React Native runtimes expose crypto without implementing it.
    }
  }

  if (!generatedSecurely) {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (storedDeviceId && DEVICE_ID_PATTERN.test(storedDeviceId)) return storedDeviceId;

  const deviceId = generateDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}
