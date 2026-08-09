import { Migration } from "./types";

export const taskFunctionalCoreMigration: Migration = {
  version: 6,
  name: "task_functional_core",
  async up(database) {
    await database.execAsync(`
      ALTER TABLE tasks
        ADD COLUMN importance TEXT NOT NULL DEFAULT 'normal'
        CHECK (importance IN ('low', 'normal', 'important'));

      ALTER TABLE tasks
        ADD COLUMN parent_task_id TEXT REFERENCES tasks(id);

      CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
    `);
  }
};
