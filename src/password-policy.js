// Use one policy for registration, password recovery and password changes.
export const MIN_PASSWORD_LENGTH = 15;

export function isPasswordLongEnough(password) {
  return String(password || '').length >= MIN_PASSWORD_LENGTH;
}
