const { createHash } = require('node:crypto');
const { getConfig } = require('expo/config');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const { exp } = getConfig(__dirname, { isPublicConfig: true });

// Expo inlines the web manifest in expo-constants, outside the app source.
const extra = JSON.stringify(exp.extra ?? null);
config.cacheVersion += ':' + createHash('sha256').update(extra).digest('hex');

module.exports = withNativewind(config);
