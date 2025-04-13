// src/github/searchFiles.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchFiles, searchRepositoryCode } from './searchFiles';
import { resetGitHubTestEnvironment, sampleRepoData } from './__tests__/test-utils';
import * as cache from './utils/cache';

// Create mock functions
const mockGetRepository = vi.fn();
const mockRestClient = {
    repos: { 
        getContent: vi.fn() 
    },
    search: { 
        code: vi.fn() 
    }
};

// Mock the getRepository function
vi.mock('./getRepository.js', () => ({
    getRepository: () => mockGetRepository()
}), { virtual: true });

// Mock the REST client
vi.mock('./utils/client.js', () => ({
    getRESTClientSingleton: () => mockRestClient
}), { virtual: true });

// Mock the cache
vi.mock('./utils/cache.js', () => ({
    get: vi.fn(),
    set: vi.fn(),
}), { virtual: true });

describe('File Search', () => {
    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();

        // Setup default mock responses for getRepository
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
        it('should return cached files if available', async () => {
            // Arrange
            const expectedFiles = [{ name: 'package.json', path: 'package.json' }];
            vi.mocked(cache.get).mockReturnValue(expectedFiles);

            // Act
            const result = await searchFiles('facebook', 'react', 'src');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('files:facebook/react:src:');
            expect(mockGetRepository).not.toHaveBeenCalled();
            expect(mockRestClient.repos.getContent).not.toHaveBeenCalled();
            expect(result).toEqual(expectedFiles);
        });

        it('should fetch files and filter by query when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: [
                    { name: 'package.json', path: 'package.json', type: 'file' },
                    { name: 'README.md', path: 'README.md', type: 'file' },
                    { name: 'src', path: 'src', type: 'dir' }
                ]
            });

            // Act
            const result = await searchFiles('facebook', 'react', 'src', 'pack');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('files:facebook/react:src:pack');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: 'src',
                ref: 'main'
            });
            expect(cache.set).toHaveBeenCalledWith('files:facebook/react:src:pack', expect.any(Array));
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('package.json');
        });

        it('should handle single file response from getContent', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            // GitHub API can return a single file object instead of an array for some paths
            mockRestClient.repos.getContent.mockResolvedValue({
                data: { name: 'package.json', path: 'package.json', type: 'file' }
            });

            // Act
            const result = await searchFiles('facebook', 'react', 'package.json');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('files:facebook/react:package.json:');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: 'package.json',
                ref: 'main'
            });
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('package.json');
        });

        it('should return all files when no query is provided', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: [
                    { name: 'package.json', path: 'package.json', type: 'file' },
                    { name: 'README.md', path: 'README.md', type: 'file' },
                    { name: '.gitignore', path: '.gitignore', type: 'file' }
                ]
            });

            // Act
            const result = await searchFiles('facebook', 'react', '');

            // Assert
            expect(result).toHaveLength(3);
        });

        it('should throw error when path is not found', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockRejectedValue({
                status: 404,
                message: 'Not Found'
            });

            // Act & Assert
            await expect(searchFiles('facebook', 'react', 'nonexistent')).rejects.toThrow('Path not found');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });

        it('should throw error for other API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockRejectedValue(new Error('API rate limit exceeded'));

            // Act & Assert
            await expect(searchFiles('facebook', 'react', 'src')).rejects.toThrow('GitHub API error');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });
    });

    describe('searchRepositoryCode', () => {
        it('should return cached search results if available', async () => {
            // Arrange
            const expectedResults = { items: [{ name: 'file.js', path: 'src/file.js', html_url: 'https://github.com/file.js' }] };
            vi.mocked(cache.get).mockReturnValue(expectedResults);

            // Act
            const result = await searchRepositoryCode('facebook', 'react', 'useState');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('code-search:facebook/react:useState:30');
            expect(mockRestClient.search.code).not.toHaveBeenCalled();
            expect(result).toEqual(expectedResults);
        });

        it('should fetch search results when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.search.code.mockResolvedValue({
                data: {
                    items: [
                        { name: 'file.js', path: 'src/file.js', html_url: 'https://github.com/file.js' },
                        { name: 'other.js', path: 'src/other.js', html_url: 'https://github.com/other.js' }
                    ]
                }
            });

            // Act
            const result = await searchRepositoryCode('facebook', 'react', 'useState');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('code-search:facebook/react:useState:30');
            expect(mockRestClient.search.code).toHaveBeenCalledWith({
                q: 'repo:facebook/react useState',
                per_page: 30
            });
            expect(cache.set).toHaveBeenCalledWith('code-search:facebook/react:useState:30', expect.any(Object));
            expect(result.items).toHaveLength(2);
        });

        it('should respect the limit parameter', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.search.code.mockResolvedValue({
                data: {
                    items: Array(5).fill(0).map((_, i) => ({ 
                        name: `file${i}.js`, 
                        path: `src/file${i}.js`, 
                        html_url: `https://github.com/file${i}.js` 
                    }))
                }
            });

            // Act
            const result = await searchRepositoryCode('facebook', 'react', 'useState', 3);

            // Assert
            expect(mockRestClient.search.code).toHaveBeenCalledWith({
                q: 'repo:facebook/react useState',
                per_page: 3
            });
            expect(result.items).toHaveLength(5); // The mock always returns 5 regardless of perPage
        });

        it('should handle API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.search.code.mockRejectedValue(new Error('API rate limit exceeded'));

            // Act & Assert
            await expect(searchRepositoryCode('facebook', 'react', 'useState')).rejects.toThrow('GitHub API error');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });
    });
});