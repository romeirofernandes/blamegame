import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HugeiconsIcon } from "@hugeicons/react-native";
import Cards01Icon from "@hugeicons/core-free-icons/Cards01Icon";
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import { decks } from "./decks";
import { useAppearance } from "./appearance";
import { Body, Label, Surface, Tap, Title, hapticSelect } from "./ui";
import { Tabs, TabsList, TabsTrigger } from "./beui/tabs";
import { PromptDeckStack } from "./PromptDeckStack";

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
  return (
    <SafeAreaView edges={["bottom"]} className="border-t border-line/40 bg-panel">
      <Tabs
        value={active}
        values={destinationIds}
        onValueChange={(value) => {
          if (value === active || !destinationIds.includes(value as GameDestination)) return;
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
            <Surface
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
                  <View className="gap-2">
                    <Label className="text-muted">
                      {deck.cards.length} prompts ·{" "}
                      {sample.kind === "pick" ? "pick a person" : "write an answer"}
                    </Label>
                    <PromptDeckStack deck={deck} />
                  </View>
                )}

                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <Tap
                    label={`Try ${deck.name} solo`}
                    className="min-h-12 justify-center rounded-full px-3 web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
                    onPress={() => onTry(deck.id)}
                  >
                    <Text className="font-boldface text-sm text-lilac-strong">Try solo</Text>
                  </Tap>
                  <Tap
                    label={`Host with ${deck.name}`}
                    className="min-h-12 justify-center rounded-full border border-line px-4 web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
                    onPress={() => onHost(deck.id)}
                  >
                    <Text className="font-boldface text-sm text-cloud">Host with deck</Text>
                  </Tap>
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
  const description = avatarSlot
    ? "Set your theme and avatar, and manage your account."
    : "Choose a theme and manage your account.";

  return (
    <View className="gap-6">
      <View>
        <Title className="text-[48px] leading-display">Settings</Title>
        <Body className="mt-2 max-w-[310px] text-muted">{description}</Body>
      </View>

      <SettingsSection title="Appearance" surface>{appearanceSlot}</SettingsSection>
      {avatarSlot && (
        <SettingsSection title="Avatar">{avatarSlot}</SettingsSection>
      )}
      <SettingsSection title="Account">{accountSlot}</SettingsSection>
    </View>
  );
}

function SettingsSection({
  title,
  children,
  surface = false,
}: {
  title: string;
  children: ReactNode;
  surface?: boolean;
}) {
  return (
    <View className="gap-3">
      <Text
        accessibilityRole="header"
        className="font-display text-xl leading-6 text-cloud"
      >
        {title}
      </Text>
      {surface ? (
        <Surface className="gap-3 rounded-[20px] border border-line bg-panel p-4">
          {children}
        </Surface>
      ) : (
        <View className="gap-3">{children}</View>
      )}
    </View>
  );
}
