import { PublicRoster } from "@/components/public-rosters";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PublicRoster kind="entries" id={(await params).id} />;
}
