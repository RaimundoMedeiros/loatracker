import { ERROR_CODES, type KnownErrorCode } from './errorCodes';

const statDisplayFormatter = new Intl.NumberFormat('pt-BR', {
  useGrouping: false,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const ROSTER_VALIDATION = {
  CHARACTER_NAME_MAX_LENGTH: 16,
  ITEM_LEVEL_MAX: 9999.99,
  ITEM_LEVEL_MIN: 0,
  ITEM_LEVEL_DECIMAL_PLACES: 2,
  COMBAT_POWER_DECIMAL_PLACES: 2,
} as const;

function normalizeStatDisplayValue(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

export function formatStatDisplay(value: unknown, fallback = 'N/A'): string {
  const normalized = normalizeStatDisplayValue(value);
  if (normalized === null) return fallback;
  return statDisplayFormatter.format(normalized);
}

export function formatItemLevelDisplay(value: unknown): string {
  return formatStatDisplay(value, '0');
}

export function formatCombatPowerDisplay(value: unknown): string {
  return formatStatDisplay(value, 'N/A');
}

type DecimalInputOptions = {
  decimalPlaces: number;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
};

export function sanitizeCharacterNameInput(value: unknown): string {
  return String(value ?? '').slice(0, ROSTER_VALIDATION.CHARACTER_NAME_MAX_LENGTH);
}

export function sanitizeDecimalInput(value: unknown, options: DecimalInputOptions): string {
  const raw = String(value ?? '');
  const onlyDigitsAndDot = raw.replace(/[^0-9.]/g, '');

  const firstDotIndex = onlyDigitsAndDot.indexOf('.');
  const normalized = firstDotIndex >= 0
    ? `${onlyDigitsAndDot.slice(0, firstDotIndex + 1)}${onlyDigitsAndDot.slice(firstDotIndex + 1).replace(/\./g, '')}`
    : onlyDigitsAndDot;

  const [integerPart = '', decimalPart = ''] = normalized.split('.');
  const cappedDecimal = decimalPart.slice(0, Math.max(0, options.decimalPlaces));
  const rebuilt = normalized.includes('.') ? `${integerPart}.${cappedDecimal}` : integerPart;

  if (rebuilt === '' && options.allowEmpty) {
    return '';
  }

  if (rebuilt === '.') {
    return options.allowEmpty ? '.' : '';
  }

  const parsed = Number(rebuilt);
  if (!Number.isFinite(parsed)) {
    return options.allowEmpty ? '' : '0';
  }

  if (typeof options.max === 'number' && parsed > options.max) {
    return String(options.max);
  }

  if (typeof options.min === 'number' && parsed < options.min && rebuilt !== '') {
    return String(options.min);
  }

  return rebuilt;
}

type RosterFormValidationInput = {
  name: string;
  characterClass: string;
  itemLevelRaw: string;
  combatPowerRaw: string;
};

export type RosterValidationField = 'name' | 'characterClass' | 'itemLevelRaw' | 'combatPowerRaw';

export type RosterValidationIssue = {
  code: KnownErrorCode;
  message: string;
  field: RosterValidationField;
  severity: 'warning' | 'error';
};

export type RosterValidationResult = {
  isValid: boolean;
  issue: RosterValidationIssue | null;
};

function makeIssue(
  code: KnownErrorCode,
  message: string,
  field: RosterValidationField,
  severity: 'warning' | 'error' = 'warning'
): RosterValidationResult {
  return {
    isValid: false,
    issue: {
      code,
      message,
      field,
      severity,
    },
  };
}

export function validateRosterFormDetailed(input: RosterFormValidationInput): RosterValidationResult {
  const trimmedName = sanitizeCharacterNameInput(input.name).trim();
  if (!trimmedName) {
    return makeIssue(ERROR_CODES.VALIDATION.REQUIRED, 'Character name is required', 'name');
  }

  if (!String(input.characterClass ?? '').trim()) {
    return makeIssue(ERROR_CODES.VALIDATION.REQUIRED, 'Character class is required', 'characterClass');
  }

  const ilvlParsed = Number(input.itemLevelRaw);
  if (!Number.isFinite(ilvlParsed)) {
    return makeIssue(ERROR_CODES.VALIDATION.REQUIRED, 'Item level is required', 'itemLevelRaw');
  }

  if (ilvlParsed <= ROSTER_VALIDATION.ITEM_LEVEL_MIN) {
    return makeIssue(ERROR_CODES.VALIDATION.OUT_OF_RANGE, 'Item level must be greater than zero', 'itemLevelRaw');
  }

  if (ilvlParsed > ROSTER_VALIDATION.ITEM_LEVEL_MAX) {
    return makeIssue(
      ERROR_CODES.VALIDATION.OUT_OF_RANGE,
      `Item level cannot exceed ${ROSTER_VALIDATION.ITEM_LEVEL_MAX}`,
      'itemLevelRaw'
    );
  }

  if (String(input.combatPowerRaw ?? '').trim()) {
    const cpParsed = Number(input.combatPowerRaw);
    if (!Number.isFinite(cpParsed) || cpParsed < 0) {
      return makeIssue(
        ERROR_CODES.VALIDATION.INVALID_FORMAT,
        'Combat power must be a valid positive number',
        'combatPowerRaw'
      );
    }
  }

  return {
    isValid: true,
    issue: null,
  };
}

export function validateRosterForm(input: RosterFormValidationInput): string | null {
  const result = validateRosterFormDetailed(input);
  if (!result.isValid) {
    return result.issue?.message || 'Invalid roster form data';
  }

  return null;
}
