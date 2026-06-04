// ═══════════════════════════════════════════════════════
// Notifications — Push notifications via expo-notifications
// ═══════════════════════════════════════════════════════

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let Notifications: any = null;

// Lazy load expo-notifications to prevent crashes if not installed
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('expo-notifications not available');
}

/**
 * Request notification permissions
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

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return true;
  } catch (e) {
    console.error('Failed to request notification permissions:', e);
    return false;
  }
}

/**
 * Schedule a daily workout reminder
 */
export async function scheduleWorkoutReminder(hour: number, minute: number): Promise<string | null> {
  if (!Notifications) return null;

  try {
    // Cancel existing reminders first
    await cancelAllReminders();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏋️ Time to Train!',
        body: "Don't break your streak! Your muscles are waiting.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority?.HIGH,
      },
      trigger: {
        type: 'daily',
        hour,
        minute,
        repeats: true,
      },
    });

    await AsyncStorage.setItem('ironlog_reminder_id', id);
    return id;
  } catch (e) {
    console.error('Failed to schedule reminder:', e);
    return null;
  }
}

/**
 * Send an immediate local notification
 */
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Immediate
    });
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem('ironlog_reminder_id');
  } catch (e) {
    console.error('Failed to cancel reminders:', e);
  }
}

/**
 * Check if notifications are available and permitted
 */
export async function isNotificationsAvailable(): Promise<boolean> {
  if (!Notifications) return false;
  
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}
