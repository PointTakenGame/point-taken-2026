import { describe, expect, it } from "vitest";

import { readBuildStamp } from "./build-id";

describe("readBuildStamp", () => {
  it("says local when nothing deployed this", () => {
    expect(readBuildStamp({})).toEqual({ id: "local", where: "local" });
  });

  it("names a production deploy by its id", () => {
    expect(
      readBuildStamp({ VERCEL_DEPLOYMENT_ID: "dpl_abc123", VERCEL_ENV: "production" }),
    ).toEqual({ id: "dpl_abc123", where: "production" });
  });

  it("counts anything that is not production as a preview", () => {
    expect(
      readBuildStamp({ VERCEL_DEPLOYMENT_ID: "dpl_abc123", VERCEL_ENV: "preview" }),
    ).toEqual({
      id: "dpl_abc123",
      where: "preview",
    });
    expect(readBuildStamp({ VERCEL_DEPLOYMENT_ID: "dpl_abc123" })).toEqual({
      id: "dpl_abc123",
      where: "preview",
    });
  });

  it("falls back to local rather than showing a build with no name", () => {
    expect(
      readBuildStamp({ VERCEL_DEPLOYMENT_ID: "   ", VERCEL_ENV: "production" }),
    ).toEqual({
      id: "local",
      where: "local",
    });
  });
});
