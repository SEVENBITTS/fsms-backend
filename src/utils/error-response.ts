export type ErrorPayload = {
  status: number;
  message: string;
  type: string;
};

export function normalizeError(error: unknown): ErrorPayload {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const httpError = error as {
      status: number;
      message: string;
      type?: string;
    };

    return {
      status: httpError.status,
      message: httpError.message,
      type: httpError.type ?? "http_error",
    };
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const appError = error as {
      statusCode: number;
      message: string;
      code?: string;
      type?: string;
    };

    return {
      status: appError.statusCode,
      message: appError.message,
      type: appError.type ?? appError.code?.toLowerCase() ?? "application_error",
    };
  }

  return {
    status: 500,
    message: error instanceof Error ? error.message : "Unknown error",
    type: "internal_error",
  };
}