import { StyleSheet, Text, View } from 'react-native';

function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎬 Flicksy</Text>
      <Text style={styles.subtitle}>Movies · TV Shows · Video Games</Text>
      <Text style={styles.message}>
        Configure your .env.local file with API keys to see content
      </Text>
      <Text style={styles.instruction}>
        1. Copy .env.example to .env.local{'\n'}
        2. Add TMDb API key from https://www.themoviedb.org/settings/api{'\n'}
        3. Add IGDB credentials from https://api-docs.igdb.com/{'\n'}
        4. Refresh the app
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  instruction: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'left',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
  },
});

export { HomeScreen };
export default HomeScreen;
