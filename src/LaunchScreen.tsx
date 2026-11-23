import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useReducedMotionPreference } from './beui/useReducedMotion';

if (Platform.OS !== 'web') void SplashScreen.preventAutoHideAsync().catch(() => {});

export function LaunchScreen({ ready, children }: { ready: boolean; children: ReactNode }) {
  const reducedMotion = useReducedMotionPreference();
  const [visible, setVisible] = useState(true);
  const [logoReady, setLogoReady] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!logoReady) return;
    if (Platform.OS !== 'web') void SplashScreen.hideAsync().catch(() => {});
    if (!ready) return;
    if (reducedMotion) {
      setVisible(false);
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.14, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    ]);
    animation.start(({ finished }) => { if (finished) setVisible(false); });
    return () => animation.stop();
  }, [logoReady, opacity, ready, reducedMotion, scale]);

  return (
    <View style={{ flex: 1 }}>
      {ready && children}
      {visible && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            alignItems: 'center', justifyContent: 'center', backgroundColor: '#15131d', opacity,
          }]}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Image
              source={require('../assets/app-icon.png')}
              onLoadEnd={() => setLogoReady(true)}
              resizeMode="contain"
              style={{ width: 120, height: 120 }}
            />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}
