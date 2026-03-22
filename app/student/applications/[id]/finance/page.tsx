import { redirect } from "next/navigation";

export default function StudentApplicationFinanceLegacyPage({ params }: { params: { id: string } }) {
  redirect(`/student/finance/${params.id}`);
}
