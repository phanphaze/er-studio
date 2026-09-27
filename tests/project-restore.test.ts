import { describe, expect, it, vi, afterEach } from "vitest";
import {
  restoreProject,
  rememberProject,
  lastProjectId,
} from "../src/lib/projects/restoreProject";
import { seedGraph } from "../src/store/seed";
const older = {
  id: "older",
  name: "Older",
  revision: 2,
  updatedAt: "2026-09-01",
  entityCount: 4,
  relationshipCount: 2,
};
const newer = { ...older, id: "newer", updatedAt: "2026-09-27" };
function api() {
  return {
    list: vi.fn(async () => [older, newer]),
    open: vi.fn(async (id: string) => ({
      ...(id === older.id ? older : newer),
      graph: { ...seedGraph, name: id },
    })),
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("reopening the active project", () => {
  it("reopens the last opened project even if another was saved more recently", async () => {
    const client = api();
    const result = await restoreProject(client, older.id);
    expect(client.open).toHaveBeenCalledWith(older.id);
    expect(result.current?.graph.name).toBe(older.id);
    expect(result.current?.revision).toBe(2);
  });
  it.each([null, "deleted-project"])(
    "falls back to the latest saved project for preference %s",
    async (id) => {
      expect((await restoreProject(api(), id)).current?.id).toBe(newer.id);
    },
  );
  it("allows the starter model only when there are no saved projects", async () => {
    const client = api();
    client.list.mockResolvedValue([]);
    expect((await restoreProject(client, null)).current).toBeNull();
    expect(client.open).not.toHaveBeenCalled();
  });
  it("surfaces fetch failures instead of replacing the project with a default", async () => {
    const client = api();
    client.open.mockRejectedValue(new Error("Offline"));
    await expect(restoreProject(client, older.id)).rejects.toThrow("Offline");
    client.list.mockRejectedValue(new Error("Storage unavailable"));
    await expect(restoreProject(client, older.id)).rejects.toThrow(
      "Storage unavailable",
    );
  });
  it("persists active project identity across page instances", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    rememberProject("first");
    rememberProject("second");
    expect(lastProjectId()).toBe("second");
  });
  it("tolerates unavailable browser preferences", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    });
    expect(() => rememberProject("project")).not.toThrow();
    expect(lastProjectId()).toBeNull();
  });
});
