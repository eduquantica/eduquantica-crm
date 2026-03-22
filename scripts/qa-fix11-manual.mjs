import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:3000";

const GPA_OPTIONS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.25", "4.5", "4.75", "5.0"];
const LETTER_OPTIONS = ["A*", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickByText(page, text, selector = "button, a") {
  const clicked = await page.evaluate(({ selector, text }) => {
    const wanted = (text || "").replace(/\s+/g, " ").trim().toLowerCase();
    const target = [...document.querySelectorAll(selector)].find((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      return t === wanted;
    });
    if (!target) return false;
    target.click();
    return true;
  }, { selector, text });
  if (!clicked) throw new Error(`Could not click element with text: ${text}`);
}

async function existsText(page, text, selector = "*") {
  return page.evaluate(({ selector, text }) => {
    return [...document.querySelectorAll(selector)].some((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      return t.includes(text);
    });
  }, { selector, text });
}

async function fillInputByLabel(page, labelText, value) {
  const ok = await page.evaluate(({ labelText, value }) => {
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find((l) => (l.textContent || "").replace(/\s+/g, " ").trim() === labelText);
    if (!label) return false;

    const forId = label.getAttribute("for");
    let input = null;
    if (forId) input = document.getElementById(forId);
    if (!input) {
      const parent = label.parentElement;
      if (parent) input = parent.querySelector("input, textarea, select");
    }
    if (!input) return false;

    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { labelText, value });

  if (!ok) throw new Error(`Could not fill input for label: ${labelText}`);
}

async function selectByLabel(page, labelText, value) {
  const ok = await page.evaluate(({ labelText, value }) => {
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find((l) => (l.textContent || "").replace(/\s+/g, " ").trim() === labelText);
    if (!label) return false;

    const parent = label.parentElement;
    if (!parent) return false;
    const sel = parent.querySelector("select");
    if (!sel) return false;
    const has = [...sel.options].some((opt) => opt.value === value || (opt.textContent || "").trim() === value);
    if (!has) return false;

    const actual = [...sel.options].find((opt) => opt.value === value || (opt.textContent || "").trim() === value);
    sel.value = actual.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { labelText, value });

  if (!ok) throw new Error(`Could not select ${value} for label: ${labelText}`);
}

async function login(page, email, password) {
  const cdp = await page.target().createCDPSession();
  await cdp.send("Network.clearBrowserCookies");
  await cdp.send("Network.clearBrowserCache");

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  try {
    await page.waitForSelector("#email", { timeout: 15000 });
  } catch {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  }

  const emailSelector = (await page.$("#email")) ? "#email" : 'input[type="email"]';
  const passwordSelector = (await page.$("#password")) ? "#password" : 'input[type="password"]';

  await page.type(emailSelector, email, { delay: 10 });
  await page.type(passwordSelector, password, { delay: 10 });

  const submitSelector = (await page.$('button[type="submit"]')) ? 'button[type="submit"]' : "button";
  await Promise.all([
    page.click(submitSelector),
    page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null),
  ]);

  let redirected = false;
  for (let i = 0; i < 40; i += 1) {
    const pathname = await page.evaluate(() => location.pathname);
    if (!pathname.startsWith("/login")) {
      redirected = true;
      break;
    }
    await sleep(500);
  }

  if (!redirected) {
    const hasInvalidError = await existsText(page, "Invalid email or password", "*" );
    const currentPath = await page.evaluate(() => location.pathname);
    throw new Error(`Login did not redirect (path=${currentPath}, invalidCredentials=${hasInvalidError}).`);
  }
}

async function uploadFirstFileInput(page, filePath) {
  const handles = await page.$$("input[type=\"file\"]");
  if (!handles.length) return false;
  await handles[0].uploadFile(filePath);
  return true;
}

function addResult(results, id, title, pass, note) {
  results.push({ id, title, status: pass ? "PASS" : "FAIL", note });
}

function makeDummyPng() {
  const out = path.join(process.cwd(), "scripts", "qa-dummy.png");
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2W7WQAAAAASUVORK5CYII=";
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  return out;
}

async function run() {
  const results = [];
  let studentId = null;
  const dummyFile = makeDummyPng();

  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
  let page = await browser.newPage();
  page.setDefaultTimeout(20000);

  let beforeDeleteCards = 0;

  try {
    await login(page, "student@eduquantica.com", "Student123!");
    await page.goto(`${BASE_URL}/student/profile/academic`, { waitUntil: "networkidle2" });

    // 1
    try {
      await clickByText(page, "Add Qualification", "button");
      const ok = await existsText(page, "Add Qualification (Step 1/4)", "h2");
      addResult(results, 1, "Open Add Qualification modal", ok, ok ? "Opened Step 1." : "Step 1 heading not found.");
    } catch (e) {
      addResult(results, 1, "Open Add Qualification modal", false, e.message);
    }

    // 2
    try {
      // choose first non-empty option
      await page.evaluate(() => {
        const sel = document.querySelector('select');
        if (!sel) return;
        const opt = [...sel.options].find((o) => o.value && !o.disabled && !o.parentElement?.disabled);
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await clickByText(page, "Next", "button");
      const ok = await existsText(page, "(Step 2/4)", "h2");
      addResult(results, 2, "Step 1 Next works", ok, ok ? "Reached Step 2." : "Did not reach Step 2.");
    } catch (e) {
      addResult(results, 2, "Step 1 Next works", false, e.message);
    }

    // 3
    try {
      await fillInputByLabel(page, "Institution name", "QA Institute");
      await fillInputByLabel(page, "Country of study", "UK");
      await fillInputByLabel(page, "Year of completion", "2024");
      await fillInputByLabel(page, "Overall GPA/Grade", "A");

      await clickByText(page, "Back", "button");
      const backOk = await existsText(page, "(Step 1/4)", "h2");
      if (!backOk) throw new Error("Back did not return to Step 1");

      await clickByText(page, "Next", "button");
      await clickByText(page, "Next", "button");
      const nextOk = await existsText(page, "(Step 3/4)", "h2");
      addResult(results, 3, "Step 2 Back and Next work", nextOk, nextOk ? "Back and Next both worked." : "Next did not reach Step 3.");
    } catch (e) {
      addResult(results, 3, "Step 2 Back and Next work", false, e.message);
    }

    // attach file for step 3 actions
    await uploadFirstFileInput(page, dummyFile);

    // 4
    try {
      const hasSaveNoOcr = await existsText(page, "Save Without OCR", "button");
      const hasRunOcr = await existsText(page, "Upload and Run OCR", "button");
      addResult(results, 4, 'Step 3 shows both actions', hasSaveNoOcr && hasRunOcr, `Save Without OCR=${hasSaveNoOcr}, Upload and Run OCR=${hasRunOcr}`);
    } catch (e) {
      addResult(results, 4, 'Step 3 shows both actions', false, e.message);
    }

    // move to step 4 via Save Without OCR
    let step4Ready = false;
    try {
      await clickByText(page, "Save Without OCR", "button");
      await page.waitForFunction(() => document.querySelector("h2")?.textContent?.includes("Step 4/4"), { timeout: 30000 });
      step4Ready = true;
    } catch {
      const stepError = await page.evaluate(() => {
        const el = document.querySelector(".text-red-700");
        return el ? (el.textContent || "").trim() : "";
      });
      step4Ready = false;
      addResult(results, 5, "Step 4 subject cursor does not jump", false, `Blocked: could not reach Step 4 after Save Without OCR. ${stepError}`.trim());
      addResult(results, 6, "Step 4 GPA grade values appear", false, `Blocked: could not reach Step 4 after Save Without OCR. ${stepError}`.trim());
      addResult(results, 7, "Step 4 Letter grade options appear", false, `Blocked: could not reach Step 4 after Save Without OCR. ${stepError}`.trim());
      addResult(results, 8, "Step 4 Save and Next and Back work", false, `Blocked: could not reach Step 4 after Save Without OCR. ${stepError}`.trim());
      addResult(results, 9, "Saved qualification appears with correct grade", false, "Blocked: Step 4 flow did not complete.");
    }

    // 5 cursor
    if (step4Ready) {
    try {
      const ok = await page.evaluate(() => {
        const input = document.querySelector('tbody tr td input');
        if (!input) return false;
        input.focus();
        input.value = "Mathematics";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const same = document.activeElement === input;
        const caret = input.selectionStart === input.value.length || input.selectionStart === null;
        return same && caret && input.value === "Mathematics";
      });
      addResult(results, 5, 'Step 4 subject cursor does not jump', ok, ok ? "Input retained focus/caret." : "Focus/caret did not remain stable.");
    } catch (e) {
      addResult(results, 5, 'Step 4 subject cursor does not jump', false, e.message);
    }
    }

    // 6 GPA selector and values
    if (step4Ready) {
    try {
      await page.evaluate(() => {
        const radio = document.querySelector('input[name="qualification-grade-type"][value="GPA"]');
        if (radio) {
          radio.click();
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      const gpaOk = await page.evaluate((opts) => {
        const datalist = document.querySelector('datalist[id^="gpa-options-"]');
        if (!datalist) return false;
        const values = [...datalist.querySelectorAll("option")].map((o) => o.value);
        return opts.every((v) => values.includes(v));
      }, GPA_OPTIONS);
      addResult(results, 6, "Step 4 GPA grade values appear", gpaOk, gpaOk ? "All GPA values available." : "Missing one or more GPA values.");
    } catch (e) {
      addResult(results, 6, "Step 4 GPA grade values appear", false, e.message);
    }
    }

    // 7 LETTER selector and values
    if (step4Ready) {
    try {
      await page.evaluate(() => {
        const radio = document.querySelector('input[name="qualification-grade-type"][value="LETTER"]');
        if (radio) {
          radio.click();
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      const letterOk = await page.evaluate((opts) => {
        const select = document.querySelector('tbody tr td select');
        if (!select) return false;
        const values = [...select.querySelectorAll("option")].map((o) => (o.value || "").trim()).filter(Boolean);
        return opts.every((v) => values.includes(v));
      }, LETTER_OPTIONS);
      addResult(results, 7, "Step 4 Letter grade options appear", letterOk, letterOk ? "All expected letter grades available." : "Missing one or more letter grade options.");
    } catch (e) {
      addResult(results, 7, "Step 4 Letter grade options appear", false, e.message);
    }
    }

    // set grade A* for save and card verify
    if (step4Ready) {
    await page.evaluate(() => {
      const select = document.querySelector('tbody tr td select');
      if (select) {
        select.value = "A*";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    }

    // 8 back/save and next
    if (step4Ready) {
    try {
      const hasBack = await existsText(page, "Back", "button");
      const hasSaveNext = await existsText(page, "Save and Next", "button");
      if (!hasBack || !hasSaveNext) throw new Error("Back and/or Save and Next missing on Step 4");

      await clickByText(page, "Back", "button");
      const step3 = await existsText(page, "(Step 3/4)", "h2");
      if (!step3) throw new Error("Back did not return to Step 3");

      await clickByText(page, "Save Without OCR", "button");
      await page.waitForFunction(() => document.querySelector("h2")?.textContent?.includes("Step 4/4"), { timeout: 15000 });
      await clickByText(page, "Save and Next", "button");
      await sleep(1500);

      const closed = !(await existsText(page, "Step 4/4", "h2"));
      addResult(results, 8, "Step 4 Save and Next and Back work", closed, closed ? "Back works and Save closes modal." : "Save and Next did not complete flow.");
    } catch (e) {
      addResult(results, 8, "Step 4 Save and Next and Back work", false, e.message);
    }
    }

    // 9 saved qualification card shows grade
    if (step4Ready) {
    try {
      const pageText = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim());
      const ok = pageText.includes("Mathematics") && (pageText.includes("A*") || pageText.includes("A* / 5.0 GPA") || pageText.includes("A*"));
      addResult(results, 9, "Saved qualification appears with correct grade", ok, ok ? "Qualification card includes Mathematics and grade." : "Could not verify saved card grade.");
    } catch (e) {
      addResult(results, 9, "Saved qualification appears with correct grade", false, e.message);
    }
    }

    // 10 edit button every card
    try {
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("article")];
        const filtered = cards.filter((c) => c.querySelector("button"));
        const counts = filtered.map((card) => ({
          hasEdit: [...card.querySelectorAll("button")].some((b) => (b.textContent || "").trim() === "Edit"),
          hasDelete: [...card.querySelectorAll("button")].some((b) => (b.textContent || "").trim() === "Delete"),
        }));
        return {
          total: counts.length,
          allEdit: counts.length > 0 && counts.every((c) => c.hasEdit),
          allDelete: counts.length > 0 && counts.every((c) => c.hasDelete),
        };
      });
      beforeDeleteCards = r.total;
      addResult(results, 10, "Edit appears on every qualification card", r.allEdit, `cards=${r.total}`);
      addResult(results, 13, "Delete appears on every qualification card", r.allDelete, `cards=${r.total}`);
    } catch (e) {
      addResult(results, 10, "Edit appears on every qualification card", false, e.message);
      addResult(results, 13, "Delete appears on every qualification card", false, e.message);
    }

    // 11 click edit prefilled
    try {
      await clickByText(page, "Edit", "button");
      const editHeading = await existsText(page, "Edit Qualification", "h2");
      const prefill = await page.evaluate(() => {
        const labels = [...document.querySelectorAll("label")];
        const label = labels.find((l) => (l.textContent || "").trim() === "Institution name");
        if (!label) return false;
        const input = label.parentElement?.querySelector("input");
        return !!input && !!input.value;
      });
      addResult(results, 11, "Edit opens pre-filled modal", editHeading && prefill, `heading=${editHeading}, prefill=${prefill}`);
    } catch (e) {
      addResult(results, 11, "Edit opens pre-filled modal", false, e.message);
    }

    // 12 change grade and save -> card updates instantly
    try {
      await clickByText(page, "Next", "button"); // step2
      await clickByText(page, "Next", "button"); // step3
      await uploadFirstFileInput(page, dummyFile);
      await clickByText(page, "Save Without OCR", "button");
      await page.waitForFunction(() => document.querySelector("h2")?.textContent?.includes("Step 4/4"), { timeout: 30000 });

      await page.evaluate(() => {
        const radio = document.querySelector('input[name="qualification-grade-type"][value="LETTER"]');
        if (radio) radio.click();
      });
      await page.evaluate(() => {
        const select = document.querySelector('tbody tr td select');
        if (select) {
          select.value = "B+";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      await clickByText(page, "Save and Next", "button");
      await sleep(2500);
      const updated = await existsText(page, "B+", "main");
      addResult(results, 12, "Edit grade save updates card instantly", updated, updated ? "Card text updated to B+." : "Updated grade not observed on card.");
    } catch (e) {
      addResult(results, 12, "Edit grade save updates card instantly", false, e.message);
    }

    // 14+15 delete confirm + remove instantly
    try {
      let sawDialog = false;
      page.once("dialog", async (dialog) => {
        sawDialog = true;
        try {
          await dialog.accept();
        } catch {
          // Ignore transient protocol races if dialog auto-closes.
        }
      });
      await clickByText(page, "Delete", "button");
      await sleep(1500);

      const afterDeleteCards = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("article")].filter((c) => c.querySelector("button"));
        return cards.length;
      });

      addResult(results, 14, "Delete shows confirmation dialog", sawDialog, sawDialog ? "Native confirm dialog shown." : "No confirm dialog detected.");
      addResult(results, 15, "Confirm delete removes card instantly", afterDeleteCards < beforeDeleteCards, `before=${beforeDeleteCards}, after=${afterDeleteCards}`);
    } catch (e) {
      addResult(results, 14, "Delete shows confirmation dialog", false, e.message);
      addResult(results, 15, "Confirm delete removes card instantly", false, e.message);
    }

    // ADMIN checks 16-21
    await page.close();
    page = await browser.newPage();
    page.setDefaultTimeout(20000);

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await login(page, "admin@eduquantica.com", "Admin123!");
    await page.goto(`${BASE_URL}/dashboard/students`, { waitUntil: "networkidle2" });

    try {
      const opened = await page.evaluate(() => {
        const link = [...document.querySelectorAll('a[href^="/dashboard/students/"]')]
          .find((a) => !a.getAttribute("href")?.endsWith("/new"));
        if (!link) return null;
        const href = link.getAttribute("href");
        link.click();
        return href;
      });
      if (!opened) throw new Error("No student link found on admin students list");
      await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null);
      const match = page.url().match(/\/dashboard\/students\/([^/?#]+)/);
      studentId = match?.[1] || null;
      addResult(results, 16, "Open student record in admin portal", !!studentId, studentId ? `Opened student ${studentId}` : "Could not parse opened student id.");
    } catch (e) {
      addResult(results, 16, "Open student record in admin portal", false, e.message);
    }

    try {
      await clickByText(page, "Academic Profile", "button");
      const ok = await existsText(page, "Academic Profile", "h3,button");
      addResult(results, 17, "Go to Academic Profile tab", ok, ok ? "Academic tab opened." : "Academic tab not opened.");
    } catch (e) {
      addResult(results, 17, "Go to Academic Profile tab", false, e.message);
    }

    try {
      const editableActionVisible = await existsText(page, "Edit Grade", "button");
      addResult(results, 18, "Edit Mode toggle visible", editableActionVisible, editableActionVisible ? "Per-subject edit controls are visible." : "No edit controls found in academic table.");
    } catch (e) {
      addResult(results, 18, "Edit Mode toggle visible", false, e.message);
    }

    try {
      await clickByText(page, "Edit Grade", "button");
      const inEditState = await existsText(page, "Save", "button");
      addResult(results, 19, "Toggle Edit Mode enables editing", inEditState, inEditState ? "Editing state activated for a subject row." : "Could not enter editing state.");
    } catch (e) {
      addResult(results, 19, "Toggle Edit Mode enables editing", false, e.message);
    }

    try {
      await clickByText(page, "Edit Grade", "button");
      const hasSelector = await page.evaluate(() => {
        const selects = [...document.querySelectorAll("select")];
        return selects.some((s) => [...s.options].some((o) => o.value === "GPA") && [...s.options].some((o) => o.value === "LETTER"));
      });
      addResult(results, 20, "Subject grade type selector appears", hasSelector, hasSelector ? "GPA/LETTER selector visible." : "Grade type selector not visible.");
    } catch (e) {
      addResult(results, 20, "Subject grade type selector appears", false, e.message);
    }

    try {
      await page.evaluate(() => {
        const gradeTypeSelect = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "GPA") && [...s.options].some((o) => o.value === "LETTER"));
        if (gradeTypeSelect) {
          gradeTypeSelect.value = "LETTER";
          gradeTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.evaluate(() => {
        const gradeSelect = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "A*"));
        if (gradeSelect) {
          gradeSelect.value = "A*";
          gradeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await clickByText(page, "Save", "button");
      await sleep(1200);
      const updated = await existsText(page, "A*", "table,main");
      addResult(results, 21, "Admin grade change saves correctly", updated, updated ? "Saved and updated in table." : "Could not verify updated grade.");
    } catch (e) {
      addResult(results, 21, "Admin grade change saves correctly", false, e.message);
    }

    // Agent checks 22-27
    await page.close();
    page = await browser.newPage();
    page.setDefaultTimeout(20000);

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await login(page, "agent@eduquantica.com", "Agent123!");
    await page.goto(`${BASE_URL}/agent/students`, { waitUntil: "networkidle2" });

    let agentStudentOpened = false;
    try {
      const rowHref = await page.evaluate(() => {
        const link = [...document.querySelectorAll('a[href^="/agent/students/"]')]
          .find((a) => !a.getAttribute("href")?.includes("/new"));
        return link ? link.getAttribute("href") : null;
      });

      if (!rowHref) {
        await page.goto(`${BASE_URL}/agent/students/new`, { waitUntil: "networkidle2" });
        const stamp = Date.now();
        await page.type('input[placeholder="First Name"]', "QA", { delay: 5 });
        await page.type('input[placeholder="Last Name"]', `Student${stamp}`, { delay: 5 });
        await page.type('input[placeholder="Email"]', `qa.student.${stamp}@example.com`, { delay: 5 });
        await clickByText(page, "Create Student", "button");
        await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null);
        await page.goto(`${BASE_URL}/agent/students`, { waitUntil: "networkidle2" });
      }

      const opened = await page.evaluate(() => {
        const link = [...document.querySelectorAll('a[href^="/agent/students/"]')]
          .find((a) => !a.getAttribute("href")?.includes("/new"));
        if (!link) return false;
        link.click();
        return true;
      });
      if (!opened) throw new Error("No student link available in agent students list");
      await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null);
      agentStudentOpened = page.url().includes("/agent/students/");
      addResult(results, 22, "Open student in agent portal", agentStudentOpened, agentStudentOpened ? `Opened ${page.url()}` : "Failed to open agent student detail page.");
    } catch (e) {
      addResult(results, 22, "Open student in agent portal", false, e.message);
    }

    try {
      await clickByText(page, "academic", "button");
      const ok = await existsText(page, "Academic Profile", "button,h3");
      addResult(results, 23, "Go to Academic Profile section", ok, ok ? "Academic section visible." : "Could not open academic section.");
    } catch (e) {
      addResult(results, 23, "Go to Academic Profile section", false, e.message);
    }

    try {
      const hasEditGrade = await existsText(page, "Edit Grade", "button");
      addResult(results, 24, "Edit Grade appears next to each subject", hasEditGrade, hasEditGrade ? "Edit Grade button found." : "Edit Grade button not found.");
    } catch (e) {
      addResult(results, 24, "Edit Grade appears next to each subject", false, e.message);
    }

    try {
      await clickByText(page, "Edit Grade", "button");
      const hasSelector = await page.evaluate(() => {
        const selects = [...document.querySelectorAll("select")];
        return selects.some((s) => [...s.options].some((o) => o.value === "GPA") && [...s.options].some((o) => o.value === "LETTER"));
      });
      addResult(results, 25, "Edit Grade opens grade type selector", hasSelector, hasSelector ? "Grade type selector opened." : "No GPA/LETTER selector visible.");
    } catch (e) {
      addResult(results, 25, "Edit Grade opens grade type selector", false, e.message);
    }

    try {
      await page.evaluate(() => {
        const gradeTypeSelect = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "GPA") && [...s.options].some((o) => o.value === "LETTER"));
        if (gradeTypeSelect) {
          gradeTypeSelect.value = "GPA";
          gradeTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.type('input[type="number"]', "4.25", { delay: 10 });
      await clickByText(page, "Save", "button");
      await sleep(1200);
      const ok = await existsText(page, "4.25", "table,main");
      addResult(results, 26, "Agent GPA save updates instantly", ok, ok ? "GPA update visible." : "GPA update not visible.");
    } catch (e) {
      addResult(results, 26, "Agent GPA save updates instantly", false, e.message);
    }

    try {
      await clickByText(page, "Edit Grade", "button");
      await page.evaluate(() => {
        const gradeTypeSelect = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "GPA") && [...s.options].some((o) => o.value === "LETTER"));
        if (gradeTypeSelect) {
          gradeTypeSelect.value = "LETTER";
          gradeTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.evaluate(() => {
        const gradeSelect = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "A*"));
        if (gradeSelect) {
          gradeSelect.value = "A*";
          gradeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await clickByText(page, "Save", "button");
      await sleep(1200);
      const ok = await existsText(page, "A*", "table,main");
      addResult(results, 27, "Agent Letter A* save updates instantly", ok, ok ? "Letter update visible." : "Letter update not visible.");
    } catch (e) {
      addResult(results, 27, "Agent Letter A* save updates instantly", false, e.message);
    }
  } finally {
    await browser.close();
  }

  const outPath = path.join(process.cwd(), "scripts", "qa-fix11-report.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ outPath, results }, null, 2));
}

run().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
