import CityMap from "@/components/citymap"
import { ParseBusinessJSON } from "@/lib/utils"

export default function Page() {
  const data = ParseBusinessJSON()
  return <CityMap data={data} />
}
