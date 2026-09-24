import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import QueueStatusCard from "../components/QueueStatusCard";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function AdminDashboard({ onLogout }) {
  const [currentServing, setCurrentServing] = useState("--");
  const [queuePaused, setQueuePaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const [stats, setStats] = useState({
    totalTokens: 0,
    served: 0,
    avgWaitTime: "0 mins",
  });

  const [queue, setQueue] = useState([]);

  const showActionMessage = (message) => {
    setActionMessage(message);
    setTimeout(() => setActionMessage(""), 3000);
  };

  const speakTokenAlert = (tokenNumber) => {
    const message = new SpeechSynthesisUtterance(
      `Token number ${tokenNumber}, ready ah irunga. Ungal turn seekiram varapogudhu`,
    );

    message.lang = "en-IN";
    message.rate = 0.65;
    message.pitch = 1;

    speechSynthesis.speak(message);
  };

  const loadQueue = async () => {
    try {
      const token = localStorage.getItem("adminToken");

      const response = await fetch(
        "https://e-varisai-2.onrender.com/api/admin/queue/all?limit=50",
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        setQueue(data.queue.filter((item) => item.status === "waiting"));

        const statusResponse = await fetch(
          "https://e-varisai-2.onrender.com/api/queue/status",
        );

        const statusData = await statusResponse.json();

        if (statusData.success) {
          setCurrentServing(statusData.queue.currentServing);
          setQueuePaused(Boolean(statusData.queue.paused));
        }

        setStats({
          totalTokens: data.total || data.queue.length,
          served: data.served || 0,
          avgWaitTime: data.avgWaitTime || "5 mins",
        });
      }
    } catch (error) {
      console.error(error);
      showActionMessage("Error loading queue");
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleNextToken = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");

      const response = await fetch(
        "https://e-varisai-2.onrender.com/api/admin/queue/next",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        await loadQueue();

        const message = new SpeechSynthesisUtterance(
          `Now serving token ${data.nextToken.replace("T-", "")}`,
        );

        message.lang = "en-IN";
        message.rate = 0.65;
        message.pitch = 1;

        speechSynthesis.cancel();
        speechSynthesis.speak(message);

        setTimeout(() => {
          if (queue.length > 0) {
            speakTokenAlert(queue[0].id.replace("T-", ""));
          }
        }, 1000);

        showActionMessage("Next token called successfully");
      } else {
        showActionMessage(data.message || "Failed to call next token");
      }
    } catch (error) {
      console.error("Error calling next token:", error);
      showActionMessage("Error calling next token");
    } finally {
      setLoading(false);
    }
  };

  const handlePauseResume = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");

      const response = await fetch(
        "https://e-varisai-2.onrender.com/api/admin/queue/pause",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paused: !queuePaused }),
        },
      );

      const data = await response.json();

      if (data.success) {
        setQueuePaused(!queuePaused);
        const statusMsg = !queuePaused ? "Queue paused" : "Queue resumed";
        showActionMessage(statusMsg);
        await loadQueue();
      } else {
        showActionMessage(data.message || "Failed to toggle pause");
      }
    } catch (error) {
      console.error("Error toggling pause:", error);
      showActionMessage("Error toggling pause state");
    } finally {
      setLoading(false);
    }
  };

  const handleResetCounter = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");
      const confirmed = window.confirm(
        "Are you sure you want to reset the counter? This will clear all queue data.",
      );

      if (!confirmed) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        "https://e-varisai-2.onrender.com/api/admin/queue/reset",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        setCurrentServing("--");
        setQueue([]);
        setQueuePaused(false);
        setStats({
          totalTokens: 0,
          served: 0,
          avgWaitTime: "0 mins",
        });
        showActionMessage("Counter reset successfully");
      } else {
        showActionMessage(data.message || "Failed to reset counter");
      }
    } catch (error) {
      console.error("Error resetting counter:", error);
      showActionMessage("Error resetting counter");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");

      const response = await fetch(
        "https://e-varisai-2.onrender.com/api/admin/queue/report",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        const reportData = data.report;
        const csvContent = generateCSV(reportData);

        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          `queue-report-${new Date().toISOString().split("T")[0]}.csv`,
        );
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showActionMessage("Report generated and downloaded successfully");
      } else {
        showActionMessage(data.message || "Failed to generate report");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      showActionMessage("Error generating report");
    } finally {
      setLoading(false);
    }
  };

  const generateCSV = (reportData) => {
    const headers = [
      "Token",
      "Name",
      "Time Joined",
      "Served Time",
      "Wait Duration",
      "Status",
    ];
    const rows =
      reportData.queue_records?.map((record) => [
        record.token_id || "",
        record.name || "",
        record.joined_time || "",
        record.served_time || "",
        record.wait_duration || "",
        record.status || "",
      ]) || [];

    const csvRows = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ];

    return csvRows.join("\n");
  };

  const handleCancelToken = (tokenId) => {
    setQueue((currentQueue) =>
      currentQueue.filter((item) => item.id !== tokenId),
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-20">
        <Header title="e-Varisai | Admin Portal" />
      </div>

      {/* Action Message Toast */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 bg-green-600 text-white rounded-lg shadow-lg font-medium"
          >
            {actionMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-b-2 border-border bg-card px-4 py-6 sm:px-6 lg:px-8 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Queue Control Center
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Manage live tokens and queue operations
            </p>
            {queuePaused && (
              <div className="mt-3 inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                ⏸️ Queue is Paused
              </div>
            )}
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={onLogout}
              variant="outline"
              size="lg"
              className="px-6 py-6 text-base font-semibold border-2"
            >
              Exit Admin Portal
            </Button>
          </motion.div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Stats Overview */}
          <motion.div
            className="grid gap-6 md:grid-cols-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {[
              { label: "Total Tokens", value: stats.totalTokens, icon: "🎟️" },
              { label: "Served", value: stats.served, icon: "✅" },
              { label: "Avg Wait Time", value: stats.avgWaitTime, icon: "⏱️" },
            ].map((stat, idx) => (
              <motion.div key={idx} variants={cardVariants}>
                <Card className="overflow-hidden border-2 bg-gradient-to-br from-card to-muted/20">
                  <CardContent className="flex items-center gap-6 pt-8 pb-8">
                    <div className="text-5xl">{stat.icon}</div>

                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        {stat.label}
                      </p>

                      <p className="mt-2 text-4xl font-black text-foreground">
                        {stat.value}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Control Section */}
          <motion.div
            className="grid gap-8 lg:grid-cols-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Current Serving Card */}
            <motion.div variants={cardVariants}>
              <Card className="flex flex-col overflow-hidden border-2 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl">Now Serving</CardTitle>

                    <motion.div
                      className="inline-flex h-4 w-4 rounded-full bg-green-600 shadow-lg"
                      animate={{
                        opacity: [0.4, 1, 0.4],
                        scale: [0.8, 1.1, 0.8],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col items-center justify-center py-12">
                  <motion.p
                    className="text-7xl font-black text-primary"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    {currentServing}
                  </motion.p>

                  <p className="mt-4 text-base font-medium text-muted-foreground">
                    Current counter service
                  </p>

                  <motion.div
                    className="w-full mt-10"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      onClick={handleNextToken}
                      disabled={loading || queuePaused}
                      size="lg"
                      className="w-full text-lg font-bold py-7"
                    >
                      {loading ? "Processing..." : "Call Next Token"}
                    </Button>
                  </motion.div>
                  {queuePaused ? (
                    <p className="mt-3 text-sm font-medium text-red-600">
                      Queue is currently paused.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={cardVariants}>
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Quick Actions</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Button
                    onClick={handlePauseResume}
                    disabled={loading}
                    variant="outline"
                    className="w-full justify-start text-base py-6 border-2"
                  >
                    {queuePaused ? "▶️ Resume Queue" : "⏸️ Pause Queue"}
                  </Button>

                  <Button
                    onClick={handleResetCounter}
                    disabled={loading}
                    variant="outline"
                    className="w-full justify-start text-base py-6 border-2 hover:border-red-500 hover:text-red-600"
                  >
                    🔄 Reset Counter
                  </Button>

                  <Button
                    onClick={handleGenerateReport}
                    disabled={loading}
                    variant="outline"
                    className="w-full justify-start text-base py-6 border-2"
                  >
                    📄 Generate Report
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Queue Status */}
            <motion.div variants={cardVariants}>
              <QueueStatusCard
                currentServing={currentServing}
                yourToken={queue[0]?.id || "--"}
                peopleAhead={queue.length}
                progress={Math.max(5, 100 - queue.length * 7)}
              />
            </motion.div>
          </motion.div>

          {/* Queue Table */}
          <motion.div variants={cardVariants}>
            <Card className="border-2 overflow-hidden">
              <CardHeader className="border-b-2 border-border bg-gradient-to-r from-card to-muted/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Live Queue</CardTitle>

                    <CardDescription className="mt-2 text-base">
                      Next {queue.length} customers waiting
                    </CardDescription>
                  </div>

                  <Badge className="px-4 py-2 text-base font-semibold">
                    {queue.length} Waiting
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b-2 border-border text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30">
                        <th className="text-left py-4 px-6">Token</th>
                        <th className="text-left py-4 px-6">Name</th>
                        <th className="text-left py-4 px-6">Time Joined</th>
                        <th className="text-center py-4 px-6">Status</th>
                        <th className="text-right py-4 px-6">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      <AnimatePresence initial={false}>
                        {queue.length === 0 ? (
                          <motion.tr
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <td
                              colSpan="5"
                              className="py-16 text-center text-muted-foreground"
                            >
                              <p className="text-xl font-medium">
                                No customers waiting
                              </p>
                            </td>
                          </motion.tr>
                        ) : (
                          queue.map((item) => (
                            <motion.tr
                              key={item.id}
                              layout
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.2 }}
                              className="hover:bg-muted/40 transition-colors"
                            >
                              <td className="py-5 px-6 font-bold text-lg text-foreground">
                                {item.id}
                              </td>

                              <td className="py-5 px-6 text-foreground font-medium">
                                {item.name}
                              </td>

                              <td className="py-5 px-6 text-muted-foreground">
                                {item.time}
                              </td>

                              <td className="py-5 px-6 text-center">
                                <Badge
                                  variant="secondary"
                                  className="px-3 py-1 font-semibold"
                                >
                                  Waiting
                                </Badge>
                              </td>

                              <td className="py-5 px-6 text-right">
                                <motion.button
                                  onClick={() => handleCancelToken(item.id)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="text-base font-bold text-red-600 hover:text-red-700 hover:underline"
                                >
                                  Cancel
                                </motion.button>
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-border bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
        <p>© 2024 e-Varisai. Government Service Queue Management System.</p>
      </footer>
    </div>
  );
}
