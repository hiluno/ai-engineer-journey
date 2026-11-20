import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { FinanceAlert } from '../lib/types';

let configured = false;
let permitted: boolean | null = null;

async function ensureSetup(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!configured) {
    configured = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alertas', {
        name: 'Alertas de orçamento e metas',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }
  if (permitted === null) {
    const current = await Notifications.getPermissionsAsync();
    permitted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  }
  return permitted;
}

/** Mostra uma notificação local por cada alerta (orçamento atingido, meta cumprida…). */
export async function notifyAlerts(alerts: FinanceAlert[]): Promise<void> {
  try {
    if (!(await ensureSetup())) return;
    for (const a of alerts) {
      await Notifications.scheduleNotificationAsync({
        content: { title: a.title, body: a.message },
        trigger: Platform.OS === 'android' ? { channelId: 'alertas' } : null,
      });
    }
  } catch (e) {
    console.warn('Notificação falhou', e);
  }
}
