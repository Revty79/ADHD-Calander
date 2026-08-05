import { SqlExecutor } from "../sql";

export type Migration = {
  version: number;
  name: string;
  up(database: SqlExecutor): Promise<void>;
};
