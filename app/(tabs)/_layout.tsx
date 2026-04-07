import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BRAND = '#216BFF';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#252525',
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 10, marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '练习室',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="language-modal" options={{ href: null }} />
    </Tabs>
  );
}
