import type { MtConfig } from "@ipc/mt";

export interface MtHostState {
  mt: MtConfig;
  version: string;
  configVersion: number;
}

export interface MtConfigSaved {
  mt: MtConfig;
}

export class MtApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MtApiError";
  }
}

export async function fetchMtConfig(): Promise<MtHostState> {
  return await request<MtHostState>("/mt/config");
}

export async function saveMtConfig(
  patch: Partial<MtConfig>,
): Promise<MtConfigSaved> {
  return await request<MtConfigSaved>("/mt/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw new MtApiError(
      `MT request failed: ${url} (${response.status})`,
      response.status,
    );
  }
  return (await response.json()) as T;
}
