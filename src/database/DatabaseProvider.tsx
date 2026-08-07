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

import { createTaskRepository } from "./createTaskRepository";
import { TaskRepository } from "./repositories/taskRepository";

type DatabaseState =
  | { status: "loading" }
  | { status: "ready"; taskRepository: TaskRepository }
  | { status: "error"; message: string };

const TaskRepositoryContext = createContext<TaskRepository | null>(null);

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<DatabaseState>({ status: "loading" });

  const openDatabase = useCallback(async () => {
    return createTaskRepository();
  }, []);

  const retryDatabase = useCallback(async () => {
    setState({ status: "loading" });

    try {
      setState({ status: "ready", taskRepository: await openDatabase() });
    } catch (error) {
      console.error("Database initialization failed", error);
      setState({
        status: "error",
        message: "Local task storage could not be opened. Please try again."
      });
    }
  }, [openDatabase]);

  useEffect(() => {
    let isActive = true;

    async function loadInitialDatabase() {
      try {
        const taskRepository = await openDatabase();

        if (isActive) {
          setState({ status: "ready", taskRepository });
        }
      } catch (error) {
        console.error("Database initialization failed", error);

        if (isActive) {
          setState({
            status: "error",
            message: "Local task storage could not be opened. Please try again."
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
        <ActivityIndicator accessibilityLabel="Opening local task storage" />
        <Text style={styles.message}>Opening local task storage...</Text>
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
            accessibilityLabel="Retry opening local task storage"
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
    <TaskRepositoryContext.Provider value={state.taskRepository}>
      {children}
    </TaskRepositoryContext.Provider>
  );
}

export function useTaskRepository(): TaskRepository {
  const repository = useContext(TaskRepositoryContext);

  if (!repository) {
    throw new Error("TaskRepository is not available.");
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
