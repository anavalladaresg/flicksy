import { StyleSheet, Text, View } from 'react-native';

function TrackedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📚 Library</Text>
      <Text style={styles.subtitle}>Your tracked movies, TV shows, and games</Text>
      <Text style={styles.message}>
        Items you add will appear here
      </Text>
      <Text style={styles.instruction}>
        Go to the Home or Search tabs and add items to track them.
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
    textAlign: 'center',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
  },
});

export { TrackedScreen };
export default TrackedScreen;
