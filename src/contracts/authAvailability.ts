/** Availability is a public configuration projection, never Auth authority. */
export type AuthAvailability = {
  emailPassword: boolean;
  emailSignup: boolean;
  phoneOtp: boolean;
  emailConfirmationRequired: boolean;
  // Intersects implemented recovery with an explicitly configured deployment redirect.
  passwordRecovery: boolean;
};

export type AuthAvailabilityPort = {
  read(signal?: AbortSignal): Promise<AuthAvailability>;
};
