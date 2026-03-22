export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FC] bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(27,42,74,0.12),transparent_35%)]">
      {children}
    </div>
  );
}
