// src/github/searchFiles.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchFiles, searchRepositoryCode } from './searchFiles';
import { resetGitHubTestEnvironment, sampleRepoData } from './__tests__/test-utils';
import * as cache from './utils/cache';

// Mock the getRepository function
vi.mock('./getRepository.js', () => ({
    getRepository: vi.fn()
}));

// Mock the REST client
vi.mock('./utils/client.js', () => {
    const mockRestClient = {
        repos: {
            getContent: vi.fn()
        },
        search: {
            code: vi.fn()
        }
    };

    return {
        getRESTClientSingleton: () => mockRestClient,
    };
});

// Mock the cache
vi.mock('./utils/cache.js', () => ({
    get: vi.fn(),
    set: vi.fn(),
}));

describe('File Search', () => {
    // REST client mock
    let mockRestClient: any;
    let mockGetRepository: any;

    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();

        // Get reference to the mocked REST client
        mockRestClient = require('./utils/client.js').getRESTClientSingleton();
        mockGetRepository = require('./getRepository.js').getRepository;

        // Setup default mock responses
        mockGetRepository.mockResolvedValue({
            repository: {
                ...sampleRepoData,
                defaultBranchRef: {
                    name: 'main'
                }
            }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('searchFiles', () => {
        it('should return cached search results if available', async () => {
            // Arrange
            const cachedFiles = [
                {
                    name: 'index.js',
                    path: 'src/index.js',
                    type: 'file',
                    size: 500,
                    url: 'https://github.com/facebook/react/blob/main/src/index.js',
                    downloadUrl: 'https://raw.githubusercontent.com/facebook/react/main/src/index.js'
                }
            ];
            vi.mocked(cache.get).mockReturnValue(cachedFiles);

            // Act
            const result = await searchFiles('facebook', 'react', 'src', 'index');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('files:facebook/react:src:index');
            expect(mockRestClient.repos.getContent).not.toHaveBeenCalled(); // REST not called when cache hit
            expect(result).toEqual(cachedFiles);
        });

        it('should fetch files and filter by query when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock content response
            mockRestClient.repos.getContent.mockResolvedValue({
                data: [
                    {
                        name: 'index.js',
                        path: 'src/index.js',
                        type: 'file',
                        size: 500,
                        html_url: 'https://github.com/facebook/react/blob/main/src/index.js',
                        download_url: 'https://raw.githubusercontent.com/facebook/react/main/src/index.js'
                    },
                    {
                        name: 'Component.js',
                        path: 'src/Component.js',
                        type: 'file',
                        size: 700,
                        html_url: 'https://github.com/facebook/react/blob/main/src/Component.js',
                        download_url: 'https://raw.githubusercontent.com/facebook/react/main/src/Component.js'
                    }
                ]
            });

            // Act
            const result = await searchFiles('facebook', 'react', 'src', 'index');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('files:facebook/react:src:index');
            expect(mockGetRepository).toHaveBeenCalledWith('facebook', 'react');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: 'src',
                ref: 'main'
            });

            // Check files filtering
            expect(result).toHaveLength(1); // Only the file matching 'index'
            expect(result[0].name).toBe('index.js');
            expect(result[0].path).toBe('src/index.js');

            expect(cache.set).toHaveBeenCalledWith('files:facebook/react:src:index', result);
        });

        it('should handle single file response from getContent', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock single file response
            mockRestClient.repos.getContent.mockResolvedValue({
                data: {
                    name: 'index.js',
                    path: 'src/index.js',
                    type: 'file',
                    size: 500,
                    html_url: 'https://github.com/facebook/react/blob/main/src/index.js',
                    download_url: 'https://raw.githubusercontent.com/facebook/react/main/src/index.js'
                }
            });

            // Act
            const result = await searchFiles('facebook', 'react', 'src/index.js');

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('index.js');
        });

        it('should return all files when no query is provided', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock content response
            mockRestClient.repos.getContent.mockResolvedValue({
                data: [
                    {
                        name: 'index.js',
                        path: 'src/index.js',
                        type: 'file',
                        size: 500,
                        html_url: 'https://github.com/facebook/react/blob/main/src/index.js',
                        download_url: 'https://raw.githubusercontent.com/facebook/react/main/src/index.js'
                    },
                    {
                        name: 'Component.js',
                        path: 'src/Component.js',
                        type: 'file',
                        size: 700,
                        html_url: 'https://github.com/facebook/react/blob/main/src/Component.js',
                        download_url: 'https://raw.githubusercontent.com/facebook/react/main/src/Component.js'
                    }
                ]
            });

            // Act
            const result = await searchFiles('facebook', 'react', 'src');

            // Assert
            expect(result).toHaveLength(2); // All files returned
        });

        it('should throw error when path is not found', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const notFoundError = new Error('Not found');
            (notFoundError as any).status = 404;
            mockRestClient.repos.getContent.mockRejectedValue(notFoundError);

            // Act & Assert
            await expect(searchFiles('facebook', 'react', 'nonexistent')).rejects.toThrow('Path not found');
        });

        it('should throw error for other API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockRejectedValue(new Error('API rate limit exceeded'));

            // Act & Assert
            await expect(searchFiles('facebook', 'react', 'src')).rejects.toThrow('GitHub API error');
        });
    });

    describe('searchRepositoryCode', () => {
        it('should return cached search results if available', async () => {
            // Arrange
            const cachedResults = {
                total_count: 5,
                incomplete_results: false,
                items: [
                    {
                        name: 'index.js',
                        path: 'src/index.js',
                        sha: 'abc123',
                        url: 'https://api.github.com/repos/facebook/react/contents/src/index.js',
                        git_url: 'https://api.github.com/repos/facebook/react/git/blobs/abc123',
                        html_url: 'https://github.com/facebook/react/blob/main/src/index.js',
                        repository: {
                            name: 'react',
                            full_name: 'facebook/react',
                            owner: {
                                login: 'facebook'
                            }
                        },
                        score: 1.0
                    }
                ]
            };
            vi.mocked(cache.get).mockReturnValue(cachedResults);

            // Act
            const result = await searchRepositoryCode('facebook', 'react', 'useState');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('code-search:facebook/react:useState:30');
            expect(mockRestClient.search.code).not.toHaveBeenCalled(); // REST not called when cache hit
            expect(result).toEqual(cachedResults);
        });

        it('should fetch code search results when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss

            // Mock search response
            const searchResults = {
                total_count: 5,
                incomplete_results: false,
                items: [
                    {
                        name: 'index.js',
                        path: 'src/index.js',
                        sha: 'abc123',
                        url: 'https://api.github.com/repos/facebook/react/contents/src/index.js',
                        git_url: 'https://api.github.com/repos/facebook/react/git/blobs/abc123',
                        html_url: 'https://github.com/facebook/react/blob/main/src/index.js',
                        repository: {
                            name: 'react',
                            full_name: 'facebook/react',
                            owner: {
                                login: 'facebook'
                            }
                        },
                        score: 1.0
                    }
                ]
            };
            mockRestClient.search.code.mockResolvedValue({ data: searchResults });

            // Act
            const result = await searchRepositoryCode('facebook', 'react', 'useState');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('code-search:facebook/react:useState:30');
            expect(mockRestClient.search.code).toHaveBeenCalledWith({
                q: 'repo:facebook/react useState',
                per_page: 30
            });

            expect(result).toEqual(searchResults);
            expect(cache.set).toHaveBeenCalledWith('code-search:facebook/react:useState:30', searchResults);
        });

        it('should respect the limit parameter', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.search.code.mockResolvedValue({ data: { items: [] } });

            // Act
            await searchRepositoryCode('facebook', 'react', 'useState', 10);

            // Assert
            expect(cache.get).toHaveBeenCalledWith('code-search:facebook/react:useState:10');
            expect(mockRestClient.search.code).toHaveBeenCalledWith({
                q: 'repo:facebook/react useState',
                per_page: 10
            });
        });

        it('should handle API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.search.code.mockRejectedValue(new Error('API rate limit exceeded'));

            // Act & Assert
            await expect(searchRepositoryCode('facebook', 'react', 'useState')).rejects.toThrow('GitHub API error');
        });
    });
});
