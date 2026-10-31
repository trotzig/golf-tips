import Constants from "expo-constants";
import { PrefToggle } from "../../src/components/PrefToggle";
import { Body, Card, Screen } from "../../src/components/ui";
import { situations } from "../../src/data";
import { useColors } from "../../src/theme";

export default function Settings() {
  const c = useColors();
  return (
    <Screen>
      <Card title="Which way do you swing?">
        <PrefToggle pref="hand" />
        <Body style={{ color: c.inkMuted, marginTop: 10 }}>
          Every direction in the advice — aim, curve, miss — follows this setting.
        </Body>
      </Card>
      <Card title="Distance">
        <PrefToggle pref="distance" />
        <Body style={{ color: c.inkMuted, marginTop: 10 }}>
          Shot lengths, and short distances like putts.
        </Body>
      </Card>
      <Card title="Wind speed">
        <PrefToggle pref="wind" />
      </Card>
      <Card title="Golfer in the diagrams">
        <PrefToggle pref="golfer" />
        <Body style={{ color: c.inkMuted, marginTop: 10 }}>
          The figure that plays each shot. The advice is the same.
        </Body>
      </Card>
      <Body style={{ color: c.inkMuted, fontSize: 14 }}>
        Shotbook {Constants.expoConfig?.version} · {situations.length} situations, all available
        offline.
      </Body>
    </Screen>
  );
}
