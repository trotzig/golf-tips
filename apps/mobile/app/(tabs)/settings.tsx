import Constants from "expo-constants";
import { HandToggle } from "../../src/components/HandToggle";
import { Body, Card, Screen } from "../../src/components/ui";
import { situations } from "../../src/data";
import { useColors } from "../../src/theme";

export default function Settings() {
  const c = useColors();
  return (
    <Screen>
      <Card title="Which way do you swing?">
        <HandToggle />
        <Body style={{ color: c.inkMuted, marginTop: 10 }}>
          Every direction in the advice — aim, curve, miss — follows this setting.
        </Body>
      </Card>
      <Body style={{ color: c.inkMuted, fontSize: 14 }}>
        Shotbook {Constants.expoConfig?.version} · {situations.length} situations, all available
        offline.
      </Body>
    </Screen>
  );
}
