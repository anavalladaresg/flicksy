import { useNavigation } from 'expo-router';
import FloatingModalShell from '@/src/components/common/FloatingModalShell';
import FriendsScreen from '@/src/screens/FriendsScreen';

export default function FriendsRoute() {
  const navigation = useNavigation();

  return (
    <FloatingModalShell onClose={() => navigation.goBack()} maxWidth={820}>
      <FriendsScreen />
    </FloatingModalShell>
  );
}
