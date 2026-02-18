import { Redirect } from 'expo-router';
import AuthScreen from '@/src/screens/AuthScreen';
import { useAuthStatus } from '@/src/hooks/use-auth-status';

export default function AuthRoute() {
  const { isLoading, isSignedIn } = useAuthStatus();
  if (!isLoading && isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }
  return <AuthScreen />;
}
