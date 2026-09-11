export interface PasswordRuleResult {
  rule: string;
  satisfied: boolean;
}

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'motdepasse',
  'motdepasse123',
  'azerty',
  'azerty123',
  'qwerty',
  'qwerty123',
  '12345678',
  '123456789',
  '1234567890',
  'admin123',
  'administrator',
  'welcome1',
  'iloveyou',
  'abc12345',
  'essai123',
  'test1234',
]);

const SEQUENTIAL_PATTERN =
  /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|efgh|fghi|ghij|azerty|qwerty)/i;

export function evaluatePasswordRules(password: string, minLength: number): PasswordRuleResult[] {
  return [
    { rule: 'length', satisfied: password.length >= minLength },
    { rule: 'uppercase', satisfied: /[A-Z]/.test(password) },
    { rule: 'lowercase', satisfied: /[a-z]/.test(password) },
    { rule: 'digit', satisfied: /\d/.test(password) },
    { rule: 'special', satisfied: /[^A-Za-z0-9]/.test(password) },
    { rule: 'notCommon', satisfied: !isCommonOrGuessable(password) },
  ];
}

export function isCommonOrGuessable(password: string): boolean {
  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) return true;
  if (SEQUENTIAL_PATTERN.test(lowered)) return true;
  if (/^(.)\1+$/.test(password)) return true;
  return false;
}

export function validatePasswordStrength(
  password: string,
  minLength: number,
): { valid: boolean; unmetRules: string[] } {
  const results = evaluatePasswordRules(password, minLength);
  const unmetRules = results.filter((entry) => !entry.satisfied).map((entry) => entry.rule);
  return { valid: unmetRules.length === 0, unmetRules };
}

export const PASSWORD_RULE_LABELS: Record<string, string> = {
  length: 'longueur minimale insuffisante',
  uppercase: 'au moins une lettre majuscule requise',
  lowercase: 'au moins une lettre minuscule requise',
  digit: 'au moins un chiffre requis',
  special: 'au moins un caractère spécial requis',
  notCommon: 'mot de passe trop courant ou facilement devinable',
};

export function describeUnmetRules(unmetRules: string[]): string {
  return unmetRules.map((rule) => PASSWORD_RULE_LABELS[rule] ?? rule).join(' ; ');
}
