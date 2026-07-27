import { Dashboard } from "@/components/Dashboard";

/**
 * One page, tab-switched. The data all arrives in a single payload from
 * /api/event, so routing between views would only add navigation cost.
 */
export default function Page() {
  return <Dashboard />;
}
