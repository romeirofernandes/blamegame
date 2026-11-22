// Adapted from BeUI Native Tabs, distributed under the MIT license:
// https://beui.dev/native/r/tabs
import {
  createContext,
  createElement,
  isValidElement,
  type ComponentType,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  type ColorValue,
  type LayoutRectangle,
  Pressable,
  type PressableInstance,
  type PressableProps,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from "react-native";
import Animated, {
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useAppearance } from "../appearance";
import { useReducedMotionPreference } from "./useReducedMotion";

type IconProps = { size: number; color: ColorValue | undefined };
type IconSource = ComponentType<IconProps> | ReactNode;

function renderIcon(icon: IconSource, props: IconProps) {
  if (typeof icon === "function") return createElement(icon, props);
  if (
    icon != null &&
    typeof icon === "object" &&
    !isValidElement(icon) &&
    "$$typeof" in icon
  ) {
    return createElement(icon as unknown as ComponentType<IconProps>, props);
  }
  return icon;
}

const INDICATOR_SPRING = {
  stiffness: 245,
  damping: 36,
  mass: 1.2,
  reduceMotion: ReduceMotion.System,
} as const;
const SLACK = 1;
const ICON_SIZE = 20;

type TabsContextValue = {
  value: string;
  values: readonly string[];
  select: (value: string) => void;
  focus: (value: string) => void;
  register: (value: string, node: PressableInstance | null) => void;
  animate: boolean;
};

type Indicator = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
  visible: SharedValue<number>;
  report: (value: string, layout: LayoutRectangle) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);
const IndicatorContext = createContext<Indicator | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tabs parts must be rendered inside Tabs.");
  return context;
}

export type TabsProps = ViewProps & {
  value: string;
  values: readonly string[];
  onValueChange: (value: string) => void;
  className?: string;
};

export function Tabs({
  value,
  values,
  onValueChange,
  children,
  ...props
}: TabsProps) {
  const reducedMotion = useReducedMotionPreference();
  const triggers = useRef(new Map<string, PressableInstance>());
  const register = useCallback((key: string, node: PressableInstance | null) => {
    if (node) triggers.current.set(key, node);
    else triggers.current.delete(key);
  }, []);
  const focus = useCallback((key: string) => {
    const node = triggers.current.get(key) as unknown as
      | { focus?: () => void }
      | undefined;
    node?.focus?.();
  }, []);
  const context = useMemo<TabsContextValue>(
    () => ({
      value,
      values,
      select: onValueChange,
      focus,
      register,
      animate: !reducedMotion,
    }),
    [focus, onValueChange, reducedMotion, register, value, values],
  );

  return (
    <TabsContext.Provider value={context}>
      <View {...props}>{children}</View>
    </TabsContext.Provider>
  );
}

export type TabsListProps = Omit<ViewProps, "children"> & {
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
};

export function TabsList({
  children,
  className = "",
  indicatorClassName = "bg-prompt-stack",
  ...props
}: TabsListProps) {
  const { value, animate } = useTabs();
  const layouts = useRef(new Map<string, LayoutRectangle>());
  const heading = useRef<LayoutRectangle | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const animateRef = useRef(animate);
  animateRef.current = animate;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const visible = useSharedValue(0);

  const move = useCallback(
    (target: string) => {
      const layout = layouts.current.get(target);
      if (!layout) {
        heading.current = null;
        visible.value = 0;
        return;
      }
      const last = heading.current;
      if (
        animateRef.current &&
        last &&
        visible.value === 1 &&
        Math.abs(last.x - layout.x) < 0.5 &&
        Math.abs(last.width - layout.width) < 0.5 &&
        Math.abs(last.y - layout.y) < 0.5 &&
        Math.abs(last.height - layout.height) < 0.5
      ) {
        return;
      }
      heading.current = layout;
      y.value = layout.y;
      height.value = layout.height;
      if (visible.value === 0 || !animateRef.current) {
        x.value = layout.x;
        width.value = layout.width;
      } else {
        x.value = withSpring(layout.x, INDICATOR_SPRING);
        width.value = withSpring(layout.width, INDICATOR_SPRING);
      }
      visible.value = 1;
    },
    [height, visible, width, x, y],
  );

  useEffect(() => {
    move(value);
  }, [animate, move, value]);

  const report = useCallback(
    (key: string, layout: LayoutRectangle) => {
      layouts.current.set(key, layout);
      move(valueRef.current);
    },
    [move],
  );
  const indicator = useMemo<Indicator>(
    () => ({ x, y, width, height, visible, report }),
    [height, report, visible, width, x, y],
  );
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    width: width.value,
    height: height.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <View {...props} accessibilityRole="tablist" className={`w-full ${className}`}>
      <IndicatorContext.Provider value={indicator}>
        <View className="relative w-full flex-row items-center rounded-full bg-panel p-1">
          <Animated.View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            className={indicatorClassName}
            style={[styles.indicator, indicatorStyle]}
          />
          {children}
        </View>
      </IndicatorContext.Provider>
    </View>
  );
}

export type TabsTriggerProps = Omit<
  PressableProps,
  "children" | "style" | "onPress" | "onLayout" | "accessibilityRole"
> & {
  value: string;
  icon?: IconSource;
  children: ReactNode;
  className?: string;
  onPress?: PressableProps["onPress"];
  onLayout?: PressableProps["onLayout"];
};

function TabContent({
  children,
  icon,
  color,
}: {
  children: ReactNode;
  icon?: IconSource;
  color: string;
}) {
  return (
    <View className="items-center justify-center gap-1">
      {icon != null && (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="items-center justify-center"
        >
          {renderIcon(icon, { size: ICON_SIZE, color })}
        </View>
      )}
      {typeof children === "string" || typeof children === "number" ? (
        <Text numberOfLines={1} className="font-boldface text-xs leading-4" style={{ color }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function overlap(
  left: number,
  width: number,
  indicatorX: number,
  indicatorWidth: number,
  visible: number,
) {
  "worklet";
  const start = Math.min(width, Math.max(0, indicatorX - left));
  const end = Math.min(
    width,
    Math.max(0, left + width - (indicatorX + indicatorWidth)),
  );
  const hidden = visible === 0 || start + end >= width;
  return hidden ? { start: 0, end: 0, hidden } : { start, end, hidden };
}

export function TabsTrigger({
  value,
  icon,
  children,
  className = "",
  accessibilityLabel,
  accessibilityState,
  disabled,
  onLayout,
  onPress,
  ...props
}: TabsTriggerProps) {
  const { value: current, values, select, focus, register } = useTabs();
  const indicator = useContext(IndicatorContext);
  if (!indicator) throw new Error("TabsTrigger must be rendered in TabsList.");
  const { colors } = useAppearance();
  const selected = current === value;
  const left = useSharedValue(0);
  const tabWidth = useSharedValue(0);

  const clipStyle = useAnimatedStyle(() => {
    const { start, end, hidden } = overlap(
      left.value,
      tabWidth.value,
      indicator.x.value,
      indicator.width.value,
      indicator.visible.value,
    );
    return { opacity: hidden ? 0 : 1, left: start, right: end };
  });
  const innerStyle = useAnimatedStyle(() => {
    const { start, end } = overlap(
      left.value,
      tabWidth.value,
      indicator.x.value,
      indicator.width.value,
      indicator.visible.value,
    );
    return { left: -start - SLACK, right: -end - SLACK };
  });

  function handleKeyDown(event: Parameters<NonNullable<PressableProps["onKeyDown"]>>[0]) {
    if (disabled) return;
    const index = values.indexOf(value);
    const key = event.nativeEvent.key;
    const next =
      key === "ArrowRight"
        ? values[(index + 1) % values.length]
        : key === "ArrowLeft"
          ? values[(index - 1 + values.length) % values.length]
          : key === "Home"
            ? values[0]
            : key === "End"
              ? values[values.length - 1]
              : undefined;
    if (!next) return;
    event.preventDefault();
    select(next);
    focus(next);
  }

  return (
    <Pressable
      {...props}
      ref={(node) => register(value, node)}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ ...accessibilityState, selected, disabled: disabled ?? false }}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className={`min-w-0 min-h-14 flex-1 items-center justify-center rounded-full px-2 py-1 web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong ${disabled ? "opacity-50" : ""} ${className}`}
      onKeyDown={handleKeyDown}
      onLayout={(event) => {
        const layout = event.nativeEvent.layout;
        left.value = layout.x;
        tabWidth.value = layout.width;
        indicator.report(value, layout);
        onLayout?.(event);
      }}
      onPress={(event) => {
        onPress?.(event);
        if (!event.defaultPrevented) select(value);
      }}
    >
      <TabContent icon={icon} color={colors.muted}>
        {children}
      </TabContent>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        pointerEvents="none"
        style={[styles.clip, clipStyle]}
      >
        <Animated.View
          className="items-center justify-center rounded-full"
          style={[styles.clipInner, innerStyle]}
        >
          <TabContent icon={icon} color={colors.lilacStrong}>
            {children}
          </TabContent>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  indicator: { position: "absolute", left: 0, top: 0, borderRadius: 9999 },
  clip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    overflow: "hidden",
    pointerEvents: "none",
  },
  clipInner: { position: "absolute", top: 0, bottom: 0 },
});
