import { chromium } from 'playwright-core';

export async function connectCdp(wsEndpoint, fn) {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  try {
    const ctx = browser.contexts()[0];
    const page = ctx?.pages()[0];
    if (!page) throw new Error('No active page in browser session.');
    return await fn(page, browser, ctx);
  } finally {
    await browser.close();
  }
}

export async function inspectPageViaCdp(wsEndpoint) {
  return connectCdp(wsEndpoint, async page => page.evaluate(() => {
    const imgs = Array.from(document.images);
    const brokenImages = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
    const bodyText = document.body?.innerText?.trim() || '';
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      bodyChars: bodyText.length,
      links: document.querySelectorAll('a[href]').length,
      images: imgs.length,
      brokenImages,
      hasVisibleContent: bodyText.length > 0 || document.body?.children?.length > 0,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      scroll: { x: scrollX, y: scrollY }
    };
  }));
}
