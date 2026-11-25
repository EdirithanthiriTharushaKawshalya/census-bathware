export const IMAGE_POLICY = {
  maxUploadBytes: 8 * 1024 * 1024,
  maxPixels: 20_000_000,
  maxEdge: 1600,
  edges: [480, 960, 1600],
  quality: 80,
  signedUrlSeconds: 300,
  browserCacheSeconds: 300,
} as const;

export type ImageVariant = {
  path: string;
  width: number;
  height: number;
  bytes: number;
};
export function validImagePath(path: string) {
  return (
    path.length <= 240 &&
    /^[a-f0-9-]{36}\/(?:[a-f0-9]{64}\/\d{1,4}\.webp|[a-f0-9-]{36}\.(?:jpeg|jpg|png|webp))$/.test(
      path,
    )
  );
}
