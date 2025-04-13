// src/github/__tests__/test-utils.ts
import { vi } from 'vitest';
import fetchMock from 'fetch-mock';
import NodeCache from 'node-cache';

/**
 * Mock implementation for GitHub GraphQL API responses
 * @returns An isolated fetch-mock instance for testing GraphQL requests
 */
export function createGraphQLMock() {
    return fetchMock.createInstance().post(
        'https://api.github.com/graphql',
        (url: string, options: { body: string, headers?: Record<string, string> }) => {
            const body = JSON.parse(options.body);
            // Default empty response - override in specific tests
            return { data: {} };
        }
    );
}

/**
 * Mock Octokit REST API responses by creating a mock implementation
 * @returns Mock Octokit instance with stubbed methods
 */
export function createOctokitMock() {
    return {
        repos: {
            getContent: vi.fn(),
            getReadme: vi.fn(),
        },
        git: {
            getTree: vi.fn(),
        },
        search: {
            code: vi.fn(),
        },
    };
}

/**
 * Create a fresh cache instance for testing
 * @returns A new NodeCache instance
 */
export function createTestCache() {
    return new NodeCache({
        stdTTL: 60, // Short TTL for testing
        checkperiod: 10,
        useClones: false,
    });
}

/**
 * Reset all mocks and clear environment variables related to GitHub
 */
export function resetGitHubTestEnvironment() {
    vi.resetModules();

    // Clear any environment variables that might affect tests
    delete process.env.GITHUB_TOKEN;
    delete process.env.CACHE_TTL;

    // Reset fetch-mock if it's been used globally
    fetchMock.hardReset();
}

/**
 * Sample repository data for testing
 */
export const sampleRepoData = {
    nameWithOwner: 'facebook/react',
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    url: 'https://github.com/facebook/react',
    homepageUrl: 'https://reactjs.org',
    stargazerCount: 205000,
    forkCount: 42000,
    isArchived: false,
    isTemplate: false,
    primaryLanguage: {
        name: 'JavaScript',
    },
    languages: {
        edges: [
            {
                node: { name: 'JavaScript' },
                size: 1540000,
            },
            {
                node: { name: 'TypeScript' },
                size: 540000,
            },
        ],
    },
    defaultBranchRef: {
        name: 'main',
    },
    licenseInfo: {
        name: 'MIT License',
        spdxId: 'MIT',
    },
    updatedAt: '2023-10-10T12:00:00Z',
};

/**
 * Sample README content for testing
 */
export const sampleReadmeContent = `# Sample Repository

This is a sample README for testing.

## API Documentation

Here is some sample API documentation:

\`\`\`javascript
function example() {
  return "Hello, world!";
}
\`\`\`

## Installation

npm install sample-package
`;

/**
 * Setup environment variables for testing
 */
export function setupTestEnv() {
    process.env.GITHUB_TOKEN = 'test-token-12345';
    process.env.CACHE_TTL = '60'; // 1 minute for testing
}
