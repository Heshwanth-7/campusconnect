export class HttpError extends Error {
  readonly status: number;
  readonly details?: { code: 'ACCOUNT_LOCKED'; lockedUntil: string };

  constructor(
    status: number,
    message: string,
    details?: { code: 'ACCOUNT_LOCKED'; lockedUntil: string },
  ) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
