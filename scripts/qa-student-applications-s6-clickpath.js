const bcrypt = require("bcryptjs");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient, ApplicationStatus, CourseLevel } = require("@prisma/client");

dotenv.config({ path: ".env.local" });
dotenv.config();

const BASE = process.env.BASE_URL || "http://localhost:3105";
const PASSWORD = "Pass1234!";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

let cleanedUp = false;

function tag() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(-6)}`;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  await prisma.$disconnect();
  await pool.end();
}

async function upsertRoleUser(roleName, email, name) {
  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) throw new Error(`Role ${roleName} not found`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  return prisma.user.upsert({
    where: { email },
    update: { name, roleId: role.id, password: passwordHash, isActive: true },
    create: { email, name, roleId: role.id, password: passwordHash, isActive: true },
  });
}

async function ensureStudent(userId, email, assignedCounsellorId) {
  const payload = {
    firstName: "S6",
    lastName: "QA",
    email,
    phone: "+8801000099999",
    nationality: "Bangladesh",
    country: "Bangladesh",
    assignedCounsellorId,
  };

  const existing = await prisma.student.findUnique({ where: { userId } });
  if (existing) {
    return prisma.student.update({ where: { id: existing.id }, data: payload });
  }

  return prisma.student.create({
    data: {
      userId,
      ...payload,
    },
  });
}

async function ensureUniversity(name, country, logo) {
  const existing = await prisma.university.findFirst({ where: { name } });
  if (existing) {
    return prisma.university.update({
      where: { id: existing.id },
      data: {
        country,
        currency: country === "UK" ? "GBP" : "CAD",
        logo,
        isActive: true,
      },
    });
  }

  return prisma.university.create({
    data: {
      name,
      country,
      currency: country === "UK" ? "GBP" : "CAD",
      logo,
      isActive: true,
    },
  });
}

async function ensureCourse(universityId, name, field, fee) {
  const existing = await prisma.course.findFirst({ where: { universityId, name } });
  if (existing) {
    return prisma.course.update({
      where: { id: existing.id },
      data: {
        level: CourseLevel.MASTERS,
        fieldOfStudy: field,
        duration: "12 months",
        studyMode: "FULL_TIME",
        tuitionFee: fee,
        applicationFee: 50,
        currency: "GBP",
        intakeDatesWithDeadlines: [{ date: "2026-09", deadline: "2026-07-01" }],
        isActive: true,
      },
    });
  }

  return prisma.course.create({
    data: {
      universityId,
      name,
      level: CourseLevel.MASTERS,
      fieldOfStudy: field,
      duration: "12 months",
      studyMode: "FULL_TIME",
      tuitionFee: fee,
      applicationFee: 50,
      currency: "GBP",
      intakeDatesWithDeadlines: [{ date: "2026-09", deadline: "2026-07-01" }],
      isActive: true,
    },
  });
}

async function seedFixture() {
  const seedTag = tag();

  const counsellorUser = await upsertRoleUser("COUNSELLOR", `qa.s6.counsellor.${seedTag}@example.com`, "S6 QA Counsellor");
  const studentWithAppsUser = await upsertRoleUser("STUDENT", `qa.s6.student.withapp.${seedTag}@example.com`, "S6 QA Student");
  const studentNoAppsUser = await upsertRoleUser("STUDENT", `qa.s6.student.noapp.${seedTag}@example.com`, "S6 QA NoApps");

  const studentWithApps = await ensureStudent(studentWithAppsUser.id, studentWithAppsUser.email, counsellorUser.id);
  const studentNoApps = await ensureStudent(studentNoAppsUser.id, studentNoAppsUser.email, counsellorUser.id);

  const ukUni = await ensureUniversity(`S6 QA UK University ${seedTag}`, "UK", "/images/logo.png");
  const caUni = await ensureUniversity(`S6 QA CA University ${seedTag}`, "Canada", "/images/logo.png");

  const noOfferCourse = await ensureCourse(ukUni.id, `S6 No Offer Course ${seedTag}`, "Computer Science", 16000);
  const offerCourse = await ensureCourse(caUni.id, `S6 Offer Course ${seedTag}`, "Data Science", 18000);

  await prisma.application.deleteMany({
    where: {
      studentId: studentWithApps.id,
      courseId: { in: [noOfferCourse.id, offerCourse.id] },
    },
  });

  const noOfferApp = await prisma.application.create({
    data: {
      studentId: studentWithApps.id,
      courseId: noOfferCourse.id,
      universityId: noOfferCourse.universityId,
      counsellorId: counsellorUser.id,
      status: ApplicationStatus.DOCUMENTS_PENDING,
      submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      offerReceivedAt: null,
    },
  });

  const offerApp = await prisma.application.create({
    data: {
      studentId: studentWithApps.id,
      courseId: offerCourse.id,
      universityId: offerCourse.universityId,
      counsellorId: counsellorUser.id,
      status: ApplicationStatus.CONDITIONAL_OFFER,
      submittedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      offerReceivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.documentChecklist.deleteMany({
    where: { applicationId: { in: [noOfferApp.id, offerApp.id] } },
  });

  await prisma.documentChecklist.create({
    data: {
      studentId: studentWithApps.id,
      applicationId: noOfferApp.id,
      destinationCountry: "UK",
      status: "IN_PROGRESS",
      items: {
        create: [
          { documentType: "PASSPORT", label: "Passport", status: "VERIFIED", isRequired: true },
          { documentType: "TRANSCRIPT", label: "Transcript", status: "PENDING", isRequired: true },
        ],
      },
    },
  });

  await prisma.documentChecklist.create({
    data: {
      studentId: studentWithApps.id,
      applicationId: offerApp.id,
      destinationCountry: "CA",
      status: "UNDER_REVIEW",
      items: {
        create: [
          { documentType: "PASSPORT", label: "Passport", status: "VERIFIED", isRequired: true },
        ],
      },
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        userId: counsellorUser.id,
        entityType: "application",
        entityId: noOfferApp.id,
        action: "status_change",
        details: JSON.stringify({ status: "DOCUMENTS_PENDING", notes: "Documents requested" }),
      },
      {
        userId: counsellorUser.id,
        entityType: "application",
        entityId: offerApp.id,
        action: "status_change",
        details: JSON.stringify({ status: "SUBMITTED", notes: "Submitted to university" }),
      },
      {
        userId: counsellorUser.id,
        entityType: "application",
        entityId: offerApp.id,
        action: "status_change",
        details: JSON.stringify({ status: "CONDITIONAL_OFFER", notes: "Offer received" }),
      },
      {
        userId: counsellorUser.id,
        entityType: "application",
        entityId: offerApp.id,
        action: "offer_letter_uploaded",
        details: JSON.stringify({
          documentId: `offer-${seedTag}`,
          fileName: `offer-${seedTag}.pdf`,
          fileUrl: `${BASE}/student`,
          ocr: {
            courseFee: 18000,
            scholarship: 2000,
            currency: "CAD",
            extractedText: "QA seeded offer letter",
            confidence: 0.95,
          },
          uploadedAt: new Date().toISOString(),
        }),
      },
    ],
  });

  await prisma.communication.create({
    data: {
      studentId: studentWithApps.id,
      userId: counsellorUser.id,
      type: "EMAIL",
      subject: "Welcome update",
      message: "Please review the latest steps for your application.",
      direction: "OUTBOUND",
      isRead: false,
    },
  });

  const scholarship = await prisma.scholarship.create({
    data: {
      universityId: offerApp.universityId,
      courseId: offerApp.courseId,
      name: `S6 Scholarship ${seedTag}`,
      description: "S6 QA scholarship",
      amount: 2500,
      currency: "CAD",
      amountType: "FIXED",
      isPartial: true,
      eligibilityCriteria: "Open to high-performing students",
      nationalityRestrictions: [],
      isActive: true,
    },
  });

  await prisma.studentScholarshipApplication.deleteMany({
    where: { studentId: studentWithApps.id, scholarshipId: scholarship.id },
  });

  await prisma.studentScholarshipApplication.create({
    data: {
      studentId: studentWithApps.id,
      scholarshipId: scholarship.id,
      applicationId: offerApp.id,
      status: "INTERESTED",
      notes: "QA seed",
    },
  });

  await prisma.application.deleteMany({
    where: { studentId: studentNoApps.id },
  });

  return {
    withAppsEmail: studentWithAppsUser.email,
    noAppsEmail: studentNoAppsUser.email,
    noOfferAppId: noOfferApp.id,
    offerAppId: offerApp.id,
  };
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  const hasEmailInput = await page.$("#email");
  if (!hasEmailInput) {
    const currentPath = await page.evaluate(() => window.location.pathname);
    if (currentPath !== "/login") {
      return;
    }
    await page.waitForSelector("#email", { timeout: 15000 });
  }

  await page.click("#email", { clickCount: 3 });
  await page.type("#email", email);
  await page.click("#password", { clickCount: 3 });
  await page.type("#password", PASSWORD);
  await page.click('button[type="submit"]');

  await Promise.race([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => null),
    page.waitForFunction(() => window.location.pathname !== "/login", { timeout: 45000 }).catch(() => null),
  ]);

  const stillOnLogin = await page.evaluate(() => window.location.pathname === "/login");
  if (stillOnLogin) {
    const loginError = await page.evaluate(() => {
      const node = document.querySelector(".bg-red-50");
      return (node?.textContent || "").trim();
    });
    throw new Error(`Login did not redirect for ${email}${loginError ? ` | UI error: ${loginError}` : ""}`);
  }
}

async function runQa() {
  const fixture = await seedFixture();
  const browser = await puppeteer.launch({ headless: true });
  let currentStep = "init";

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await login(page, fixture.withAppsEmail);

    currentStep = "1";
    // 1. /student/applications loads correctly showing application cards
    await page.goto(`${BASE}/student/applications`, { waitUntil: "networkidle2" });
    await page.waitForSelector("h1.text-2xl");
    const cardsLoaded = await page.evaluate(() => {
      const heading = document.body.innerText.includes("My Applications");
      const cardCount = document.querySelectorAll("article.rounded-2xl").length;
      return heading && cardCount >= 2;
    });
    assertCondition(cardsLoaded, "[1] Applications list did not load with cards");

    currentStep = "3";
    // 3. Card fields must exist
    const cardFieldsPresent = await page.evaluate(() => {
      const first = document.querySelector("article.rounded-2xl");
      if (!first) return false;
      const hasLogo = !!first.querySelector("img");
      const text = first.textContent || "";
      const hasCourse = text.includes("Course") || text.includes("S6");
      const hasIntake = text.includes("Intake:");
      const hasStatus = !!first.querySelector("span.rounded-full");
      const hasNextAction = text.includes("Next action:");
      const hasProgress = first.querySelectorAll("div.h-1.rounded").length > 0;
      return hasLogo && hasCourse && hasIntake && hasStatus && hasNextAction && hasProgress;
    });
    assertCondition(cardFieldsPresent, "[3] Card is missing one or more required elements");

    currentStep = "4";
    // 4. View Full Details opens detail page
    await page.waitForFunction((targetAppId) => {
      return document.querySelector(`a[href="/student/applications/${targetAppId}"]`) !== null;
    }, {}, fixture.noOfferAppId);

    const openedDetails = await page.evaluate((targetAppId) => {
      const link = document.querySelector(`a[href="/student/applications/${targetAppId}"]`);
      if (!link) return false;
      link.click();
      return true;
    }, fixture.noOfferAppId);
    assertCondition(openedDetails, "[4] View Full Details link not found");
    await page.waitForFunction((id) => window.location.pathname === `/student/applications/${id}`, {}, fixture.noOfferAppId);

    currentStep = "5";
    // 5. Detail page has all 6 tabs
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("button")).map((node) => (node.textContent || "").trim());
      return ["Progress Timeline", "Documents", "Offer Letter", "Finance", "Scholarships", "Messages"].every((tab) => labels.includes(tab));
    }, { timeout: 30000 });

    const tabsVisible = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("button")).map((node) => (node.textContent || "").trim());
      return ["Progress Timeline", "Documents", "Offer Letter", "Finance", "Scholarships", "Messages"].every((tab) => labels.includes(tab));
    });
    assertCondition(tabsVisible, "[5] Not all 6 tabs are visible on detail page");

    currentStep = "6";
    // 6. Progress timeline checks
    const timelineOk = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasNext = text.includes("What happens next?");
      const hasPulseCurrent = document.querySelector(".animate-pulse") !== null;
      const hasCompletedBlue = document.querySelectorAll(".bg-blue-600").length > 0;
      const hasFutureGrey = document.querySelectorAll(".bg-slate-100, .bg-slate-200").length > 0;
      const isVertical = document.querySelectorAll(".border-l, .border-l-2").length > 0 || document.querySelectorAll(".flex-col").length > 4;
      return hasNext && hasPulseCurrent && hasCompletedBlue && hasFutureGrey && isVertical;
    });
    assertCondition(timelineOk, "[6] Timeline visuals/structure did not meet expected behavior");

    currentStep = "7";
    // 7. Documents tab checklist + ring + upload buttons
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Documents");
      if (tab) tab.click();
    });
    await sleep(500);
    const docsOk = await page.evaluate(() => {
      const hasRing = document.querySelectorAll("svg circle").length >= 2;
      const text = document.body.innerText;
      const hasChecklist = text.includes("Document progress") || text.includes("Verified");
      const hasUpload = text.includes("Upload") && text.includes("Take Photo with Phone");
      return hasRing && hasChecklist && hasUpload;
    });
    assertCondition(docsOk, "[7] Documents tab did not show checklist ring/upload controls");

    currentStep = "8-no-offer";
    // 8. Offer tab no-offer padlock
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Offer Letter");
      if (tab) tab.click();
    });
    await sleep(400);
    const noOfferPadlock = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("You will be able to view your offer letter here once received") && document.querySelector("svg") !== null;
    });
    assertCondition(noOfferPadlock, "[8] No-offer state did not show padlock message");

    currentStep = "9-locked";
    // 9. Finance lock before offer
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Finance");
      if (tab) tab.click();
    });
    await sleep(400);
    const financeLocked = await page.evaluate(() => {
      return document.body.innerText.includes("Finance section unlocks after offer letter is received.");
    });
    assertCondition(financeLocked, "[9] Finance did not show lock message before offer");

    currentStep = "12-back-1";
    // 12. Back button
    await page.click('a[href="/student/applications"]');
    await page.waitForFunction(() => window.location.pathname === "/student/applications");
    await page.waitForFunction((targetAppId) => {
      return document.querySelector(`a[href="/student/applications/${targetAppId}"]`) !== null;
    }, {}, fixture.offerAppId);

    currentStep = "4-offer";
    // open offer app detail
    const openedOfferDetails = await page.evaluate((targetAppId) => {
      const link = document.querySelector(`a[href="/student/applications/${targetAppId}"]`);
      if (!link) return false;
      link.click();
      return true;
    }, fixture.offerAppId);
    assertCondition(openedOfferDetails, "[8/9/10/11] Offer app detail link not found");
    await page.waitForFunction((id) => window.location.pathname === `/student/applications/${id}`, {}, fixture.offerAppId);
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("button")).map((node) => (node.textContent || "").trim());
      return ["Progress Timeline", "Documents", "Offer Letter", "Finance", "Scholarships", "Messages"].every((tab) => labels.includes(tab));
    }, { timeout: 30000 });

    currentStep = "8-offer-exists";
    // 8 (offer exists): document + download
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Offer Letter");
      if (tab) tab.click();
    });
    await sleep(450);
    const offerExistsUi = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasDoc = text.includes("Offer Letter Document");
      const hasDownload = Array.from(document.querySelectorAll("a")).some((a) => (a.textContent || "").includes("Download"));
      return hasDoc && hasDownload;
    });
    assertCondition(offerExistsUi, "[8] Offer document/download not shown when offer exists");

    currentStep = "9-unlocked";
    // 9 unlock after offer
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Finance");
      if (tab) tab.click();
    });
    await sleep(1200);
    const financeUnlocked = await page.evaluate(() => {
      const text = document.body.innerText;
      return !text.includes("Finance section unlocks after offer letter is received") && (
        text.includes("Funding")
        || text.includes("Deposit")
        || text.includes("Bank")
        || text.includes("Total to Show in Bank")
      );
    });
    assertCondition(financeUnlocked, "[9] Finance did not unlock after offer letter");

    currentStep = "10";
    // 10 scholarships tab
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Scholarships");
      if (tab) tab.click();
    });
    await sleep(500);
    const scholarshipsOk = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("Interested") && text.includes("Applied") && text.includes("Scholarship");
    });
    assertCondition(scholarshipsOk, "[10] Scholarships tab missing expected linked scholarship/actions");

    currentStep = "11";
    // 11 messages tab
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Messages");
      if (tab) tab.click();
    });
    await page.waitForFunction(() => {
      return document.body.innerText.includes("Application messages with your counsellor");
    }, { timeout: 15000 });
    await page.waitForSelector('textarea[placeholder*="Type your message"]', { timeout: 15000 });

    const messagesOk = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasThread = text.includes("Application messages with your counsellor");
      const hasCounsellorMessage =
        text.includes("Please review the latest steps for your application.")
        || text.includes("COUNSELLOR");
      const hasInput = document.querySelector('textarea[placeholder*="Type your message"]') !== null;
      return hasThread && hasCounsellorMessage && hasInput;
    });
    assertCondition(messagesOk, "[11] Messages tab did not show counsellor thread");

    currentStep = "12-back-2";
    // 12 back button again
    await page.click('a[href="/student/applications"]');
    await page.waitForFunction(() => window.location.pathname === "/student/applications");

    currentStep = "2";
    // 2 empty state on no-app student
    const noAppsContext = await browser.createBrowserContext();
    const page2 = await noAppsContext.newPage();
    await page2.setViewport({ width: 1440, height: 900 });
    await login(page2, fixture.noAppsEmail);
    await page2.goto(`${BASE}/student/applications`, { waitUntil: "networkidle2" });
    const emptyStateOk = await page2.evaluate(() => {
      const text = document.body.innerText;
      const hasEmpty = text.includes("No applications yet") && text.includes("Start exploring courses");
      const hasButton = Array.from(document.querySelectorAll("a")).some((a) => (a.textContent || "").includes("Start Exploring Courses") && a.getAttribute("href") === "/student/courses");
      return hasEmpty && hasButton;
    });
    assertCondition(emptyStateOk, "[2] Empty state/button did not render correctly");
    await noAppsContext.close();

    console.log("S6_APPLICATIONS_CLICKPATH_PASS");
  } catch (error) {
    console.error("S6 QA failed at step", currentStep);
    throw error;
  } finally {
    await browser.close();
  }
}

runQa()
  .catch((error) => {
    console.error("S6_APPLICATIONS_CLICKPATH_FAIL", error.message);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
