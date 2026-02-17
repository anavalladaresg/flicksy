import { useLocalSearchParams, useNavigation } from 'expo-router';

import TVDetailsScreen from '@/src/screens/TVDetailsScreen';

export default function TVDetailsRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const tvId = Number(id);

  return <TVDetailsScreen route={{ params: { tvId } }} navigation={navigation} />;
}
