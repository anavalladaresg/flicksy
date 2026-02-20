import { useNavigation } from 'expo-router';
import FloatingModalShell from '@/src/components/common/FloatingModalShell';
import FriendLibraryScreen from '@/src/screens/FriendLibraryScreen';

export default function FriendLibraryRoute() {
  const navigation = useNavigation();

  return (
    <FloatingModalShell onClose={() => navigation.goBack()} maxWidth={980}>
      <FriendLibraryScreen />
    </FloatingModalShell>
  );
}
