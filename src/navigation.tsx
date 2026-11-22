import { type ReactNode } from "react";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HugeiconsIcon } from "@hugeicons/react-native";
import Cards01Icon from "@hugeicons/core-free-icons/Cards01Icon";
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import { decks } from "./decks";
import { deckArt } from "./deckArt";
import { Body, Button, Label, Surface, Tap, Title, hapticSelect } from "./ui";
import { Tabs, TabsList, TabsTrigger } from "./beui/tabs";
import { useSoundEffects } from "./soundEffects";

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
const destinationIds = destinations.map(({ id }) => id);

export function GameTabBar({
  active,
  onChange,
}: {
  active: GameDestination;
  onChange: (destination: GameDestination) => void;
}) {
  const { play } = useSoundEffects();
  return (
    <SafeAreaView edges={["bottom"]} className="border-t border-line/40 bg-panel">
      <Tabs
        value={active}
        values={destinationIds}
        onValueChange={(value) => {
          if (value === active || !destinationIds.includes(value as GameDestination)) return;
          play("tap");
          hapticSelect();
          onChange(value as GameDestination);
        }}
        className="mx-auto w-full max-w-[480px] px-4 py-1"
      >
        <TabsList accessibilityLabel="Game navigation">
          {destinations.map(({ id, label, icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              icon={({ size, color }) => (
                <HugeiconsIcon
                  accessible={false}
                  icon={icon}
                  color={color}
                  size={size}
                  strokeWidth={1.9}
                />
              )}
              className="active:opacity-75"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </SafeAreaView>
  );
}

export function DecksScreen({
  onHost,
}: {
  onHost: (deckId: string) => void;
}) {
  return (
    <View className="gap-6">
      <View>
        <Title className="text-[48px] leading-display">The decks</Title>
        <Body className="mt-2 max-w-[310px] text-muted">
          Pick a mood for the room.
        </Body>
      </View>
      <View className="gap-4">
        {decks.map((deck) => {
          const sample = deck.cards[0];
          return (
            <Surface key={deck.id} className="overflow-hidden rounded-[24px] border border-line bg-panel">
              <View className="gap-4 p-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1 gap-1">
                    <Label className="text-lilac-strong">{deck.label}</Label>
                    <Text accessibilityRole="header" className="font-display text-[22px] leading-7 text-cloud">{deck.name}</Text>
                    <Body className="text-sm leading-5 text-muted">{deck.description}</Body>
                  </View>
                  <Image
                    source={deckArt[deck.id]}
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    pointerEvents="none"
                    resizeMode="contain"
                    style={{ width: 64, height: 64, flexShrink: 0 }}
                  />
                </View>

                {sample && (
                  <View className="gap-2">
                    <Label className="text-muted">
                      {sample.kind === "pick" ? "pick a person" : "write an answer"}
                    </Label>
                    <Surface className="gap-2 rounded-[18px] border border-line/60 bg-canvas p-4">
                      <Label>Sample prompt</Label>
                      <Body className="font-display text-lg leading-6">{sample.question.replace("{player}", "Maya")}</Body>
                    </Surface>
                  </View>
                )}

                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <Button
                    className="flex-1"
                    label={`Host a game with ${deck.name}`}
                    onPress={() => onHost(deck.id)}
                  >
                    Host with deck
                  </Button>
                </View>
              </View>
            </Surface>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsScreen({
  appearanceSlot,
  avatarSlot,
  accountSlot,
}: {
  appearanceSlot: ReactNode;
  avatarSlot?: ReactNode;
  accountSlot: ReactNode;
}) {
  return (
    <View className="gap-6">
      <Title className="text-[38px] leading-display">Settings</Title>
      <SettingsSection title="Preferences">{appearanceSlot}</SettingsSection>
      <SettingsSection title="Account">
        {avatarSlot && <View className="mb-3 border-b border-line/60 pb-2">{avatarSlot}</View>}
        {accountSlot}
      </SettingsSection>
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
    <View className="gap-2">
      <Label accessibilityRole="header" className="pl-1 text-xs tracking-[1px]">{title}</Label>
      <Surface className="rounded-[20px] border border-line bg-panel px-4 py-3">{children}</Surface>
    </View>
  );
}
