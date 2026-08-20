export function requiresTwoFactorForRole(roleName?: string | null): boolean {
  return Boolean(roleName && roleName !== 'Labour');
}

export function requiresTwoFactor(
  roleName?: string | null,
  totpSecret?: string | null
): boolean {
  return requiresTwoFactorForRole(roleName) && !!totpSecret;
}
