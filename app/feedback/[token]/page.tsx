import FeedbackFormClient from "./FeedbackFormClient";

export default function FeedbackPage({ params }: { params: { token: string } }) {
  return <FeedbackFormClient token={params.token} />;
}
