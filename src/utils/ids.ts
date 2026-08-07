export function createTaskId(): string {
  return createLocalId("task");
}

export function createCalendarEventId(): string {
  return createLocalId("event");
}

export function createRecoverySessionId(): string {
  return createLocalId("recovery_session");
}

export function createRecoveryItemId(): string {
  return createLocalId("recovery_item");
}

function createLocalId(
  prefix: "task" | "event" | "recovery_session" | "recovery_item"
): string {
  const randomUuid = globalThis.crypto?.randomUUID;

  if (randomUuid) {
    return randomUuid.call(globalThis.crypto);
  }

  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);

  return `${prefix}_${timestamp}_${randomPart}`;
}
