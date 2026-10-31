import { Jost_400Regular } from "@expo-google-fonts/jost/400Regular";
import { Jost_500Medium } from "@expo-google-fonts/jost/500Medium";
import { Jost_600SemiBold } from "@expo-google-fonts/jost/600SemiBold";
import { Jost_700Bold } from "@expo-google-fonts/jost/700Bold";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { PrefsProvider } from "../src/prefs";
import { dark, fonts, light } from "../src/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? dark : light;
  const [fontsLoaded, fontError] = useFonts({
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
    Jost_700Bold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.canvas,
      card: c.canvas,
      text: c.inkStrong,
      border: c.line,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <PrefsProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerTintColor: c.accent,
            headerTitleStyle: { fontFamily: fonts.semibold, color: c.inkStrong },
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: c.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="category/[id]" options={{ title: "" }} />
          <Stack.Screen name="situations/[id]" options={{ title: "" }} />
          <Stack.Screen name="tags/[tag]" options={{ title: "" }} />
        </Stack>
      </PrefsProvider>
    </ThemeProvider>
  );
}
