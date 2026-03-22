import VisaDetailClient from "./VisaDetailClient";

export default async function VisaDetailPage({ params }: { params: { id: string } }) {
  return <VisaDetailClient applicationId={params.id} />;
}
