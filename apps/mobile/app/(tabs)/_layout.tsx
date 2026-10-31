import { Tabs } from "expo-router/js-tabs";
import { FlagIcon, HeartIcon, SearchIcon, SettingsIcon } from "../../src/components/icons";
import { fonts, useColors } from "../../src/theme";

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.inkMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: c.canvas, borderTopColor: c.line },
        headerStyle: { backgroundColor: c.canvas },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.semibold, color: c.inkStrong },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Browse",
          headerShown: false,
          tabBarIcon: ({ color }) => <FlagIcon color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <SearchIcon color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color }) => <HeartIcon color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <SettingsIcon color={color as string} />,
        }}
      />
    </Tabs>
  );
}
