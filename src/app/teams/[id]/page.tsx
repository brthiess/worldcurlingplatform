import { PublicRoster } from "@/components/public-rosters";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PublicRoster kind="teams" id={(await params).id} />;
}
