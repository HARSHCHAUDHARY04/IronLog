// ═══════════════════════════════════════════════════════
// Notifications — local notifications via expo-notifications
// • Smart workout reminders (skip days you've already trained)
// • Rest-timer alert that fires even when the app is backgrounded
// ═══════════════════════════════════════════════════════

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, toLocalDateStr } from './date';

let Notifications: any = null;

// Lazy load expo-notifications to prevent crashes if not installed
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('expo-notifications not available');
}

const REMINDER_IDS_KEY = 'ironlog_reminder_ids';
const REMINDER_DAYS_AHEAD = 7;
const REST_CHANNEL_ID = 'rest-timer';

let handlerConfigured = false;

function configureHandler() {
  if (!Notifications || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync?.(REST_CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance?.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      sound: 'default',
    }).catch(() => {});
  }
}

// Show notifications in the foreground if permission was granted earlier
configureHandler();

/**
 * Request notification permissions. Call this from a user action
 * (e.g. enabling reminders), not on app launch.
 */
export async function requestPermissions(): Promise<boolean> {
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;

    configureHandler();
    return true;
  } catch (e) {
    console.error('Failed to request notification permissions:', e);
    return false;
  }
}

export async function isNotificationsAvailable(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

// ───────────────────────────────────────────────────────
// Workout reminders
// ───────────────────────────────────────────────────────

/** Cancel only the reminders this module scheduled */
export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;
  try {
    const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    await AsyncStorage.removeItem(REMINDER_IDS_KEY);
  } catch (e) {
    console.error('Failed to cancel reminders:', e);
  }
}

/**
 * Schedule one reminder per day for the next week at hour:minute.
 * Today is skipped if the user already trained (or the time has passed).
 * Call again on app start and after each workout to keep the window rolling.
 */
export async function scheduleWorkoutReminders(
  hour: number,
  minute: number,
  lastWorkoutDate?: string | null
): Promise<void> {
  if (!Notifications) return;
  if (!(await isNotificationsAvailable())) return;

  await cancelAllReminders();

  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const ids: string[] = [];

  try {
    for (let offset = 0; offset < REMINDER_DAYS_AHEAD; offset++) {
      const day = addDays(now, offset);
      const fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0);
      if (fireAt <= now) continue;
      if (offset === 0 && lastWorkoutDate === todayStr) continue;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🏋️ Time to Train!',
          body: "Don't break your streak! Your muscles are waiting.",
          sound: true,
        },
        trigger: { type: 'date', date: fireAt },
      });
      ids.push(id);
    }
    await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to schedule reminders:', e);
  }
}

// ───────────────────────────────────────────────────────
// Rest timer
// ───────────────────────────────────────────────────────

let restNotificationId: string | null = null;

export async function scheduleRestTimerNotification(seconds: number): Promise<void> {
  if (!Notifications || seconds <= 0) return;
  await cancelRestTimerNotification();
  if (!(await isNotificationsAvailable())) return;

  try {
    restNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest over 💪',
        body: 'Time for your next set.',
        sound: true,
      },
      trigger: {
        type: 'timeInterval',
        seconds: Math.round(seconds),
        repeats: false,
        channelId: REST_CHANNEL_ID,
      },
    });
  } catch (e) {
    console.error('Failed to schedule rest timer notification:', e);
  }
}

export async function cancelRestTimerNotification(): Promise<void> {
  if (!Notifications || !restNotificationId) return;
  const id = restNotificationId;
  restNotificationId = null;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

/** Send an immediate local notification */
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}
