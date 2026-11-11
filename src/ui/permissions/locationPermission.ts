import { PermissionsAndroid, Platform } from 'react-native';
import { askInContext, type PermissionAskAnswer, type PermissionNeed } from './permissionAsk';

/**
 * Whether the system's location window is about to open. Foreground location on Android is granted when either the fine or the
 * coarse permission is held; the capture asks for both at once, so holding one means no window. Reading the state asks for
 * nothing. Other platforms are not read here (Android first, owner decision R01), so no dialog is put in front of them.
 */
export async function locationNeed(): Promise<PermissionNeed> {
  if (Platform.OS !== 'android') return 'unknown';
  const [fine, coarse] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION),
  ]);
  return fine || coarse ? 'granted' : 'ask';
}

/**
 * The question before the system's location window, for the one moment the person asks for their place ("Koristi gde sam",
 * "U blizini"). `later` means: do not read the position now, and say nothing.
 */
export const askForLocation = (): Promise<PermissionAskAnswer> => askInContext('location', locationNeed);
