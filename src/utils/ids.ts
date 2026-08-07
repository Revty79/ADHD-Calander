export function createTaskId(): string {
  return createLocalId("task");
}

export function createCalendarEventId(): string {
  return createLocalId("event");
}

function createLocalId(prefix: "task" | "event"): string {
  const randomUuid = globalThis.crypto?.randomUUID;

  if (randomUuid) {
    return randomUuid.call(globalThis.crypto);
  }

  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);

  return `${prefix}_${timestamp}_${randomPart}`;
}
