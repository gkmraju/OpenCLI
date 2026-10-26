import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getRegistry } from '@jackwener/opencli/registry';
import { createPageMock } from '../test-utils.js';
import './search.js';

const search = getRegistry().get('jd/search');

function pageAt(url, html = '') {
  const page = createPageMock();
  page.evaluate.mockImplementation(async (script) => {
    const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
    // The empty-results polling loop should finish immediately in offline tests.
    dom.window.setTimeout = (callback) => { callback(); return 0; };
    try {
      return await dom.window.eval(script);
    } finally {
      dom.window.close();
    }
  });
  return page;
}

describe('jd search login redirect', () => {
  it('reports AUTH_REQUIRED rather than success with empty results on passport.jd.com', async () => {
    const page = pageAt(
      'https://passport.jd.com/new/login.aspx?ReturnUrl=https%3A%2F%2Fsearch.jd.com%2FSearch',
      '<title>京东-欢迎登录</title>',
    );
    await expect(search.func(page, { query: 'swimming board', limit: 5 }))
      .rejects.toMatchObject({ name: 'AuthRequiredError', code: 'AUTH_REQUIRED', exitCode: 77 });
    expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('https://search.jd.com/Search?keyword='));
  });

  it('still returns product rows from an authenticated search page', async () => {
    const page = pageAt(
      'https://search.jd.com/Search?keyword=swimming',
      '<div data-sku="100226966445">游泳浮板 ¥53.1 京东自营旗舰店</div>',
    );
    await expect(search.func(page, { query: 'swimming', limit: 5 }))
      .resolves.toEqual([expect.objectContaining({
        sku: '100226966445',
        price: '¥53.1',
        url: 'https://item.jd.com/100226966445.html',
      })]);
  });

  it('preserves genuine empty search results on the search domain', async () => {
    const page = pageAt('https://search.jd.com/Search?keyword=none', '<div>没有相关商品</div>');
    await expect(search.func(page, { query: 'none', limit: 5 })).resolves.toEqual([]);
  });
});
