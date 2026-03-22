import MobileUploadClient from "./MobileUploadClient";

export const dynamic = "force-dynamic";

export default function MobileUploadPage({ searchParams }: { searchParams: { token?: string } }) {
  return <MobileUploadClient token={searchParams.token || ""} />;
}
