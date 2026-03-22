export type MockInterviewQuestionCategory =
  | "University Knowledge"
  | "Destination Choice"
  | "Academic Background"
  | "English Language Proficiency"
  | "Study Motivation"
  | "Financial Questions"
  | "Accommodation and Living Plans"
  | "Post Study Work Plans"
  | "Ties to Home Country"
  | "Genuineness and Consistency Check";

export type MockInterviewBaseQuestion = {
  id: string;
  question: string;
  followUp?: string;
  evaluationCriteria: string;
  redFlags: string;
  category: MockInterviewQuestionCategory;
};

export type MockInterviewRoundDefinition = {
  roundNumber: number;
  roundName: MockInterviewQuestionCategory;
  questions: MockInterviewBaseQuestion[];
};

export const MOCK_INTERVIEW_ROUNDS: MockInterviewRoundDefinition[] = [
  {
    roundNumber: 1,
    roundName: "University Knowledge",
    questions: [
      {
        id: "r1-q1",
        question: "Why did you choose [University Name] specifically?",
        followUp: "Can you mention two specific reasons linked to your academic or career goals?",
        evaluationCriteria: "Specific, researched, and personal reasons tied to goals.",
        redFlags: "Generic answer, cannot name university strengths, appears coached.",
        category: "University Knowledge",
      },
      {
        id: "r1-q2",
        question: "What do you know about [University Name]? Tell me about its reputation and rankings.",
        followUp: "Can you cite one concrete ranking, accreditation, or recognition?",
        evaluationCriteria: "Accurate facts aligned with provided university materials.",
        redFlags: "Incorrect ranking claims or obvious fabrication.",
        category: "University Knowledge",
      },
      {
        id: "r1-q3",
        question: "Why did you choose [Course Name]? What attracted you to this specific programme?",
        followUp: "Which modules or outcomes from the course are most relevant to your goals?",
        evaluationCriteria: "Clear course-program fit and realistic outcome understanding.",
        redFlags: "Cannot explain course specifics; mismatched motivation.",
        category: "University Knowledge",
      },
      {
        id: "r1-q4",
        question: "What is the duration and tuition fee of your course?",
        followUp: "Please confirm the total tuition and whether this is per year or total programme cost.",
        evaluationCriteria: "Numerically consistent with offer/course data.",
        redFlags: "Major mismatch with offer letter extracted data.",
        category: "University Knowledge",
      },
      {
        id: "r1-q5",
        question: "Have you applied to any other universities?",
        followUp: "Can you explain your shortlist decision process?",
        evaluationCriteria: "Consistent and plausible application strategy.",
        redFlags: "Contradicts earlier statements or records.",
        category: "University Knowledge",
      },
      {
        id: "r1-q6",
        question: "If yes: Did you receive offers from other universities?",
        followUp: "What were the key differences among those offers?",
        evaluationCriteria: "Consistent evidence-based comparison.",
        redFlags: "Inconsistency with prior answers or documents.",
        category: "University Knowledge",
      },
      {
        id: "r1-q7",
        question: "If yes: Why did you choose [University Name] over others?",
        followUp: "What made this offer the strongest academic and financial fit?",
        evaluationCriteria: "Balanced rationale covering quality, fit, and affordability.",
        redFlags: "No clear basis for choice.",
        category: "University Knowledge",
      },
      {
        id: "r1-q8",
        question: "If no: Why only one university? Did you not consider other options?",
        followUp: "How did you evaluate risk with a single application strategy?",
        evaluationCriteria: "Reasoned planning with logical justification.",
        redFlags: "Unprepared or implausible explanation.",
        category: "University Knowledge",
      },
      {
        id: "r1-q9",
        question: "What do you know about the campus, facilities, and student support at [University Name]?",
        followUp: "Name one support service you expect to use and why.",
        evaluationCriteria: "Specific knowledge from official sources.",
        redFlags: "No awareness of basic student support.",
        category: "University Knowledge",
      },
      {
        id: "r1-q10",
        question: "Who recommended this university to you or how did you find out about it?",
        followUp: "What steps did you personally take to verify the recommendation?",
        evaluationCriteria: "Demonstrates independent research and ownership.",
        redFlags: "Entirely third-party driven with no personal research.",
        category: "University Knowledge",
      },
    ],
  },
  {
    roundNumber: 2,
    roundName: "Destination Choice",
    questions: [
      { id: "r2-q1", question: "Why did you choose to study in [Country]?", followUp: "Can you link your choice to education quality and career outcomes?", evaluationCriteria: "Country-level rationale with specific academic/career logic.", redFlags: "Weak, generic, or migration-focused-only motive.", category: "Destination Choice" },
      { id: "r2-q2", question: "Why not study in your home country? What is lacking there?", followUp: "Please answer respectfully with concrete academic differences.", evaluationCriteria: "Balanced comparison without exaggeration.", redFlags: "Dismissive or unrealistic claims.", category: "Destination Choice" },
      { id: "r2-q3", question: "Have you considered studying in any other country? Why [Country] over others?", followUp: "What was your decision framework for comparing countries?", evaluationCriteria: "Structured, evidence-based comparison.", redFlags: "No comparison process.", category: "Destination Choice" },
      { id: "r2-q4", question: "What do you know about student life in [Country]?", followUp: "What practical adjustment challenges do you expect?", evaluationCriteria: "Practical awareness and adaptation planning.", redFlags: "No realistic understanding.", category: "Destination Choice" },
      { id: "r2-q5", question: "What do you know about the education system in [Country]?", followUp: "How is assessment structured in your chosen system?", evaluationCriteria: "Basic correctness on system structure.", redFlags: "Factually incorrect system claims.", category: "Destination Choice" },
      { id: "r2-q6", question: "Have you ever visited [Country] before? If yes: Tell me about your experience.", followUp: "Did that visit influence your academic planning?", evaluationCriteria: "Consistent travel history and relevance.", redFlags: "Inconsistency with declared travel/immigration history.", category: "Destination Choice" },
      { id: "r2-q7", question: "Do you have any friends or family living in [Country]?", followUp: "How will this influence your study plans, if at all?", evaluationCriteria: "Transparent and consistent ties disclosure.", redFlags: "Concealment or contradiction.", category: "Destination Choice" },
      { id: "r2-q8", question: "What challenges do you expect living in [Country] and how will you handle them?", followUp: "Give one concrete coping plan for cost, weather, or culture.", evaluationCriteria: "Practical preparedness and maturity.", redFlags: "No mitigation plan.", category: "Destination Choice" },
    ],
  },
  {
    roundNumber: 3,
    roundName: "Academic Background",
    questions: [
      { id: "r3-q1", question: "Tell me about your academic qualifications. What did you study previously?", followUp: "Please include qualification level and completion year.", evaluationCriteria: "Clear chronology and qualification relevance.", redFlags: "Inconsistent timeline.", category: "Academic Background" },
      { id: "r3-q2", question: "What grades did you achieve in your most recent qualification?", followUp: "Can you explain your strongest and weakest subjects?", evaluationCriteria: "Accurate grades aligned with records.", redFlags: "Grade inflation or mismatch with transcript.", category: "Academic Background" },
      { id: "r3-q3", question: "How does your previous study relate to [Course Name] you are applying for?", followUp: "Which prior modules are most transferable?", evaluationCriteria: "Logical progression between prior study and target course.", redFlags: "No academic bridge.", category: "Academic Background" },
      { id: "r3-q4", question: "Do you have any gaps in your education? If yes: Please explain what you did during that time.", followUp: "Can you provide a timeline of activities during the gap?", evaluationCriteria: "Transparent explanation with timeline consistency.", redFlags: "Unexplained or contradictory gaps.", category: "Academic Background" },
      { id: "r3-q5", question: "Have you studied any similar courses before? If yes: Why are you studying it again at this level?", followUp: "What additional outcomes does this new course provide?", evaluationCriteria: "Clear upskilling or specialization logic.", redFlags: "Redundant or unclear progression rationale.", category: "Academic Background" },
      { id: "r3-q6", question: "What was the most challenging subject for you and how did you handle it?", followUp: "What strategy did you use to improve performance?", evaluationCriteria: "Reflective learning behavior.", redFlags: "No ownership of learning challenges.", category: "Academic Background" },
      { id: "r3-q7", question: "Why do you want to study at this level rather than using your existing qualification?", followUp: "What career doors are blocked without this level?", evaluationCriteria: "Specific level-based career justification.", redFlags: "Vague or unnecessary-level argument.", category: "Academic Background" },
    ],
  },
  {
    roundNumber: 4,
    roundName: "English Language Proficiency",
    questions: [
      { id: "r4-q1", question: "What is your English language test score? IELTS, TOEFL, PTE etc.", followUp: "Please share section scores if you remember them.", evaluationCriteria: "Accurate and test-valid responses.", redFlags: "Score inconsistency vs records.", category: "English Language Proficiency" },
      { id: "r4-q2", question: "When did you take your English test?", followUp: "Is the score still valid for your university intake?", evaluationCriteria: "Date awareness and validity understanding.", redFlags: "Invalid or uncertain score validity.", category: "English Language Proficiency" },
      { id: "r4-q3", question: "Have you studied in English medium before?", followUp: "How has that prepared you for this programme?", evaluationCriteria: "Language readiness demonstration.", redFlags: "Overstated readiness without support.", category: "English Language Proficiency" },
      { id: "r4-q4", question: "Why did you choose to study in English rather than your native language?", followUp: "How does English benefit your future career path?", evaluationCriteria: "Pragmatic and career-linked language rationale.", redFlags: "No clear reason.", category: "English Language Proficiency" },
      { id: "r4-q5", question: "How do you plan to keep up with lectures and assignments in English?", followUp: "Name two concrete study strategies.", evaluationCriteria: "Specific academic coping mechanisms.", redFlags: "No preparation plan.", category: "English Language Proficiency" },
      { id: "r4-q6", question: "Have you taken any English language courses or preparation classes?", followUp: "What measurable improvements did you achieve?", evaluationCriteria: "Evidence of proactive preparation.", redFlags: "No preparation despite weak score profile.", category: "English Language Proficiency" },
      { id: "r4-q7", question: "Do you feel confident communicating in English in an academic environment?", followUp: "Can you give an example of recent academic communication in English?", evaluationCriteria: "Confidence + evidence.", redFlags: "High confidence but no supporting experience.", category: "English Language Proficiency" },
    ],
  },
  {
    roundNumber: 5,
    roundName: "Study Motivation",
    questions: [
      { id: "r5-q1", question: "What are your career goals after completing this course?", followUp: "Please share short-term and long-term goals.", evaluationCriteria: "Realistic and coherent career roadmap.", redFlags: "Unclear or contradictory goals.", category: "Study Motivation" },
      { id: "r5-q2", question: "How will [Course Name] help you achieve your career goals?", followUp: "Which specific modules or skills are most critical?", evaluationCriteria: "Course-to-career mapping.", redFlags: "No concrete link.", category: "Study Motivation" },
      { id: "r5-q3", question: "Why do you need this specific qualification for your career?", followUp: "What roles explicitly require this qualification?", evaluationCriteria: "Qualification necessity evidence.", redFlags: "Qualification appears unnecessary.", category: "Study Motivation" },
      { id: "r5-q4", question: "What research have you done about career prospects after this course?", followUp: "Mention market demand evidence or target employers.", evaluationCriteria: "Evidence-backed opportunity awareness.", redFlags: "No market research.", category: "Study Motivation" },
      { id: "r5-q5", question: "What is your plan B if your original career plan does not work out?", followUp: "How does your degree still create value in alternate paths?", evaluationCriteria: "Contingency planning maturity.", redFlags: "No fallback strategy.", category: "Study Motivation" },
      { id: "r5-q6", question: "Do you have any work experience related to your chosen field?", followUp: "How did that experience shape your study decision?", evaluationCriteria: "Practical exposure linkage.", redFlags: "Claims of experience that are vague or inconsistent.", category: "Study Motivation" },
    ],
  },
  {
    roundNumber: 6,
    roundName: "Financial Questions",
    questions: [
      { id: "r6-q1", question: "Who is sponsoring your studies?", followUp: "What is your relationship with your sponsor?", evaluationCriteria: "Clear, verifiable sponsorship source.", redFlags: "Unclear sponsor identity.", category: "Financial Questions" },
      { id: "r6-q2", question: "What is your primary source of funds?", followUp: "Can you explain the source history briefly?", evaluationCriteria: "Transparent lawful source explanation.", redFlags: "Unexplained or suspicious source.", category: "Financial Questions" },
      { id: "r6-q3", question: "How much money do you have available for your studies and living expenses?", followUp: "Break this down by tuition, living, and buffer.", evaluationCriteria: "Numerically accurate and structured.", redFlags: "Amounts inconsistent with known requirements.", category: "Financial Questions" },
      { id: "r6-q4", question: "Can you explain how your sponsor earned or saved this money?", followUp: "What is the sponsor’s occupation and estimated annual income?", evaluationCriteria: "Plausible earning capacity and savings story.", redFlags: "Implausible accumulation claims.", category: "Financial Questions" },
      { id: "r6-q5", question: "Are your funds currently held in a bank account? Which bank and in which country?", followUp: "How long have these funds remained available?", evaluationCriteria: "Banking specifics and stability.", redFlags: "No clear custody of funds.", category: "Financial Questions" },
      { id: "r6-q6", question: "Have you calculated your total cost of study including tuition, accommodation, and living?", followUp: "Please share your month-by-month estimate.", evaluationCriteria: "Comprehensive budgeting.", redFlags: "No cost planning.", category: "Financial Questions" },
      { id: "r6-q7", question: "What will happen if your costs are higher than expected?", followUp: "What exact contingency resources are available?", evaluationCriteria: "Credible contingency planning.", redFlags: "No financial fallback.", category: "Financial Questions" },
      { id: "r6-q8", question: "Do you have any scholarships or financial aid?", followUp: "How much does this reduce your total funding burden?", evaluationCriteria: "Accurate aid acknowledgement and budgeting impact.", redFlags: "Claims unverified scholarship support.", category: "Financial Questions" },
    ],
  },
  {
    roundNumber: 7,
    roundName: "Accommodation and Living Plans",
    questions: [
      { id: "r7-q1", question: "Where do you plan to live during your studies?", followUp: "Why did you choose this option?", evaluationCriteria: "Realistic accommodation choice.", redFlags: "No accommodation planning.", category: "Accommodation and Living Plans" },
      { id: "r7-q2", question: "Have you arranged accommodation already? If yes: Tell me about it.", followUp: "Can you share estimated rent and contract terms?", evaluationCriteria: "Specific arrangement details.", redFlags: "Unverified or contradictory claims.", category: "Accommodation and Living Plans" },
      { id: "r7-q3", question: "What is your monthly budget for accommodation?", followUp: "How does this compare with city averages?", evaluationCriteria: "Cost-awareness aligned budget.", redFlags: "Severely unrealistic budget.", category: "Accommodation and Living Plans" },
      { id: "r7-q4", question: "What is your monthly budget for food and living expenses?", followUp: "Please break down key categories.", evaluationCriteria: "Detailed monthly budgeting.", redFlags: "No budget granularity.", category: "Accommodation and Living Plans" },
      { id: "r7-q5", question: "Have you researched the cost of living in [City/Country]?", followUp: "Name two cost sources you used.", evaluationCriteria: "Evidence of practical preparation.", redFlags: "No research done.", category: "Accommodation and Living Plans" },
      { id: "r7-q6", question: "Do you know anyone in [City] who could help you settle in?", followUp: "How will you settle if you cannot rely on them?", evaluationCriteria: "Balanced support expectations.", redFlags: "Overdependence on undeclared contacts.", category: "Accommodation and Living Plans" },
      { id: "r7-q7", question: "What will you do if your accommodation falls through?", followUp: "What is your emergency accommodation plan for the first two weeks?", evaluationCriteria: "Practical contingency plan.", redFlags: "No fallback housing plan.", category: "Accommodation and Living Plans" },
    ],
  },
  {
    roundNumber: 8,
    roundName: "Post Study Work Plans",
    questions: [
      { id: "r8-q1", question: "What do you plan to do immediately after completing your studies?", followUp: "What are your first 90-day post-study steps?", evaluationCriteria: "Clear immediate plan.", redFlags: "No post-study clarity.", category: "Post Study Work Plans" },
      { id: "r8-q2", question: "Do you plan to use the Post Study Work visa to work in [Country] after graduation?", followUp: "If yes, how does this align with your long-term goals?", evaluationCriteria: "Policy-aware and goal-aligned response.", redFlags: "Confused or inconsistent visa intent.", category: "Post Study Work Plans" },
      { id: "r8-q3", question: "If yes: What kind of job will you look for?", followUp: "Which employers or sectors are your priority targets?", evaluationCriteria: "Role-specific career targeting.", redFlags: "No defined job target.", category: "Post Study Work Plans" },
      { id: "r8-q4", question: "How long do you plan to stay in [Country] after graduation?", followUp: "What determines your return timeline?", evaluationCriteria: "Time-bounded and coherent plan.", redFlags: "Unclear timeline.", category: "Post Study Work Plans" },
      { id: "r8-q5", question: "Do you intend to settle permanently in [Country] or return home?", followUp: "Please explain your reasoning clearly.", evaluationCriteria: "Consistent intent statement.", redFlags: "Contradicts home-ties narrative.", category: "Post Study Work Plans" },
      { id: "r8-q6", question: "What opportunities will this degree open for you back in your home country?", followUp: "Name specific roles or sectors back home.", evaluationCriteria: "Strong home-country opportunity linkage.", redFlags: "No home-country value proposition.", category: "Post Study Work Plans" },
    ],
  },
  {
    roundNumber: 9,
    roundName: "Ties to Home Country",
    questions: [
      { id: "r9-q1", question: "What will you do when you return to your home country after studies?", followUp: "What timeline do you have for returning and starting that plan?", evaluationCriteria: "Concrete return plan.", redFlags: "No return strategy.", category: "Ties to Home Country" },
      { id: "r9-q2", question: "Do you have family members who depend on you back home?", followUp: "How do these responsibilities influence your long-term decisions?", evaluationCriteria: "Credible family ties.", redFlags: "Vague dependency claims.", category: "Ties to Home Country" },
      { id: "r9-q3", question: "Do you have a job, business, or property waiting for you back home?", followUp: "Can you explain your expected role or responsibility there?", evaluationCriteria: "Tangible economic/professional ties.", redFlags: "No concrete ties.", category: "Ties to Home Country" },
      { id: "r9-q4", question: "What motivates you to return home after your studies?", followUp: "What are the biggest pull factors for returning?", evaluationCriteria: "Strong and believable pull factors.", redFlags: "No clear return motivation.", category: "Ties to Home Country" },
      { id: "r9-q5", question: "What ties do you have to your home country that will bring you back?", followUp: "Which tie is the strongest and why?", evaluationCriteria: "Multiple credible ties.", redFlags: "Only weak or non-committal ties.", category: "Ties to Home Country" },
      { id: "r9-q6", question: "Has any member of your immediate family previously studied or lived abroad?", followUp: "How is your case similar or different from theirs?", evaluationCriteria: "Transparent and consistent family history.", redFlags: "Concealed or contradictory family migration history.", category: "Ties to Home Country" },
    ],
  },
  {
    roundNumber: 10,
    roundName: "Genuineness and Consistency Check",
    questions: [
      { id: "r10-q1", question: "Can you summarise why you chose [University], [Course], and [Country] in one minute?", followUp: "Please keep it concise and consistent with your earlier answers.", evaluationCriteria: "Coherent summary with internal consistency.", redFlags: "Contradictions across prior responses.", category: "Genuineness and Consistency Check" },
      { id: "r10-q2", question: "Is there anything else you would like to tell us about yourself or your application?", followUp: "Share one important detail that strengthens your case.", evaluationCriteria: "Relevant additional context.", redFlags: "Irrelevant or inconsistent add-ons.", category: "Genuineness and Consistency Check" },
      { id: "r10-q3", question: "What is your biggest concern about studying abroad?", followUp: "How will you manage this concern realistically?", evaluationCriteria: "Self-awareness and mitigation plan.", redFlags: "No preparation for obvious challenges.", category: "Genuineness and Consistency Check" },
      { id: "r10-q4", question: "How have you prepared for this interview?", followUp: "What specific materials or guidance did you use?", evaluationCriteria: "Preparedness and authenticity.", redFlags: "Scripted, memorized, or evasive delivery.", category: "Genuineness and Consistency Check" },
    ],
  },
];

export const ROUND_SCORE_WEIGHTS: Record<number, number> = {
  1: 15,
  2: 10,
  3: 10,
  4: 10,
  5: 10,
  6: 15,
  7: 5,
  8: 5,
  9: 10,
  10: 10,
};

export function interpolatePlaceholders(input: string, vars: Record<string, string | null | undefined>) {
  return input
    .replaceAll("[University Name]", vars.universityName || "the university")
    .replaceAll("[University]", vars.universityName || "the university")
    .replaceAll("[Course Name]", vars.courseName || "the course")
    .replaceAll("[Course]", vars.courseName || "the course")
    .replaceAll("[Country]", vars.country || "the destination country")
    .replaceAll("[City/Country]", vars.cityCountry || vars.country || "the destination");
}

export function getRoundDefinition(roundNumber: number) {
  return MOCK_INTERVIEW_ROUNDS.find((r) => r.roundNumber === roundNumber) || null;
}

export function getQuestionByRoundAndIndex(roundNumber: number, questionNumber: number) {
  const round = getRoundDefinition(roundNumber);
  if (!round) return null;
  return round.questions[questionNumber - 1] || null;
}
