import { redirect } from "next/navigation";

export default function StudentApplicationFinanceMobileBridgeLegacyPage({ params }: { params: { id: string } }) {
  redirect(`/student/finance/${params.id}/finance-mobile-bridge`);
}
