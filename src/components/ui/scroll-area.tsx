"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  viewportProps?: ScrollAreaPrimitive.Viewport.Props
  scrollbars?: "vertical" | "horizontal" | "both"
  scrollbarClassName?: string
}

function ScrollArea({
  className,
  children,
  viewportProps,
  scrollbars = "vertical",
  scrollbarClassName,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("group/scroll-area relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        {...viewportProps}
        className={cn(
          "absolute inset-0 rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportProps?.className
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {(scrollbars === "vertical" || scrollbars === "both") && (
        <ScrollBar keepMounted className={scrollbarClassName} />
      )}
      {(scrollbars === "horizontal" || scrollbars === "both") && (
        <ScrollBar keepMounted orientation="horizontal" className={scrollbarClassName} />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "overlay-scrollbar z-[60] flex touch-none select-none opacity-0 transition-opacity duration-200 data-[scrolling]:opacity-100 group-focus-within/scroll-area:opacity-100 motion-reduce:transition-none data-horizontal:h-2 data-horizontal:flex-col data-vertical:h-full data-vertical:w-2",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full border-2 border-transparent bg-muted-foreground/45 bg-clip-padding transition-colors hover:bg-muted-foreground/65 motion-reduce:transition-none"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
