import { StatusBar } from 'expo-status-bar';
import { Tabs } from 'expo-router/js-tabs';
import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '../components/ui';
import { DataProvider, useData } from '../state/DataContext';

const tabIcon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };

function AppTabs() {
  const { loaded, alerts } = useData();
  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const urgent = alerts.filter((a) => a.level === 'danger' || a.level === 'warning').length;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '800', color: colors.text },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumo',
          headerTitle: 'Finanças da Família',
          tabBarIcon: tabIcon('🏠'),
          tabBarBadge: urgent > 0 ? urgent : undefined,
        }}
      />
      <Tabs.Screen name="movimentos" options={{ title: 'Movimentos', tabBarIcon: tabIcon('💶') }} />
      <Tabs.Screen name="orcamento" options={{ title: 'Orçamento', headerTitle: 'Orçamento e Poupança', tabBarIcon: tabIcon('🎯') }} />
      <Tabs.Screen name="emprestimos" options={{ title: 'Crédito', headerTitle: 'Simulador de Crédito', tabBarIcon: tabIcon('🏦') }} />
      <Tabs.Screen name="investir" options={{ title: 'Investir', headerTitle: 'Ideias de Investimento', tabBarIcon: tabIcon('📈') }} />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <DataProvider>
      <StatusBar style="dark" />
      <AppTabs />
    </DataProvider>
  );
}
