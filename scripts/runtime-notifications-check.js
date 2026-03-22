const bcrypt = require('bcryptjs');
const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Pass1234!';

function todayTag() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${m}${day}`;
}

async function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertRoleUser(roleName, email, name) {
  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) throw new Error(`Role ${roleName} missing`);
  const hash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { password: hash, name, roleId: role.id, isActive: true },
    create: { email, password: hash, name, roleId: role.id, isActive: true },
  });
}

async function ensureStudent(userId, email) {
  const existing = await prisma.student.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.student.create({
    data: { userId, firstName: 'Runtime', lastName: 'Student', email },
  });
}

async function ensureSubAgent(userId) {
  const existing = await prisma.subAgent.findUnique({ where: { userId } });
  if (existing) {
    return prisma.subAgent.update({
      where: { id: existing.id },
      data: { isApproved: true, approvalStatus: 'APPROVED' },
    });
  }
  return prisma.subAgent.create({
    data: {
      userId,
      agencyName: 'Runtime QA Agency',
      isApproved: true,
      approvalStatus: 'APPROVED',
      commissionRate: 80,
    },
  });
}

async function seed() {
  const tag = todayTag();
  const admin = await upsertRoleUser('ADMIN', `runtime.admin.${tag}@example.com`, 'Runtime Admin');
  const sub = await upsertRoleUser('SUB_AGENT', `runtime.subagent.${tag}@example.com`, 'Runtime Subagent');
  const stu = await upsertRoleUser('STUDENT', `runtime.student.${tag}@example.com`, 'Runtime Student');

  await ensureSubAgent(sub.id);
  await ensureStudent(stu.id, stu.email);

  await Promise.all([
    prisma.notification.deleteMany({ where: { userId: admin.id } }),
    prisma.notification.deleteMany({ where: { userId: sub.id } }),
    prisma.notification.deleteMany({ where: { userId: stu.id } }),
  ]);

  const now = Date.now();
  await prisma.notification.createMany({
    data: [
      ...Array.from({ length: 12 }, (_, i) => ({
        userId: admin.id,
        type: 'SYSTEM_TEST',
        message: `ADMIN_ONLY_${i + 1}`,
        linkUrl: i === 0 ? '/dashboard/settings' : '/dashboard',
        isRead: false,
        createdAt: new Date(now - i * 1000),
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        userId: sub.id,
        type: 'SYSTEM_TEST',
        message: `SUBAGENT_ONLY_${i + 1}`,
        linkUrl: '/agent/dashboard',
        isRead: false,
        createdAt: new Date(now - i * 1000),
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        userId: stu.id,
        type: 'SYSTEM_TEST',
        message: `STUDENT_ONLY_${i + 1}`,
        linkUrl: '/student',
        isRead: false,
        createdAt: new Date(now - i * 1000),
      })),
    ],
  });

  return {
    admin: { email: admin.email, expectedUnread: 12 },
    sub: { email: sub.email, expectedUnread: 4 },
    stu: { email: stu.email, expectedUnread: 5 },
  };
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('#email', { clickCount: 3 });
  await page.type('#email', email);
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await sleep(1500);
}

async function api(page, path = '/api/notifications?limit=50') {
  return page.evaluate(async (p) => {
    const res = await fetch(p);
    return res.json();
  }, path);
}

async function clickButtonByText(page, text) {
  const handles = await page.$$('button, a');
  for (const h of handles) {
    const t = await page.evaluate((el) => (el.textContent || '').trim(), h);
    if (t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

async function ensureNotificationsOpen(page) {
  const panel = await page.$('div.absolute.right-0.mt-2.z-20');
  if (!panel) {
    await page.click('button[aria-label="Notifications"]');
    await page.waitForSelector('div.absolute.right-0.mt-2.z-20');
  }
}

async function checkAdmin(browser, creds) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await login(page, creds.email);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });

  const a1 = await api(page);
  const badge = await page.$eval('button[aria-label="Notifications"] span', (el) => (el.textContent || '').trim());
  await assert(badge === '9+', `Admin badge expected 9+, got ${badge}`);
  await assert(a1.unreadCount === creds.expectedUnread, `Admin API unread expected ${creds.expectedUnread}, got ${a1.unreadCount}`);

  await ensureNotificationsOpen(page);
  await page.waitForSelector('div.max-h-72');
  const count = await page.$$eval('div.max-h-72 > button', (els) => els.length);
  await assert(count === 10, `Admin dropdown should show 10, got ${count}`);

  await page.click('div.max-h-72 > button:first-child');
  await page.waitForFunction(() => location.pathname === '/dashboard/settings', { timeout: 10000 });
  const a2 = await api(page);
  await assert(a2.unreadCount === creds.expectedUnread - 1, `Admin click-read failed: ${a2.unreadCount}`);

  await ensureNotificationsOpen(page);
  await page.waitForSelector('div.max-h-72');
  const okMark = await clickButtonByText(page, 'Mark all read');
  await assert(okMark, 'Mark all read button missing');
  await sleep(500);
  const a3 = await api(page);
  await assert(a3.unreadCount === 0, `Admin mark-all failed unread=${a3.unreadCount}`);

  await ensureNotificationsOpen(page);
  const openedViewAll = await clickButtonByText(page, 'View all');
  await assert(openedViewAll, 'Admin View all link missing');
  await page.waitForFunction(() => location.pathname === '/notifications', { timeout: 10000 });

  for (const tab of ['All', 'Unread', 'Applications', 'Documents', 'Commissions', 'System']) {
    const clicked = await clickButtonByText(page, tab);
    await assert(clicked, `Admin tab missing ${tab}`);
    await sleep(200);
  }
  await context.close();
}

async function checkSub(browser, creds) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await login(page, creds.email);
  await page.goto(`${BASE}/agent/dashboard`, { waitUntil: 'networkidle2' });

  await page.waitForSelector('button[aria-label="Notifications"]');
  const a = await api(page);
  const badge = await page.$eval('button[aria-label="Notifications"] span', (el) => (el.textContent || '').trim());
  await assert(a.unreadCount === creds.expectedUnread, `Sub unread mismatch API=${a.unreadCount}`);
  await assert(badge === String(creds.expectedUnread), `Sub badge mismatch ${badge}`);

  await page.click('button[aria-label="Notifications"]');
  await page.waitForSelector('div.max-h-72');
  const texts = await page.$$eval('div.max-h-72 > button', (els) => els.map((e) => (e.textContent || '').trim()));
  await assert(texts.some((t) => t.includes('SUBAGENT_ONLY_')), 'Sub own notifications missing');
  await assert(!texts.some((t) => t.includes('ADMIN_ONLY_') || t.includes('STUDENT_ONLY_')), 'Sub sees foreign notifications');

  await context.close();
}

async function checkStudent(browser, creds) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await login(page, creds.email);
  await page.goto(`${BASE}/student`, { waitUntil: 'networkidle2' });

  await page.waitForSelector('button[aria-label="Notifications"]');
  const a = await api(page);
  const badge = await page.$eval('button[aria-label="Notifications"] span', (el) => (el.textContent || '').trim());
  await assert(a.unreadCount === creds.expectedUnread, `Student unread mismatch API=${a.unreadCount}`);
  await assert(badge === String(creds.expectedUnread), `Student badge mismatch ${badge}`);

  await page.click('button[aria-label="Notifications"]');
  await page.waitForSelector('div.max-h-72');
  const texts = await page.$$eval('div.max-h-72 > button', (els) => els.map((e) => (e.textContent || '').trim()));
  await assert(texts.some((t) => t.includes('STUDENT_ONLY_')), 'Student own notifications missing');
  await assert(!texts.some((t) => t.includes('ADMIN_ONLY_') || t.includes('SUBAGENT_ONLY_')), 'Student sees foreign notifications');

  await page.goto(`${BASE}/student/notifications`, { waitUntil: 'networkidle2' });
  for (const tab of ['All', 'Unread', 'Applications', 'Documents', 'Commissions', 'System']) {
    const clicked = await clickButtonByText(page, tab);
    await assert(clicked, `Student tab missing ${tab}`);
  }
  await context.close();
}

async function main() {
  const creds = await seed();
  const browser = await puppeteer.launch({ headless: true });
  try {
    await checkAdmin(browser, creds.admin);
    await checkSub(browser, creds.sub);
    await checkStudent(browser, creds.stu);
    console.log('RUNTIME_CHECKLIST_PASS');
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error('RUNTIME_CHECKLIST_FAIL', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
