const { createHash } = require('node:crypto');
const { getConfig } = require('expo/config');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const { exp } = getConfig(__dirname, { isPublicConfig: true });

// Expo inlines the web manifest in expo-constants, outside the app source.
const extra = JSON.stringify(exp.extra ?? null);
config.cacheVersion += ':' + createHash('sha256').update(extra).digest('hex');

const nativewindConfig = withNativewind(config);
const nativewindResolver = nativewindConfig.resolver.resolveRequest;

// expo-asset needs React Native's AssetRegistry export. NativeWind's component
// re-export currently omits that export on React Native 0.88.
nativewindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== 'web' &&
    moduleName === 'react-native' &&
    context.originModulePath.includes('/node_modules/expo-asset/')
  ) {
    const resolver = config.resolver.resolveRequest ?? context.resolveRequest;
    return resolver(context, moduleName, platform);
  }

  return nativewindResolver(context, moduleName, platform);
};

module.exports = nativewindConfig;
