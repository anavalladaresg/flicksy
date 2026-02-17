/**
 * Navegación con React Navigation
 * Configura bottom tabs y stacks para cada feature
 */

import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

// Pantallas
import HomeScreen from '../screens/HomeScreen';
import MovieDetailsScreen from '../screens/MovieDetailsScreen';
import SearchScreen from '../screens/SearchScreen';
import TrackedScreen from '../screens/TrackedScreen';

// ============= STACK NAVIGATION =============
export const MovieStack = createNativeStackNavigator();

export const MovieStackNavigator = () => {
  return (
    <MovieStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <MovieStack.Screen name="MovieList" component={HomeScreen} />
      <MovieStack.Screen
        name="MovieDetails"
        component={MovieDetailsScreen}
        options={{
          cardStyle: { backgroundColor: '#fff' },
        }}
      />
    </MovieStack.Navigator>
  );
};

// ============= BOTTOM TAB NAVIGATION =============
const Tab = createBottomTabNavigator();

export const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#f5f5f5',
          borderTopColor: '#ddd',
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Tracked') {
            iconName = focused ? 'bookmark' : 'bookmark-border';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Inicio',
          tabBarLabel: 'Inicio',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Buscar',
          tabBarLabel: 'Buscar',
        }}
      />
      <Tab.Screen
        name="Tracked"
        component={TrackedScreen}
        options={{
          title: 'Mi Biblioteca',
          tabBarLabel: 'Biblioteca',
        }}
      />
    </Tab.Navigator>
  );
};

// Export type for navigation
export type RootStackParamList = {
  Home: undefined;
  MovieDetails: { movieId: number };
  TVDetails: { tvId: number };
  GameDetails: { gameId: number };
  Search: undefined;
  Tracked: undefined;
};
