// Adapted from beUI Native Card (MIT).
// Source: https://github.com/starc007/beui-native/tree/main/src/components/card
import { View, type ViewProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

export type SurfaceProps = ViewProps & { className?: string };

/** A themed View surface that still accepts the full native View prop set. */
export function Surface({ className = '', ...props }: SurfaceProps) {
  return <View {...props} className={twMerge('rounded-2xl border border-line bg-panel', className)} />;
}
