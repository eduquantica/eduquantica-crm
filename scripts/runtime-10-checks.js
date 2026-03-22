const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
const creds = {
  admin: { email: 'admin@eduquantica.com', password: 'Admin123!', expectedPath: '/dashboard' },
  agent: { email: 'agent@eduquantica.com', password: 'Agent123!', expectedPath: '/agent/dashboard' },
  student: { email: 'student@eduquantica.com', password: 'Student123!', expectedPath: '/student/dashboard' },
};

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
}

async function loginAs(browser, { email, password, expectedPath }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#email', { timeout: 20000 });

  await page.click('#email', { clickCount: 3 });
  await page.type('#email', email);
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', password);

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null),
  ]);

  for (let i = 0; i < 20; i += 1) {
    if (page.url().includes(expectedPath)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { context, page };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    // 1) Login page styled
    {
      const page = await browser.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
      const bg = await page.$eval('button[type="submit"]', (el) => getComputedStyle(el).backgroundColor);
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        pass('check-1-login-style', `button bg=${bg}`);
      } else {
        fail('check-1-login-style', `button bg=${bg}`);
      }
      await page.close();
    }

    // 2-5) Admin checks
    {
      const { context, page } = await loginAs(browser, creds.admin);
      const url = page.url();
      if (url.includes('/dashboard')) pass('check-2-admin-login-redirect', url);
      else fail('check-2-admin-login-redirect', url);

      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('aside.flex.flex-col.h-screen.w-64', { timeout: 20000 });

      const sidebarCount = await page.$$eval('aside.flex.flex-col.h-screen.w-64', (els) => els.length);
      if (sidebarCount === 1) pass('check-3-admin-single-sidebar', `count=${sidebarCount}`);
      else fail('check-3-admin-single-sidebar', `count=${sidebarCount}`);

      const sidebarBg = await page.$eval('aside.flex.flex-col.h-screen.w-64', (el) => getComputedStyle(el).backgroundColor);
      if (sidebarBg.includes('27, 42, 74')) pass('check-4-admin-sidebar-navy', sidebarBg);
      else fail('check-4-admin-sidebar-navy', sidebarBg);

      const navVertical = await page.$eval('aside.flex.flex-col.h-screen.w-64 nav', (el) => {
        const style = getComputedStyle(el);
        return style.display === 'flex' && style.flexDirection === 'column';
      });
      if (navVertical) pass('check-5-admin-nav-vertical');
      else fail('check-5-admin-nav-vertical');

      await context.close();
    }

    // 6-8) Agent checks
    {
      const { context, page } = await loginAs(browser, creds.agent);
      const url = page.url();
      if (url.includes('/agent/dashboard')) pass('check-6-agent-login-redirect', url);
      else fail('check-6-agent-login-redirect', url);

      await page.goto(`${BASE}/agent/dashboard`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('aside.flex.flex-col.h-screen.w-64', { timeout: 20000 });

      const sidebarCount = await page.$$eval('aside.flex.flex-col.h-screen.w-64', (els) => els.length);
      if (sidebarCount === 1) pass('check-7-agent-single-sidebar', `count=${sidebarCount}`);
      else fail('check-7-agent-single-sidebar', `count=${sidebarCount}`);

      const loadingStillVisible = await page.evaluate(() => (document.body.innerText || '').includes('Loading dashboard...'));
      if (!loadingStillVisible) pass('check-8-agent-dashboard-not-stuck-loading');
      else fail('check-8-agent-dashboard-not-stuck-loading');

      await context.close();
    }

    // 9-10) Student checks
    {
      const { context, page } = await loginAs(browser, creds.student);
      const url = page.url();
      if (url.includes('/student/dashboard')) pass('check-9-student-login-redirect', url);
      else fail('check-9-student-login-redirect', url);

      await page.goto(`${BASE}/student/dashboard`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('aside.flex.flex-col.h-screen.w-64', { timeout: 20000 });

      const sidebarCount = await page.$$eval('aside.flex.flex-col.h-screen.w-64', (els) => els.length);
      const navVertical = await page.$eval('aside.flex.flex-col.h-screen.w-64 nav', (el) => {
        const style = getComputedStyle(el);
        return style.display === 'flex' && style.flexDirection === 'column';
      });

      if (sidebarCount === 1 && navVertical) {
        pass('check-10-student-sidebar-single-and-vertical', `count=${sidebarCount}`);
      } else {
        fail('check-10-student-sidebar-single-and-vertical', `count=${sidebarCount}, navVertical=${navVertical}`);
      }

      await context.close();
    }
  } catch (error) {
    fail('runner-exception', String(error));
  } finally {
    await browser.close();
  }

  let failed = 0;
  console.log('\n10-CHECK RESULTS');
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? ` :: ${result.detail}` : ''}`);
    if (!result.ok) failed += 1;
  }

  if (results.length !== 10) {
    console.log(`FAIL expected 10 checks, got ${results.length}`);
    process.exit(2);
  }

  if (failed > 0) {
    console.log(`FAILED: ${failed} checks failed.`);
    process.exit(1);
  }

  console.log('SUCCESS: all 10 checks passed.');
})();
