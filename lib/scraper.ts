import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

export type Confidence = "green" | "amber" | "red";

export interface Field<T> {
  value: T | null;
  confidence: Confidence;
}

export interface ScrapedCourse {
  name: Field<string>;
  level: Field<string>;
  duration: Field<string>;
  tuitionFee: Field<string>;
  intakeDates: Field<string>;
  entryRequirements: Field<string>;
  englishRequirements: Field<string>;
  scholarships: Field<string>;
  description: Field<string>;
}

export interface ScrapeResult {
  university: {
    name: Field<string>;
    location: Field<string>;
    description: Field<string>;
    campusDetails: Field<string>;
    foundedYear: Field<string>;
    type: Field<string>;
  };
  courses: ScrapedCourse[];
}

function basicParse(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content") || "";

  // naive course extraction: look for any element containing the word "course" and grab its text
  const courses: ScrapedCourse[] = [];
  $("*").each((i, el) => {
    const txt = $(el).text().trim();
    if (/course/i.test(txt) && txt.length < 100) {
      courses.push({
        name: { value: txt, confidence: "amber" },
        level: { value: null, confidence: "red" },
        duration: { value: null, confidence: "red" },
        tuitionFee: { value: null, confidence: "red" },
        intakeDates: { value: null, confidence: "red" },
        entryRequirements: { value: null, confidence: "red" },
        englishRequirements: { value: null, confidence: "red" },
        scholarships: { value: null, confidence: "red" },
        description: { value: null, confidence: "red" },
      });
    }
  });

  return {
    university: {
      name: { value: title || null, confidence: title ? "green" : "red" },
      location: { value: null, confidence: "red" },
      description: { value: description || null, confidence: description ? "green" : "red" },
      campusDetails: { value: null, confidence: "red" },
      foundedYear: { value: null, confidence: "red" },
      type: { value: null, confidence: "red" },
    },
    courses,
  };
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  // try standard fetch
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const html = await res.text();
    return basicParse(html);
  } catch (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _err
  ) {
    // fallback to puppeteer
    try {
      const browser = await puppeteer.launch({ args: ["--no-sandbox"], headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const html = await page.content();
      await browser.close();
      return basicParse(html);
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      err
    ) {
      throw new Error("Scraping failed");
    }
  }
}
