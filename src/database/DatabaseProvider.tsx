import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createRepositories } from "./createRepositories";
import { CalendarEventRepository } from "./repositories/calendarEventRepository";
import { DailyRecapRepository } from "./repositories/dailyRecapRepository";
import { RecoveryRepository } from "./repositories/recoveryRepository";
import { TaskRepository } from "./repositories/taskRepository";

type DatabaseState =
  | { status: "loading" }
  | {
      status: "ready";
      taskRepository: TaskRepository;
      calendarEventRepository: CalendarEventRepository;
      recoveryRepository: RecoveryRepository;
      dailyRecapRepository: DailyRecapRepository;
    }
  | { status: "error"; message: string };

const TaskRepositoryContext = createContext<TaskRepository | null>(null);
const CalendarEventRepositoryContext = createContext<CalendarEventRepository | null>(
  null
);
const RecoveryRepositoryContext = createContext<RecoveryRepository | null>(null);
const DailyRecapRepositoryContext = createContext<DailyRecapRepository | null>(null);

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<DatabaseState>({ status: "loading" });

  const openDatabase = useCallback(async () => {
    return createRepositories();
  }, []);

  const retryDatabase = useCallback(async () => {
    setState({ status: "loading" });

    try {
      setState({ status: "ready", ...(await openDatabase()) });
    } catch (error) {
      console.error("Database initialization failed", error);
      setState({
        status: "error",
        message: "Local calendar storage could not be opened. Please try again."
      });
    }
  }, [openDatabase]);

  useEffect(() => {
    let isActive = true;

    async function loadInitialDatabase() {
      try {
        const repositories = await openDatabase();

        if (isActive) {
          setState({ status: "ready", ...repositories });
        }
      } catch (error) {
        console.error("Database initialization failed", error);

        if (isActive) {
          setState({
            status: "error",
            message: "Local calendar storage could not be opened. Please try again."
          });
        }
      }
    }

    loadInitialDatabase();

    return () => {
      isActive = false;
    };
  }, [openDatabase]);

  if (state.status === "loading") {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Opening local calendar storage" />
        <Text style={styles.message}>Opening local calendar storage...</Text>
      </SafeAreaView>
    );
  }

  if (state.status === "error") {
    return (
      <SafeAreaView style={styles.centered}>
        <View accessibilityRole="alert" style={styles.errorPanel}>
          <Text style={styles.title}>Storage needs attention</Text>
          <Text style={styles.message}>{state.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry opening local calendar storage"
            onPress={retryDatabase}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <DailyRecapRepositoryContext.Provider value={state.dailyRecapRepository}>
      <RecoveryRepositoryContext.Provider value={state.recoveryRepository}>
        <CalendarEventRepositoryContext.Provider value={state.calendarEventRepository}>
          <TaskRepositoryContext.Provider value={state.taskRepository}>
            {children}
          </TaskRepositoryContext.Provider>
        </CalendarEventRepositoryContext.Provider>
      </RecoveryRepositoryContext.Provider>
    </DailyRecapRepositoryContext.Provider>
  );
}

export function useTaskRepository(): TaskRepository {
  const repository = useContext(TaskRepositoryContext);

  if (!repository) {
    throw new Error("TaskRepository is not available.");
  }

  return repository;
}

export function useCalendarEventRepository(): CalendarEventRepository {
  const repository = useContext(CalendarEventRepositoryContext);

  if (!repository) {
    throw new Error("CalendarEventRepository is not available.");
  }

  return repository;
}

export function useRecoveryRepository(): RecoveryRepository {
  const repository = useContext(RecoveryRepositoryContext);

  if (!repository) {
    throw new Error("RecoveryRepository is not available.");
  }

  return repository;
}

export function useDailyRecapRepository(): DailyRecapRepository {
  const repository = useContext(DailyRecapRepositoryContext);

  if (!repository) {
    throw new Error("DailyRecapRepository is not available.");
  }

  return repository;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: "#f8f7f3",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  errorPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 18,
    width: "100%"
  },
  title: {
    color: "#2f2d2a",
    fontSize: 22,
    fontWeight: "700"
  },
  message: {
    color: "#4a4742",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
    textAlign: "center"
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#2f5d62",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.75
  }
});
