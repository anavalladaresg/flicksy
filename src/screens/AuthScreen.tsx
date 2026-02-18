import { Platform } from 'react-native';

const AuthScreen =
  Platform.OS === 'web'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./AuthScreen.web').default
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./AuthScreen.native').default;

export default AuthScreen;
