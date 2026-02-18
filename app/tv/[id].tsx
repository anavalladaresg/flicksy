import { useLocalSearchParams, useNavigation } from 'expo-router';

import FloatingModalShell from '@/src/components/common/FloatingModalShell';
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
    <FloatingModalShell onClose={() => navigation.goBack()} maxWidth={1100}>
      <TVDetailsScreen
        route={{ params: { tvId, fromFriendId, fromFriendName } }}
        navigation={navigation}
      />
    </FloatingModalShell>
  );
}
