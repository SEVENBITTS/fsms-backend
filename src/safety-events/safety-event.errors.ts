export class SafetyEventValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "SAFETY_EVENT_VALIDATION_FAILED";
}

export class SafetyEventReferenceNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "SAFETY_EVENT_REFERENCE_NOT_FOUND";

  constructor(message: string) {
    super(message);
  }
}

export class SafetyEventNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "SAFETY_EVENT_NOT_FOUND";

  constructor(eventId: string) {
    super(`Safety event not found: ${eventId}`);
  }
}

export class SafetyEventMeetingTriggerNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "SAFETY_EVENT_MEETING_TRIGGER_NOT_FOUND";

  constructor(triggerId: string) {
    super(`Safety event meeting trigger not found: ${triggerId}`);
  }
}

export class SafetyEventAgendaLinkConflictError extends Error {
  readonly statusCode = 409;
  readonly code = "SAFETY_EVENT_AGENDA_LINK_CONFLICT";

  constructor() {
    super("Safety event meeting trigger is already linked to this meeting");
  }
}

export class SafetyEventAgendaLinkNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "SAFETY_EVENT_AGENDA_LINK_NOT_FOUND";

  constructor(agendaLinkId: string) {
    super(`Safety event agenda link not found: ${agendaLinkId}`);
  }
}
