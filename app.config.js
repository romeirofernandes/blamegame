const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

module.exports = ({ config }) => {
  const servicesFile = resolve(__dirname, process.env.GOOGLE_SERVICES_JSON || 'google-services.json');
  if (!existsSync(servicesFile) && !process.env.GOOGLE_SERVICES_JSON) return config;

  const { project_info: project, client: clients } = JSON.parse(readFileSync(servicesFile, 'utf8'));
  const client = clients.find((entry) => entry.client_info?.android_client_info?.package_name === config.android?.package);
  const apiKey = client?.api_key?.[0]?.current_key;
  const appId = client?.client_info?.mobilesdk_app_id;
  if (!apiKey || !appId || !project?.project_id) {
    throw new Error('google-services.json must contain a Firebase client matching the Android package.');
  }

  return {
    ...config,
    android: { ...config.android, googleServicesFile: servicesFile },
    extra: {
      ...config.extra,
      firebase: { apiKey, appId, projectId: project.project_id, authDomain: `${project.project_id}.firebaseapp.com` },
    },
  };
};
