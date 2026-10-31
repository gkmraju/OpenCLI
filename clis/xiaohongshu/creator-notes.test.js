import { describe, expect, it, vi } from 'vitest';
import vm from 'node:vm';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { getRegistry } from '@jackwener/opencli/registry';
import { __test__, parseCreatorNoteIdsFromHtml, parseCreatorNotesText } from './creator-notes.js';
import './creator-notes.js';
function createPageMock(evaluateResult, interceptedRequests = []) {
    const evaluate = Array.isArray(evaluateResult)
        ? vi.fn()
            .mockResolvedValueOnce(evaluateResult[0])
            .mockResolvedValue(evaluateResult[evaluateResult.length - 1])
        : vi.fn().mockResolvedValue(evaluateResult);
    const getInterceptedRequests = Array.isArray(interceptedRequests)
        ? vi.fn().mockResolvedValue(interceptedRequests)
        : vi.fn().mockResolvedValue([]);
    return {
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate,
        snapshot: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        pressKey: vi.fn().mockResolvedValue(undefined),
        scrollTo: vi.fn().mockResolvedValue(undefined),
        getFormState: vi.fn().mockResolvedValue({ forms: [], orphanFields: [] }),
        wait: vi.fn().mockResolvedValue(undefined),
        tabs: vi.fn().mockResolvedValue([]),
        selectTab: vi.fn().mockResolvedValue(undefined),
        networkRequests: vi.fn().mockResolvedValue([]),
        consoleMessages: vi.fn().mockResolvedValue([]),
        scroll: vi.fn().mockResolvedValue(undefined),
        autoScroll: vi.fn().mockResolvedValue(undefined),
        installInterceptor: vi.fn().mockResolvedValue(undefined),
        getInterceptedRequests,
        getCookies: vi.fn().mockResolvedValue([]),
        screenshot: vi.fn().mockResolvedValue(''),
        waitForCapture: vi.fn().mockResolvedValue(undefined),
    };
}
describe('xiaohongshu creator-notes', () => {
    it('parses creator note text blocks into rows', () => {
        const bodyText = `笔记管理
全部笔记(366)
已发布
测试笔记一
发布于 2025年12月04日 19:45
148208
324
2279
465
32
权限设置
取消置顶
编辑
删除
仅自己可见
测试笔记二
发布于 2026年03月18日 12:39
10
0
0
0
0
权限设置`;
        expect(parseCreatorNotesText(bodyText)).toEqual([
            {
                id: '',
                title: '测试笔记一',
                date: '2025年12月04日 19:45',
                views: 148208,
                likes: 2279,
                collects: 465,
                comments: 324,
                url: '',
            },
            {
                id: '',
                title: '测试笔记二',
                date: '2026年03月18日 12:39',
                views: 10,
                likes: 0,
                collects: 0,
                comments: 0,
                url: '',
            },
        ]);
    });

    it('extracts note ids from creator note-manager html', () => {
        const html = `
      <div>&quot;noteId&quot;:&quot;aaaaaaaaaaaaaaaaaaaaaaaa&quot;</div>
      <div>&quot;noteId&quot;:&quot;dddddddddddddddddddddddd&quot;</div>
      <div>&quot;noteId&quot;:&quot;aaaaaaaaaaaaaaaaaaaaaaaa&quot;</div>
    `;
        expect(parseCreatorNoteIdsFromHtml(html)).toEqual([
            'aaaaaaaaaaaaaaaaaaaaaaaa',
            'dddddddddddddddddddddddd',
        ]);
    });
    it('harvests captured analyze pages in page order and dedupes note ids', () => {
        const captureMap = {
            '/api/galaxy/creator/datacenter/note/analyze/list?type=0&page_size=10&page_num=2': {
                ok: true,
                body: JSON.stringify({
                    data: {
                        total: 3,
                        note_infos: [
                            { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', title: 'page 2' },
                            { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'duplicate from page 2' },
                        ],
                    },
                }),
            },
            '/api/galaxy/creator/datacenter/note/analyze/list?type=0&page_size=10&page_num=1': {
                ok: true,
                body: JSON.stringify({
                    data: {
                        total: 3,
                        note_infos: [
                            { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'page 1' },
                        ],
                    },
                }),
            },
        };
        expect(__test__.harvestAnalyzeListCaptures(captureMap)).toEqual({
            total: 3,
            items: [
                { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'page 1' },
                { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', title: 'page 2' },
            ],
        });
    });
    it('treats incomplete captured pagination as fallback-needed instead of partial success', () => {
        const firstPageItems = Array.from({ length: 10 }, (_, index) => ({
            id: String(index).padStart(24, '0'),
        }));
        expect(__test__.isAnalyzeCaptureComplete(firstPageItems, 25, 20)).toBe(false);
        expect(__test__.isAnalyzeCaptureComplete(firstPageItems, 25, 10)).toBe(true);
        expect(__test__.isAnalyzeCaptureComplete(firstPageItems, 0, 20)).toBe(true);
    });
    it('unwraps browser bridge capture-map envelopes', () => {
        const captureMap = {
            '/api/galaxy/creator/datacenter/note/analyze/list?page_num=1': {
                ok: true,
                body: '{"data":{"total":0,"note_infos":[]}}',
            },
        };
        expect(__test__.parseCaptureMapPayload({ session: 'site:xiaohongshu', data: JSON.stringify(captureMap) })).toEqual(captureMap);
        expect(__test__.parseCaptureMapPayload({ session: 'site:xiaohongshu', data: captureMap })).toEqual(captureMap);
    });
    it('does not fall back to partial DOM rows when captured total proves pagination is incomplete', async () => {
        const cmd = getRegistry().get('xiaohongshu/creator-notes');
        const captureMap = {
            '/api/galaxy/creator/datacenter/note/analyze/list?type=0&page_size=10&page_num=1': {
                ok: true,
                body: JSON.stringify({
                    data: {
                        total: 25,
                        note_infos: Array.from({ length: 10 }, (_, index) => ({
                            id: String(index).padStart(24, '0'),
                            title: `note ${index}`,
                        })),
                    },
                }),
            },
        };
        const page = createPageMock(undefined);
        page.evaluate = vi.fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(JSON.stringify(captureMap))
            .mockResolvedValueOnce(false);

        await expect(cmd.func(page, { limit: 20 })).rejects.toBeInstanceOf(CommandExecutionError);
    });

});

function fakeNoteCard(id, nodes) {
    return {
        getAttribute: (name) => name === 'data-impression' ? JSON.stringify({ noteId: id }) : null,
        querySelector: (selector) => selector.split(',').map((part) => nodes[part.trim()]).find(Boolean) || null,
        querySelectorAll: (selector) => selector.split(',').flatMap((part) => nodes[part.trim()] || []),
    };
}

describe('creator note-manager DOM compatibility (#2707)', () => {
    it('supports the new note-card DOM and preserves note ids, dates and metric order', () => {
        const card = fakeNoteCard('aaaaaaaaaaaaaaaaaaaaaaaa', {
            '.note-card__title': { innerText: 'New layout note' },
            '.note-card__time': { innerText: '发布于 2026年10月24日 10:30' },
            '.note-card__stat': [
                { innerText: '40,104' },
                { innerText: '2,430' },
                { innerText: '692' },
                { innerText: '511' },
                { innerText: '12' },
            ],
        });
        const document = {
            querySelectorAll: (selector) => {
                expect(selector).toContain('.note-card');
                return [card];
            },
        };
        const cards = JSON.parse(JSON.stringify(vm.runInNewContext(__test__.noteManagerCardsScript, { document })));
        expect(cards).toEqual([{
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            title: 'New layout note',
            date: '2026年10月24日 10:30',
            metrics: [40104, 2430, 692, 511, 12],
        }]);
    });

    it('retains the legacy div.note selectors', () => {
        const card = fakeNoteCard('bbbbbbbbbbbbbbbbbbbbbbbb', {
            '.title': { innerText: 'Legacy note' },
            '.time_status': { innerText: '发布于 2025年12月04日 19:45' },
            '.icon_list .icon': [
                { innerText: '15' }, { innerText: '2' }, { innerText: '3' }, { innerText: '4' },
            ],
        });
        const cards = JSON.parse(JSON.stringify(vm.runInNewContext(__test__.noteManagerCardsScript, {
            document: { querySelectorAll: () => [card] },
        })));
        expect(cards).toEqual([{
            id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
            title: 'Legacy note',
            date: '2025年12月04日 19:45',
            metrics: [15, 2, 3, 4],
        }]);
    });

    it('uses the shared card reader when signed analytics endpoints return no rows', async () => {
        const page = createPageMock(undefined);
        const cardRows = [{
            id: 'cccccccccccccccccccccccc',
            title: 'Fallback note',
            date: '2026年10月24日 10:30',
            metrics: [40104, 2430, 692, 511],
        }];
        page.evaluate = vi.fn(async (source) => {
            if (source === __test__.noteManagerCardsScript) return cardRows;
            if (source === 'JSON.stringify(window.__xhsCapture || {})') return '{}';
            if (source.includes('const resp = await fetch')) return { error: 'HTTP 406' };
            if (source.includes('await fetch(')) return true;
            return undefined;
        });
        const cmd = getRegistry().get('xiaohongshu/creator-notes');
        const notes = await cmd.func(page, { limit: 5 });
        expect(notes).toEqual([{
            rank: 1,
            id: 'cccccccccccccccccccccccc',
            title: 'Fallback note',
            date: '2026年10月24日 10:30',
            views: 40104,
            likes: 692,
            collects: 511,
            comments: 2430,
            url: 'https://creator.xiaohongshu.com/statistics/note-detail?noteId=cccccccccccccccccccccccc',
        }]);
        expect(page.evaluate).toHaveBeenCalledWith(__test__.noteManagerCardsScript);
    });
});
