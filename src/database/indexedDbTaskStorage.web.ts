import { taskStatuses, Task, TaskStatus } from "../types/task";
import { normalizeLocalDateInput, normalizeOptionalTime } from "../utils/dates";
import { TaskStorage } from "./taskStorage";

const WEB_DATABASE_NAME = "adhd-calendar-web";
const WEB_DATABASE_VERSION = 1;
const TASK_STORE_NAME = "tasks";

type IndexedDbFactory = Pick<IDBFactory, "open">;

type OpenIndexedDbTaskStorageOptions = {
  databaseName?: string;
  indexedDB?: IndexedDbFactory;
};

type StoredTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  scheduledDate: string;
  scheduledTime: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
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

export async function openIndexedDbTaskStorage(
  options: OpenIndexedDbTaskStorageOptions = {}
): Promise<TaskStorage> {
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

    return new IndexedDbTaskStorage(database);
  } catch (error) {
    if (error instanceof WebStorageInitializationError) {
      throw error;
    }

    throw new WebStorageInitializationError(
      "Unable to open browser task storage.",
      error
    );
  }
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

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !isNullableString(value.description) ||
    typeof status !== "string" ||
    !isTaskStatus(status) ||
    typeof scheduledDate !== "string" ||
    normalizeLocalDateInput(scheduledDate) !== scheduledDate ||
    !isValidStoredTime(scheduledTime) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isNullableString(value.completedAt) ||
    !isNullableString(value.deletedAt)
  ) {
    throw new WebStorageDataError("Stored task data has an invalid shape.");
  }

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    status,
    scheduledDate,
    scheduledTime,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt: value.completedAt,
    deletedAt: value.deletedAt
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

      if (database.objectStoreNames.contains(TASK_STORE_NAME)) {
        return;
      }

      const taskStore = database.createObjectStore(TASK_STORE_NAME, {
        keyPath: "id"
      });
      taskStore.createIndex("scheduledDate", "scheduledDate", { unique: false });
      taskStore.createIndex("updatedAt", "updatedAt", { unique: false });
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

function isValidStoredTime(value: unknown): value is Task["scheduledTime"] {
  return (
    value === null ||
    (typeof value === "string" && normalizeOptionalTime(value) === value)
  );
}
