"use client";

export default function AppModal({
  children,
  maxWidthClass = "max-w-2xl",
}: {
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${maxWidthClass} rounded-xl bg-white p-5 shadow-xl`}>
        {children}
      </div>
    </div>
  );
}
