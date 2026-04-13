export interface DomainEventPublisher {
  publish<TPayload>(eventName: string, payload: TPayload): Promise<void>;
}