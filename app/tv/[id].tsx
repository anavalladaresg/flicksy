import { useLocalSearchParams, useNavigation } from 'expo-router';

import TVDetailsScreen from '@/src/screens/TVDetailsScreen';

export default function TVDetailsRoute() {
  const { id, fromFriendId, fromFriendName } = useLocalSearchParams<{
    id?: string;
    fromFriendId?: string;
    fromFriendName?: string;
  }>();
  const navigation = useNavigation();
  const tvId = Number(id);

  return (
    <TVDetailsScreen
      route={{ params: { tvId, fromFriendId, fromFriendName } }}
      navigation={navigation}
    />
  );
}
