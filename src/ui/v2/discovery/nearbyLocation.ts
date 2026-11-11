/** Kept lazy even outside native resolution; useNearbyMap declines capture on web before calling it. */
export const loadNearbyLocation = () => import('expo-location');
