const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 120000 });
  await page.screenshot({ path: '/tmp/eduquantica-login.png', fullPage: true });

  const result = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const buttons = Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim());
    const hasSignIn = buttons.some((t) => /sign in/i.test(t));

    const allElements = Array.from(document.querySelectorAll('*'));
    const hasNavyBackground = allElements.some((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      const r = Number(m[1]);
      const g = Number(m[2]);
      const b = Number(m[3]);
      return r <= 40 && g <= 70 && b >= 80 && b <= 140;
    });

    const hasGoldBranding = allElements.some((el) => {
      const values = [getComputedStyle(el).color, getComputedStyle(el).backgroundColor];
      return values.some((v) => {
        const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return false;
        const r = Number(m[1]);
        const g = Number(m[2]);
        const b = Number(m[3]);
        return r >= 180 && r <= 255 && g >= 120 && g <= 220 && b <= 120;
      });
    });

    const inputStyles = Array.from(document.querySelectorAll('input')).map((input) => {
      const s = getComputedStyle(input);
      return {
        borderRadius: s.borderRadius,
        borderWidth: s.borderWidth,
        paddingLeft: s.paddingLeft,
      };
    });

    const inputsStyled = inputStyles.length > 0 && inputStyles.every((s) => s.borderRadius !== '0px' && s.paddingLeft !== '0px');

    return {
      title: document.title,
      hasEduQuanticaText: /eduquantica/i.test(text),
      hasSignIn,
      hasNavyBackground,
      hasGoldBranding,
      inputsStyled,
      inputCount: inputStyles.length,
      screenshot: '/tmp/eduquantica-login.png',
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
