import React, { useState, useEffect } from "react";

export default function ClockHeader() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="inline-flex items-center space-x-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-sm text-slate-300">
      <span className="font-semibold select-all">
        {currentTime.toLocaleDateString("fr-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).toUpperCase()}{" - "}{currentTime.toLocaleTimeString("fr-CA")}
      </span>
    </span>
  );
}
