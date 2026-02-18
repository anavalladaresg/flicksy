import { useLocalSearchParams } from 'expo-router';

import BrowseSection from '@/src/screens/BrowseSectionScreen';

export default function BrowseSectionRoute() {
  const { type } = useLocalSearchParams<{ type?: string | string[] }>();
  const value = Array.isArray(type) ? type[0] : type;
  const normalized = value === 'tv' || value === 'game' ? value : 'movie';

  return <BrowseSection type={normalized} />;
}
