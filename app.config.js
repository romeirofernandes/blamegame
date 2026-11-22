const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

function configureGoogleIos(ios, servicesFile, urlScheme) {
  const infoPlist = { ...ios?.infoPlist };
  if (urlScheme) {
    const urlTypes = [...(infoPlist.CFBundleURLTypes || [])];
    const hasScheme = urlTypes.some((type) => type.CFBundleURLSchemes?.includes(urlScheme));
    if (!hasScheme) urlTypes.push({ CFBundleURLSchemes: [urlScheme] });
    infoPlist.CFBundleURLTypes = urlTypes;
  }

  return {
    ...ios,
    ...(servicesFile ? { googleServicesFile: servicesFile } : {}),
    ...(Object.keys(infoPlist).length ? { infoPlist } : {}),
  };
}

module.exports = ({ config }) => {
  const servicesFile = resolve(__dirname, process.env.GOOGLE_SERVICES_JSON || 'google-services.json');
  const iosServicesFile = resolve(__dirname, process.env.GOOGLE_SERVICE_INFO_PLIST || 'GoogleService-Info.plist');
  const hasServicesFile = existsSync(servicesFile) || Boolean(process.env.GOOGLE_SERVICES_JSON);
  const hasIosServicesFile = existsSync(iosServicesFile) || Boolean(process.env.GOOGLE_SERVICE_INFO_PLIST);
  const googlePlugin = '@react-native-google-signin/google-signin';
  const iosPlist = hasIosServicesFile ? readFileSync(iosServicesFile, 'utf8') : '';
  const plistValue = (key) => iosPlist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))?.[1];
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME || plistValue('REVERSED_CLIENT_ID');
  const googleIOSClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || plistValue('CLIENT_ID');

  let googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (hasServicesFile) {
    const { project_info: project, client: clients } = JSON.parse(readFileSync(servicesFile, 'utf8'));
    const client = clients.find((entry) => entry.client_info?.android_client_info?.package_name === config.android?.package);
    const apiKey = client?.api_key?.[0]?.current_key;
    const appId = client?.client_info?.mobilesdk_app_id;
    if (!apiKey || !appId || !project?.project_id) {
      throw new Error('google-services.json must contain a Firebase client matching the Android package.');
    }

    googleWebClientId ||= client.oauth_client?.find((oauthClient) => oauthClient.client_type === 3)?.client_id;

    return {
      ...config,
      android: { ...config.android, googleServicesFile: servicesFile },
      ios: configureGoogleIos(config.ios, hasIosServicesFile ? iosServicesFile : null, iosUrlScheme),
      plugins: [...(config.plugins || []), googlePlugin],
      extra: {
        ...config.extra,
        firebase: { apiKey, appId, projectId: project.project_id, authDomain: `${project.project_id}.firebaseapp.com` },
        ...(googleWebClientId ? { googleWebClientId } : {}),
        ...(iosUrlScheme ? { googleIOSUrlScheme: iosUrlScheme } : {}),
        ...(googleIOSClientId ? { googleIOSClientId } : {}),
      },
    };
  }

  if (!googleWebClientId && !hasIosServicesFile) return config;

  return {
    ...config,
    ios: configureGoogleIos(config.ios, hasIosServicesFile ? iosServicesFile : null, iosUrlScheme),
    plugins: [...(config.plugins || []), googlePlugin],
    extra: {
      ...config.extra,
      ...(googleWebClientId ? { googleWebClientId } : {}),
      ...(iosUrlScheme ? { googleIOSUrlScheme: iosUrlScheme } : {}),
      ...(googleIOSClientId ? { googleIOSClientId } : {}),
    },
  };
};
