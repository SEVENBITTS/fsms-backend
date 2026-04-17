export class PlatformValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "PLATFORM_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "PlatformValidationError";
  }
}

export class PlatformNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "PLATFORM_NOT_FOUND";

  constructor(platformId: string) {
    super(`Platform not found: ${platformId}`);
    this.name = "PlatformNotFoundError";
  }
}

export class MaintenanceScheduleNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MAINTENANCE_SCHEDULE_NOT_FOUND";

  constructor(scheduleId: string) {
    super(`Maintenance schedule not found: ${scheduleId}`);
    this.name = "MaintenanceScheduleNotFoundError";
  }
}
