import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface UserAvatarProps {
  avatarUrl?: string | null;
  size?: number;
  isDark?: boolean;
}

export default function UserAvatar({ avatarUrl, size = 40, isDark = false }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const showImage = Boolean(avatarUrl) && !failed;
  const iconSize = Math.max(16, Math.round(size * 0.48));

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: isDark ? '#334155' : '#BFDBFE',
          backgroundColor: isDark ? '#0B1220' : '#EFF6FF',
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl as string }}
          resizeMode="cover"
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <MaterialIcons name="person" size={iconSize} color={isDark ? '#93C5FD' : '#0369A1'} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});

