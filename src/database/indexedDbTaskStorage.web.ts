import {
  calendarEventKinds,
  CalendarEvent,
  CalendarEventKind
} from "../types/calendarEvent";
import { taskStatuses, Task, TaskStatus } from "../types/task";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../utils/dates";
import { CalendarEventStorage } from "./calendarEventStorage";
import { TaskStorage } from "./taskStorage";

const WEB_DATABASE_NAME = "adhd-calendar-web";
const WEB_DATABASE_VERSION = 2;
const TASK_STORE_NAME = "tasks";
const EVENT_STORE_NAME = "calendarEvents";

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
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
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
      )
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

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !isNullableString(value.description) ||
    typeof status !== "string" ||
    !isTaskStatus(status) ||
    !isValidStoredDate(scheduledDate) ||
    !isValidStoredTime(scheduledTime) ||
    !isValidStoredDuration(estimatedDurationMinutes) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isNullableString(value.completedAt) ||
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
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt: value.completedAt,
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
