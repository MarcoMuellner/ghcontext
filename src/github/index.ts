/**
 * GitHub API Client Module
 *
 * This module provides functions for interacting with the GitHub API
 * to retrieve repository information, file content, and other GitHub data.
 *
 * @module github
 */

// Export token utilities
export {
  getToken,
  TokenSource,
  TokenInfo,
  clearTokenCache,
} from "./utils/getToken";

// Export cache utilities
export * as cache from "./utils/cache.js";

// Export client utilities
export {
  getGraphQLClient,
  getGraphQLClientSingleton,
  getRESTClient,
  getRESTClientSingleton,
  clearClientCache,
} from "./utils/client.js";

// Export repository functions
export {
  searchRepositories,
  type RepositorySearchResult,
  type RepositoryEdge,
  type RepositorySearchResponse,
} from "./searchRepositories.js";

export {
  getRepository,
  type Repository,
  type LanguageEdge,
  type RepositoryResponse,
} from "./getRepository.js";

// Export file functions
export {
  getReadmeContent,
  getReadmeContentByPath,
} from "./getReadmeContent.js";

export {
  searchFiles,
  searchRepositoryCode,
  type FileInfo,
} from "./searchFiles.js";

export { getFileContent, getRawFileContent } from "./getFileContent.js";

export {
  getRepositoryStructure,
  getRepositoryFiles,
  type StructureEntry,
  type StructureFile,
  type StructureDirectory,
} from "./getRepositoryStructure.js";

// Export documentation functions
export { extractApiDocumentation } from "./extractAPIDocumentation.js";
