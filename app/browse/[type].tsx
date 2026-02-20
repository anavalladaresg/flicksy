import { useLocalSearchParams, useNavigation } from 'expo-router';

import FloatingModalShell from '@/src/components/common/FloatingModalShell';
import BrowseSection from '@/src/screens/BrowseSectionScreen';

export default function BrowseSectionRoute() {
  const { type } = useLocalSearchParams<{ type?: string | string[] }>();
  const navigation = useNavigation();
  const value = Array.isArray(type) ? type[0] : type;
  const normalized = value === 'tv' || value === 'game' ? value : 'movie';

  return (
    <FloatingModalShell onClose={() => navigation.goBack()} maxWidth={980}>
      <BrowseSection type={normalized} />
    </FloatingModalShell>
  );
}
