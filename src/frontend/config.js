import { Platform } from 'react-native';

const ENV = {
  development: {
    API_URL: Platform.select({
      web: 'http://localhost:3000/api',
      default: 'http://localhost:3000/api',
    }),
    SOCKET_URL: 'http://localhost:3000',
  },
  production: {
    API_URL: 'https://api.orbit-app.com/api',
    SOCKET_URL: 'https://api.orbit-app.com',
  },
};

const getEnv = () => {
  if (__DEV__) return ENV.development;
  return ENV.production;
};

export default getEnv();
