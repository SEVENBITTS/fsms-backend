export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly type: string = "http_error"
  ) {
    super(message);
  }
}