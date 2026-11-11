// Capture and remove a web recovery callback before navigation reads the URL.
// All other startup, routing and application ownership remains with Expo Router.
import './src/bootstrap/passwordRecoveryBootstrap';
import './src/bootstrap/signupConfirmationBootstrap';
// Configure the native exit before Router can auto-hide on navigation readiness.
import './src/bootstrap/entrySplashBootstrap';
import 'expo-router/entry';
