export type AdapterErrorCode =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UPSTREAM'
  | 'VALIDATION'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export class AdapterError extends Error {
  public readonly code: AdapterErrorCode;
  public readonly providerId: string;
  public override readonly cause?: unknown;

  constructor(input: { code: AdapterErrorCode; providerId: string; message: string; cause?: unknown }) {
    super(input.message);
    this.name = 'AdapterError';
    this.code = input.code;
    this.providerId = input.providerId;
    this.cause = input.cause;
  }
}

export function mapUnknownError(providerId: string, err: unknown): AdapterError {
  if (err instanceof AdapterError) return err;

  if (err instanceof Error) {
    const message = err.message || 'unknown_error';

    const code: AdapterErrorCode =
      message.toLowerCase().includes('timeout') ? 'TIMEOUT' : ('UNKNOWN' as const);

    return new AdapterError({ code, providerId, message, cause: err });
  }

  return new AdapterError({
    code: 'UNKNOWN',
    providerId,
    message: 'unknown_error',
    cause: err,
  });
}
