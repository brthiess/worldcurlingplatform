import { BracketView } from "@/components/bracket-view";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <BracketView eventId={(await params).id} />;
}
