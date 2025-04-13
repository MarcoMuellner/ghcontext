// src/github/extractAPIDocumentation.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractApiDocumentation } from "./extractAPIDocumentation.js";
import { resetGitHubTestEnvironment } from "./__tests__/test-utils.js";
import * as getReadmeContentModule from "./getReadmeContent.js";
import * as getFileContentModule from "./getFileContent.js";
import * as getRepositoryStructureModule from "./getRepositoryStructure.js";
import * as cacheModule from "./utils/cache.js";

// Test data
const readmeWithApiSection = `# Sample Repository

This is a sample README for testing.

## API Documentation

Here is some sample API documentation:

\`\`\`javascript
function example() {
  return "Hello, world!";
}
\`\`\`

## Usage

\`\`\`javascript
import { example } from 'sample-repo';
console.log(example());
\`\`\`

## Something Else

More content here
`;

// readmeWithoutApiSection not currently used in tests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _readmeWithoutApiSection = `# Sample Repository

This is a sample README for testing.

## Installation

npm install sample-package
`;

const readmeWithCodeBlocks = `# Sample Repository

No API docs, but here's some code:

\`\`\`javascript
function doSomething() {
  return true;
}
\`\`\`
`;

// apiMdContent not currently used in tests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _apiMdContent = `# API Reference

This document describes the API for Sample Repository.

## Methods

### example()

Returns a greeting message.
`;

describe("API Documentation Extraction", () => {
  beforeEach(() => {
    resetGitHubTestEnvironment();
    vi.clearAllMocks();

    // Setup spies
    vi.spyOn(cacheModule, "get");
    vi.spyOn(cacheModule, "set");
    vi.spyOn(getReadmeContentModule, "getReadmeContent");
    vi.spyOn(getFileContentModule, "getFileContent");
    vi.spyOn(getRepositoryStructureModule, "getRepositoryFiles");
  });

  it("should return cached API documentation if available", async () => {
    // Arrange
    const cachedApiDocs = "## API Documentation\n\nSome cached API docs";
    vi.mocked(cacheModule.get).mockReturnValue(cachedApiDocs);

    // Act
    const result = await extractApiDocumentation("facebook", "react");

    // Assert
    expect(cacheModule.get).toHaveBeenCalledWith("api-docs:facebook/react");
    expect(result).toEqual(cachedApiDocs);
    expect(getReadmeContentModule.getReadmeContent).not.toHaveBeenCalled();
  });

  it("should extract API sections from README when not cached", async () => {
    // Arrange
    vi.mocked(cacheModule.get).mockReturnValue(undefined);
    vi.mocked(getReadmeContentModule.getReadmeContent).mockResolvedValue(
      readmeWithApiSection,
    );

    // Act
    const result = await extractApiDocumentation("facebook", "react");

    // Assert
    expect(cacheModule.get).toHaveBeenCalledWith("api-docs:facebook/react");
    expect(getReadmeContentModule.getReadmeContent).toHaveBeenCalledWith(
      "facebook",
      "react",
    );
    expect(result).toContain("## API Documentation");
    expect(result).toContain("function example()");
    expect(cacheModule.set).toHaveBeenCalled();
  });

  it("should extract multiple API-related sections from README", async () => {
    // Arrange
    vi.mocked(cacheModule.get).mockReturnValue(undefined);
    vi.mocked(getReadmeContentModule.getReadmeContent).mockResolvedValue(
      readmeWithApiSection,
    );

    // Act
    const result = await extractApiDocumentation("facebook", "react");

    // Assert
    expect(result).toContain("## API Documentation");
    expect(result).toContain("## Usage");
  });

  it("should extract code blocks as examples when no API sections or docs found", async () => {
    // Arrange
    vi.mocked(cacheModule.get).mockReturnValue(undefined);
    vi.mocked(getReadmeContentModule.getReadmeContent).mockResolvedValue(
      readmeWithCodeBlocks,
    );

    // All file content lookups fail
    vi.mocked(getFileContentModule.getFileContent).mockRejectedValue(
      new Error("File not found"),
    );
    vi.mocked(
      getRepositoryStructureModule.getRepositoryFiles,
    ).mockResolvedValue([]);

    // Act
    const result = await extractApiDocumentation("facebook", "react");

    // Assert
    expect(result).toContain("## Code Examples");
    expect(result).toContain("function doSomething()");
  });

  it("should return null when README not found", async () => {
    // Arrange
    vi.mocked(cacheModule.get).mockReturnValue(undefined);
    vi.mocked(getReadmeContentModule.getReadmeContent).mockResolvedValue(null);

    // Act
    const result = await extractApiDocumentation("facebook", "react");

    // Assert
    expect(result).toBeNull();
    expect(cacheModule.set).toHaveBeenCalledWith(
      "api-docs:facebook/react",
      null,
    );
  });

  it("should handle errors gracefully", async () => {
    // Arrange
    vi.mocked(cacheModule.get).mockReturnValue(undefined);
    vi.mocked(getReadmeContentModule.getReadmeContent).mockRejectedValue(
      new Error("API rate limit exceeded"),
    );

    // Act
    const result = await extractApiDocumentation("facebook", "react");

    // Assert
    expect(result).toBeNull();
    expect(cacheModule.set).not.toHaveBeenCalled(); // Don't cache errors
  });
});
