import { useLocalSearchParams, useNavigation } from 'expo-router';

import FloatingModalShell from '@/src/components/common/FloatingModalShell';
import MovieDetailsScreen from '@/src/screens/MovieDetailsScreen';

export default function MovieDetailsRoute() {
  const { id, fromFriendId, fromFriendName } = useLocalSearchParams<{
    id?: string;
    fromFriendId?: string;
    fromFriendName?: string;
  }>();
  const navigation = useNavigation();
  const movieId = Number(id);

  return (
    <FloatingModalShell onClose={() => navigation.goBack()} maxWidth={1100}>
      <MovieDetailsScreen
        route={{ params: { movieId, fromFriendId, fromFriendName } }}
        navigation={navigation}
      />
    </FloatingModalShell>
  );
}
