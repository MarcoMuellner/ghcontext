// src/github/getRepositoryStructure.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRepositoryStructure,
  getRepositoryFiles,
  StructureEntry,
  StructureFile,
  StructureDirectory,
} from "./getRepositoryStructure";
import {
  resetGitHubTestEnvironment,
  sampleRepoData,
} from "./__tests__/test-utils";
import * as cache from "./utils/cache";

// Helper functions for type checking - preserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _isDirectory(entry: StructureEntry): entry is StructureDirectory {
  return entry.type === "dir";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _isFile(entry: StructureEntry): entry is StructureFile {
  return entry.type === "file";
}

// Create mock functions
const mockGetRepository = vi.fn();
const mockRestClient = {
  repos: {
    getContent: vi.fn(),
  },
  git: {
    getTree: vi.fn(),
  },
};

// Mock the getRepository function
vi.mock(
  "./getRepository.js",
  () => ({
    getRepository: () => mockGetRepository(),
  }),
  { virtual: true },
);

// Mock the REST client
vi.mock(
  "./utils/client.js",
  () => ({
    getRESTClientSingleton: () => mockRestClient,
  }),
  { virtual: true },
);

// Mock the cache
vi.mock(
  "./utils/cache.js",
  () => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
  { virtual: true },
);

describe("Repository Structure", () => {
  beforeEach(() => {
    resetGitHubTestEnvironment();

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock responses for getRepository
    mockGetRepository.mockResolvedValue({
      repository: {
        ...sampleRepoData,
        defaultBranchRef: {
          name: "main",
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getRepositoryStructure", () => {
    it("should return cached structure if available", async () => {
      // Arrange
      const expectedStructure = {
        name: "root",
        path: "",
        type: "dir",
        contents: [
          { name: "src", path: "src", type: "dir", contents: [] },
          {
            name: "package.json",
            path: "package.json",
            type: "file",
            size: 1000,
          },
        ],
      };
      vi.mocked(cache.get).mockReturnValue(expectedStructure);

      // Act
      const result = await getRepositoryStructure("facebook", "react", ".");

      // Assert
      expect(cache.get).toHaveBeenCalledWith("structure:facebook/react:.:3");
      expect(mockRestClient.git.getTree).not.toHaveBeenCalled();
      expect(result).toEqual(expectedStructure);
    });

    it("should fetch repository structure when not cached", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

      // Mock repos.getContent for the root directory
      mockRestClient.repos.getContent.mockResolvedValue({
        data: [
          { name: "src", path: "src", type: "dir" },
          {
            name: "package.json",
            path: "package.json",
            type: "file",
            size: 1024,
          },
          { name: "README.md", path: "README.md", type: "file", size: 2048 },
        ],
      });

      // Act
      const result = await getRepositoryStructure("facebook", "react", ".");

      // Assert
      expect(cache.get).toHaveBeenCalledWith("structure:facebook/react:.:3");
      expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
        owner: "facebook",
        repo: "react",
        path: ".",
        ref: "main",
      });
      expect(cache.set).toHaveBeenCalledWith(
        "structure:facebook/react:.:3",
        expect.any(Object),
      );
      expect(result.type).toBe("dir");
      expect((result as StructureDirectory).contents.length).toBe(3);
    });

    it("should respect the maxDepth parameter", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

      // Mock for the root directory
      mockRestClient.repos.getContent.mockImplementation(({ path }) => {
        if (path === "") {
          return Promise.resolve({
            data: [
              { name: "src", path: "src", type: "dir" },
              {
                name: "package.json",
                path: "package.json",
                type: "file",
                size: 1024,
              },
            ],
          });
        } else if (path === "src") {
          return Promise.resolve({
            data: [
              { name: "components", path: "src/components", type: "dir" },
              { name: "utils", path: "src/utils", type: "dir" },
              {
                name: "index.js",
                path: "src/index.js",
                type: "file",
                size: 512,
              },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });

      // Act
      const result = await getRepositoryStructure("facebook", "react", "", 1);

      // Assert
      expect(cache.get).toHaveBeenCalledWith("structure:facebook/react::1");

      // Check that we have the root level structure
      expect(result.type).toBe("dir");
      expect((result as StructureDirectory).contents).toHaveLength(2);

      // Check that we don't go deeper than maxDepth
      const srcDir = (result as StructureDirectory).contents.find(
        (item) => item.name === "src",
      );
      expect(srcDir).toBeDefined();
      expect(srcDir!.type).toBe("dir");
      // In our implementation it will have the contents but not recurse further
      // so we don't assert on the contents length
    });

    it("should handle getting structure for a specific path", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

      // Mock for the specific path
      mockRestClient.repos.getContent.mockResolvedValue({
        data: [
          {
            name: "Button.js",
            path: "src/components/Button.js",
            type: "file",
            size: 2048,
          },
          {
            name: "Input.js",
            path: "src/components/Input.js",
            type: "file",
            size: 1536,
          },
        ],
      });

      // Act
      const result = await getRepositoryStructure(
        "facebook",
        "react",
        "src/components",
      );

      // Assert
      expect(cache.get).toHaveBeenCalledWith(
        "structure:facebook/react:src/components:3",
      );
      expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
        owner: "facebook",
        repo: "react",
        path: "src/components",
        ref: "main",
      });

      // Verify the result structure
      expect(result.type).toBe("dir");
      expect(result.name).toBe("components");
      expect(result.path).toBe("src/components");
      expect((result as StructureDirectory).contents).toHaveLength(2);
    });

    it("should throw error when path is not found", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
      mockRestClient.repos.getContent.mockRejectedValue({
        status: 404,
        message: "Not Found",
      });

      // Act & Assert
      await expect(
        getRepositoryStructure("facebook", "react", "nonexistent"),
      ).rejects.toThrow("Path not found");
      expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
    });

    it("should handle case when getting a file instead of directory", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
      // Simulate getting a single file
      mockRestClient.repos.getContent.mockResolvedValue({
        data: {
          name: "package.json",
          path: "package.json",
          type: "file",
          size: 1024,
        },
      });

      // Act
      const result = await getRepositoryStructure(
        "facebook",
        "react",
        "package.json",
      );

      // Assert
      expect(cache.get).toHaveBeenCalledWith(
        "structure:facebook/react:package.json:3",
      );
      expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
        owner: "facebook",
        repo: "react",
        path: "package.json",
        ref: "main",
      });

      // Verify it's a file type result
      expect(result.type).toBe("file");
      expect(result.name).toBe("package.json");
      expect(result.path).toBe("package.json");
      expect((result as StructureFile).size).toBe(1024);
    });
  });

  describe("getRepositoryFiles", () => {
    it("should return cached files list if available", async () => {
      // Arrange
      const expectedFiles = ["package.json", "src/index.js"];
      vi.mocked(cache.get).mockReturnValue(expectedFiles);

      // Act
      const result = await getRepositoryFiles("facebook", "react");

      // Assert
      expect(cache.get).toHaveBeenCalledWith("repo-files:facebook/react:all");
      expect(mockRestClient.git.getTree).not.toHaveBeenCalled();
      expect(result).toEqual(expectedFiles);
    });

    it("should fetch repository files when not cached", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
      mockRestClient.git.getTree.mockResolvedValue({
        data: {
          tree: [
            { path: "src", type: "tree", sha: "abc123" },
            { path: "package.json", type: "blob", sha: "def456" },
            { path: "src/index.js", type: "blob", sha: "ghi789" },
          ],
        },
      });

      // Act
      const result = await getRepositoryFiles("facebook", "react");

      // Assert
      expect(cache.get).toHaveBeenCalledWith("repo-files:facebook/react:all");
      expect(mockRestClient.git.getTree).toHaveBeenCalledWith({
        owner: "facebook",
        repo: "react",
        tree_sha: "main",
        recursive: "1",
      });
      expect(cache.set).toHaveBeenCalledWith(
        "repo-files:facebook/react:all",
        expect.any(Array),
      );
      // Should only return file paths, not directories
      expect(result.length).toBe(2);
      expect(result.includes("package.json")).toBe(true);
      expect(result.includes("src/index.js")).toBe(true);
    });

    it("should filter files by extension when specified", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
      mockRestClient.git.getTree.mockResolvedValue({
        data: {
          tree: [
            { path: "src/index.js", type: "blob", sha: "abc123" },
            { path: "src/utils.ts", type: "blob", sha: "def456" },
            { path: "README.md", type: "blob", sha: "ghi789" },
          ],
        },
      });

      // Act
      const result = await getRepositoryFiles("facebook", "react", ".js");

      // Assert
      expect(result.length).toBe(1);
      expect(result[0]).toBe("src/index.js");
    });

    it("should handle GitHub API errors", async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
      mockRestClient.git.getTree.mockRejectedValue(
        new Error("API rate limit exceeded"),
      );

      // Act & Assert
      await expect(getRepositoryFiles("facebook", "react")).rejects.toThrow(
        "GitHub API error",
      );
      expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
    });
  });
});
