"use client";

import { useEffect, useState } from "react";

function greetingByHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TimeGreeting({ firstName }: { firstName: string }) {
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    setGreeting(greetingByHour(new Date().getHours()));
  }, []);

  return <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-slate-100">{greeting}, {firstName}</h1>;
}
