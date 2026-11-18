import type { Metadata } from "next";
import Evolution from "@/components/Evolution";

export const metadata: Metadata = {
  title: "Evolving the rogue",
  description: "A rogue strategy improved generation by generation, against every monitor.",
};

export default function Page() {
  return <Evolution />;
}
