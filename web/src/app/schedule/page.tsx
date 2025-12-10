import { redirect } from "next/navigation";

export default function SchedulePage() {
  redirect("/requests");
  return null;
}
