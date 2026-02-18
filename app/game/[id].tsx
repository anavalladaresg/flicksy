import { useLocalSearchParams, useNavigation } from 'expo-router';

import FloatingModalShell from '@/src/components/common/FloatingModalShell';
import GameDetailsScreen from '@/src/screens/GameDetailsScreen';

export default function GameDetailsRoute() {
  const { id, fromFriendId, fromFriendName } = useLocalSearchParams<{
    id?: string | string[];
    fromFriendId?: string;
    fromFriendName?: string;
  }>();
  const navigation = useNavigation();
  const gameId = Number(Array.isArray(id) ? id[0] : id);

  return (
    <FloatingModalShell onClose={() => navigation.goBack()} maxWidth={1100}>
      <GameDetailsScreen
        route={{ params: { gameId, fromFriendId, fromFriendName } }}
        navigation={navigation}
      />
    </FloatingModalShell>
  );
}
