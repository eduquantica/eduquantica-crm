"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import EligibilityStatusBadge from "@/components/shared/EligibilityStatusBadge";

type EligibilityStatus = {
	eligible: boolean;
	partiallyEligible: boolean;
	overridden: boolean;
	overriddenBy?: string;
	overriddenAt?: string;
	matchedRequirements: string[];
	missingRequirements: string[];
	message: string;
	matchStatus: "PENDING" | "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
	matchScore: number;
};

type CompareCourse = {
	id: string;
	name: string;
	level: string;
	fieldOfStudy: string | null;
	duration: string | null;
	tuitionFee: number | null;
	applicationFee: number | null;
	currency: string;
	nextIntake: { date?: string; deadline?: string } | null;
	englishReqIelts: number | null;
	scholarshipAvailable: boolean;
	scholarshipAmount: {
		amount: number;
		currency: string;
		amountType: "FIXED" | "PERCENTAGE";
		percentageOf: "TUITION" | "LIVING" | "TOTAL" | null;
	} | null;
	eligibility: EligibilityStatus;
	successChance: number;
	university: {
		name: string;
		logo: string | null;
		country: string;
		qsRanking: number | null;
		timesHigherRanking: number | null;
		postStudyWorkVisa: string | null;
	};
};

type CompareResponse = {
	data: {
		studentNationality?: string | null;
		courses: CompareCourse[];
	};
};

function formatLevel(level: string) {
	return level.replaceAll("_", " ");
}

function eligibilityRank(status: EligibilityStatus) {
	if (status.message === "No specific requirements set") return 4;
	if (status.eligible) return 3;
	if (status.partiallyEligible) return 2;
	if (status.message === "Add qualifications to check eligibility") return 1;
	return 0;
}

function nextIntakeText(value: { date?: string; deadline?: string } | null) {
	if (!value) return "N/A";
	if (value.date) return value.date;
	if (value.deadline) return `By ${new Date(value.deadline).toLocaleDateString("en-GB")}`;
	return "N/A";
}

function minNumber(values: Array<number | null>) {
	const nums = values.filter((value): value is number => value != null);
	return nums.length ? Math.min(...nums) : null;
}

function maxNumber(values: Array<number | null>) {
	const nums = values.filter((value): value is number => value != null);
	return nums.length ? Math.max(...nums) : null;
}

function toTimestamp(intake: { date?: string; deadline?: string } | null) {
	if (!intake) return null;
	const raw = intake.deadline || intake.date;
	if (!raw) return null;
	const ts = Date.parse(raw);
	return Number.isFinite(ts) ? ts : null;
}

export default function WishlistComparePage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [loading, setLoading] = useState(true);
	const [studentNationality, setStudentNationality] = useState<string | null>(null);
	const [courses, setCourses] = useState<CompareCourse[]>([]);
	const [applyingId, setApplyingId] = useState<string | null>(null);

	const selectedIds = useMemo(() => {
		const raw = searchParams.get("ids") || "";
		return raw
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean)
			.slice(0, 5);
	}, [searchParams]);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				if (selectedIds.length < 2) {
					setLoading(false);
					return;
				}

				setLoading(true);
				const res = await fetch(`/api/student/wishlist?details=1&ids=${encodeURIComponent(selectedIds.join(","))}`, {
					cache: "no-store",
				});

				const json = (await res.json()) as CompareResponse | { error?: string };
				if (!res.ok || !("data" in json)) {
					throw new Error("error" in json ? json.error || "Failed to load comparison" : "Failed to load comparison");
				}

				if (cancelled) return;

				setCourses(json.data.courses || []);
				setStudentNationality(json.data.studentNationality || null);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to load comparison");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selectedIds]);

	const bestTuition = useMemo(() => minNumber(courses.map((course) => course.tuitionFee)), [courses]);
	const bestAppFee = useMemo(() => minNumber(courses.map((course) => course.applicationFee)), [courses]);
	const bestQs = useMemo(() => minNumber(courses.map((course) => course.university.qsRanking)), [courses]);
	const bestTimes = useMemo(() => minNumber(courses.map((course) => course.university.timesHigherRanking)), [courses]);
	const bestIelts = useMemo(() => minNumber(courses.map((course) => course.englishReqIelts)), [courses]);
	const bestScholarshipAmount = useMemo(
		() => maxNumber(courses.map((course) => course.scholarshipAmount?.amount ?? null)),
		[courses],
	);
	const bestSuccess = useMemo(() => maxNumber(courses.map((course) => course.successChance)), [courses]);
	const bestIntake = useMemo(() => minNumber(courses.map((course) => toTimestamp(course.nextIntake))), [courses]);
	const bestEligibility = useMemo(() => {
		if (!courses.length) return 0;
		const best = Math.max(...courses.map((course) => eligibilityRank(course.eligibility)));
		return best;
	}, [courses]);

	function removeFromComparison(courseId: string) {
		setCourses((previous) => {
			const next = previous.filter((course) => course.id !== courseId);
			if (next.length < 2) {
				toast.error("Add at least 2 courses to compare");
				router.push("/student/wishlist");
			}
			return next;
		});
	}

	async function applyNow(course: CompareCourse) {
		try {
			setApplyingId(course.id);
			const res = await fetch("/api/student/applications/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ courseId: course.id }),
			});
			const json = (await res.json()) as {
				error?: string;
				existingApplicationId?: string;
				data?: {
					application?: { id: string };
					applicationId?: string;
					fee?: { feeRequired?: boolean };
				};
			};

			if (res.status === 409) {
				toast.error(json.error || "You already have an active application for this course.");
				const existingId = json.existingApplicationId || json.data?.application?.id || json.data?.applicationId;
				if (existingId) router.push(`/student/applications/${existingId}`);
				return;
			}

			const applicationId = json.data?.application?.id || json.data?.applicationId;
			if (!res.ok || !applicationId) {
				throw new Error(json.error || "Failed to create application");
			}

			toast.success(`Application submitted for ${course.name} at ${course.university.name}.`);
			setTimeout(() => {
				if (json.data?.fee?.feeRequired) {
					router.push(`/student/applications/${applicationId}/fee?fromCreate=1`);
				} else {
					router.push(`/student/applications/${applicationId}`);
				}
			}, 250);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to apply");
		} finally {
			setApplyingId(null);
		}
	}

	if (loading) {
		return (
			<main className="w-full px-5 py-6 sm:px-7">
				<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading comparison...</div>
			</main>
		);
	}

	if (selectedIds.length < 2 || courses.length < 2) {
		return (
			<main className="w-full px-5 py-6 sm:px-7">
				<section className="rounded-2xl border border-slate-200 bg-white p-8">
					<h1 className="text-xl font-semibold text-slate-900">Select at least 2 courses to compare</h1>
					<p className="mt-2 text-sm text-slate-600">Go back to wishlist and tick two or more saved courses.</p>
					<Link href="/student/wishlist" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white">
						<ArrowLeft className="h-4 w-4" /> Back to Wishlist
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="w-full space-y-4 px-5 py-6 sm:px-7">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Course Comparison</h1>
					<p className="mt-1 text-sm text-slate-600">Comparing {courses.length} shortlisted courses</p>
				</div>

				<div className="flex items-center gap-2">
					<Link href="/student/wishlist" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
						Back
					</Link>
					<button
						onClick={() => window.print()}
						className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
					>
						<Download className="h-4 w-4" /> Print / Export PDF
					</button>
				</div>
			</header>

			<section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
				<div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
					Comparing {courses.length} courses (maximum 5)
				</div>
				<table className="min-w-[980px] w-full border-collapse text-sm">
					<thead>
						<tr>
							<th className="sticky left-0 z-10 w-56 border-b border-r border-slate-200 bg-slate-50 p-3 text-left font-semibold text-slate-900">
								Category
							</th>
							{courses.map((course) => (
								<th key={course.id} className="border-b border-slate-200 p-3 text-left font-semibold text-slate-900">
									<div className="space-y-2">
										<div className="flex justify-end">
											<button
												onClick={() => removeFromComparison(course.id)}
												className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"
												aria-label={`Remove ${course.name} from comparison`}
											>
												<X className="h-3.5 w-3.5" />
											</button>
										</div>
										<p className="font-semibold">{course.university.name}</p>
										<p className="text-xs font-normal text-slate-500">{course.name}</p>
									</div>
								</th>
							))}
						</tr>
					</thead>

					<tbody>
						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">University</td>
							{courses.map((course) => (
								<td key={`${course.id}-uni`} className="border-l border-slate-100 p-3">
									<div className="flex items-center gap-2">
										{course.university.logo ? (
											<Image
												src={course.university.logo}
												alt={course.university.name}
												width={28}
												height={28}
												className="h-7 w-7 rounded object-cover"
												loader={({ src }) => src}
												unoptimized
											/>
										) : (
											<div className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
												{course.university.name.slice(0, 2).toUpperCase()}
											</div>
										)}
										<span>{course.university.name}</span>
									</div>
								</td>
							))}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Course Name</td>
							{courses.map((course) => (
								<td key={`${course.id}-name`} className="border-l border-slate-100 p-3">{course.name}</td>
							))}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Level</td>
							{courses.map((course) => (
								<td key={`${course.id}-level`} className="border-l border-slate-100 p-3">{formatLevel(course.level)}</td>
							))}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Duration</td>
							{courses.map((course) => (
								<td key={`${course.id}-duration`} className="border-l border-slate-100 p-3">{course.duration || "N/A"}</td>
							))}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Tuition Fee</td>
							{courses.map((course) => {
								const isBest = bestTuition != null && course.tuitionFee != null && course.tuitionFee === bestTuition;
								return (
									<td key={`${course.id}-tuition`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{course.tuitionFee ? (
											<CurrencyDisplay amount={course.tuitionFee} baseCurrency={course.currency} studentNationality={studentNationality || undefined} />
										) : (
											"N/A"
										)}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Application Fee</td>
							{courses.map((course) => {
								const isBest = bestAppFee != null && course.applicationFee != null && course.applicationFee === bestAppFee;
								return (
									<td key={`${course.id}-app-fee`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{course.applicationFee ? `${course.currency} ${course.applicationFee.toLocaleString()}` : "Free / N/A"}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Next Intake</td>
							{courses.map((course) => {
								const ts = toTimestamp(course.nextIntake);
								const isBest = bestIntake != null && ts != null && ts === bestIntake;
								return (
									<td key={`${course.id}-intake`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{nextIntakeText(course.nextIntake)}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">QS Ranking</td>
							{courses.map((course) => {
								const isBest = bestQs != null && course.university.qsRanking != null && course.university.qsRanking === bestQs;
								return (
									<td key={`${course.id}-qs`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{course.university.qsRanking ?? "N/A"}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Times Higher Ranking</td>
							{courses.map((course) => {
								const isBest =
									bestTimes != null
									&& course.university.timesHigherRanking != null
									&& course.university.timesHigherRanking === bestTimes;
								return (
									<td key={`${course.id}-times`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{course.university.timesHigherRanking ?? "N/A"}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Field of Study</td>
							{courses.map((course) => (
								<td key={`${course.id}-field`} className="border-l border-slate-100 p-3">{course.fieldOfStudy || "N/A"}</td>
							))}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">English Requirement (IELTS)</td>
							{courses.map((course) => {
								const isBest = bestIelts != null && course.englishReqIelts != null && course.englishReqIelts === bestIelts;
								return (
									<td key={`${course.id}-ielts`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{course.englishReqIelts != null ? `IELTS ${course.englishReqIelts}` : "N/A"}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Scholarship Available</td>
							{courses.map((course) => (
								<td
									key={`${course.id}-scholarship-available`}
									className={`border-l border-slate-100 p-3 ${course.scholarshipAvailable ? "bg-emerald-50" : ""}`}
								>
									{course.scholarshipAvailable ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-slate-400" />}
								</td>
							))}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Scholarship Amount</td>
							{courses.map((course) => {
								const amount = course.scholarshipAmount?.amount ?? null;
								const isBest = bestScholarshipAmount != null && amount != null && amount === bestScholarshipAmount;
								return (
									<td key={`${course.id}-scholarship-amount`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{!course.scholarshipAmount ? (
											"N/A"
										) : course.scholarshipAmount.amountType === "FIXED" ? (
											`${course.scholarshipAmount.currency} ${course.scholarshipAmount.amount.toLocaleString()}`
										) : (
											`${course.scholarshipAmount.amount}% (${course.scholarshipAmount.percentageOf || "TOTAL"})`
										)}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Eligibility Match</td>
							{courses.map((course) => {
								const isBest = eligibilityRank(course.eligibility) === bestEligibility;

								return (
									<td key={`${course.id}-eligibility`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										<EligibilityStatusBadge status={course.eligibility} isStaff={false} />
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Success Chance %</td>
							{courses.map((course) => {
								const isBest = bestSuccess != null && course.successChance === bestSuccess;
								return (
									<td key={`${course.id}-success`} className={`border-l border-slate-100 p-3 ${isBest ? "bg-emerald-50" : ""}`}>
										{course.successChance}%
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Post-Study Work Rights</td>
							{courses.map((course) => {
								const hasValue = Boolean(course.university.postStudyWorkVisa);
								return (
									<td key={`${course.id}-psw`} className={`border-l border-slate-100 p-3 ${hasValue ? "bg-emerald-50" : ""}`}>
										{course.university.postStudyWorkVisa || "N/A"}
									</td>
								);
							})}
						</tr>

						<tr>
							<td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 font-medium text-slate-900">Apply</td>
							{courses.map((course) => (
								<td key={`${course.id}-apply`} className="border-l border-slate-100 p-3">
									<button
										onClick={() => void applyNow(course)}
										disabled={applyingId === course.id}
										className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
									>
										{applyingId === course.id && <Loader2 className="h-4 w-4 animate-spin" />}
										Apply Now
									</button>
								</td>
							))}
						</tr>
					</tbody>
				</table>
			</section>
		</main>
	);
}
