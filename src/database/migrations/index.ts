import { createTasksMigration } from "./001_create_tasks";
import { Migration } from "./types";

export const migrations: Migration[] = [createTasksMigration];
