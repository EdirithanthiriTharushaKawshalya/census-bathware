import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.censusbathware.app",
  appName: "Census Bathware",
  webDir: "mobile/dist",
  server: { androidScheme: "https", hostname: "localhost" },
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: "#102f2b" },
    StatusBar: { style: "LIGHT", backgroundColor: "#102f2b" },
  },
};
export default config;
