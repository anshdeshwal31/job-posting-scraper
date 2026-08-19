import { validateJob } from "@/src/validation/job-schema";

describe("validateJob", () => {
  const validJob = {
    externalId: "job-123",
    title: "Senior Engineer",
    company: "Acme Corp",
    url: "https://example.com/jobs/123",
    location: "Remote",
    postedAt: "2024-01-15T10:00:00Z",
  };

  it("accepts a fully valid job", () => {
    const result = validateJob(validJob);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.externalId).toBe("job-123");
      expect(result.data.title).toBe("Senior Engineer");
    }
  });

  it("accepts a minimal valid job (optional fields absent)", () => {
    const result = validateJob({
      externalId: "min-001",
      title: "Engineer",
      company: "Corp",
      url: "https://example.com/jobs/1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a job missing title", () => {
    const result = validateJob({ ...validJob, title: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects a job with empty title", () => {
    const result = validateJob({ ...validJob, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a job missing externalId", () => {
    const result = validateJob({ ...validJob, externalId: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects a job with invalid url", () => {
    const result = validateJob({ ...validJob, url: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("url");
    }
  });

  it("rejects a job missing url", () => {
    const result = validateJob({ ...validJob, url: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects a job with invalid postedAt date", () => {
    const result = validateJob({ ...validJob, postedAt: "not-a-date" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("postedAt");
    }
  });

  it("accepts a job with undefined postedAt", () => {
    const result = validateJob({ ...validJob, postedAt: undefined });
    expect(result.success).toBe(true);
  });

  it("rejects null", () => {
    const result = validateJob(null);
    expect(result.success).toBe(false);
  });

  it("rejects a primitive string", () => {
    const result = validateJob("this is not a job object at all");
    expect(result.success).toBe(false);
  });

  it("rejects missing company", () => {
    const result = validateJob({ ...validJob, company: undefined });
    expect(result.success).toBe(false);
  });
});
