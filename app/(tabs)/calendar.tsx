import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { ErrorNotice } from "../../src/components/ErrorNotice";
import { Screen } from "../../src/components/Screen";
import {
  addLocalDays,
  addLocalMonths,
  formatCompactDay,
  formatDayHeading,
  formatMonthHeading,
  formatWeekHeading,
  getCalendarRange,
  getMonthGrid,
  getWeekDates,
  weekdayLabels
} from "../../src/features/calendar/calendarDates";
import {
  CalendarDaySchedule,
  createEmptyDay,
  formatDuration,
  getEventDurationMinutes
} from "../../src/features/calendar/calendarSchedule";
import { useCalendarSchedule } from "../../src/features/calendar/hooks/useCalendarSchedule";
import { formatReminders } from "../../src/notifications/reminderRules";
import { CalendarEventOccurrence } from "../../src/types/calendarEvent";
import { getItemColorOption } from "../../src/types/itemColor";
import { formatRecurrence } from "../../src/features/calendar/recurrenceRules";
import { LocalDateString } from "../../src/types/dateTime";
import { Task } from "../../src/types/task";
import {
  getTaskPreferredTimeLabel,
  getTaskStatusLabel,
  getTaskTimingNote
} from "../../src/features/tasks/taskPresentation";
import {
  formatLocalTimeForDisplay,
  getLocalDateString,
  normalizeLocalDateInput
} from "../../src/utils/dates";

type CalendarView = "month" | "week" | "day";

export default function CalendarScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const today = getLocalDateString();
  const initialDate = normalizeLocalDateInput(params.date ?? "") ?? today;
  const [selectedDate, setSelectedDate] = useState<LocalDateString>(initialDate);
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const { width } = useWindowDimensions();
  const isWide = width >= 1000;
  const range = useMemo(
    () => getCalendarRange(calendarView, selectedDate),
    [calendarView, selectedDate]
  );
  const { days, isLoading, errorMessage, refresh } = useCalendarSchedule(
    range.startDate,
    range.endDate
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const selectedDay = days.get(selectedDate) ?? createEmptyDay(selectedDate);

  function movePeriod(amount: -1 | 1) {
    if (calendarView === "month") {
      setSelectedDate(addLocalMonths(selectedDate, amount));
    } else if (calendarView === "week") {
      setSelectedDate(addLocalDays(selectedDate, amount * 7));
    } else {
      setSelectedDate(addLocalDays(selectedDate, amount));
    }
  }

  return (
    <Screen wide>
      <View style={styles.pageHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Plan what is fixed and flexible</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Calendar
          </Text>
          <Text style={styles.intro}>
            See commitments and scheduled work without treating open time as a demand.
          </Text>
        </View>
        <View style={styles.addActions}>
          <Pressable
            accessibilityLabel={`Add fixed event on ${formatDayHeading(selectedDate)}`}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: "/events/new", params: { date: selectedDate } })
            }
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Add event</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Add task on ${formatDayHeading(selectedDate)}`}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/tasks/new",
                params: { scheduledDate: selectedDate, returnTo: "calendar" }
              })
            }
            style={({ pressed }) => [styles.addTaskButton, pressed && styles.pressed]}
          >
            <Text style={styles.addTaskButtonText}>Add task</Text>
          </Pressable>
        </View>
      </View>

      <View accessibilityRole="tablist" style={styles.viewSwitcher}>
        {(["month", "week", "day"] as const).map((view) => {
          const isSelected = calendarView === view;

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              key={view}
              onPress={() => setCalendarView(view)}
              style={({ pressed }) => [
                styles.viewButton,
                isSelected && styles.viewButtonSelected,
                pressed && styles.pressed
              ]}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  isSelected && styles.viewButtonTextSelected
                ]}
              >
                {view[0]?.toUpperCase()}
                {view.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.periodHeader}>
        <Pressable
          accessibilityLabel={`Previous ${calendarView}`}
          accessibilityRole="button"
          onPress={() => movePeriod(-1)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconButtonText}>Previous</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.periodTitle}>
          {calendarView === "month"
            ? formatMonthHeading(selectedDate)
            : calendarView === "week"
              ? formatWeekHeading(selectedDate)
              : formatDayHeading(selectedDate)}
        </Text>
        <View style={styles.periodActions}>
          <Pressable
            accessibilityLabel="Return calendar to today"
            accessibilityRole="button"
            onPress={() => setSelectedDate(today)}
            style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Next ${calendarView}`}
            accessibilityRole="button"
            onPress={() => movePeriod(1)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.iconButtonText}>Next</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator accessibilityLabel="Loading calendar" />
          <Text style={styles.mutedText}>Loading calendar...</Text>
        </View>
      ) : null}

      {errorMessage ? <ErrorNotice message={errorMessage} onRetry={refresh} /> : null}

      {!isLoading && !errorMessage && calendarView === "month" ? (
        <View style={[styles.monthWorkspace, isWide && styles.monthWorkspaceWide]}>
          <MonthView
            days={days}
            isWide={isWide}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
            today={today}
          />
          <View style={[styles.detailPanel, isWide && styles.detailPanelWide]}>
            <DayDetails day={selectedDay} compact />
          </View>
        </View>
      ) : null}

      {!isLoading && !errorMessage && calendarView === "week" ? (
        <WeekView
          days={days}
          isWide={isWide}
          onSelectDate={setSelectedDate}
          selectedDate={selectedDate}
          today={today}
        />
      ) : null}

      {!isLoading && !errorMessage && calendarView === "day" ? (
        <View style={styles.dayView}>
          <DayDetails day={selectedDay} />
        </View>
      ) : null}
    </Screen>
  );
}

function MonthView({
  days,
  isWide,
  onSelectDate,
  selectedDate,
  today
}: {
  days: Map<LocalDateString, CalendarDaySchedule>;
  isWide: boolean;
  onSelectDate(date: LocalDateString): void;
  selectedDate: LocalDateString;
  today: LocalDateString;
}) {
  const monthDays = getMonthGrid(selectedDate);

  return (
    <View style={styles.monthPanel}>
      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {monthDays.map((gridDay) => {
          const schedule = days.get(gridDay.date) ?? createEmptyDay(gridDay.date);
          const taskCount = schedule.plannedTasks.length + schedule.flexibleTasks.length;
          const isSelected = gridDay.date === selectedDate;
          const isToday = gridDay.date === today;
          const summary = [
            `${schedule.fixedEvents.length} fixed`,
            `${taskCount} tasks`,
            `${schedule.completedTaskCount} completed`
          ].join(", ");

          return (
            <Pressable
              accessibilityLabel={`${formatDayHeading(gridDay.date)}: ${summary}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={gridDay.date}
              onPress={() => onSelectDate(gridDay.date)}
              style={({ pressed }) => [
                styles.monthCell,
                isWide ? styles.monthCellWide : styles.monthCellCompact,
                !gridDay.isCurrentMonth && styles.monthCellOutside,
                isToday && styles.todayCell,
                isSelected && styles.selectedCell,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.dayNumber, isToday && styles.todayDayNumber]}>
                {gridDay.dayNumber}
              </Text>
              <View style={styles.monthIndicators}>
                <View accessibilityLabel="Item colors" style={styles.colorDots}>
                  {[
                    ...schedule.fixedEvents,
                    ...schedule.plannedTasks,
                    ...schedule.flexibleTasks
                  ]
                    .slice(0, 5)
                    .map((item) => (
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        key={item.id}
                        style={[
                          styles.colorDot,
                          { backgroundColor: getItemColorOption(item.color).borderColor }
                        ]}
                      />
                    ))}
                </View>
                {schedule.fixedEvents.length > 0 ? (
                  <Text numberOfLines={1} style={styles.fixedIndicator}>
                    Fixed {schedule.fixedEvents.length}
                  </Text>
                ) : null}
                {taskCount > 0 ? (
                  <Text numberOfLines={1} style={styles.taskIndicator}>
                    Tasks {taskCount}
                  </Text>
                ) : null}
                {schedule.completedTaskCount > 0 ? (
                  <Text numberOfLines={1} style={styles.doneIndicator}>
                    Done {schedule.completedTaskCount}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WeekView({
  days,
  isWide,
  onSelectDate,
  selectedDate,
  today
}: {
  days: Map<LocalDateString, CalendarDaySchedule>;
  isWide: boolean;
  onSelectDate(date: LocalDateString): void;
  selectedDate: LocalDateString;
  today: LocalDateString;
}) {
  return (
    <View style={[styles.weekGrid, !isWide && styles.weekList]}>
      {getWeekDates(selectedDate).map((date) => {
        const day = days.get(date) ?? createEmptyDay(date);
        const taskCount = day.plannedTasks.length + day.flexibleTasks.length;

        return (
          <Pressable
            accessibilityLabel={`Select ${formatDayHeading(date)}`}
            accessibilityRole="button"
            accessibilityState={{ selected: date === selectedDate }}
            key={date}
            onPress={() => onSelectDate(date)}
            style={({ pressed }) => [
              styles.weekDay,
              isWide && styles.weekDayWide,
              date === today && styles.todayCell,
              date === selectedDate && styles.selectedWeekDay,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.weekDayTitle}>{formatCompactDay(date)}</Text>
            <View style={styles.factualSummary}>
              <Text style={styles.summaryText}>{day.fixedEvents.length} fixed</Text>
              <Text style={styles.summaryText}>{taskCount} tasks</Text>
              <Text style={styles.summaryText}>{day.scheduledMinutes} scheduled min</Text>
            </View>
            <View style={styles.weekItems}>
              {day.fixedEvents.map((event) => (
                <View
                  key={event.id}
                  style={[
                    styles.weekItemTint,
                    {
                      backgroundColor: getItemColorOption(event.color).backgroundColor,
                      borderLeftColor: getItemColorOption(event.color).borderColor
                    }
                  ]}
                >
                  <Text numberOfLines={2} style={styles.weekFixedItem}>
                    {event.startTime} Fixed: {event.title}
                    {event.isRecurring ? " · Repeats" : ""}
                  </Text>
                </View>
              ))}
              {day.plannedTasks.map((task) => (
                <Text
                  key={task.id}
                  numberOfLines={2}
                  style={[
                    styles.weekTaskItem,
                    {
                      backgroundColor: getItemColorOption(task.color).backgroundColor,
                      borderLeftColor: getItemColorOption(task.color).borderColor,
                      borderLeftWidth: 3
                    }
                  ]}
                >
                  {task.scheduledTime
                    ? `${formatLocalTimeForDisplay(task.scheduledTime)} Scheduled: `
                    : "Scheduled: "}
                  {task.title}
                  {task.estimatedDurationMinutes
                    ? ` · ${formatDuration(task.estimatedDurationMinutes)}`
                    : ""}
                </Text>
              ))}
              {day.flexibleTasks.map((task) => (
                <Text
                  key={task.id}
                  numberOfLines={2}
                  style={[
                    styles.weekTaskItem,
                    {
                      backgroundColor: getItemColorOption(task.color).backgroundColor,
                      borderLeftColor: getItemColorOption(task.color).borderColor,
                      borderLeftWidth: 3
                    }
                  ]}
                >
                  Planned: {task.title}
                  {getTaskPreferredTimeLabel(task)
                    ? ` · ${getTaskPreferredTimeLabel(task)}`
                    : ""}
                  {task.estimatedDurationMinutes
                    ? ` · ${formatDuration(task.estimatedDurationMinutes)}`
                    : ""}
                </Text>
              ))}
              {day.fixedEvents.length === 0 && taskCount === 0 ? (
                <Text style={styles.quietDayText}>No scheduled items</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function DayDetails({
  day,
  compact = false
}: {
  day: CalendarDaySchedule;
  compact?: boolean;
}) {
  const router = useRouter();
  const taskCount = day.plannedTasks.length + day.flexibleTasks.length;

  return (
    <View style={styles.dayDetails}>
      <View style={styles.dayDetailsHeader}>
        <Text accessibilityRole="header" style={styles.dayDetailsTitle}>
          {formatDayHeading(day.date)}
        </Text>
        <Text style={styles.daySummary}>
          {day.fixedEvents.length} fixed · {taskCount} tasks · {day.scheduledMinutes}{" "}
          scheduled min
        </Text>
      </View>

      <ScheduleSection emptyMessage="No fixed commitments for this day." title="Fixed">
        {day.fixedEvents.map((event) => (
          <EventCard event={event} key={event.id} />
        ))}
      </ScheduleSection>

      <ScheduleSection
        emptyMessage="No tasks have a start time on this day."
        title="Scheduled"
      >
        {day.plannedTasks.map((task) => (
          <TaskScheduleCard key={task.id} task={task} variant="scheduled" />
        ))}
      </ScheduleSection>

      <ScheduleSection
        emptyMessage="No planned tasks are associated with this date."
        title="Planned"
      >
        {day.flexibleTasks.map((task) => (
          <TaskScheduleCard key={task.id} task={task} variant="planned" />
        ))}
      </ScheduleSection>

      {compact ? (
        <Pressable
          accessibilityLabel={`Add task for ${formatDayHeading(day.date)}`}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/tasks/new",
              params: { scheduledDate: day.date, returnTo: "calendar" }
            })
          }
          style={({ pressed }) => [styles.dayLink, pressed && styles.pressed]}
        >
          <Text style={styles.dayLinkText}>Add task for this day</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ScheduleSection({
  children,
  emptyMessage,
  title
}: {
  children: React.ReactNode;
  emptyMessage: string;
  title: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean);

  return (
    <View style={styles.scheduleSection}>
      <Text accessibilityRole="header" style={styles.scheduleSectionTitle}>
        {title}
      </Text>
      {hasItems ? children : <Text style={styles.emptySectionText}>{emptyMessage}</Text>}
    </View>
  );
}

function EventCard({ event }: { event: CalendarEventOccurrence }) {
  const router = useRouter();
  const duration = formatDuration(getEventDurationMinutes(event));
  const color = getItemColorOption(event.color);

  return (
    <View
      style={[
        styles.scheduleCard,
        styles.fixedCard,
        { backgroundColor: color.backgroundColor, borderLeftColor: color.borderColor }
      ]}
    >
      <Text style={styles.fixedLabel}>FIXED COMMITMENT</Text>
      <Text style={styles.scheduleCardTitle}>{event.title}</Text>
      <Text style={styles.scheduleMeta}>
        {event.startTime}
        {event.endTime ? ` - ${event.endTime}` : ""}
        {duration ? ` · ${duration}` : ""}
      </Text>
      {event.reminders.length > 0 ? (
        <Text style={styles.scheduleMeta}>
          Reminders: {formatReminders(event.reminders)}
        </Text>
      ) : null}
      {event.isRecurring ? (
        <Text style={styles.scheduleMeta}>{formatRecurrence(event.recurrence)}</Text>
      ) : null}
      {event.notes ? <Text style={styles.scheduleNotes}>{event.notes}</Text> : null}
      <Pressable
        accessibilityLabel={`Edit ${event.title}`}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/events/[id]/edit",
            params: { id: event.seriesId, originalDate: event.originalDate }
          })
        }
        style={({ pressed }) => [styles.editEventButton, pressed && styles.pressed]}
      >
        <Text style={styles.editEventText}>Edit event</Text>
      </Pressable>
    </View>
  );
}

function TaskScheduleCard({
  task,
  variant
}: {
  task: Task;
  variant: "scheduled" | "planned";
}) {
  const duration = formatDuration(task.estimatedDurationMinutes);
  const color = getItemColorOption(task.color);

  return (
    <View
      style={[
        styles.scheduleCard,
        styles.taskCard,
        { backgroundColor: color.backgroundColor, borderLeftColor: color.borderColor }
      ]}
    >
      <Text style={styles.taskLabel}>
        {variant === "scheduled" ? "SCHEDULED TASK" : "PLANNED TASK"}
      </Text>
      <Text style={styles.scheduleCardTitle}>{task.title}</Text>
      <Text style={styles.scheduleMeta}>
        {task.scheduledTime ? `${formatLocalTimeForDisplay(task.scheduledTime)} · ` : ""}
        {getTaskPreferredTimeLabel(task) ? `${getTaskPreferredTimeLabel(task)} · ` : ""}
        {duration ? `${duration} · ` : ""}
        {getTaskStatusLabel(task.status)}
      </Text>
      {getTaskTimingNote(task) ? (
        <Text style={styles.timingNote}>{getTaskTimingNote(task)}</Text>
      ) : null}
      {task.reminders.length > 0 ? (
        <Text style={styles.scheduleMeta}>
          Reminders: {formatReminders(task.reminders)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "space-between",
    marginBottom: 24
  },
  headerCopy: {
    flex: 1,
    minWidth: 240
  },
  eyebrow: {
    color: "#59665e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  title: {
    color: "#292724",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 5
  },
  intro: {
    color: "#5a5650",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 680
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  addActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  addTaskButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#2f5d62",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18
  },
  addTaskButtonText: {
    color: "#2f5d62",
    fontSize: 16,
    fontWeight: "800"
  },
  viewSwitcher: {
    alignSelf: "flex-start",
    backgroundColor: "#e7e3db",
    borderRadius: 10,
    flexDirection: "row",
    gap: 3,
    marginBottom: 18,
    padding: 4
  },
  viewButton: {
    alignItems: "center",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 78,
    paddingHorizontal: 14
  },
  viewButtonSelected: {
    backgroundColor: "#ffffff",
    borderColor: "#9fb6ad",
    borderWidth: 1
  },
  viewButtonText: {
    color: "#5a5650",
    fontSize: 14,
    fontWeight: "700"
  },
  viewButtonTextSelected: {
    color: "#204c50"
  },
  periodHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 16
  },
  periodTitle: {
    color: "#302e2b",
    flexGrow: 1,
    fontSize: 21,
    fontWeight: "800",
    minWidth: 190,
    textAlign: "center"
  },
  periodActions: {
    flexDirection: "row",
    gap: 8
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#b7b0a6",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 13
  },
  iconButtonText: {
    color: "#3f4d48",
    fontSize: 14,
    fontWeight: "700"
  },
  todayButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 11
  },
  todayButtonText: {
    color: "#24565c",
    fontSize: 14,
    fontWeight: "800"
  },
  loadingState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 44
  },
  mutedText: {
    color: "#68645e"
  },
  monthWorkspace: {
    gap: 20
  },
  monthWorkspaceWide: {
    alignItems: "flex-start",
    flexDirection: "row"
  },
  monthPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d7d1c8",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: "hidden"
  },
  weekdayRow: {
    backgroundColor: "#eef2ed",
    flexDirection: "row"
  },
  weekdayLabel: {
    color: "#4b5851",
    flexBasis: "14.285%",
    fontSize: 12,
    fontWeight: "800",
    paddingVertical: 10,
    textAlign: "center"
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  monthCell: {
    backgroundColor: "#ffffff",
    borderColor: "#e2ddd4",
    borderRightWidth: 1,
    borderTopWidth: 1,
    flexBasis: "14.285%",
    padding: 7
  },
  monthCellWide: {
    minHeight: 112
  },
  monthCellCompact: {
    minHeight: 72,
    paddingHorizontal: 4
  },
  monthCellOutside: {
    backgroundColor: "#f5f3ee",
    opacity: 0.66
  },
  todayCell: {
    backgroundColor: "#edf4f2"
  },
  selectedCell: {
    borderColor: "#2f5d62",
    borderWidth: 2,
    padding: 5
  },
  dayNumber: {
    color: "#45413c",
    fontSize: 13,
    fontWeight: "700"
  },
  todayDayNumber: {
    color: "#17494e",
    fontWeight: "900"
  },
  monthIndicators: {
    gap: 3,
    marginTop: 6
  },
  colorDots: {
    flexDirection: "row",
    gap: 3,
    minHeight: 8
  },
  colorDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  fixedIndicator: {
    color: "#394941",
    fontSize: 10,
    fontWeight: "800"
  },
  taskIndicator: {
    color: "#53625b",
    fontSize: 10,
    fontWeight: "800"
  },
  doneIndicator: {
    color: "#59665e",
    fontSize: 10
  },
  detailPanel: {
    backgroundColor: "#f1f3ef",
    borderColor: "#d0d8d1",
    borderRadius: 12,
    borderWidth: 1,
    padding: 18
  },
  detailPanelWide: {
    width: 330
  },
  weekGrid: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 8
  },
  weekList: {
    flexDirection: "column"
  },
  weekDay: {
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 150,
    padding: 14
  },
  weekDayWide: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10
  },
  selectedWeekDay: {
    borderColor: "#2f5d62",
    borderWidth: 2
  },
  weekDayTitle: {
    color: "#302e2b",
    fontSize: 15,
    fontWeight: "800"
  },
  factualSummary: {
    borderBottomColor: "#e3ded5",
    borderBottomWidth: 1,
    gap: 3,
    marginTop: 10,
    paddingBottom: 10
  },
  summaryText: {
    color: "#615d57",
    fontSize: 11,
    lineHeight: 16
  },
  weekItems: {
    gap: 7,
    marginTop: 11
  },
  weekFixedItem: {
    borderLeftColor: "#47665a",
    borderLeftWidth: 3,
    color: "#3f4943",
    fontSize: 11,
    lineHeight: 16,
    paddingLeft: 6
  },
  weekItemTint: {
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3
  },
  weekTaskItem: {
    borderLeftColor: "#789087",
    borderLeftWidth: 3,
    color: "#4f5c54",
    fontSize: 11,
    lineHeight: 16,
    paddingLeft: 6
  },
  quietDayText: {
    color: "#77716a",
    fontSize: 12,
    fontStyle: "italic"
  },
  dayView: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9d4ca",
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 820,
    padding: 20,
    width: "100%"
  },
  dayDetails: {
    gap: 20
  },
  dayDetailsHeader: {
    borderBottomColor: "#d7ddd7",
    borderBottomWidth: 1,
    paddingBottom: 14
  },
  dayDetailsTitle: {
    color: "#302e2b",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 27
  },
  daySummary: {
    color: "#5c625e",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  scheduleSection: {
    gap: 9
  },
  scheduleSectionTitle: {
    color: "#35322e",
    fontSize: 16,
    fontWeight: "800"
  },
  emptySectionText: {
    color: "#716c65",
    fontSize: 14,
    lineHeight: 20
  },
  scheduleCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dcd6cc",
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  fixedCard: {
    borderLeftColor: "#47665a"
  },
  taskCard: {
    borderLeftColor: "#789087"
  },
  fixedLabel: {
    color: "#466056",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  taskLabel: {
    color: "#53625b",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  scheduleCardTitle: {
    color: "#302e2b",
    fontSize: 15,
    fontWeight: "800"
  },
  scheduleMeta: {
    color: "#66615a",
    fontSize: 13,
    lineHeight: 18
  },
  timingNote: {
    color: "#53625b",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  scheduleNotes: {
    color: "#4f4b46",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3
  },
  editEventButton: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 3
  },
  editEventText: {
    color: "#24565c",
    fontSize: 13,
    fontWeight: "800"
  },
  dayLink: {
    alignItems: "center",
    borderColor: "#829b91",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  dayLinkText: {
    color: "#24565c",
    fontSize: 13,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.68
  }
});
