import { Stack, useLocalSearchParams } from "expo-router";
import { Body, PageTitle, Screen, SituationList, styles as ui } from "../../src/components/ui";
import { getCategory, situationsIn } from "../../src/data";
import { useColors } from "../../src/theme";

export default function CategoryScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = getCategory(id);
  if (!category) return <Stack.Screen options={{ title: "Not found" }} />;
  return (
    <Screen>
      <Stack.Screen options={{ title: category.title }} />
      <PageTitle>{category.title}</PageTitle>
      <Body style={[ui.large, { color: c.inkMuted }]}>{category.description}</Body>
      <SituationList situations={situationsIn(category.id)} showCategory={false} />
    </Screen>
  );
}
