import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HugeiconsIcon } from "@hugeicons/react-native";
import Cards01Icon from "@hugeicons/core-free-icons/Cards01Icon";
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import { decks } from "./decks";
import { useAppearance } from "./appearance";
import { Body, Label, Title, hapticSelect } from "./ui";

export type GameDestination = "play" | "decks" | "settings";

const destinations = [
  { id: "play", label: "Play", icon: PlayIcon },
  { id: "decks", label: "Decks", icon: Cards01Icon },
  { id: "settings", label: "Settings", icon: Settings01Icon },
] as const satisfies {
  id: GameDestination;
  label: string;
  icon: typeof PlayIcon;
}[];

export function GameTabBar({
  active,
  onChange,
}: {
  active: GameDestination;
  onChange: (destination: GameDestination) => void;
}) {
  const { colors } = useAppearance();
  return (
    <SafeAreaView edges={["bottom"]} className="border-t border-line/40 bg-panel">
      <View
        accessibilityRole="tablist"
        className="mx-auto w-full max-w-[480px] flex-row px-4 py-1"
      >
        {destinations.map(({ id, label, icon }) => {
          const selected = active === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              className="min-h-14 flex-1 items-center justify-center gap-1 rounded-xl active:opacity-75 web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
              onPress={() => {
                if (selected) return;
                hapticSelect();
                onChange(id);
              }}
            >
              <View
                aria-hidden
                className={`h-0.5 w-4 rounded-full ${selected ? "bg-lilac-strong" : "bg-transparent"}`}
              />
              <HugeiconsIcon
                accessible={false}
                icon={icon}
                color={selected ? colors.lilacStrong : colors.muted}
                size={21}
                strokeWidth={selected ? 2.2 : 1.8}
              />
              <Text
                className={`font-boldface text-xs leading-4 ${selected ? "text-lilac-strong" : "text-muted"}`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export function DecksScreen({
  onHost,
  onTry,
}: {
  onHost: (deckId: string) => void;
  onTry: (deckId: string) => void;
}) {
  const { colors } = useAppearance();
  return (
    <View className="gap-6">
      <View>
        <Title className="text-[48px] leading-display">The decks</Title>
        <Body className="mt-2 max-w-[310px] text-muted">
          Pick a mood for the room or try a deck solo.
        </Body>
      </View>

      <View className="gap-4">
        {decks.map((deck) => {
          const sample = deck.cards[0];
          return (
            <View
              key={deck.id}
              className="overflow-hidden rounded-[24px] border border-line bg-panel"
            >
              <View className="gap-4 p-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1 gap-1">
                    <Label className="text-lilac-strong">{deck.label}</Label>
                    <Text
                      accessibilityRole="header"
                      className="font-display text-[22px] leading-7 text-cloud"
                    >
                      {deck.name}
                    </Text>
                    <Body className="text-sm leading-5 text-muted">
                      {deck.description}
                    </Body>
                  </View>
                  <View
                    style={{ backgroundColor: deck.color }}
                    className="size-9 shrink-0 rotate-3 items-center justify-center rounded-[12px]"
                  >
                    <HugeiconsIcon
                      accessible={false}
                      icon={Cards01Icon}
                      color={colors.ink}
                      size={21}
                      strokeWidth={1.9}
                    />
                  </View>
                </View>

                {sample && (
                  <View
                    style={{ backgroundColor: deck.color }}
                    className="gap-2 rounded-[18px] p-4"
                  >
                    <Label className="text-ink">Sample prompt</Label>
                    <Text className="font-display text-[18px] leading-[25px] text-ink">
                      {sample.question.replace("{player}", "Maya")}
                    </Text>
                  </View>
                )}

                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Try ${deck.name} solo`}
                    className="min-h-12 justify-center rounded-full px-3 web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
                    onPress={() => onTry(deck.id)}
                  >
                    <Text className="font-boldface text-sm text-lilac-strong">Try solo</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Host with ${deck.name}`}
                    className="min-h-12 justify-center rounded-full border border-line px-4 web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
                    onPress={() => onHost(deck.id)}
                  >
                    <Text className="font-boldface text-sm text-cloud">Host with deck</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsScreen({
  appearanceSlot,
  accountSlot,
}: {
  appearanceSlot: ReactNode;
  accountSlot: ReactNode;
}) {
  return (
    <View className="gap-7">
      <View>
        <Title className="text-[48px] leading-display">Settings</Title>
        <Body className="mt-2 max-w-[310px] text-muted">
          Make the game feel like yours.
        </Body>
      </View>

      <SettingsSection title="Appearance">{appearanceSlot}</SettingsSection>
      <SettingsSection title="Account">{accountSlot}</SettingsSection>
    </View>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <Text
        accessibilityRole="header"
        className="font-display text-xl leading-6 text-cloud"
      >
        {title}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}
