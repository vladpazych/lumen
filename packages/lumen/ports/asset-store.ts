/** Driven port — downloads a generated asset and persists it locally */
export type AssetStorePort = {
  save(
    url: string,
    documentUri: string,
    format: string,
  ): Promise<string>;
};
