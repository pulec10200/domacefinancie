/** Source adapters only import immutable local copies. Remote implementations are future integrations. */
export interface DocumentSourceAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
}
export type GoogleDriveSourceConfiguration = {
  kind: "google_drive";
  accountReference: string;
  folderId: string;
};
export type OneDriveSourceConfiguration = {
  kind: "onedrive";
  accountReference: string;
  folderId: string;
};
export type EmailAttachmentSourceConfiguration = {
  kind: "email";
  accountReference: string;
  folderId: string;
  allowedMimeTypes: string[];
};
export type LocalFolderSourceConfiguration = {
  kind: "local_folder";
  path: string;
};
export type DocumentSourceConfiguration =
  | LocalFolderSourceConfiguration
  | GoogleDriveSourceConfiguration
  | OneDriveSourceConfiguration
  | EmailAttachmentSourceConfiguration;
