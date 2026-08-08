import {
  calendarEventKinds,
  CalendarEvent,
  CalendarEventKind
} from "../types/calendarEvent";
import {
  recoveryDecisionTypes,
  RecoveryDecisionType,
  RecoveryItem,
  recoveryItemStatuses,
  RecoveryItemStatus,
  RecoverySession,
  recoverySessionStatuses,
  RecoverySessionStatus
} from "../types/recovery";
import { isReminderOffsetMinutes } from "../notifications/reminderRules";
import { taskStatuses, Task, TaskStatus } from "../types/task";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../utils/dates";
import { CalendarEventStorage } from "./calendarEventStorage";
import { RecoveryDecisionMutation, RecoveryStorage } from "./recoveryStorage";
import { SettingsStorage, StoredSetting } from "./settingsStorage";
import { TaskStorage } from "./taskStorage";

const WEB_DATABASE_NAME = "adhd-calendar-web";
const WEB_DATABASE_VERSION = 5;
const TASK_STORE_NAME = "tasks";
const EVENT_STORE_NAME = "calendarEvents";
const RECOVERY_SESSION_STORE_NAME = "recoverySessions";
const RECOVERY_ITEM_STORE_NAME = "recoveryItems";
const SETTINGS_STORE_NAME = "appSettings";

type IndexedDbFactory = Pick<IDBFactory, "open">;

type OpenIndexedDbStorageOptions = {
  databaseName?: string;
  indexedDB?: IndexedDbFactory;
  keyRange?: Pick<typeof IDBKeyRange, "bound">;
};

type StoredTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  estimatedDurationMinutes?: number | null;
  deadlineDate?: Task["deadlineDate"];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  reminderOffsetMinutes?: Task["reminderOffsetMinutes"];
  deletedAt: string | null;
};

type StoredCalendarEvent = {
  id: string;
  title: string;
  kind: CalendarEventKind;
  date: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  reminderOffsetMinutes?: CalendarEvent["reminderOffsetMinutes"];
  createdAt: string;
  updatedAt: string;
};

type StoredRecoverySession = {
  id: string;
  sourceDate: string;
  status: RecoverySessionStatus;
  startedAt: string;
  completedAt: string | null;
};

type StoredRecoveryItem = {
  id: string;
  sessionId: string;
  taskId: string;
  originalTitle: string;
  originalStatus: TaskStatus;
  originalScheduledDate: string;
  originalScheduledTime: string | null;
  originalEstimatedDurationMinutes: number | null;
  originalReminderOffsetMinutes?: RecoveryItem["originalReminderOffsetMinutes"];
  status: RecoveryItemStatus;
  decision: RecoveryDecisionType | null;
  note: string | null;
  rescheduledDate: string | null;
  rescheduledTime: string | null;
  createdTaskIds: string[];
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class WebStorageInitializationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "WebStorageInitializationError";
    this.cause = cause;
  }
}

export class WebStorageDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebStorageDataError";
  }
}

export async function openIndexedDbStorages(
  options: OpenIndexedDbStorageOptions = {}
): Promise<{
  taskStorage: TaskStorage;
  calendarEventStorage: CalendarEventStorage;
  recoveryStorage: RecoveryStorage;
  settingsStorage: SettingsStorage;
}> {
  const indexedDbFactory = options.indexedDB ?? globalThis.indexedDB;

  if (!indexedDbFactory) {
    throw new WebStorageInitializationError(
      "IndexedDB is not available in this browser.",
      null
    );
  }

  try {
    const database = await openDatabase(
      indexedDbFactory,
      options.databaseName ?? WEB_DATABASE_NAME
    );

    return {
      taskStorage: new IndexedDbTaskStorage(database),
      calendarEventStorage: new IndexedDbCalendarEventStorage(
        database,
        options.keyRange ?? globalThis.IDBKeyRange
      ),
      recoveryStorage: new IndexedDbRecoveryStorage(database),
      settingsStorage: new IndexedDbSettingsStorage(database)
    };
  } catch (error) {
    if (error instanceof WebStorageInitializationError) {
      throw error;
    }

    throw new WebStorageInitializationError(
      "Unable to open browser calendar storage.",
      error
    );
  }
}

export async function openIndexedDbTaskStorage(
  options: OpenIndexedDbStorageOptions = {}
): Promise<TaskStorage> {
  return (await openIndexedDbStorages(options)).taskStorage;
}

export async function openIndexedDbCalendarEventStorage(
  options: OpenIndexedDbStorageOptions = {}
): Promise<CalendarEventStorage> {
  return (await openIndexedDbStorages(options)).calendarEventStorage;
}

export async function openIndexedDbRecoveryStorage(
  options: OpenIndexedDbStorageOptions = {}
): Promise<RecoveryStorage> {
  return (await openIndexedDbStorages(options)).recoveryStorage;
}

export async function openIndexedDbSettingsStorage(
  options: OpenIndexedDbStorageOptions = {}
): Promise<SettingsStorage> {
  return (await openIndexedDbStorages(options)).settingsStorage;
}

export function serializeTaskForWeb(task: Task): StoredTask {
  return { ...task };
}

export function deserializeTaskFromWeb(value: unknown): Task {
  if (!isRecord(value)) {
    throw new WebStorageDataError("Stored task data is not an object.");
  }

  const status = value.status;
  const scheduledDate = value.scheduledDate;
  const scheduledTime = value.scheduledTime;
  const estimatedDurationMinutes = value.estimatedDurationMinutes ?? null;
  const deadlineDate = value.deadlineDate ?? null;
  const completedAt = value.completedAt ?? null;
  const reminderOffsetMinutes = value.reminderOffsetMinutes ?? null;

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !isNullableString(value.description) ||
    typeof status !== "string" ||
    !isTaskStatus(status) ||
    !isValidStoredDate(scheduledDate) ||
    !isValidStoredTime(scheduledTime) ||
    !isValidStoredDuration(estimatedDurationMinutes) ||
    !isValidStoredDate(deadlineDate) ||
    !isValidStoredReminderOffset(reminderOffsetMinutes) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isNullableString(completedAt) ||
    !isNullableString(value.deletedAt)
  ) {
    throw new WebStorageDataError("Stored task data has an invalid shape.");
  }

  if (scheduledTime !== null && scheduledDate === null) {
    throw new WebStorageDataError("Stored task time requires a scheduled date.");
  }

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    status,
    scheduledDate,
    scheduledTime,
    estimatedDurationMinutes,
    deadlineDate,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt,
    reminderOffsetMinutes,
    deletedAt: value.deletedAt
  };
}

export function serializeCalendarEventForWeb(event: CalendarEvent): StoredCalendarEvent {
  return { ...event };
}

export function deserializeCalendarEventFromWeb(value: unknown): CalendarEvent {
  if (!isRecord(value)) {
    throw new WebStorageDataError("Stored event data is not an object.");
  }

  const kind = value.kind;
  const date = value.date;
  const startTime = value.startTime;
  const endTime = value.endTime;
  const durationMinutes = value.durationMinutes;
  const reminderOffsetMinutes = value.reminderOffsetMinutes ?? null;

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof kind !== "string" ||
    !isCalendarEventKind(kind) ||
    typeof date !== "string" ||
    normalizeLocalDateInput(date) !== date ||
    typeof startTime !== "string" ||
    normalizeOptionalTime(startTime) !== startTime ||
    !isValidStoredTime(endTime) ||
    !isValidStoredDuration(durationMinutes) ||
    !isValidStoredReminderOffset(reminderOffsetMinutes) ||
    !isNullableString(value.notes) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new WebStorageDataError("Stored event data has an invalid shape.");
  }

  if (endTime !== null && durationMinutes !== null) {
    throw new WebStorageDataError(
      "Stored event data cannot have both an end time and duration."
    );
  }

  return {
    id: value.id,
    title: value.title,
    kind,
    date,
    startTime,
    endTime,
    durationMinutes,
    notes: value.notes,
    reminderOffsetMinutes,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

export function serializeRecoverySessionForWeb(
  session: RecoverySession
): StoredRecoverySession {
  return {
    id: session.id,
    sourceDate: session.sourceDate,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt
  };
}

export function deserializeRecoverySessionFromWeb(
  value: unknown
): Omit<RecoverySession, "items"> {
  if (!isRecord(value)) {
    throw new WebStorageDataError("Stored recovery session data is not an object.");
  }

  const sourceDate = value.sourceDate;
  const status = value.status;

  if (
    typeof value.id !== "string" ||
    typeof sourceDate !== "string" ||
    normalizeLocalDateInput(sourceDate) !== sourceDate ||
    typeof status !== "string" ||
    !isRecoverySessionStatus(status) ||
    typeof value.startedAt !== "string" ||
    !isNullableString(value.completedAt)
  ) {
    throw new WebStorageDataError("Stored recovery session data has an invalid shape.");
  }

  if (
    (status === "active" && value.completedAt !== null) ||
    (status === "completed" && value.completedAt === null)
  ) {
    throw new WebStorageDataError(
      "Stored recovery session status does not match its completion time."
    );
  }

  return {
    id: value.id,
    sourceDate,
    status,
    startedAt: value.startedAt,
    completedAt: value.completedAt
  };
}

export function serializeRecoveryItemForWeb(item: RecoveryItem): StoredRecoveryItem {
  return { ...item, createdTaskIds: [...item.createdTaskIds] };
}

export function deserializeRecoveryItemFromWeb(value: unknown): RecoveryItem {
  if (!isRecord(value)) {
    throw new WebStorageDataError("Stored recovery item data is not an object.");
  }

  const originalScheduledDate = value.originalScheduledDate;
  const originalStatus = value.originalStatus;
  const originalScheduledTime = value.originalScheduledTime;
  const originalEstimatedDurationMinutes = value.originalEstimatedDurationMinutes;
  const originalReminderOffsetMinutes = value.originalReminderOffsetMinutes ?? null;
  const status = value.status;
  const decision = value.decision;
  const rescheduledDate = value.rescheduledDate;
  const rescheduledTime = value.rescheduledTime;

  if (
    typeof value.id !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.taskId !== "string" ||
    typeof value.originalTitle !== "string" ||
    typeof originalStatus !== "string" ||
    !isTaskStatus(originalStatus) ||
    typeof originalScheduledDate !== "string" ||
    normalizeLocalDateInput(originalScheduledDate) !== originalScheduledDate ||
    !isValidStoredTime(originalScheduledTime) ||
    !isValidStoredDuration(originalEstimatedDurationMinutes) ||
    !isValidStoredReminderOffset(originalReminderOffsetMinutes) ||
    typeof status !== "string" ||
    !isRecoveryItemStatus(status) ||
    !isRecoveryDecision(decision) ||
    !isNullableString(value.note) ||
    !isValidStoredDate(rescheduledDate) ||
    !isValidStoredTime(rescheduledTime) ||
    !isStringArray(value.createdTaskIds) ||
    !isNullableString(value.reviewedAt) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new WebStorageDataError("Stored recovery item data has an invalid shape.");
  }

  if (rescheduledTime !== null && rescheduledDate === null) {
    throw new WebStorageDataError("Stored recovery time requires a recovery date.");
  }

  if (
    (status === "pending" && decision !== null && decision !== "skip") ||
    (status === "resolved" && (decision === null || decision === "skip"))
  ) {
    throw new WebStorageDataError(
      "Stored recovery item status does not match its decision."
    );
  }

  return {
    id: value.id,
    sessionId: value.sessionId,
    taskId: value.taskId,
    originalTitle: value.originalTitle,
    originalStatus,
    originalScheduledDate,
    originalScheduledTime,
    originalEstimatedDurationMinutes,
    originalReminderOffsetMinutes,
    status,
    decision,
    note: value.note,
    rescheduledDate,
    rescheduledTime,
    createdTaskIds: [...value.createdTaskIds],
    reviewedAt: value.reviewedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

class IndexedDbTaskStorage implements TaskStorage {
  constructor(private readonly database: IDBDatabase) {}

  async insertTask(task: Task): Promise<void> {
    const transaction = this.database.transaction(TASK_STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);

    try {
      await requestResult(
        transaction.objectStore(TASK_STORE_NAME).add(serializeTaskForWeb(task))
      );
    } finally {
      await completion;
    }
  }

  async getTasksForDate(scheduledDate: string): Promise<Task[]> {
    const transaction = this.database.transaction(TASK_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction
        .objectStore(TASK_STORE_NAME)
        .index("scheduledDate")
        .getAll(scheduledDate)
    );

    await completion;

    return records.map(deserializeTaskFromWeb);
  }

  async getAllTasks(): Promise<Task[]> {
    const transaction = this.database.transaction(TASK_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction.objectStore(TASK_STORE_NAME).getAll()
    );

    await completion;

    return records.map(deserializeTaskFromWeb);
  }

  async getTaskById(id: string): Promise<Task | null> {
    const transaction = this.database.transaction(TASK_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const record = await requestResult(transaction.objectStore(TASK_STORE_NAME).get(id));

    await completion;

    return record === undefined ? null : deserializeTaskFromWeb(record);
  }

  async updateTask(task: Task): Promise<boolean> {
    const transaction = this.database.transaction(TASK_STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    const taskStore = transaction.objectStore(TASK_STORE_NAME);
    const existingRecord = await requestResult(taskStore.get(task.id));

    if (existingRecord === undefined) {
      await completion;
      return false;
    }

    await requestResult(taskStore.put(serializeTaskForWeb(task)));
    await completion;

    return true;
  }
}

class IndexedDbCalendarEventStorage implements CalendarEventStorage {
  constructor(
    private readonly database: IDBDatabase,
    private readonly keyRange: Pick<typeof IDBKeyRange, "bound"> | undefined
  ) {}

  async insertEvent(event: CalendarEvent): Promise<void> {
    const transaction = this.database.transaction(EVENT_STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);

    try {
      await requestResult(
        transaction.objectStore(EVENT_STORE_NAME).add(serializeCalendarEventForWeb(event))
      );
    } finally {
      await completion;
    }
  }

  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const transaction = this.database.transaction(EVENT_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction.objectStore(EVENT_STORE_NAME).index("date").getAll(date)
    );

    await completion;

    return records.map(deserializeCalendarEventFromWeb);
  }

  async getEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    if (!this.keyRange) {
      throw new WebStorageInitializationError(
        "IndexedDB key ranges are not available in this browser.",
        null
      );
    }

    const transaction = this.database.transaction(EVENT_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction
        .objectStore(EVENT_STORE_NAME)
        .index("date")
        .getAll(this.keyRange.bound(startDate, endDate))
    );

    await completion;

    return records.map(deserializeCalendarEventFromWeb);
  }

  async getAllEvents(): Promise<CalendarEvent[]> {
    const transaction = this.database.transaction(EVENT_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction.objectStore(EVENT_STORE_NAME).getAll()
    );

    await completion;

    return records.map(deserializeCalendarEventFromWeb);
  }
}

class IndexedDbSettingsStorage implements SettingsStorage {
  constructor(private readonly database: IDBDatabase) {}

  async getSetting(key: string): Promise<StoredSetting | null> {
    const transaction = this.database.transaction(SETTINGS_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const record = await requestResult(
      transaction.objectStore(SETTINGS_STORE_NAME).get(key)
    );

    await completion;

    if (record === undefined || !isStoredSetting(record)) {
      return null;
    }

    return record;
  }

  async setSetting(setting: StoredSetting): Promise<void> {
    const transaction = this.database.transaction(SETTINGS_STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);

    await requestResult(transaction.objectStore(SETTINGS_STORE_NAME).put(setting));
    await completion;
  }
}

class IndexedDbRecoveryStorage implements RecoveryStorage {
  constructor(private readonly database: IDBDatabase) {}

  async insertSession(session: RecoverySession): Promise<void> {
    const transaction = this.database.transaction(
      [RECOVERY_SESSION_STORE_NAME, RECOVERY_ITEM_STORE_NAME],
      "readwrite"
    );
    const completion = transactionComplete(transaction);
    const sessionStore = transaction.objectStore(RECOVERY_SESSION_STORE_NAME);
    const itemStore = transaction.objectStore(RECOVERY_ITEM_STORE_NAME);

    try {
      const activeSession = await requestResult(
        sessionStore.index("status").get("active")
      );

      if (activeSession !== undefined) {
        throw new Error("An active recovery session already exists.");
      }

      await requestResult(sessionStore.add(serializeRecoverySessionForWeb(session)));

      for (const item of session.items) {
        await requestResult(itemStore.add(serializeRecoveryItemForWeb(item)));
      }
    } catch (error) {
      abortTransaction(transaction);
      await ignoreTransactionResult(completion);
      throw error;
    }

    await completion;
  }

  async getActiveSession(): Promise<RecoverySession | null> {
    const transaction = this.database.transaction(
      RECOVERY_SESSION_STORE_NAME,
      "readonly"
    );
    const completion = transactionComplete(transaction);
    const record = await requestResult(
      transaction.objectStore(RECOVERY_SESSION_STORE_NAME).index("status").get("active")
    );

    await completion;

    if (record === undefined) {
      return null;
    }

    return this.loadSession(deserializeRecoverySessionFromWeb(record));
  }

  async getLatestCompletedSession(): Promise<RecoverySession | null> {
    const transaction = this.database.transaction(
      RECOVERY_SESSION_STORE_NAME,
      "readonly"
    );
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction
        .objectStore(RECOVERY_SESSION_STORE_NAME)
        .index("status")
        .getAll("completed")
    );

    await completion;

    const session = records
      .map(deserializeRecoverySessionFromWeb)
      .sort((left, right) =>
        (right.completedAt ?? "").localeCompare(left.completedAt ?? "")
      )[0];

    return session ? this.loadSession(session) : null;
  }

  async getSessionsForDate(sourceDate: string): Promise<RecoverySession[]> {
    const transaction = this.database.transaction(
      RECOVERY_SESSION_STORE_NAME,
      "readonly"
    );
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction.objectStore(RECOVERY_SESSION_STORE_NAME).getAll()
    );

    await completion;

    const sessions = records
      .map(deserializeRecoverySessionFromWeb)
      .filter((session) => session.sourceDate === sourceDate)
      .sort(
        (left, right) =>
          left.startedAt.localeCompare(right.startedAt) || left.id.localeCompare(right.id)
      );

    return Promise.all(sessions.map((session) => this.loadSession(session)));
  }

  async saveDecision(mutation: RecoveryDecisionMutation): Promise<void> {
    const transaction = this.database.transaction(
      [TASK_STORE_NAME, RECOVERY_ITEM_STORE_NAME],
      "readwrite"
    );
    const completion = transactionComplete(transaction);
    const taskStore = transaction.objectStore(TASK_STORE_NAME);
    const itemStore = transaction.objectStore(RECOVERY_ITEM_STORE_NAME);

    try {
      for (const task of mutation.updatedTasks) {
        const existingTask = await requestResult(taskStore.get(task.id));

        if (existingTask === undefined) {
          throw new Error(`Task ${task.id} could not be updated.`);
        }

        await requestResult(taskStore.put(serializeTaskForWeb(task)));
      }

      for (const task of mutation.createdTasks) {
        await requestResult(taskStore.add(serializeTaskForWeb(task)));
      }

      const existingItem = await requestResult(itemStore.get(mutation.item.id));

      if (existingItem === undefined) {
        throw new Error(`Recovery item ${mutation.item.id} could not be updated.`);
      }

      await requestResult(itemStore.put(serializeRecoveryItemForWeb(mutation.item)));
    } catch (error) {
      abortTransaction(transaction);
      await ignoreTransactionResult(completion);
      throw error;
    }

    await completion;
  }

  async updateSession(session: RecoverySession): Promise<void> {
    const transaction = this.database.transaction(
      RECOVERY_SESSION_STORE_NAME,
      "readwrite"
    );
    const completion = transactionComplete(transaction);
    const sessionStore = transaction.objectStore(RECOVERY_SESSION_STORE_NAME);

    try {
      const existingSession = await requestResult(sessionStore.get(session.id));

      if (existingSession === undefined) {
        throw new Error(`Recovery session ${session.id} could not be updated.`);
      }

      await requestResult(sessionStore.put(serializeRecoverySessionForWeb(session)));
    } catch (error) {
      abortTransaction(transaction);
      await ignoreTransactionResult(completion);
      throw error;
    }

    await completion;
  }

  private async loadSession(
    session: Omit<RecoverySession, "items">
  ): Promise<RecoverySession> {
    const transaction = this.database.transaction(RECOVERY_ITEM_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction
        .objectStore(RECOVERY_ITEM_STORE_NAME)
        .index("sessionId")
        .getAll(session.id)
    );

    await completion;

    return {
      ...session,
      items: records
        .map(deserializeRecoveryItemFromWeb)
        .sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) ||
            left.id.localeCompare(right.id)
        )
    };
  }
}

function openDatabase(
  indexedDbFactory: IndexedDbFactory,
  databaseName: string
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;

    try {
      request = indexedDbFactory.open(databaseName, WEB_DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(TASK_STORE_NAME)) {
        const taskStore = database.createObjectStore(TASK_STORE_NAME, {
          keyPath: "id"
        });
        taskStore.createIndex("scheduledDate", "scheduledDate", { unique: false });
        taskStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(EVENT_STORE_NAME)) {
        const eventStore = database.createObjectStore(EVENT_STORE_NAME, {
          keyPath: "id"
        });
        eventStore.createIndex("date", "date", { unique: false });
        eventStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(RECOVERY_SESSION_STORE_NAME)) {
        const sessionStore = database.createObjectStore(RECOVERY_SESSION_STORE_NAME, {
          keyPath: "id"
        });
        sessionStore.createIndex("status", "status", { unique: false });
        sessionStore.createIndex("completedAt", "completedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(RECOVERY_ITEM_STORE_NAME)) {
        const itemStore = database.createObjectStore(RECOVERY_ITEM_STORE_NAME, {
          keyPath: "id"
        });
        itemStore.createIndex("sessionId", "sessionId", { unique: false });
        itemStore.createIndex("status", "status", { unique: false });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
    request.onblocked = () => reject(new Error("IndexedDB upgrade was blocked."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function abortTransaction(transaction: IDBTransaction): void {
  try {
    transaction.abort();
  } catch {}
}

async function ignoreTransactionResult(completion: Promise<void>): Promise<void> {
  try {
    await completion;
  } catch {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.some((status) => status === value);
}

function isCalendarEventKind(value: string): value is CalendarEventKind {
  return calendarEventKinds.some((kind) => kind === value);
}

function isRecoverySessionStatus(value: string): value is RecoverySessionStatus {
  return recoverySessionStatuses.some((status) => status === value);
}

function isRecoveryItemStatus(value: string): value is RecoveryItemStatus {
  return recoveryItemStatuses.some((status) => status === value);
}

function isRecoveryDecision(value: unknown): value is RecoveryDecisionType | null {
  return (
    value === null ||
    (typeof value === "string" &&
      recoveryDecisionTypes.some((decision) => decision === value))
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item): item is string => typeof item === "string")
  );
}

function isValidStoredDate(value: unknown): value is Task["scheduledDate"] {
  return (
    value === null ||
    (typeof value === "string" && normalizeLocalDateInput(value) === value)
  );
}

function isValidStoredTime(value: unknown): value is Task["scheduledTime"] {
  return (
    value === null ||
    (typeof value === "string" && normalizeOptionalTime(value) === value)
  );
}

function isValidStoredDuration(value: unknown): value is number | null {
  return (
    value === null || (typeof value === "number" && Number.isInteger(value) && value > 0)
  );
}

function isValidStoredReminderOffset(
  value: unknown
): value is Task["reminderOffsetMinutes"] {
  return value === null || isReminderOffsetMinutes(value);
}

function isStoredSetting(value: unknown): value is StoredSetting {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.value === "string" &&
    typeof value.updatedAt === "string"
  );
}
