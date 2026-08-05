export function createTaskId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;

  if (randomUuid) {
    return randomUuid.call(globalThis.crypto);
  }

  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);

  return `task_${timestamp}_${randomPart}`;
}
