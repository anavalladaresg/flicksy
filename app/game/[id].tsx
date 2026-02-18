import { useLocalSearchParams, useNavigation } from 'expo-router';

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
    <GameDetailsScreen
      route={{ params: { gameId, fromFriendId, fromFriendName } }}
      navigation={navigation}
    />
  );
}
