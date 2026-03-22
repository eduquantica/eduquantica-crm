const fs = require('fs');
const bcrypt = require('bcryptjs');
const puppeteer = require('puppeteer');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, ApplicationStatus, CourseLevel, ImmigrationAlertStatus, ImmigrationMonitorStatus } = require('@prisma/client');

dotenv.config({ path: '.env.local' });

dotenv.config();

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const PASSWORD = 'Pass1234!';
const LOG_FILE = '/tmp/eduqa-dev.log';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function tag() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const t = String(d.getTime()).slice(-6);
  return `${d.getFullYear()}${m}${day}-${t}`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertRoleUser(roleName, email, name) {
  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) throw new Error(`Missing role ${roleName}`);
  const hash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { password: hash, roleId: role.id, name, isActive: true },
    create: { email, password: hash, roleId: role.id, name, isActive: true },
  });
}

async function ensureSubAgent(userId, agencyName) {
  const existing = await prisma.subAgent.findUnique({ where: { userId } });
  if (existing) {
    return prisma.subAgent.update({
      where: { id: existing.id },
      data: {
        agencyName,
        isApproved: true,
        approvalStatus: 'APPROVED',
        commissionRate: 80,
      },
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
  });
}

async function ensureStudent({ userId, email, firstName, lastName, subAgentId = null, assignedCounsellorId = null }) {
  const existing = await prisma.student.findUnique({ where: { userId } });
  if (existing) {
    return prisma.student.update({
      where: { id: existing.id },
      data: { email, firstName, lastName, subAgentId, assignedCounsellorId },
    });
  }

  return prisma.student.create({
    data: {
      userId,
      email,
      firstName,
      lastName,
      subAgentId,
      assignedCounsellorId,
      nationality: 'Bangladesh',
      country: 'Bangladesh',
    },
  });
}

async function ensureUniversity(name, country) {
  const existing = await prisma.university.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.university.create({
    data: {
      name,
      country,
      currency: country === 'UK' ? 'GBP' : country === 'CA' ? 'CAD' : 'USD',
      isActive: true,
    },
  });
}

async function ensureCourse(universityId, name) {
  const existing = await prisma.course.findFirst({ where: { universityId, name } });
  if (existing) return existing;

  return prisma.course.create({
    data: {
      universityId,
      name,
      level: CourseLevel.MASTERS,
      duration: '12 months',
      currency: 'GBP',
      tuitionFee: 15000,
      isActive: true,
    },
  });
}

async function ensureApplication(studentId, courseId, universityId, counsellorId, createdAt) {
  const existing = await prisma.application.findFirst({
    where: { studentId, courseId, universityId },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return prisma.application.update({
      where: { id: existing.id },
      data: {
        counsellorId,
        status: ApplicationStatus.DRAFT,
        createdAt,
      },
    });
  }

  return prisma.application.create({
    data: {
      studentId,
      courseId,
      universityId,
      counsellorId,
      status: ApplicationStatus.DRAFT,
      createdAt,
    },
  });
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.click('#email', { clickCount: 3 });
  await page.type('#email', email);
  await page.click('#password', { clickCount: 3 });
  await page.type('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await sleep(1200);
}

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const res = await fetch(path, options);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, ok: res.ok, json };
  }, { path, options });
}

async function setupFixture() {
  const id = tag();

  const admin = await upsertRoleUser('ADMIN', `qa.admin.${id}@example.com`, 'QA Admin');
  const counsellor = await upsertRoleUser('COUNSELLOR', `qa.counsellor.${id}@example.com`, 'QA Counsellor');
  const manager = await upsertRoleUser('MANAGER', `qa.manager.${id}@example.com`, 'QA Manager');
  const subUser = await upsertRoleUser('SUB_AGENT', `qa.subagent.${id}@example.com`, 'QA SubAgent');
  const studentAffectedUser = await upsertRoleUser('STUDENT', `qa.student.uk.${id}@example.com`, 'QA Student UK');
  const studentOtherUser = await upsertRoleUser('STUDENT', `qa.student.ca.${id}@example.com`, 'QA Student CA');

  const subAgent = await ensureSubAgent(subUser.id, `QA Agency ${id}`);

  const studentAffected = await ensureStudent({
    userId: studentAffectedUser.id,
    email: studentAffectedUser.email,
    firstName: 'QA',
    lastName: 'StudentUK',
    subAgentId: subAgent.id,
    assignedCounsellorId: counsellor.id,
  });

  const studentOther = await ensureStudent({
    userId: studentOtherUser.id,
    email: studentOtherUser.email,
    firstName: 'QA',
    lastName: 'StudentCA',
    subAgentId: subAgent.id,
    assignedCounsellorId: counsellor.id,
  });

  const uniUk = await ensureUniversity(`QA UK University ${id}`, 'UK');
  const uniCa = await ensureUniversity(`QA CA University ${id}`, 'CA');

  const courseUk = await ensureCourse(uniUk.id, `QA MSc UK ${id}`);
  const courseCa = await ensureCourse(uniCa.id, `QA MSc CA ${id}`);

  const oldAppDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const appAffected = await ensureApplication(studentAffected.id, courseUk.id, uniUk.id, counsellor.id, oldAppDate);
  await ensureApplication(studentOther.id, courseCa.id, uniCa.id, counsellor.id, oldAppDate);

  await prisma.activityLog.create({
    data: {
      userId: admin.id,
      entityType: 'application',
      entityId: appAffected.id,
      action: 'offer_letter_uploaded',
      details: JSON.stringify({
        documentId: `offer-${id}`,
        fileName: `offer-${id}.pdf`,
        fileUrl: `${BASE}/student`,
        ocr: {
          courseFee: 15000,
          scholarship: 0,
          currency: 'GBP',
          extractedText: 'QA seeded offer letter',
          confidence: 0.95,
        },
        uploadedAt: new Date().toISOString(),
      }),
    },
  });

  await prisma.notification.deleteMany({
    where: {
      userId: { in: [admin.id, counsellor.id, manager.id, subUser.id, studentAffectedUser.id, studentOtherUser.id] },
    },
  });

  await prisma.activityLog.deleteMany({
    where: {
      entityType: 'notification_settings',
      userId: { in: [admin.id, counsellor.id, manager.id, subUser.id, studentAffectedUser.id, studentOtherUser.id] },
    },
  });

  const pageUrl = `${BASE}/login?immigration-qa=${id}`;
  let monitoredPage = await prisma.immigrationMonitoredPage.findUnique({ where: { pageUrl } });
  if (!monitoredPage) {
    monitoredPage = await prisma.immigrationMonitoredPage.create({
      data: {
        country: 'UK',
        pageUrl,
        isActive: true,
        status: ImmigrationMonitorStatus.ACTIVE,
      },
    });
  }

  await prisma.immigrationRuleAlert.deleteMany({ where: { monitoredPageId: monitoredPage.id } });
  await prisma.immigrationPageSnapshot.create({
    data: {
      monitoredPageId: monitoredPage.id,
      contentHash: crypto.createHash('sha256').update(`OLD-${id}`).digest('hex'),
      keyContent: `Old immigration rule text for QA ${id}`,
      rawContent: `Old raw content ${id}`,
    },
  });

  return {
    id,
    users: {
      admin,
      counsellor,
      manager,
      subUser,
      studentAffectedUser,
      studentOtherUser,
    },
    entities: {
      monitoredPage,
      appAffected,
    },
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');

  const fixture = await setupFixture();
  const { users, entities } = fixture;

  const browser = await puppeteer.launch({ headless: true });
  const result = {
    admin: {},
    counsellorManager: {},
    subAgent: {},
    student: {},
  };

  try {
    const adminCtx = await browser.createBrowserContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, users.admin.email);

    const noSecret = await api(adminPage, '/api/cron/immigration-monitor');
    assert(noSecret.status === 401, `Cron unauth check expected 401 got ${noSecret.status}`);

    if (process.env.CRON_SECRET) {
      const withSecret = await api(adminPage, '/api/cron/immigration-monitor', {
        method: 'GET',
        headers: { 'x-cron-secret': process.env.CRON_SECRET },
      });
      assert(withSecret.status !== 404, 'Cron route missing');
      result.admin.cronEndpoint = withSecret.status;
    } else {
      result.admin.cronEndpoint = 'CRON_SECRET not set; existence verified via 401';
    }

    const pagesRes = await api(adminPage, '/api/admin/settings/immigration-monitor/pages');
    assert(pagesRes.ok, 'Failed to load monitored pages as admin');
    const monitored = pagesRes.json.data.find((p) => p.pageUrl === entities.monitoredPage.pageUrl);
    assert(monitored?.id, 'Seeded monitored page not found from API');

    const triggerRes = await api(adminPage, `/api/admin/settings/immigration-monitor/pages/${monitored.id}/check`, {
      method: 'POST',
    });
    assert(triggerRes.ok, `Check-now failed: ${JSON.stringify(triggerRes.json)}`);
    assert(triggerRes.json?.data?.changed === true, 'Expected check-now to detect change');

    const notificationsAfterDetect = await api(adminPage, '/api/notifications?limit=100');
    assert(notificationsAfterDetect.ok, 'Admin notifications fetch failed');
    const detectNotif = (notificationsAfterDetect.json.data || []).find((n) => n.type === 'IMMIGRATION_RULE_CHANGE');
    assert(detectNotif, 'Admin did not receive change-detected notification');

    const alertId = new URL(detectNotif.linkUrl, BASE).searchParams.get('immigrationAlertId');
    assert(alertId, 'immigrationAlertId missing from notification link');

    const alertsRes = await api(adminPage, '/api/admin/settings/immigration-monitor/alerts');
    assert(alertsRes.ok, 'Failed to fetch immigration alerts');
    const pendingAlert = (alertsRes.json.data || []).find((a) => a.id === alertId);
    assert(pendingAlert, 'Pending alert not found');
    const currentMonthlySetting = Number(pendingAlert.currentSettingMonthlyLivingCost || 0);
    const updatedMonthlySetting = currentMonthlySetting + 321;

    const beforeFinance = await api(adminPage, `/api/dashboard/applications/${entities.appAffected.id}/finance`);
    assert(beforeFinance.ok, 'Failed to fetch finance before publish');
    const beforeTotal = beforeFinance.json?.data?.summary?.totalToShowInBank;
    assert(typeof beforeTotal === 'number', 'Missing before totalToShowInBank');

    await adminPage.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle2' });
    await adminPage.waitForSelector('h2');
    const pageText = await adminPage.content();
    assert(pageText.includes('Immigration Monitor'), 'Immigration Monitor section missing in settings');

    const oldNewSection = await adminPage.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div'));
      return all.some((node) => {
        const text = (node.textContent || '');
        return text.includes('Old text') && text.includes('New text');
      });
    });
    assert(oldNewSection, 'Old vs new text comparison not shown');

    const reviewHref = await adminPage.$eval(`a[href="${entities.monitoredPage.pageUrl}"]`, (el) => el.getAttribute('href'));
    assert(reviewHref === entities.monitoredPage.pageUrl, 'Review Official Page button href incorrect');

    const updateSettingsHref = await adminPage.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const target = anchors.find((a) => (a.textContent || '').includes('Update Settings'));
      return target ? target.getAttribute('href') : null;
    });
    assert(
      updateSettingsHref && updateSettingsHref.includes('/dashboard/settings#financial-requirements'),
      `Update Settings link incorrect: ${updateSettingsHref}`,
    );

    const financialPut = await api(adminPage, '/api/admin/settings/financial-requirements', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: [
          {
            countryCode: 'UK',
            countryName: 'United Kingdom',
            monthlyLivingCost: updatedMonthlySetting,
            currency: 'GBP',
            defaultMonths: 9,
            rules: ['QA updated rule'],
          },
        ],
      }),
    });
    assert(financialPut.ok, `Failed updating financial settings: ${JSON.stringify(financialPut.json)}`);

    await adminPage.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle2' });
    await sleep(400);

    const clickedConfirm = await adminPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => (b.textContent || '').includes('Confirm and Publish Update'));
      if (!btn) return false;
      btn.click();
      return true;
    });
    assert(clickedConfirm, 'Confirm and Publish Update button not found');

    await sleep(2200);

    const alertsAfterConfirm = await api(adminPage, '/api/admin/settings/immigration-monitor/alerts');
    assert(alertsAfterConfirm.ok, 'Alerts fetch failed after confirm');
    const alertAfter = (alertsAfterConfirm.json.data || []).find((a) => a.id === alertId);
    assert(alertAfter, 'Alert missing after confirm');
    assert(alertAfter.status === ImmigrationAlertStatus.CONFIRMED_PUBLISHED, `Alert not confirmed: ${alertAfter.status}`);

    const changelog = await prisma.immigrationRuleChangelog.findUnique({ where: { alertId } });
    assert(changelog, 'Changelog entry missing after confirm');

    const afterFinance = await api(adminPage, `/api/dashboard/applications/${entities.appAffected.id}/finance`);
    assert(afterFinance.ok, 'Failed to fetch finance after publish');
    const afterTotal = afterFinance.json?.data?.summary?.totalToShowInBank;
    assert(typeof afterTotal === 'number', 'Missing after totalToShowInBank');
    assert(afterTotal !== beforeTotal, `Total Amount to Show in Bank did not recalculate (${beforeTotal} -> ${afterTotal})`);

    result.admin = {
      ...result.admin,
      detectedNotification: true,
      oldVsNewComparison: true,
      reviewOfficialPage: true,
      updateSettingsLink: updateSettingsHref,
      confirmPublish: true,
      changelogLogged: Boolean(changelog),
      monitorSectionVisible: true,
      totalToShowInBankBefore: beforeTotal,
      totalToShowInBankAfter: afterTotal,
    };

    await adminCtx.close();

    const counsellorCtx = await browser.createBrowserContext();
    const counsellorPage = await counsellorCtx.newPage();
    await login(counsellorPage, users.counsellor.email);

    const counsellorNotifs = await api(counsellorPage, '/api/notifications?limit=100');
    assert(counsellorNotifs.ok, 'Counsellor notifications API failed');
    assert(
      (counsellorNotifs.json.data || []).some((n) => n.type === 'IMMIGRATION_RULE_PUBLISHED_COUNSELLOR'),
      'Counsellor did not receive publish notification',
    );

    await counsellorPage.goto(`${BASE}/dashboard/applications`, { waitUntil: 'networkidle2' });
    const counsellorHasBanner = await counsellorPage.content();
    assert(counsellorHasBanner.includes('Financial requirements updated - re-review'), 'Counsellor applications amber banner missing');

    await counsellorCtx.close();

    const managerCtx = await browser.createBrowserContext();
    const managerPage = await managerCtx.newPage();
    await login(managerPage, users.manager.email);

    const managerNotifs = await api(managerPage, '/api/notifications?limit=100');
    assert(managerNotifs.ok, 'Manager notifications API failed');
    assert(
      (managerNotifs.json.data || []).some((n) => n.type === 'IMMIGRATION_RULE_PUBLISHED_COUNSELLOR'),
      'Manager did not receive publish notification',
    );

    await managerPage.goto(`${BASE}/dashboard/applications`, { waitUntil: 'networkidle2' });
    const managerHasBanner = await managerPage.content();
    assert(managerHasBanner.includes('Financial requirements updated - re-review'), 'Manager applications amber banner missing');

    await managerCtx.close();

    await sleep(1200);
    const devLog = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
    const counsellorEmailLogged = devLog.includes(users.counsellor.email) && devLog.includes('financial requirements updated');
    const managerEmailLogged = devLog.includes(users.manager.email) && devLog.includes('financial requirements updated');
    assert(counsellorEmailLogged, 'Counsellor email summary not observed in dev email logs');
    assert(managerEmailLogged, 'Manager email summary not observed in dev email logs');

    result.counsellorManager = {
      portalNotification: true,
      amberBanner: true,
      emailSummary: true,
    };

    const subCtx = await browser.createBrowserContext();
    const subPage = await subCtx.newPage();
    await login(subPage, users.subUser.email);

    const subNotifs = await api(subPage, '/api/notifications?limit=100');
    assert(subNotifs.ok, 'Sub-agent notifications API failed');
    assert(
      (subNotifs.json.data || []).some((n) => n.type === 'IMMIGRATION_RULE_PUBLISHED_SUB_AGENT'),
      'Sub-agent did not receive publish notification',
    );

    await subPage.goto(`${BASE}/agent/students`, { waitUntil: 'networkidle2' });
    const subFlag = await subPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows.find((r) => (r.textContent || '').includes('QA StudentUK'));
      if (!row) return false;
      return Boolean(row.querySelector('svg.text-amber-500'));
    });
    assert(subFlag, 'Sub-agent student list flag icon missing for affected student');

    await subCtx.close();

    result.subAgent = {
      portalNotification: true,
      studentFlagIcon: true,
    };

    const studentCtx = await browser.createBrowserContext();
    const studentPage = await studentCtx.newPage();
    await login(studentPage, users.studentAffectedUser.email);

    const studentNotifs = await api(studentPage, '/api/notifications?limit=100');
    assert(studentNotifs.ok, 'Student notifications API failed');
    assert(
      (studentNotifs.json.data || []).some((n) => n.type === 'IMMIGRATION_RULE_PUBLISHED_STUDENT'),
      'Affected student did not receive publish notification',
    );

    await studentPage.goto(`${BASE}/student/applications/${entities.appAffected.id}/finance`, { waitUntil: 'networkidle2' });
    const studentFinanceApi = await api(studentPage, `/api/dashboard/applications/${entities.appAffected.id}/finance`);
    assert(studentFinanceApi.ok, 'Student finance API failed');
    assert(Boolean(studentFinanceApi.json?.data?.immigrationUpdate), 'Student finance API missing immigration update payload');

    await studentPage.waitForFunction(() => document.body.innerText.includes('Financial Summary'), { timeout: 60000 });
    const studentAmberBanner = await studentPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('div.border-amber-200.bg-amber-50'));
      return nodes.some((node) => (node.textContent || '').includes('Financial requirements updated - re-review'));
    });
    assert(studentAmberBanner, 'Student finance amber banner missing');

    await studentCtx.close();

    const studentOtherCtx = await browser.createBrowserContext();
    const studentOtherPage = await studentOtherCtx.newPage();
    await login(studentOtherPage, users.studentOtherUser.email);

    const studentOtherNotifs = await api(studentOtherPage, '/api/notifications?limit=100');
    assert(studentOtherNotifs.ok, 'Other student notifications API failed');
    assert(
      !(studentOtherNotifs.json.data || []).some((n) => n.type === 'IMMIGRATION_RULE_PUBLISHED_STUDENT'),
      'Unaffected student incorrectly received publish notification',
    );

    await studentOtherCtx.close();

    result.student = {
      affectedPortalNotification: true,
      destinationCountryOnly: true,
      financeAmberBanner: true,
      recalculatedTotalToShowInBank: true,
    };

    console.log('IMMIGRATION_QA_PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error('IMMIGRATION_QA_FAIL', error.message);
  try {
    await prisma.$disconnect();
  } catch {}
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
