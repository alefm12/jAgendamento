import { ComponentProps, useEffect } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right"
import { DayPicker, useDayPicker } from "react-day-picker"
import type { MonthCaptionProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const MonthHeader = ({ calendarMonth, className, children, ...rest }: MonthCaptionProps) => {
  const {
    previousMonth,
    nextMonth,
    goToMonth,
    labels: { labelPrevious, labelNext },
    dayPickerProps,
  } = useDayPicker()

  const navigationDisabled = Boolean(dayPickerProps?.disableNavigation)
  const canGoPrev = Boolean(previousMonth) && !navigationDisabled
  const canGoNext = Boolean(nextMonth) && !navigationDisabled

  const label = format(calendarMonth.date, "MMMM yyyy", {
    locale: dayPickerProps?.locale as any,
  })

  const buttonClass = (isDisabled: boolean) => cn(
    buttonVariants({ variant: "outline" }),
    "size-9 bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200 cursor-pointer",
    isDisabled && "opacity-40 cursor-not-allowed hover:bg-background hover:text-muted-foreground"
  )

  const handlePrevious = () => {
    if (!canGoPrev || !previousMonth) return
    goToMonth(previousMonth)
    dayPickerProps?.onPrevClick?.(previousMonth)
  }

  const handleNext = () => {
    if (!canGoNext || !nextMonth) return
    goToMonth(nextMonth)
    dayPickerProps?.onNextClick?.(nextMonth)
  }

  return (
    <div
      {...rest}
      className={cn("flex items-center justify-between w-full mb-4", className)}
    >
      <button
        type="button"
        className={buttonClass(!canGoPrev)}
        onClick={handlePrevious}
        disabled={!canGoPrev}
        aria-label={labelPrevious(previousMonth)}
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="flex-1 text-center">
        {children ?? (
          <span className="text-lg font-semibold text-foreground capitalize">
            {label}
          </span>
        )}
      </div>
      <button
        type="button"
        className={buttonClass(!canGoNext)}
        onClick={handleNext}
        disabled={!canGoNext}
        aria-label={labelNext(nextMonth)}
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}

function Calendar({
  className,
  classNames,
  components: userComponents,
  showOutsideDays = true,
  locale = ptBR,
  ...props
}: ComponentProps<typeof DayPicker>) {
  useEffect(() => {
    const errorHandler = (e: ErrorEvent) => {
      if (e.message?.includes('ResizeObserver')) {
        e.stopImmediatePropagation()
        e.preventDefault()
      }
    }
    window.addEventListener('error', errorHandler)
    return () => window.removeEventListener('error', errorHandler)
  }, [])

  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      hideNavigation
      className={cn("p-3 sm:p-6 w-full max-w-full overflow-hidden scale-90 sm:scale-100", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2 sm:gap-4 w-full max-w-full",
        month: "flex flex-col gap-2 sm:gap-4 w-full max-w-full",
        month_caption: "flex items-center justify-between w-full mb-4",
        caption_label: "text-lg font-semibold text-foreground",
        nav: "flex items-center justify-between w-full px-4",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-9 bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200 cursor-pointer"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-9 bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200 cursor-pointer"
        ),
        month_grid: "w-full border-collapse mt-2",
        weekdays: "flex w-full justify-around mb-2",
        weekday: "text-muted-foreground w-10 h-10 font-semibold text-sm flex items-center justify-center",
        week: "flex w-full justify-around gap-1 mt-1",
        day: cn(
          "relative w-10 h-10 p-0 font-medium rounded-lg cursor-pointer",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:bg-accent hover:text-accent-foreground hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        ),
        day_button: cn(
          "w-full h-full flex items-center justify-center cursor-pointer",
          "transition-all duration-200"
        ),
        range_start:
          "aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:rounded-l-lg",
        range_end:
          "aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:rounded-r-lg",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold shadow-lg scale-105",
        today: "bg-accent/30 text-accent-foreground font-semibold border-2 border-accent",
        outside:
          "text-muted-foreground/40 opacity-50",
        disabled: "text-muted-foreground/30 opacity-40 cursor-not-allowed hover:bg-transparent hover:scale-100 pointer-events-none",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        ...userComponents,
        MonthCaption: MonthHeader,
        Chevron: ({ orientation, className, ...props }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className={cn("size-5 cursor-pointer", className)} {...props} />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
