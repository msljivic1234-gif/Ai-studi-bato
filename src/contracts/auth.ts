/** Client Auth commands. Session ownership remains with the Auth runtime. */
export type PasswordSignInInput = { email: string; password: string };
export type EmailSignUpInput = PasswordSignInInput & {
  firstName: string;
  lastName: string;
  /** Optional legacy metadata; city is collected in task/work contexts, not required for signup. */
  city?: string;
};
export type PhoneOtpInput = { phone: string };
export type PhoneOtpVerificationInput = PhoneOtpInput & { token: string };
export type AuthAccountScope = { accountId: string; accountRevision: number };

export type AuthClientPort = {
  signInWithPassword(input: PasswordSignInInput): Promise<void>;
  signUp(input: EmailSignUpInput): Promise<{ hasSession: boolean }>;
  resendSignupConfirmation(email: string): Promise<void>;
  sendPhoneOtp(input: PhoneOtpInput): Promise<void>;
  verifyPhoneOtp(input: PhoneOtpVerificationInput): Promise<void>;
  requestPasswordRecovery(email: string): Promise<void>;
  signOutLocal(expected: AuthAccountScope): Promise<void>;
};
