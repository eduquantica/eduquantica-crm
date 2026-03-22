"use client";

import { useEffect } from "react";

export default function CourseViewTracker({ courseId }: { courseId: string }) {
  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/student/courses/${courseId}/view`, {
      method: "POST",
      signal: controller.signal,
    }).catch(() => {
      return;
    });

    return () => controller.abort();
  }, [courseId]);

  return null;
}
