// src/github/utils/cache.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cache from './cache';
import NodeCache from 'node-cache';
import { resetGitHubTestEnvironment } from '../__tests__/test-utils';

// Mock NodeCache
vi.mock('node-cache', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            has: vi.fn(),
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            flushAll: vi.fn(),
            getStats: vi.fn()
        }))
    };
});

describe('Cache Utilities', () => {
    // Mock cache instance
    let mockCacheInstance: any;

    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset NodeCache mock and capture the instance
        vi.clearAllMocks();
        mockCacheInstance = vi.mocked(NodeCache).mock.results[0]?.value;

        // Set environment variable
        process.env.CACHE_TTL = '500';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('NodeCache initialization', () => {
        it('should initialize cache with correct default settings', () => {
            // Arrange & Act - The cache is initialized when the module is imported

            // Assert
            expect(NodeCache).toHaveBeenCalledWith({
                stdTTL: 500, // From environment variable
                checkperiod: 120,
                useClones: false
            });
        });

        it('should use default TTL when environment variable is not set', () => {
            // Arrange
            delete process.env.CACHE_TTL;

            // Reset and re-import the module to check initialization with defaults
            vi.resetModules();
            const freshCache = require('./cache');

            // Assert
            expect(NodeCache).toHaveBeenCalledWith(expect.objectContaining({
                stdTTL: 300, // Default value
            }));
        });
    });

    describe('cache.exists', () => {
        it('should check if key exists in cache', () => {
            // Arrange
            mockCacheInstance.has.mockReturnValue(true);

            // Act
            const result = cache.exists('test-key');

            // Assert
            expect(mockCacheInstance.has).toHaveBeenCalledWith('test-key');
            expect(result).toBe(true);
        });
    });

    describe('cache.get', () => {
        it('should retrieve value from cache', () => {
            // Arrange
            const mockData = { data: 'test-data' };
            mockCacheInstance.get.mockReturnValue(mockData);

            // Act
            const result = cache.get('test-key');

            // Assert
            expect(mockCacheInstance.get).toHaveBeenCalledWith('test-key');
            expect(result).toEqual(mockData);
        });

        it('should return undefined for non-existent key', () => {
            // Arrange
            mockCacheInstance.get.mockReturnValue(undefined);

            // Act
            const result = cache.get('non-existent-key');

            // Assert
            expect(result).toBeUndefined();
        });
    });

    describe('cache.set', () => {
        it('should store value in cache with default TTL', () => {
            // Arrange
            const mockData = { data: 'test-data' };
            mockCacheInstance.set.mockReturnValue(true);

            // Act
            const result = cache.set('test-key', mockData);

            // Assert
            expect(mockCacheInstance.set).toHaveBeenCalledWith('test-key', mockData, 500);
            expect(result).toBe(true);
        });

        it('should store value in cache with custom TTL', () => {
            // Arrange
            const mockData = { data: 'test-data' };
            const customTtl = 1000;
            mockCacheInstance.set.mockReturnValue(true);

            // Act
            const result = cache.set('test-key', mockData, customTtl);

            // Assert
            expect(mockCacheInstance.set).toHaveBeenCalledWith('test-key', mockData, customTtl);
            expect(result).toBe(true);
        });
    });

    describe('cache.del', () => {
        it('should delete key from cache', () => {
            // Arrange
            mockCacheInstance.del.mockReturnValue(1);

            // Act
            const result = cache.del('test-key');

            // Assert
            expect(mockCacheInstance.del).toHaveBeenCalledWith('test-key');
            expect(result).toBe(1);
        });
    });

    describe('cache.clear', () => {
        it('should clear all cache entries', () => {
            // Arrange & Act
            cache.clear();

            // Assert
            expect(mockCacheInstance.flushAll).toHaveBeenCalled();
        });
    });

    describe('cache.getStats', () => {
        it('should return cache statistics', () => {
            // Arrange
            const mockStats = { hits: 10, misses: 5 };
            mockCacheInstance.getStats.mockReturnValue(mockStats);

            // Act
            const result = cache.getStats();

            // Assert
            expect(mockCacheInstance.getStats).toHaveBeenCalled();
            expect(result).toEqual(mockStats);
        });
    });
});
