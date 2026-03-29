import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { readAdminEnv } from './config';

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

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });
    user.authenticateUser(authDetails, {
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
