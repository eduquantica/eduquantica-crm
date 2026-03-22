const bcrypt = require("bcryptjs");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient, ApplicationStatus, CourseLevel, MatchStatus, ProgrammeLevel, QualType } = require("@prisma/client");

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

async function sleep(ms) {
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
    firstName: "S4",
    lastName: "QA",
    email,
    phone: "+8801000001234",
    nationality: "Bangladesh",
    country: "Bangladesh",
    passportNumber: "BD8899001",
    passportExpiry: new Date("2031-12-31"),
    address: "Dhaka",
    city: "Dhaka",
    assignedCounsellorId,
    englishTestType: "IELTS",
    englishTestScore: "7.0",
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

async function ensureAcademicProfileComplete(studentId) {
  const profile = await prisma.studentAcademicProfile.upsert({
    where: { studentId },
    update: { isComplete: true },
    create: {
      studentId,
      isComplete: true,
    },
  });

  const qual = await prisma.studentQualification.findFirst({
    where: { academicProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  if (!qual) {
    await prisma.studentQualification.create({
      data: {
        academicProfileId: profile.id,
        qualType: QualType.HSC,
        qualName: "HSC",
        institutionName: "Dhaka Board",
        yearCompleted: 2023,
        overallGrade: "GPA 4.8",
        overallUniversal: 88,
      },
    });
  }
}

async function ensureUniversity(name, country, qs, times) {
  const existing = await prisma.university.findFirst({ where: { name } });
  if (existing) {
    return prisma.university.update({
      where: { id: existing.id },
      data: {
        country,
        currency: country === "UK" ? "GBP" : "CAD",
        isActive: true,
        qsRanking: qs,
        timesHigherRanking: times,
        postStudyWorkVisa: "Available",
      },
    });
  }

  return prisma.university.create({
    data: {
      name,
      country,
      currency: country === "UK" ? "GBP" : "CAD",
      isActive: true,
      qsRanking: qs,
      timesHigherRanking: times,
      postStudyWorkVisa: "Available",
    },
  });
}

async function ensureCourse(universityId, name, field, fee, level = CourseLevel.MASTERS) {
  const existing = await prisma.course.findFirst({ where: { universityId, name } });
  if (existing) {
    return prisma.course.update({
      where: { id: existing.id },
      data: {
        level,
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
      level,
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

async function ensureEntryRequirements(courseId) {
  const entry = await prisma.courseEntryRequirement.upsert({
    where: { courseId },
    update: {
      acceptedQualTypes: [QualType.HSC, QualType.A_LEVEL],
      overallMinUniversal: 70,
      overallDescription: "Standard entry requirements",
      englishReqIelts: 6.0,
      englishReqPte: 58,
      englishReqToefl: 80,
      additionalNotes: "Personalised by nationality",
    },
    create: {
      courseId,
      acceptedQualTypes: [QualType.HSC, QualType.A_LEVEL],
      overallMinUniversal: 70,
      overallDescription: "Standard entry requirements",
      englishReqIelts: 6.0,
      englishReqPte: 58,
      englishReqToefl: 80,
      additionalNotes: "Personalised by nationality",
    },
  });

  await prisma.countryEntryRequirement.upsert({
    where: {
      entryReqId_countryCode_programmeLevel: {
        entryReqId: entry.id,
        countryCode: "BD",
        programmeLevel: ProgrammeLevel.MASTERS,
      },
    },
    update: {
      qualificationType: "HSC",
      minGradeDescription: "Minimum GPA 4.0",
      minUniversalScore: 75,
      requiredSubjects: "Mathematics, English",
    },
    create: {
      entryReqId: entry.id,
      countryCode: "BD",
      programmeLevel: ProgrammeLevel.MASTERS,
      qualificationType: "HSC",
      minGradeDescription: "Minimum GPA 4.0",
      minUniversalScore: 75,
      requiredSubjects: "Mathematics, English",
    },
  });
}

async function ensureScholarship(universityId, courseId, name) {
  const existing = await prisma.scholarship.findFirst({ where: { courseId, name } });
  if (existing) {
    return prisma.scholarship.update({
      where: { id: existing.id },
      data: {
        universityId,
        isActive: true,
        amount: 2000,
        currency: "GBP",
        amountType: "FIXED",
        eligibilityCriteria: "Open to high-performing students",
      },
    });
  }

  return prisma.scholarship.create({
    data: {
      universityId,
      courseId,
      name,
      description: "S4 QA scholarship",
      amount: 2000,
      currency: "GBP",
      amountType: "FIXED",
      isPartial: true,
      eligibilityCriteria: "Open to high-performing students",
      nationalityRestrictions: [],
      isActive: true,
    },
  });
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.click("#email", { clickCount: 3 });
  await page.type("#email", email);
  await page.click("#password", { clickCount: 3 });
  await page.type("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle2" });
}

async function getWishlistIdsFromBrowser(page) {
  return page.evaluate(async () => {
    const res = await fetch("/api/student/wishlist");
    const json = await res.json();
    return json?.data?.courseIds || [];
  });
}

async function seedFixture() {
  const seedTag = tag();

  const counsellorUser = await upsertRoleUser("COUNSELLOR", `qa.s4.counsellor.${seedTag}@example.com`, "S4 QA Counsellor");
  const studentUser = await upsertRoleUser("STUDENT", `qa.s4.student.${seedTag}@example.com`, "S4 QA Student");

  const student = await ensureStudent(studentUser.id, studentUser.email, counsellorUser.id);
  await ensureAcademicProfileComplete(student.id);

  const ukUni = await ensureUniversity(`S4 QA UK University ${seedTag}`, "UK", 90, 120);
  const ukUni2 = await ensureUniversity(`S4 QA UK University B ${seedTag}`, "UK", 110, 160);
  const caUni = await ensureUniversity(`S4 QA CA University ${seedTag}`, "Canada", 130, 220);

  const searchCourse = await ensureCourse(ukUni.id, `S4 Search Alpha ${seedTag}`, "Computer Science", 15500);
  const duplicateCourse = await ensureCourse(ukUni2.id, `S4 Duplicate Guard ${seedTag}`, "Data Science", 16500);
  const nonEligibleCourse = await ensureCourse(caUni.id, `S4 Canada Beta ${seedTag}`, "Business", 14000);

  await ensureEntryRequirements(searchCourse.id);
  await ensureScholarship(ukUni.id, searchCourse.id, `S4 Scholarship ${seedTag}`);

  await prisma.application.deleteMany({
    where: {
      studentId: student.id,
      courseId: { in: [searchCourse.id, duplicateCourse.id, nonEligibleCourse.id] },
    },
  });

  const duplicateApp = await prisma.application.create({
    data: {
      studentId: student.id,
      courseId: duplicateCourse.id,
      universityId: duplicateCourse.universityId,
      counsellorId: counsellorUser.id,
      status: ApplicationStatus.SUBMITTED,
    },
    select: { id: true },
  });

  await prisma.courseEligibilityResult.deleteMany({
    where: {
      studentId: student.id,
      courseId: { in: [searchCourse.id, duplicateCourse.id, nonEligibleCourse.id] },
    },
  });

  await prisma.courseEligibilityResult.createMany({
    data: [
      {
        studentId: student.id,
        courseId: searchCourse.id,
        matchStatus: MatchStatus.FULL_MATCH,
        overallMet: true,
        matchScore: 88,
        subjectResults: [],
        missingSubjects: [],
        weakSubjects: [],
        englishMet: true,
      },
      {
        studentId: student.id,
        courseId: duplicateCourse.id,
        matchStatus: MatchStatus.PARTIAL_MATCH,
        overallMet: false,
        matchScore: 62,
        subjectResults: [],
        missingSubjects: ["Mathematics"],
        weakSubjects: [],
        englishMet: true,
      },
      {
        studentId: student.id,
        courseId: nonEligibleCourse.id,
        matchStatus: MatchStatus.NO_MATCH,
        overallMet: false,
        matchScore: 20,
        subjectResults: [],
        missingSubjects: ["English"],
        weakSubjects: ["Business"],
        englishMet: false,
      },
    ],
  });

  await prisma.studentWishlist.deleteMany({
    where: {
      studentId: student.id,
      courseId: { in: [searchCourse.id, duplicateCourse.id, nonEligibleCourse.id] },
    },
  });

  await prisma.student.update({
    where: { id: student.id },
    data: { recentlyViewedCourses: [] },
  });

  return {
    studentEmail: studentUser.email,
    studentId: student.id,
    searchCourse,
    duplicateCourse,
    nonEligibleCourse,
    duplicateAppId: duplicateApp.id,
  };
}

async function runQa() {
  const fixture = await seedFixture();
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await login(page, fixture.studentEmail);

    // 1. /student/courses loads correctly with all filters visible
    await page.goto(`${BASE}/student/courses`, { waitUntil: "networkidle2" });
    await page.waitForSelector("h1.text-2xl");
    const hasFilters = await page.evaluate(() => {
      const text = document.body.innerText;
      return (
        text.includes("Find Your Best-Fit Courses")
        && text.includes("Search")
        && text.includes("Country")
        && text.includes("Level")
        && text.includes("Field of Study")
      );
    });
    assertCondition(hasFilters, "[1] /student/courses did not load with expected filters visible");

    // 2. Search by course name works
    await page.click('input[placeholder="Course, field, or university"]', { clickCount: 3 });
    await page.type('input[placeholder="Course, field, or university"]', fixture.searchCourse.name);
    await sleep(500);
    const searchWorks = await page.evaluate((searchName, otherName) => {
      const text = document.body.innerText;
      return text.includes(searchName) && !text.includes(otherName);
    }, fixture.searchCourse.name, fixture.nonEligibleCourse.name);
    assertCondition(searchWorks, "[2] Search by course name failed");

    // reset search
    await page.click('input[placeholder="Course, field, or university"]', { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await sleep(350);

    // 3. Filter by destination country works
    await page.select('select', "Canada");
    await sleep(500);
    const countryFilterWorks = await page.evaluate((expectedName, hiddenName) => {
      const text = document.body.innerText;
      return text.includes(expectedName) && !text.includes(hiddenName);
    }, fixture.nonEligibleCourse.name, fixture.searchCourse.name);
    assertCondition(countryFilterWorks, "[3] Filter by destination country failed");

    // set country back to all (first select on page is country)
    await page.select('select', "all");
    await sleep(350);

    // 4. Show Only Eligible toggle filters correctly
    const eligibleCheckboxFound = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll("label")).find((node) => (node.textContent || "").includes("Eligible only"));
      if (!label) return false;
      const input = label.querySelector('input[type="checkbox"]');
      if (!input) return false;
      input.click();
      return true;
    });
    assertCondition(eligibleCheckboxFound, "[4] Eligible only toggle not found");
    await sleep(500);
    const eligibleToggleWorks = await page.evaluate((hiddenName, visibleName) => {
      const text = document.body.innerText;
      return !text.includes(hiddenName) && text.includes(visibleName);
    }, fixture.nonEligibleCourse.name, fixture.searchCourse.name);
    assertCondition(eligibleToggleWorks, "[4] Eligible only toggle did not filter NO_MATCH courses");

    // turn it off
    await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll("label")).find((node) => (node.textContent || "").includes("Eligible only"));
      const input = label?.querySelector('input[type="checkbox"]');
      if (input) input.click();
    });
    await sleep(350);

    // 5. Course cards show eligibility badges correctly
    const hasBadges = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("Eligible") && text.includes("Partial Match") && text.includes("Not Eligible");
    });
    assertCondition(hasBadges, "[5] Eligibility badges were not rendered correctly on course cards");

    // 6. Heart icon adds and removes from wishlist correctly
    const heartClicked = await page.evaluate((courseName) => {
      const cards = Array.from(document.querySelectorAll("article"));
      const card = cards.find((item) => (item.textContent || "").includes(courseName));
      if (!card) return false;
      const button = card.querySelector('button[aria-label="Toggle wishlist"]');
      if (!button) return false;
      button.click();
      return true;
    }, fixture.searchCourse.name);
    assertCondition(heartClicked, "[6] Could not click wishlist heart on target course");
    await sleep(600);

    let wishlistIds = await getWishlistIdsFromBrowser(page);
    assertCondition(wishlistIds.includes(fixture.searchCourse.id), "[6] Heart add to wishlist failed");

    await page.evaluate((courseName) => {
      const cards = Array.from(document.querySelectorAll("article"));
      const card = cards.find((item) => (item.textContent || "").includes(courseName));
      const button = card?.querySelector('button[aria-label="Toggle wishlist"]');
      if (button) button.click();
    }, fixture.searchCourse.name);
    await sleep(600);

    wishlistIds = await getWishlistIdsFromBrowser(page);
    assertCondition(!wishlistIds.includes(fixture.searchCourse.id), "[6] Heart remove from wishlist failed");

    // 7. View Details opens course detail page
    const detailsOpened = await page.evaluate((courseId) => {
      const link = document.querySelector(`a[href="/student/courses/${courseId}"]`);
      if (!link) return false;
      link.click();
      return true;
    }, fixture.searchCourse.id);
    assertCondition(detailsOpened, "[7] View Details link not found for target course");

    await page.waitForFunction((id) => window.location.pathname === `/student/courses/${id}`, {}, fixture.searchCourse.id);
    await page.waitForFunction(() => {
      const labels = Array.from(document.querySelectorAll("button")).map((node) => (node.textContent || "").trim());
      return labels.includes("Overview")
        && labels.includes("Entry Requirements")
        && labels.includes("Scholarships")
        && labels.includes("Similar Programs");
    }, { timeout: 15000 });

    // 8. Detail page shows all 4 tabs
    const allTabsVisible = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("button")).map((node) => (node.textContent || "").trim());
      return labels.includes("Overview")
        && labels.includes("Entry Requirements")
        && labels.includes("Scholarships")
        && labels.includes("Similar Programs");
    });
    assertCondition(allTabsVisible, "[8] Course detail tabs are incomplete");

    // 9. Entry requirements tab shows personalised requirements for student nationality
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").trim() === "Entry Requirements");
      if (button) button.click();
    });
    await sleep(500);
    const personalisedReq = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("Qualification:") && text.includes("Minimum GPA 4.0") && text.includes("Required subjects:");
    });
    assertCondition(personalisedReq, "[9] Personalised entry requirement details did not render");

    // 10. Apply Now creates application and redirects correctly
    await page.evaluate(() => {
      const applyButton = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").includes("Apply Now"));
      if (applyButton) applyButton.click();
    });

    await page.waitForFunction(() => window.location.pathname.startsWith("/student/applications/"), { timeout: 15000 });
    const createdAppPath = await page.evaluate(() => window.location.pathname);
    const createdAppId = createdAppPath.split("/").pop();
    assertCondition(Boolean(createdAppId), "[10] Apply Now redirect path missing application id");

    const createdApp = await prisma.application.findFirst({
      where: { id: createdAppId, studentId: fixture.studentId, courseId: fixture.searchCourse.id },
      select: { id: true },
    });
    assertCondition(Boolean(createdApp), "[10] Application was not created for selected course");

    // 11. Duplicate application guard message / behavior
    await page.goto(`${BASE}/student/courses/${fixture.duplicateCourse.id}`, { waitUntil: "networkidle2" });
    await sleep(700);

    const duplicateApi = await page.evaluate(async (courseId) => {
      const res = await fetch("/api/student/applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = await res.json();
      return { status: res.status, json };
    }, fixture.duplicateCourse.id);

    assertCondition(duplicateApi.status === 409, "[11] Duplicate guard did not return 409");
    assertCondition(
      typeof duplicateApi.json?.error === "string" && duplicateApi.json.error.includes("active application"),
      "[11] Duplicate guard message was not correct",
    );

    await page.evaluate(() => {
      const applyButton = Array.from(document.querySelectorAll("button")).find((node) => (node.textContent || "").includes("Apply Now"));
      if (applyButton) applyButton.click();
    });
    await page.waitForFunction(() => window.location.pathname.startsWith("/student/applications/"), { timeout: 15000 });
    const dupPath = await page.evaluate(() => window.location.pathname);
    assertCondition(dupPath.endsWith(fixture.duplicateAppId), "[11] Duplicate apply did not redirect to existing application");

    // 12. Recently viewed appears on dashboard after viewing
    await page.goto(`${BASE}/student/courses/${fixture.searchCourse.id}`, { waitUntil: "networkidle2" });
    await sleep(900);
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "networkidle2" });
    await sleep(800);

    const recentlyViewedVisible = await page.evaluate((courseName) => {
      const text = document.body.innerText;
      return text.includes("Recently Viewed Courses") && text.includes(courseName);
    }, fixture.searchCourse.name);
    assertCondition(recentlyViewedVisible, "[12] Recently viewed courses did not appear on dashboard");

    console.log("S4_COURSE_SEARCH_CLICKPATH_PASS");
  } finally {
    await browser.close();
  }
}

runQa()
  .catch((error) => {
    console.error("S4_COURSE_SEARCH_CLICKPATH_FAIL", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
