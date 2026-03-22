const bcrypt = require("bcryptjs");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient, ApplicationStatus } = require("@prisma/client");

dotenv.config({ path: ".env.local" });
dotenv.config();

const BASE = process.env.BASE_URL || "http://localhost:3105";
const PASSWORD = "Pass1234!";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
let cleanedUp = false;

async function cleanup() {
	if (cleanedUp) return;
	cleanedUp = true;
	await prisma.$disconnect();
	await pool.end();
}

function tag() {
	const now = new Date();
	return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(-6)}`;
}

function assertCondition(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

async function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

async function ensureStudentProfile(userId, email, firstName, withProfileData, assignedCounsellorId) {
	const baseData = {
		firstName,
		lastName: "QA",
		email,
		phone: withProfileData ? "+8801000000000" : null,
		nationality: withProfileData ? "Bangladesh" : null,
		country: withProfileData ? "Bangladesh" : null,
		passportNumber: withProfileData ? "BD1234567" : null,
		passportExpiry: withProfileData ? new Date("2030-12-31") : null,
		address: withProfileData ? "Dhaka Address" : null,
		city: withProfileData ? "Dhaka" : null,
		assignedCounsellorId,
	};

	const existing = await prisma.student.findUnique({ where: { userId } });
	if (existing) {
		return prisma.student.update({
			where: { id: existing.id },
			data: baseData,
		});
	}

	return prisma.student.create({
		data: {
			userId,
			...baseData,
		},
	});
}

async function ensureUniversityAndCourse(seedTag) {
	const uniName = `QA Dashboard Uni ${seedTag}`;
	let university = await prisma.university.findFirst({ where: { name: uniName } });
	if (!university) {
		university = await prisma.university.create({
			data: {
				name: uniName,
				country: "UK",
				currency: "GBP",
				isActive: true,
			},
		});
	}

	const courseName = `QA Dashboard Course ${seedTag}`;
	let course = await prisma.course.findFirst({ where: { universityId: university.id, name: courseName } });
	if (!course) {
		course = await prisma.course.create({
			data: {
				universityId: university.id,
				name: courseName,
				level: "MASTERS",
				currency: "GBP",
				tuitionFee: 15500,
				duration: "1 year",
				isActive: true,
			},
		});
	}

	return { university, course };
}

async function seedFixture() {
	const seedTag = tag();
	const counsellor = await upsertRoleUser("COUNSELLOR", `qa.dashboard.counsellor.${seedTag}@example.com`, "QA Dashboard Counsellor");
	const studentWithAppsUser = await upsertRoleUser("STUDENT", `qa.dashboard.student.withapp.${seedTag}@example.com`, "QA Student WithApp");
	const studentNoAppsUser = await upsertRoleUser("STUDENT", `qa.dashboard.student.noapp.${seedTag}@example.com`, "QA Student NoApp");

	const [studentWithApps, studentNoApps] = await Promise.all([
		ensureStudentProfile(studentWithAppsUser.id, studentWithAppsUser.email, "WithApp", true, counsellor.id),
		ensureStudentProfile(studentNoAppsUser.id, studentNoAppsUser.email, "NoApp", true, counsellor.id),
	]);

	const { university, course } = await ensureUniversityAndCourse(seedTag);

	await prisma.application.create({
		data: {
			studentId: studentWithApps.id,
			courseId: course.id,
			universityId: university.id,
			counsellorId: counsellor.id,
			status: ApplicationStatus.DOCUMENTS_PENDING,
			createdAt: new Date(),
		},
	});

	await prisma.documentChecklist.create({
		data: {
			studentId: studentWithApps.id,
			applicationId: (
				await prisma.application.findFirst({
					where: { studentId: studentWithApps.id, courseId: course.id },
					orderBy: { createdAt: "desc" },
					select: { id: true },
				})
			).id,
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

	await prisma.activityLog.create({
		data: {
			userId: counsellor.id,
			entityType: "student",
			entityId: studentWithApps.id,
			action: "dashboard_seen",
			details: "qa activity",
			createdAt: new Date(Date.now() - 10 * 60 * 1000),
		},
	});

	await prisma.activityLog.deleteMany({
		where: {
			userId: { in: [studentWithAppsUser.id, studentNoAppsUser.id] },
			entityType: "studentCourse",
			action: "viewed",
		},
	});

	return {
		withApps: { email: studentWithAppsUser.email, expectedProfilePercent: 30 },
		noApps: { email: studentNoAppsUser.email },
	};
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

async function goDashboard(page) {
	await page.goto(`${BASE}/student/dashboard`, { waitUntil: "networkidle2" });
	await page.waitForSelector("h1.text-2xl");
}

async function mockHour(context, hour) {
	await context.addInitScript((h) => {
		const OriginalDate = Date;
		class MockDate extends OriginalDate {
			constructor(...args) {
				if (args.length === 0) {
					const base = new OriginalDate();
					base.setHours(h, 0, 0, 0);
					return base;
				}
				return new OriginalDate(...args);
			}
			static now() {
				const base = new OriginalDate();
				base.setHours(h, 0, 0, 0);
				return base.getTime();
			}
		}
		window.Date = MockDate;
	}, hour);
}

async function testGreetingForHour(browser, email, hour, expectedGreeting) {
	const context = await browser.createBrowserContext();
	const page = await context.newPage();
	await page.evaluateOnNewDocument((h) => {
		const OriginalDate = Date;
		class MockDate extends OriginalDate {
			constructor(...args) {
				if (args.length === 0) {
					const base = new OriginalDate();
					base.setHours(h, 0, 0, 0);
					return base;
				}
				return new OriginalDate(...args);
			}
			static now() {
				const base = new OriginalDate();
				base.setHours(h, 0, 0, 0);
				return base.getTime();
			}
		}
		window.Date = MockDate;
	}, hour);

	await login(page, email);
	await goDashboard(page);

	const heading = await page.$eval("h1.text-2xl", (el) => (el.textContent || "").trim());
	assertCondition(heading.startsWith(expectedGreeting), `Greeting mismatch at ${hour}:00. Expected ${expectedGreeting}, got '${heading}'`);

	await context.close();
}

async function testDashboardMain(browser, creds) {
	const context = await browser.createBrowserContext();
	const page = await context.newPage();

	await login(page, creds.withApps.email);
	await goDashboard(page);

	const h1 = await page.$eval("h1.text-2xl", (el) => (el.textContent || "").trim());
	assertCondition(/Good (morning|afternoon|evening),/.test(h1), "Dashboard greeting did not render");

	const profileText = await page.evaluate(() => {
		const spans = Array.from(document.querySelectorAll("span"));
		const node = spans.find((el) => (el.textContent || "").includes("Profile completion:"));
		return (node?.textContent || "").trim();
	});
	assertCondition(profileText.includes(`Profile completion: ${creds.withApps.expectedProfilePercent}%`), `Unexpected profile completion text: ${profileText}`);

	const sidebarProgress = await page.evaluate(() => {
		const nodes = Array.from(document.querySelectorAll("p"));
		const match = nodes.find((el) => (el.textContent || "").trim().endsWith("%") && (el.className || "").includes("text-xs"));
		return (match?.textContent || "").trim();
	});
	assertCondition(sidebarProgress === `${creds.withApps.expectedProfilePercent}%`, `Sidebar profile percent mismatch: ${sidebarProgress}`);

	const progressBarWidth = await page.evaluate(() => {
		const progressBars = Array.from(document.querySelectorAll("div.h-full.rounded-full.transition-all"));
		const progressBar = progressBars[0];
		return progressBar ? progressBar.getAttribute("style") || "" : "";
	});
	const normalizedWidth = progressBarWidth.replace(/\s/g, "");
	assertCondition(normalizedWidth.includes(`width:${creds.withApps.expectedProfilePercent}%`), `Progress bar width mismatch: ${progressBarWidth}`);

	const hasDocumentsPending = await page.evaluate(() => {
		return Array.from(document.querySelectorAll("span")).some((el) => (el.textContent || "").trim() === "Documents Pending");
	});
	assertCondition(hasDocumentsPending, "Application status card did not render for student with applications");

	const quickActions = [
		{ label: "Complete Profile", hrefContains: "/student/profile" },
		{ label: "Search Courses", hrefContains: "/student/courses" },
		{ label: "Upload Documents", hrefContains: "/student/checklist" },
		{ label: "Message Counsellor", hrefContains: "/student/messages" },
	];

	for (const action of quickActions) {
		const href = await page.evaluate((label) => {
			const links = Array.from(document.querySelectorAll("a"));
			const target = links.find((el) => (el.textContent || "").trim() === label);
			return target ? target.getAttribute("href") || "" : "";
		}, action.label);
		assertCondition(href.includes(action.hrefContains), `Quick action '${action.label}' link mismatch: ${href}`);
	}

	const docRingExists = await page.evaluate(() => {
		const title = Array.from(document.querySelectorAll("h2")).find((el) => (el.textContent || "").trim() === "Documents Status");
		if (!title) return false;
		const card = title.closest("article");
		if (!card) return false;
		return card.querySelectorAll("svg circle").length >= 2;
	});
	assertCondition(docRingExists, "Document status circular progress ring missing");

	const counsellorDetails = await page.evaluate(() => {
		const card = Array.from(document.querySelectorAll("h2")).find((el) => (el.textContent || "").trim() === "Your Counsellor")?.closest("article");
		if (!card) return { hasName: false, hasEmail: false };
		const text = card.textContent || "";
		return {
			hasName: text.includes("QA Dashboard Counsellor"),
			hasEmail: text.includes("qa.dashboard.counsellor."),
		};
	});
	assertCondition(counsellorDetails.hasName && counsellorDetails.hasEmail, "Counsellor widget details missing");

	const floating = await page.evaluate(() => {
		const link = document.querySelector('a[aria-label="Chat with Eduvi"]');
		if (!link) return { exists: false };
		const style = window.getComputedStyle(link);
		return {
			exists: true,
			href: link.getAttribute("href") || "",
			position: style.position,
			right: style.right,
			bottom: style.bottom,
		};
	});
	assertCondition(floating.exists, "Floating Eduvi chat button missing");
	assertCondition(floating.href.includes("/student/messages#eduvi"), `Floating Eduvi href mismatch: ${floating.href}`);

	await context.close();
}

async function testNoAppsState(browser, creds) {
	const context = await browser.createBrowserContext();
	const page = await context.newPage();
	await login(page, creds.noApps.email);
	await goDashboard(page);

	const noAppsText = await page.evaluate(() => {
		return Array.from(document.querySelectorAll("p")).some((el) => (el.textContent || "").includes("No active applications yet."));
	});
	assertCondition(noAppsText, "No-application empty state not shown");

	const recentlyViewedHeaderVisible = await page.evaluate(() => {
		return Array.from(document.querySelectorAll("h2")).some((el) => (el.textContent || "").trim() === "Recently Viewed Courses");
	});
	assertCondition(!recentlyViewedHeaderVisible, "Recently Viewed Courses row should be hidden when no viewed courses exist");

	await context.close();
}

async function main() {
	const creds = await seedFixture();
	const browser = await puppeteer.launch({ headless: true });

	try {
		await testDashboardMain(browser, creds);
		await testGreetingForHour(browser, creds.withApps.email, 9, "Good morning");
		await testGreetingForHour(browser, creds.withApps.email, 14, "Good afternoon");
		await testGreetingForHour(browser, creds.withApps.email, 20, "Good evening");
		await testNoAppsState(browser, creds);
		console.log("STUDENT_DASHBOARD_CLICKPATH_PASS");
	} finally {
		await browser.close();
		await cleanup();
	}
}

main().catch(async (error) => {
	console.error("STUDENT_DASHBOARD_CLICKPATH_FAIL", error.message);
	await cleanup();
	process.exit(1);
});

