/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import { cn } from "@/lib/cn";

export default function ApplicationsNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [students, setStudents] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [universities, setUniversities] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courses, setCourses] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedUniversity, setSelectedUniversity] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [selectedIntake, setSelectedIntake] = useState<string | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // fetch students
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/dashboard/students?q=${encodeURIComponent(studentSearch)}`)
        .then((r) => r.json())
        .then((d) => setStudents(d.data || []))
        .catch((err) => {
          console.error("Failed to fetch students", err);
          setStudents([]);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  // fetch universities
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch("/api/admin/universities?take=500", { cache: "no-store" });
        const data = await res.json();
        if (mounted) setUniversities(data?.data?.universities || []);
      } catch (err) {
        console.error("Failed to fetch universities", err);
        if (mounted) setUniversities([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (prefillApplied) return;

    const initialStudentId = searchParams.get("studentId");
    const initialCourseId = searchParams.get("courseId");
    if (!initialStudentId && !initialCourseId) {
      setPrefillApplied(true);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        if (initialStudentId) {
          const studentRes = await fetch(`/api/admin/students/${initialStudentId}`, { cache: "no-store" });
          if (studentRes.ok) {
            const studentJson = await studentRes.json();
            const s = studentJson?.data?.student;
            if (mounted && s) {
              setSelectedStudent(s);
            }
          }
        }

        if (initialCourseId) {
          const courseRes = await fetch(`/api/admin/courses/${initialCourseId}`, { cache: "no-store" });
          if (courseRes.ok) {
            const courseJson = await courseRes.json();
            const c = courseJson?.data?.course;
            if (mounted && c) {
              setSelectedCourse(c);
              setSelectedUniversity(c.university);
              const firstIntake = c.intakeDatesWithDeadlines?.[0]?.date || null;
              setSelectedIntake(firstIntake);
            }
          }
        }

        if (mounted) {
          setStep(initialCourseId ? 3 : 2);
          setPrefillApplied(true);
        }
      } catch (err) {
        console.error("Failed to prefill application form", err);
        if (mounted) setPrefillApplied(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [prefillApplied, searchParams]);

  // when university selected, fetch courses
  useEffect(() => {
    if (!selectedUniversity?.id) {
      setCourses([]);
      setSelectedCourse(null);
      return;
    }

    fetch(`/api/admin/universities/${selectedUniversity.id}/courses`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        setCourses(payload?.data?.courses || []);
      })
      .catch((err) => {
        console.error("Failed to fetch university courses", err);
        setCourses([]);
      });
  }, [selectedUniversity]);

  function next() {
    setStep((s) => Math.min(s + 1, 4));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function createApplication() {
    if (!selectedStudent || !selectedCourse || !selectedUniversity || !selectedIntake)
      return;

    setError("");
    setIsSubmitting(true);

    const body = {
      studentId: selectedStudent.id,
      courseId: selectedCourse.id,
      universityId: selectedUniversity.id,
      intake: selectedIntake,
    };

    try {
      const res = await fetch(`/api/dashboard/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to create application");
      }

      const data = await res.json();
      router.push(`/dashboard/applications/${data.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Create Application</h2>

        {error ? (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <div className={cn("px-3 py-1 rounded-full", step===1?"bg-blue-500 text-white":"bg-gray-100 text-gray-700")}>1</div>
            <div className={cn("px-3 py-1 rounded-full", step===2?"bg-blue-500 text-white":"bg-gray-100 text-gray-700")}>2</div>
            <div className={cn("px-3 py-1 rounded-full", step===3?"bg-blue-500 text-white":"bg-gray-100 text-gray-700")}>3</div>
            <div className={cn("px-3 py-1 rounded-full", step===4?"bg-blue-500 text-white":"bg-gray-100 text-gray-700")}>4</div>
          </div>
        </div>

        {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Select Student</label>
            <input value={studentSearch} onChange={(e)=>setStudentSearch(e.target.value)} placeholder="Search student..." className="w-full mt-2 px-3 py-2 border rounded" />

            <div className="mt-3 max-h-64 overflow-auto">
              {(students || []).map((s)=> (
                <div key={s.id} onClick={()=>setSelectedStudent(s)} className={cn("p-2 rounded hover:bg-gray-50 cursor-pointer", selectedStudent?.id===s.id?"bg-blue-50":"")}> 
                  <div className="font-medium">{s.firstName} {s.lastName} <span className="text-xs text-gray-500">{s.email}</span></div>
                  <div className="text-sm text-gray-600">Profile: {s.profileCompletion}% {s.profileCompletion < 50 && <span className="text-sm text-red-600">(Below 50% — warning)</span>}</div>
                </div>
              ))}
            </div>

          </div>
        )}

        {step === 2 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">University</label>
            <select className="w-full mt-2 px-3 py-2 border rounded" onChange={(e)=>{
              const id = e.target.value;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const u = (universities || []).find((x:any)=>x.id===id);
              setSelectedUniversity(u);
              setSelectedCourse(null);
            }} value={selectedUniversity?.id||""}>
              <option value="">Select university</option>
              {(universities||[]).map((u:any)=>(<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mt-4">Course</label>
            <select className="w-full mt-2 px-3 py-2 border rounded" onChange={(e)=>{
              const id = e.target.value;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const c = (courses || []).find((x:any)=>x.id===id);
              setSelectedCourse(c);
            }} value={selectedCourse?.id||""}>
              <option value="">Select course</option>
              {(courses||[]).map((c:any)=>(<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>

            {selectedCourse && (
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{selectedCourse.name}</div>
                    <div className="text-sm text-gray-600">Duration: {selectedCourse.duration || "-"}</div>
                    <div className="text-sm text-gray-600 mt-2">Intakes: {(selectedCourse?.intakeDatesWithDeadlines || []).map((i:any)=>i.date).join(", ")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Tuition</div>
                    <div className="text-lg font-semibold">
                      <CurrencyDisplay amount={selectedCourse.tuitionFee} baseCurrency={selectedCourse.currency || "GBP"} />
                    </div>
                  </div>
                </div>

                {/* Eligibility placeholder - simple random for now */}
                <div className="mt-3">
                  <div className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800">Partial Match</div>
                  <div className="text-sm text-amber-700 mt-2">Student partially meets entry requirements.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Select Intake</label>
            <select className="w-full mt-2 px-3 py-2 border rounded" value={selectedIntake||""} onChange={(e)=>setSelectedIntake(e.target.value)}>
              <option value="">Select intake</option>
              {(selectedCourse?.intakeDatesWithDeadlines||[]).map((i:any)=>(<option key={i.date} value={i.date}>{i.date}</option>))}
            </select>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="font-medium">Confirm</h3>
            <div className="mt-3 space-y-2">
              <div>Student: {selectedStudent?.firstName} {selectedStudent?.lastName}</div>
              <div>University: {selectedUniversity?.name}</div>
              <div>Course: {selectedCourse?.name}</div>
              <div>Intake: {selectedIntake}</div>
              <div>Tuition: <CurrencyDisplay amount={selectedCourse?.tuitionFee} baseCurrency={selectedCourse?.currency||"GBP"} /></div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={back} className="px-4 py-2 border rounded">Back</button>
              <button
                onClick={createApplication}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create Application"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <div></div>
          <div>
            {step>1 && <button onClick={back} className="px-3 py-2 mr-2">Back</button>}
            {step<4 && <button onClick={next} className="px-3 py-2 bg-blue-50 rounded">Next</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
