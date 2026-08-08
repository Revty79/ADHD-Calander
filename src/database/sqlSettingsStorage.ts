import { SettingsStorage, StoredSetting } from "./settingsStorage";
import { SqlExecutor } from "./sql";

type SettingRow = {
  key: string;
  value: string;
  updatedAt: string;
};

export class SqlSettingsStorage implements SettingsStorage {
  constructor(private readonly database: SqlExecutor) {}

  async getSetting(key: string): Promise<StoredSetting | null> {
    const row = await this.database.getFirstAsync<SettingRow>(
      `
        SELECT key, value, updated_at AS updatedAt
        FROM app_settings
        WHERE key = ?
        LIMIT 1;
      `,
      key
    );

    return row;
  }

  async setSetting(setting: StoredSetting): Promise<void> {
    await this.database.runAsync(
      `
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at;
      `,
      setting.key,
      setting.value,
      setting.updatedAt
    );
  }
}
