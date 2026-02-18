import { useNavigation } from 'expo-router';
import FloatingModalShell from '@/src/components/common/FloatingModalShell';
import AchievementsScreen from '@/src/screens/AchievementsScreen';

export default function AchievementsRoute() {
  const navigation = useNavigation();

  return (
    <FloatingModalShell onClose={() => navigation.goBack()} maxWidth={860}>
      <AchievementsScreen />
    </FloatingModalShell>
  );
}
