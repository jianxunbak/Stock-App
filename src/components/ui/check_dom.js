const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto('http://localhost:5173/analysis?ticker=AAPL', {waitUntil: 'networkidle2'});
        const html = await page.evaluate(() => {
            const btn = document.querySelector('.base-chart-controls .neu-btn-base');
            if(btn) btn.click();
            return new Promise(resolve => {
                setTimeout(() => {
                    const menus = document.querySelectorAll('.dropdown-menu-container');
                    if (menus.length === 0) resolve("No menu found");
                    else resolve(menus[menus.length-1].outerHTML);
                }, 500);
            });
        });
        console.log(html);
        await browser.close();
    } catch (e) { console.log(e.message); process.exit(1); }
})();
