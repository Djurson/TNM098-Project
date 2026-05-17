import { useEffect, useState, RefObject } from "react"

export function useResizeObserver(
  ref: RefObject<HTMLElement | SVGElement | null>
) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [ref])

  return size
}
