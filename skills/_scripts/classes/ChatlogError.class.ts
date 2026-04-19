import { ERROR_KIND_LABELS } from '../constants/chatlog-error.constants.ts';
import type { ErrorKind } from '../types/chatlog-error.types.ts';

export class ChatlogError extends Error {
  readonly kind: ErrorKind;

  constructor(kind: ErrorKind, detail: string) {
    super(`${ERROR_KIND_LABELS[kind]}: ${detail}`);
    this.name = 'ChatlogError';
    this.kind = kind;
  }
}
