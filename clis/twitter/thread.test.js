import { describe, expect, it } from 'vitest';
import { getRegistry } from '@jackwener/opencli/registry';
import { __test__ } from './thread.js';

describe('twitter thread parser', () => {
    it('extracts author bio from tweet user entity', () => {
        const command = getRegistry().get('twitter/thread');
        expect(command?.columns).toEqual(['id', 'author', 'bio', 'text', 'likes', 'retweets', 'url', 'has_media', 'media_urls', 'media_posters', 'card', 'quoted_tweet']);
        const result = __test__.parseTweetDetail({
            data: {
                threaded_conversation_with_injections_v2: {
                    instructions: [
                        {
                            entries: [
                                {
                                    content: {
                                        itemContent: {
                                            tweet_results: {
                                                result: {
                                                    rest_id: '1',
                                                    legacy: {
                                                        full_text: 'thread tweet',
                                                        favorite_count: 3,
                                                        retweet_count: 2,
                                                    },
                                                    core: {
                                                        user_results: {
                                                            result: {
                                                                legacy: {
                                                                    screen_name: 'alice',
                                                                    description: 'Thread author bio',
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
        }, new Set());
        expect(result.tweets).toHaveLength(1);
        expect(result.tweets[0]).toMatchObject({
            id: '1',
            author: 'alice',
            bio: 'Thread author bio',
            text: 'thread tweet',
            likes: 3,
            retweets: 2,
            url: 'https://x.com/alice/status/1',
        });
    });
});


describe('twitter thread coverage receipt', () => {
    const coverage = __test__.describeThreadCoverage;
    it('reports cursor exhaustion without claiming universal thread completeness', () => {
        expect(coverage({ pagesScanned: 2, stopReason: 'cursor_exhausted', nextCursor: null, returnedCount: 3, collectedCount: 3 })).toEqual({
            pages_scanned: 2, stop_reason: 'cursor_exhausted', coverage: 'exhausted',
            has_more: false, returned_count: 3, collected_count: 3,
        });
    });
    it('marks output clipping even when upstream cursor is exhausted', () => {
        expect(coverage({ pagesScanned: 1, stopReason: 'limit_reached', nextCursor: null, returnedCount: 2, collectedCount: 5 })).toMatchObject({
            stop_reason: 'limit_reached', coverage: 'partial_or_unknown', has_more: true,
        });
    });
    it.each(['page_cap', 'repeated_cursor', 'upstream_error'])('does not claim completeness on %s', (stopReason) => {
        expect(coverage({ pagesScanned: 5, stopReason, nextCursor: 'cursor-5', returnedCount: 4, collectedCount: 4 })).toMatchObject({
            stop_reason: stopReason, coverage: 'partial_or_unknown', has_more: true,
        });
    });
});
