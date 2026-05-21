import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CommentHandler } from "@ubiquity-os/plugin-sdk";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import dotenv from "dotenv";
import { runPlugin } from "../src";
import { Env } from "../src/types";
import { Context } from "../src/types/context";
import { isProtectedConfigFile } from "../src/utils/config-protection";
import { server } from "./__mocks__/node";

dotenv.config();
const octokit = new Octokit();

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});

afterAll(() => server.close());

describe("isProtectedConfigFile", () => {
  const defaultPaths = [
    ".ubiquity-os.config.yml",
    ".ubiquity-os.config.yaml",
    "ubiquity-os.config.yml",
    "ubiquity-os.config.yaml",
    ".github/ubiquity-os.config.yml",
    ".github/ubiquity-os.config.yaml",
  ];

  it("Should match exact config paths", () => {
    expect(isProtectedConfigFile(".ubiquity-os.config.yml", defaultPaths)).toBe(true);
    expect(isProtectedConfigFile(".github/ubiquity-os.config.yml", defaultPaths)).toBe(true);
    expect(isProtectedConfigFile("ubiquity-os.config.yaml", defaultPaths)).toBe(true);
  });

  it("Should match case-insensitively", () => {
    expect(isProtectedConfigFile(".UBIQUITY-OS.CONFIG.YML", defaultPaths)).toBe(true);
  });

  it("Should not match non-config files", () => {
    expect(isProtectedConfigFile("src/index.ts", defaultPaths)).toBe(false);
    expect(isProtectedConfigFile("package.json", defaultPaths)).toBe(false);
    expect(isProtectedConfigFile("README.md", defaultPaths)).toBe(false);
  });

  it("Should handle custom protected paths", () => {
    const customPaths = ["custom-config.yml"];
    expect(isProtectedConfigFile("custom-config.yml", customPaths)).toBe(true);
    expect(isProtectedConfigFile(".ubiquity-os.config.yml", customPaths)).toBe(false);
  });
});

describe("Plugin tests", () => {
  it("Should skip non-push events", async () => {
    const context = createPushContext({
      eventName: "issue_comment.created" as unknown as "push",
      ref: "refs/heads/main",
      commits: [],
    });
    const errorSpy = jest.spyOn(context.logger, "error");
    await runPlugin(context as unknown as Context);
    expect(errorSpy).toHaveBeenCalledWith("Unsupported event: issue_comment.created");
  });

  it("Should skip pushes to non-default branches", async () => {
    const context = createPushContext({
      ref: "refs/heads/feature-branch",
      commits: [{ id: "abc123", added: [], modified: [".ubiquity-os.config.yml"], removed: [] }],
    });
    const debugSpy = jest.spyOn(context.logger, "debug");
    await runPlugin(context);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining("non-default branch"));
  });

  it("Should skip when no config files are modified", async () => {
    const context = createPushContext({
      ref: "refs/heads/main",
      commits: [{ id: "abc123", added: [], modified: ["src/index.ts"], removed: [] }],
    });
    // Should complete without errors
    await runPlugin(context);
  });

  it("Should skip when no commits are present", async () => {
    const context = createPushContext({
      ref: "refs/heads/main",
      commits: [],
    });
    const debugSpy = jest.spyOn(context.logger, "debug");
    await runPlugin(context);
    expect(debugSpy).toHaveBeenCalledWith("No commits or sender info in push event, skipping.");
  });

  it("Should skip when sender is null", async () => {
    const context = createPushContext({
      ref: "refs/heads/main",
      commits: [{ id: "abc123", added: [], modified: [".ubiquity-os.config.yml"], removed: [] }],
    });
    (context.payload as Record<string, unknown>).sender = null;
    const debugSpy = jest.spyOn(context.logger, "debug");
    await runPlugin(context as unknown as Context);
    expect(debugSpy).toHaveBeenCalledWith("No commits or sender info in push event, skipping.");
  });
});

function createPushContext(overrides: Partial<{
  eventName: "push";
  ref: string;
  commits: Array<{ id: string; added: string[]; modified: string[]; removed: string[] }>;
}>) {
  const commits = overrides.commits || [];
  return {
    eventName: overrides.eventName || "push",
    command: null,
    payload: {
      action: "completed",
      sender: {
        login: "test-user",
        id: 1,
      },
      repository: {
        name: "test-repo",
        owner: { login: "test-owner" },
        default_branch: "main",
        full_name: "test-owner/test-repo",
      },
      ref: overrides.ref || "refs/heads/main",
      commits,
      installation: { id: 1 },
      organization: { login: "test-org" },
    },
    logger: new Logs("debug"),
    config: {},
    env: {} as Env,
    octokit,
    commentHandler: new CommentHandler(),
  } as unknown as Context;
}
