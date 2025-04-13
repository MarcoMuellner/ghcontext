// src/github/searchRepositories.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchRepositories } from './searchRepositories';
import { resetGitHubTestEnvironment } from './__tests__/test-utils';
import * as cache from './utils/cache';

// Mock the GraphQL client
vi.mock('./utils/client.js', () => {
    // Create a function to be used for mocking graphql requests
    const mockGraphqlFn = vi.fn();
    return {
        getGraphQLClientSingleton: () => mockGraphqlFn,
    };
});

// Mock the cache
vi.mock('./utils/cache.js', () => ({
    get: vi.fn(),
    set: vi.fn(),
}));

describe('searchRepositories', () => {
    // GraphQL client mock
    let mockGraphqlFn: any;

    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();

        // Get reference to the mocked graphql function
        mockGraphqlFn = require('./utils/client.js').getGraphQLClientSingleton();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return cached search results if available', async () => {
        // Arrange
        const cachedResults = {
            search: {
                repositoryCount: 2,
                edges: [
                    {
                        node: {
                            nameWithOwner: 'facebook/react',
                            description: 'A JavaScript library for building user interfaces',
                            url: 'https://github.com/facebook/react',
                            stargazerCount: 200000,
                            forkCount: 40000,
                            primaryLanguage: {
                                name: 'JavaScript'
                            },
                            updatedAt: '2023-01-01T00:00:00Z'
                        }
                    },
                    {
                        node: {
                            nameWithOwner: 'vuejs/vue',
                            description: 'Vue.js framework',
                            url: 'https://github.com/vuejs/vue',
                            stargazerCount: 200000,
                            forkCount: 32000,
                            primaryLanguage: {
                                name: 'JavaScript'
                            },
                            updatedAt: '2023-01-02T00:00:00Z'
                        }
                    }
                ]
            }
        };
        vi.mocked(cache.get).mockReturnValue(cachedResults);

        // Act
        const result = await searchRepositories('javascript framework', 5);

        // Assert
        expect(cache.get).toHaveBeenCalledWith('repo-search:javascript framework:5');
        expect(mockGraphqlFn).not.toHaveBeenCalled(); // GraphQL not called when cache hit
        expect(result).toEqual(cachedResults);
    });

    it('should fetch search results from GitHub API when not cached', async () => {
        // Arrange
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
        const apiResponse = {
            search: {
                repositoryCount: 2,
                edges: [
                    {
                        node: {
                            nameWithOwner: 'facebook/react',
                            description: 'A JavaScript library for building user interfaces',
                            url: 'https://github.com/facebook/react',
                            stargazerCount: 200000,
                            forkCount: 40000,
                            primaryLanguage: {
                                name: 'JavaScript'
                            },
                            updatedAt: '2023-01-01T00:00:00Z'
                        }
                    }
                ]
            }
        };
        mockGraphqlFn.mockResolvedValue(apiResponse);

        // Act
        const result = await searchRepositories('react', 5);

        // Assert
        expect(cache.get).toHaveBeenCalledWith('repo-search:react:5');
        expect(mockGraphqlFn).toHaveBeenCalledWith(
            expect.stringContaining('query searchRepositories'),
            { query: 'react', limit: 5 }
        );
        expect(cache.set).toHaveBeenCalledWith('repo-search:react:5', apiResponse);
        expect(result).toEqual(apiResponse);
    });

    it('should sanitize limit parameter to valid range', async () => {
        // Arrange
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
        mockGraphqlFn.mockResolvedValue({ search: { repositoryCount: 0, edges: [] } });

        // Act - test with too low limit
        await searchRepositories('react', -5);

        // Assert
        expect(mockGraphqlFn).toHaveBeenCalledWith(
            expect.any(String),
            { query: 'react', limit: 1 } // Should be sanitized to 1
        );

        // Reset mocks
        vi.clearAllMocks();
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

        // Act - test with too high limit
        await searchRepositories('react', 200);

        // Assert
        expect(mockGraphqlFn).toHaveBeenCalledWith(
            expect.any(String),
            { query: 'react', limit: 100 } // Should be sanitized to 100
        );
    });

    it('should use default limit of 10 when not specified', async () => {
        // Arrange
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
        mockGraphqlFn.mockResolvedValue({ search: { repositoryCount: 0, edges: [] } });

        // Act
        await searchRepositories('react');

        // Assert
        expect(mockGraphqlFn).toHaveBeenCalledWith(
            expect.any(String),
            { query: 'react', limit: 10 } // Default limit
        );
    });

    it('should throw error for GraphQL errors', async () => {
        // Arrange
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
        const graphqlError = new Error('GraphQL request failed');
        mockGraphqlFn.mockRejectedValue(graphqlError);

        // Act & Assert
        await expect(searchRepositories('react')).rejects.toThrow('GitHub API error');
        expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
    });
});
