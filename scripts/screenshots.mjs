// Génère les maquettes de docs/maquettes depuis l'app web lancée sur :3000 (mode démo).
// Usage : pnpm --filter @kairos/web build && pnpm --filter @kairos/web start & node scripts/screenshots.mjs
import { chromium } from 'playwright';
const out = new URL('../docs/maquettes/', import.meta.url).pathname;
const browser = await chromium.launch();
const errors = [];
async function shoot(name, path, { dark = false, mobile = false, action } = {}) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, colorScheme: dark ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage();
  // Horloge figée : lundi 28 septembre 2026, 10:20 (Paris) pour des maquettes représentatives.
  await page.clock.install({ time: new Date('2026-09-28T08:20:00Z') });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (action) await action(page);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: !mobile && !name.includes('commande') && !name.includes('detail') });
  await ctx.close();
}
await shoot('01-dashboard-clair', '/');
await shoot('02-dashboard-sombre', '/', { dark: true });
await shoot('03-taches-liste', '/tasks');
await shoot('04-taches-chronologie', '/tasks', { action: async (p) => { await p.getByRole('tab', { name: 'Chronologie' }).click(); await p.waitForTimeout(300); } });
await shoot('05-calendrier-semaine', '/calendar');
await shoot('06-emails', '/inbox');
await shoot('07-productivite', '/analytics');
await shoot('08-assistant', '/assistant', { action: async (p) => { await p.getByRole('button', { name: "Quelles sont mes priorités aujourd'hui ?" }).click(); await p.waitForTimeout(400); } });
await shoot('09-parametres', '/settings');
await shoot('10-detail-tache', '/tasks', { action: async (p) => { await p.getByText('Rédiger le PV de contrôle — entrepôt Lesquin').first().click(); await p.waitForTimeout(400); } });
await shoot('11-barre-commande', '/', { action: async (p) => { await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.keyboard.type('Appeler la banque vendredi 10h #sci !urgent 30min'); await p.waitForTimeout(300); } });
await shoot('12-mobile-dashboard', '/', { mobile: true });
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
