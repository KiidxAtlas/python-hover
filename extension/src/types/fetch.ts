export interface FetchRequest {
  url: string;
  timeoutMs?: number;
}

export interface FetchResult {
  status: number;
  body: string;
}
