"use client";

import { useEffect, useState } from "react";

function greetingByHour(hour: number): { text: string; emoji: string } {
  if (hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour < 18) return { text: "Good afternoon", emoji: "🌤️" };
  return { text: "Good evening", emoji: "🌙" };
}

export default function TimeGreeting({ firstName }: { firstName: string }) {
  const [greeting, setGreeting] = useState({ text: "Good morning", emoji: "☀️" });

  useEffect(() => {
    setGreeting(greetingByHour(new Date().getHours()));
  }, []);

  return (
    <h1 className="text-2xl font-bold text-white">
      {greeting.emoji} {greeting.text}, {firstName}!
    </h1>
  );
}
