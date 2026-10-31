import { Body, Screen, SituationList } from "../../src/components/ui";
import { getSituation } from "../../src/data";
import { usePrefs } from "../../src/prefs";
import { useColors } from "../../src/theme";

export default function Favourites() {
  const c = useColors();
  const { favourites } = usePrefs();
  const situations = favourites.flatMap((id) => getSituation(id) ?? []);
  return (
    <Screen>
      {situations.length === 0 ? (
        <Body style={{ color: c.inkMuted, fontSize: 18, lineHeight: 24 }}>
          Tap the heart on a situation to keep it here, ready for the course. Favourites are saved
          on this device.
        </Body>
      ) : (
        <SituationList situations={situations} />
      )}
    </Screen>
  );
}
