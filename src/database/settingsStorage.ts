export type StoredSetting = {
  key: string;
  value: string;
  updatedAt: string;
};

export type SettingsStorage = {
  getSetting(key: string): Promise<StoredSetting | null>;
  setSetting(setting: StoredSetting): Promise<void>;
};
