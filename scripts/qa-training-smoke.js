require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

const bcrypt = require('bcryptjs');
const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = process.env.QA_PASSWORD || 'Pass1234!';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function tag() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function roleId(name) {
  const role = await prisma.role.findFirst({ where: { name }, select: { id: true } });
  if (!role) throw new Error(`Missing role ${name}`);
  return role.id;
}

async function upsertUser(email, name, roleName) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, password: hash, roleId: await roleId(roleName), isActive: true },
    create: { email, name, password: hash, roleId: await roleId(roleName), isActive: true },
    select: { id: true, email: true, name: true },
  });
}

async function ensureSubAgent(userId, agencyName) {
  const existing = await prisma.subAgent.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    return prisma.subAgent.update({
      where: { id: existing.id },
      data: { agencyName, isApproved: true, approvalStatus: 'APPROVED' },
      select: { id: true },
    });
  }
  return prisma.subAgent.create({
    data: {
      userId,
      agencyName,
      isApproved: true,
      approvalStatus: 'APPROVED',
      commissionRate: 80,
    },
    select: { id: true },
  });
}

async function ensureSubAgentStaff(subAgentId, user, role = 'BRANCH_COUNSELLOR') {
  const existing = await prisma.subAgentStaff.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (existing) {
    return prisma.subAgentStaff.update({
      where: { id: existing.id },
      data: { subAgentId, role, name: user.name, email: user.email, isActive: true },
      select: { id: true },
    });
  }
  return prisma.subAgentStaff.create({
    data: {
      subAgentId,
      userId: user.id,
      name: user.name,
      email: user.email,
      role,
      isActive: true,
    },
    select: { id: true },
  });
}

async function clearTrainingForUsers(userIds) {
  const records = await prisma.trainingRecord.findMany({ where: { userId: { in: userIds } }, select: { trainingId: true } });
  const trainingIds = [...new Set(records.map((r) => r.trainingId))];
  await prisma.trainingRecord.deleteMany({ where: { userId: { in: userIds } } });
  if (trainingIds.length) {
    const orphanIds = [];
    for (const tid of trainingIds) {
      const count = await prisma.trainingRecord.count({ where: { trainingId: tid } });
      if (count === 0) orphanIds.push(tid);
    }
    if (orphanIds.length) await prisma.training.deleteMany({ where: { id: { in: orphanIds } } });
  }
}

async function seedTrainingRecord({ userId, orgId, orgType, name, status, expiryOffsetDays }) {
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() - 5);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryOffsetDays);

  const training = await prisma.training.create({
    data: {
      organisationId: orgId,
      organisationType: orgType,
      name,
      deliveredBy: 'QA Trainer',
      createdBy: userId,
      expiryDate,
      isRecurring: true,
      recurringMonths: 12,
    },
    select: { id: true },
  });

  return prisma.trainingRecord.create({
    data: {
      trainingId: training.id,
      userId,
      completionDate,
      expiryDate,
      status,
      notes: 'seeded',
    },
  });
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email', { timeout: 30000 });
  await page.click('#email', { clickCount: 3 });
  await page.type('#email', email);
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', PASSWORD);
  await page.click('button[type="submit"]');

  await Promise.race([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null),
    page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 45000 }).catch(() => null),
  ]);

  const stillOnLogin = await page.evaluate(() => window.location.pathname === '/login');
  if (stillOnLogin) {
    const loginError = await page.evaluate(() => {
      const node = document.querySelector('.bg-red-50');
      return (node?.textContent || '').trim();
    });
    throw new Error(`Login did not redirect for ${email}${loginError ? ` | UI error: ${loginError}` : ''}`);
  }
}

async function clickByText(page, selector, text) {
  return page.evaluate(({ selector, text }) => {
    const nodes = Array.from(document.querySelectorAll(selector));
    const target = nodes.find((node) => {
      const label = (node.textContent || '').trim();
      if (!label.includes(text)) return false;
      const html = node;
      if (!(html instanceof HTMLElement)) return false;
      if (html.hasAttribute('disabled')) return false;
      const style = window.getComputedStyle(html);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return true;
    });

    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, { selector, text });
}

async function selectByLabel(page, labelText, value) {
  const ok = await page.evaluate(({ labelText, value }) => {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((l) => (l.textContent || '').trim().includes(labelText));
    if (!label) return false;
    const container = label.parentElement;
    if (!container) return false;
    const select = container.querySelector('select');
    if (!select) return false;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { labelText, value });
  await assert(ok, `Label select not found: ${labelText}`);
}

async function inputByLabel(page, labelText, value) {
  const ok = await page.evaluate(({ labelText, value }) => {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((l) => (l.textContent || '').trim().includes(labelText));
    if (!label) return false;
    const container = label.parentElement;
    if (!container) return false;
    const input = container.querySelector('input,textarea');
    if (!input) return false;
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { labelText, value });
  await assert(ok, `Label input not found: ${labelText}`);
}

async function clickRowAction(page, rowText, action) {
  const ok = await page.evaluate(({ rowText, action }) => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const row = rows.find((r) => (r.textContent || '').includes(rowText));
    if (!row) return false;
    const buttons = Array.from(row.querySelectorAll('button'));
    const btn = buttons.find((b) => (b.textContent || '').trim().includes(action));
    if (!btn) return false;
    btn.click();
    return true;
  }, { rowText, action });
  await assert(ok, `Action ${action} not found for row ${rowText}`);
}

async function run() {
  const idTag = tag();

  const admin = await upsertUser('admin@eduquantica.com', 'QA Admin', 'ADMIN');
  const manager = await upsertUser('manager@eduquantica.com', 'QA Manager', 'MANAGER');
  const counsellor = await upsertUser('counsellor@eduquantica.com', 'QA Counsellor', 'COUNSELLOR');

  const subOwner = await upsertUser('agent@eduquantica.com', 'QA Sub Owner', 'SUB_AGENT');
  const branch = await upsertUser(`qa.branch.training.${idTag}@example.com`, 'QA Branch', 'SUB_AGENT');
  const sub2Owner = await upsertUser(`qa.subowner2.training.${idTag}@example.com`, 'QA Other Owner', 'SUB_AGENT');
  const sub2Branch = await upsertUser(`qa.branch2.training.${idTag}@example.com`, 'QA Other Branch', 'SUB_AGENT');

  const sa1 = await ensureSubAgent(subOwner.id, `QA Agency ${idTag}`);
  const sa2 = await ensureSubAgent(sub2Owner.id, `QA Other Agency ${idTag}`);
  await ensureSubAgentStaff(sa1.id, branch);
  await ensureSubAgentStaff(sa2.id, sub2Branch);

  await clearTrainingForUsers([admin.id, manager.id, counsellor.id, subOwner.id, branch.id, sub2Owner.id, sub2Branch.id]);

  await seedTrainingRecord({ userId: counsellor.id, orgId: 'EDUQUANTICA', orgType: 'EDUQUANTICA', name: `QA Active ${idTag}`, status: 'ACTIVE', expiryOffsetDays: 60 });
  await seedTrainingRecord({ userId: counsellor.id, orgId: 'EDUQUANTICA', orgType: 'EDUQUANTICA', name: `QA ExpSoon ${idTag}`, status: 'EXPIRING_SOON', expiryOffsetDays: 10 });
  await seedTrainingRecord({ userId: counsellor.id, orgId: 'EDUQUANTICA', orgType: 'EDUQUANTICA', name: `QA Expired ${idTag}`, status: 'EXPIRED', expiryOffsetDays: -2 });
  await seedTrainingRecord({ userId: branch.id, orgId: sa1.id, orgType: `SUBAGENT_${sa1.id}`, name: `QA SA1 ${idTag}`, status: 'ACTIVE', expiryOffsetDays: 40 });
  await seedTrainingRecord({ userId: sub2Branch.id, orgId: sa2.id, orgType: `SUBAGENT_${sa2.id}`, name: `QA SA2 ${idTag}`, status: 'ACTIVE', expiryOffsetDays: 40 });

  const browser = await puppeteer.launch({ headless: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  await login(page, admin.email);
  await page.goto(`${BASE}/dashboard/training`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('table');

  const pageText = await page.$eval('body', (el) => el.textContent || '');
  await assert(pageText.includes('Training'), 'Dashboard training page did not load');
  await assert(pageText.includes(`QA Active ${idTag}`), 'Register missing seeded rows');

  await clickByText(page, 'button', 'Add Training');
  await page.waitForSelector('form');

  const modalText = await page.$eval('form', (el) => el.textContent || '');
  for (const field of ['Staff', 'Training Name', 'Delivered By', 'Completion Date', 'Expiry Date', 'Recurring', 'Certificate URL', 'Notes']) {
    await assert(modalText.includes(field), `Add modal missing field: ${field}`);
  }

  await selectByLabel(page, 'Staff', counsellor.id);
  await inputByLabel(page, 'Training Name', `QA Create ${idTag}`);
  await inputByLabel(page, 'Delivered By', 'QA Coach');
  await inputByLabel(page, 'Completion Date', new Date().toISOString().slice(0, 10));
  const exp = new Date(); exp.setDate(exp.getDate() + 45);
  await inputByLabel(page, 'Expiry Date', exp.toISOString().slice(0, 10));
  await inputByLabel(page, 'Notes', 'Created from smoke test');

  await clickByText(page, 'button', 'Save');
  await page.waitForFunction((tag) => (document.body.textContent || '').includes(`QA Create ${tag}`), {}, idTag);

  await clickRowAction(page, `QA Create ${idTag}`, 'Edit');
  await inputByLabel(page, 'Delivered By', 'QA Coach Updated');
  await clickByText(page, 'button', 'Save');
  await page.waitForFunction(() => !document.body.textContent.includes('Saving...'));

  await clickRowAction(page, `QA Create ${idTag}`, 'Renew');
  const renewExp = new Date(); renewExp.setDate(renewExp.getDate() + 90);
  await inputByLabel(page, 'Expiry Date', renewExp.toISOString().slice(0, 10));
  await clickByText(page, 'button', 'Renew');
  await page.waitForFunction(() => !document.body.textContent.includes('Saving...'));

  await clickRowAction(page, `QA Create ${idTag}`, 'Delete');
  await page.waitForFunction(() => (document.body.textContent || '').includes('Delete Training Record'));
  await clickByText(page, 'button', 'Delete');
  await page.waitForFunction((tag) => !(document.body.textContent || '').includes(`QA Create ${tag}`), {}, idTag);

  await assert((await page.$eval('body', (el) => el.innerHTML)).includes('bg-emerald-100'), 'Active badge color class missing');
  await assert((await page.$eval('body', (el) => el.innerHTML)).includes('bg-amber-100'), 'Expiring soon badge color class missing');
  await assert((await page.$eval('body', (el) => el.innerHTML)).includes('bg-rose-100'), 'Expired badge color class missing');

  await page.select('select', counsellor.id);
  await clickByText(page, 'button', 'Apply');
  await sleep(500);
  const afterStaffFilter = await page.$eval('tbody', (el) => el.textContent || '');
  await assert(afterStaffFilter.includes('QA Counsellor'), 'Staff filter failed');

  const selects = await page.$$('select');
  await selects[1].select('EXPIRED');
  await clickByText(page, 'button', 'Apply');
  await sleep(500);
  const afterStatusFilter = await page.$eval('tbody', (el) => el.textContent || '');
  await assert(afterStatusFilter.includes('EXPIRED'), 'Status filter failed');

  await clickByText(page, 'button', 'All Organisations');
  await page.waitForTimeout(300);
  const exportCsv = await page.evaluate(async () => {
    const res = await fetch('/api/dashboard/training/export?scope=all');
    const text = await res.text();
    return { ok: res.ok, contentType: res.headers.get('content-type') || '', text };
  });
  await assert(exportCsv.ok && exportCsv.contentType.includes('text/csv') && exportCsv.text.includes('trainingName'), 'CSV export failed');

  await page.goto(`${BASE}/dashboard/users/${counsellor.id}`, { waitUntil: 'networkidle2' });
  const profileText = await page.$eval('body', (el) => el.textContent || '');
  await assert(profileText.includes('Training Records'), 'Dashboard profile training section missing');
  await clickByText(page, 'button', 'Add Record');
  await inputByLabel(page, 'Training Name', `QA Profile ${idTag}`);
  await inputByLabel(page, 'Completion Date', new Date().toISOString().slice(0, 10));

  const tempFile = '/tmp/qa-training-cert.txt';
  require('fs').writeFileSync(tempFile, 'qa certificate');
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(tempFile);
  await clickByText(page, 'button', 'Save');
  await page.waitForFunction((tag) => (document.body.textContent || '').includes(`QA Profile ${tag}`), {}, idTag);
  const href = await page.$eval('tbody a', (el) => el.getAttribute('href') || '');
  await assert(href.includes('/api/files/'), 'Certificate link was not generated from upload');

  await context.close();

  const ctx2 = await browser.createBrowserContext();
  const page2 = await ctx2.newPage();
  await login(page2, subOwner.email);
  await page2.goto(`${BASE}/agent/training`, { waitUntil: 'networkidle2' });
  await page2.waitForSelector('table');

  const text2 = await page2.$eval('body', (el) => el.textContent || '');
  await assert(text2.includes(`QA SA1 ${idTag}`), 'Agent register missing own records');
  await assert(!text2.includes(`QA SA2 ${idTag}`), 'Agent register leaked other org records');

  await clickByText(page2, 'button', 'Add Training');
  await page2.waitForSelector('form');

  const optionsText = await page2.$$eval('select option', (opts) => opts.map((o) => o.textContent || '').join('|'));
  await assert(optionsText.includes('QA Sub Owner') && optionsText.includes('QA Branch'), 'Sub-agent staff options missing expected users');
  await assert(!optionsText.includes('QA Other Branch'), 'Sub-agent staff dropdown includes other organisation');

  await selectByLabel(page2, 'Staff', branch.id);
  await inputByLabel(page2, 'Training Name', `QA AgentCreate ${idTag}`);
  await inputByLabel(page2, 'Completion Date', new Date().toISOString().slice(0, 10));
  await clickByText(page2, 'button', 'Save');
  await page2.waitForFunction((tag) => (document.body.textContent || '').includes(`QA AgentCreate ${tag}`), {}, idTag);

  await clickRowAction(page2, `QA AgentCreate ${idTag}`, 'Edit');
  await inputByLabel(page2, 'Delivered By', 'Agent Coach');
  await clickByText(page2, 'button', 'Save');

  await clickRowAction(page2, `QA AgentCreate ${idTag}`, 'Renew');
  await clickByText(page2, 'button', 'Renew');

  await clickRowAction(page2, `QA AgentCreate ${idTag}`, 'Delete');
  await clickByText(page2, 'button', 'Delete');
  await page2.waitForFunction((tag) => !(document.body.textContent || '').includes(`QA AgentCreate ${tag}`), {}, idTag);

  await page2.goto(`${BASE}/agent/team/${branch.id}`, { waitUntil: 'networkidle2' });
  const agentProfile = await page2.$eval('body', (el) => el.textContent || '');
  await assert(agentProfile.includes('Training Records'), 'Agent team profile training section missing');

  await clickByText(page2, 'button', 'Add Record');
  await inputByLabel(page2, 'Training Name', `QA AgentProfile ${idTag}`);
  await inputByLabel(page2, 'Completion Date', new Date().toISOString().slice(0, 10));
  await clickByText(page2, 'button', 'Save');
  await page2.waitForFunction((tag) => (document.body.textContent || '').includes(`QA AgentProfile ${tag}`), {}, idTag);

  const cronExists = require('fs').existsSync('app/api/cron/check-training-expiry/route.ts');
  await assert(cronExists, 'Cron route file missing');

  await ctx2.close();
  await browser.close();

  console.log('✅ Training smoke flow passed');
}

run()
  .catch(async (err) => {
    console.error('❌ Training smoke flow failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  });
