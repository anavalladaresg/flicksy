import { useLocalSearchParams, useNavigation } from 'expo-router';

import MovieDetailsScreen from '@/src/screens/MovieDetailsScreen';

export default function MovieDetailsRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const movieId = Number(id);

  return <MovieDetailsScreen route={{ params: { movieId } }} navigation={navigation} />;
}
