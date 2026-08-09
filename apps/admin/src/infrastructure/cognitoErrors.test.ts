import { describe, expect, it } from 'vitest';
import { mapConfirmPasswordError, mapForgotPasswordError } from './cognitoErrors.js';
import { validatePassword } from './passwordPolicy.js';

function cognitoError(code: string, message = ''): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe('password reset error mapping', () => {
  it('maps forgot-password Cognito edge cases to Spanish admin guidance', () => {
    expect(
      mapForgotPasswordError(
        cognitoError(
          'InvalidParameterException',
          'Cannot reset password for the user as there is no registered/verified email or phone_number',
        ),
      ),
    ).toBe(
      'El restablecimiento no está disponible porque el correo no está verificado. ' +
        'Contacta a tu administrador — puede verificar tu correo en Cognito para que puedas restablecer la contraseña.',
    );
    expect(mapForgotPasswordError(cognitoError('TooManyRequestsException'))).toBe(
      'Demasiados intentos de restablecimiento. Espera unos minutos e inténtalo de nuevo.',
    );
    expect(mapForgotPasswordError(cognitoError('InvalidParameterException'))).toBe(
      'No se pudo enviar un código para ese correo. Verifica la dirección e inténtalo de nuevo.',
    );
    expect(mapForgotPasswordError(new Error('network failed'))).toBe(
      'No se pudo enviar el código. Verifica el correo e inténtalo de nuevo, o contacta a tu administrador.',
    );
  });

  it('maps confirm-password failures while preserving Cognito policy details', () => {
    const policyMessage =
      'Password did not conform with policy: Password must have uppercase characters';

    expect(mapConfirmPasswordError(cognitoError('CodeMismatchException'))).toBe(
      'El código de verificación es incorrecto. Revisa tu correo e inténtalo de nuevo.',
    );
    expect(mapConfirmPasswordError(cognitoError('ExpiredCodeException'))).toBe(
      'Este código expiró. Vuelve atrás y solicita uno nuevo.',
    );
    expect(mapConfirmPasswordError(cognitoError('InvalidPasswordException', policyMessage))).toBe(
      policyMessage,
    );
    expect(
      mapConfirmPasswordError(
        cognitoError('NotAuthorizedException', 'Invalid verification code provided, please try again.'),
      ),
    ).toBe('Este código es inválido o expiró.');
    expect(mapConfirmPasswordError(cognitoError('LimitExceededException'))).toBe(
      'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    );
    expect(mapConfirmPasswordError(new Error('network failed'))).toBe(
      'No se pudo restablecer la contraseña. Inténtalo de nuevo o contacta a tu administrador.',
    );
  });
});

describe('validatePassword', () => {
  it.each([
    ['', 'La contraseña debe tener al menos 12 caracteres'],
    ['ABCDEFGHIJKL', 'La contraseña debe incluir una letra minúscula'],
    ['abcdefghijkl', 'La contraseña debe incluir una letra mayúscula'],
    ['Abcdefghijkl', 'La contraseña debe incluir un número'],
    ['Abcdefghijk1', null],
  ])('returns the localized password-policy result for %j', (password, expected) => {
    expect(validatePassword(password)).toBe(expected);
  });
});
