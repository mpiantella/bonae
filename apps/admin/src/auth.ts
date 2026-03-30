import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { readAdminEnv } from './config';

/** Admin-created users must set a password on first sign-in (NEW_PASSWORD_REQUIRED). */
export type SignInResult =
  | { kind: 'session'; session: CognitoUserSession }
  | {
      kind: 'newPasswordRequired';
      user: CognitoUser;
      /** Pass to `completeNewPassword` (after merging any required-attribute fields). */
      userAttributes: Record<string, string>;
      /** Attribute names Cognito still needs (show inputs and merge into `userAttributes`). */
      requiredAttributes: string[];
    };

function stripNonWritableCognitoAttributes(
  attrs: Record<string, string>,
): Record<string, string> {
  const out = { ...attrs };
  delete out.email_verified;
  delete out.phone_number_verified;
  return out;
}

/**
 * Cognito rejects `RespondToAuthChallenge` if you echo immutable attributes that are
 * already set (e.g. "Cannot modify an already provided email"). Only include `email` /
 * `phone_number` when the NEW_PASSWORD_REQUIRED challenge still required them (user
 * collected in the UI).
 */
function attributesForNewPasswordChallenge(
  attrs: Record<string, string>,
  requiredNamesFromUi: string[],
): Record<string, string> {
  const out = { ...attrs };
  delete out.email_verified;
  delete out.phone_number_verified;
  if (!requiredNamesFromUi.includes('email')) {
    delete out.email;
  }
  if (!requiredNamesFromUi.includes('phone_number')) {
    delete out.phone_number;
  }
  return out;
}

let pool: CognitoUserPool | null = null;

function getPool(): CognitoUserPool {
  if (pool) return pool;
  const env = readAdminEnv();
  if (!env.ok) {
    throw new Error(
      `Missing Cognito configuration: ${env.missing.join(', ')}. See apps/admin/.env.example.`,
    );
  }
  pool = new CognitoUserPool({
    UserPoolId: env.config.userPoolId,
    ClientId: env.config.clientId,
  });
  return pool;
}

export function getCurrentUser(): CognitoUser | null {
  return getPool().getCurrentUser();
}

export function signIn(email: string, password: string): Promise<SignInResult> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve({ kind: 'session', session }),
      onFailure: (err) => reject(err),
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        const attrs = stripNonWritableCognitoAttributes(
          userAttributes as Record<string, string>,
        );
        const required = Array.isArray(requiredAttributes) ? requiredAttributes : [];
        resolve({
          kind: 'newPasswordRequired',
          user,
          userAttributes: attrs,
          requiredAttributes: required,
        });
      },
    });
  });
}

/**
 * Finish first-time password setup after `signIn` returned `newPasswordRequired`.
 * @param requiredNamesFromUi — `requiredAttributes` that were still empty and collected
 *   in the form (e.g. `nprRequiredNames` in App). Used to avoid sending `email` / `phone_number`
 *   when Cognito already set them.
 */
export function completeNewPassword(
  user: CognitoUser,
  newPassword: string,
  userAttributes: Record<string, string>,
  requiredNamesFromUi: string[],
): Promise<CognitoUserSession> {
  const payload = attributesForNewPasswordChallenge(userAttributes, requiredNamesFromUi);
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(newPassword, payload, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  const u = getPool().getCurrentUser();
  if (u) u.signOut();
}

export function getSession(): Promise<CognitoUserSession | null> {
  const user = getPool().getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(session);
    });
  });
}

/** ID token includes `cognito:groups` (access token does not). Required for admin checks. */
export function getIdToken(session: CognitoUserSession): string {
  return session.getIdToken().getJwtToken();
}
