import { Stack, useLocalSearchParams } from "expo-router";
import { PageTitle, Screen, SituationList } from "../../src/components/ui";
import { situations } from "../../src/data";
import { tagLabel } from "../../src/lib/text";

export default function TagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const tagged = situations.filter((s) => s.tags.includes(tag));
  return (
    <Screen>
      <Stack.Screen options={{ title: tagLabel(tag) }} />
      <PageTitle>{tagLabel(tag)}</PageTitle>
      <SituationList situations={tagged} />
    </Screen>
  );
}
