import WriterClient from "./writer-client";

export default function StudentWriterPage({ params }: { params: { type: string } }) {
  return <WriterClient typeParam={params.type} />;
}
