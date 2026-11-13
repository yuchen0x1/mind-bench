import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Atom,
  BarChart3,
  BookOpen,
  Bookmark,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CopyPlus,
  Cpu,
  Clipboard,
  Clock3,
  Save,
  ScrollText,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Filter,
  FlaskConical,
  GitBranch,
  Globe2,
  History,
  LayoutDashboard,
  Lightbulb,
  Languages,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  ScanSearch,
  Send,
  Settings2,
  Shapes,
  ShieldCheck,
  Sigma,
  Sparkles,
  Square,
  Sun,
  Target,
  Terminal,
  TriangleAlert,
  Wrench,
  Trash2,
  Trophy,
  Upload,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const icons = {
  GitBranch,
  Sigma,
  Shapes,
  Box,
  Lightbulb,
  Languages,
  Globe2,
  ListChecks,
  Search,
  ScanSearch,
  AlertTriangle,
  TriangleAlert,
  Workflow,
  BookOpen,
  Code2,
  Atom,
  ShieldCheck,
  Sparkles,
};
const categoriesMeta = [
  ["logic", "逻辑推理", "LOGIC"],
  ["math", "数学计算", "MATH"],
  ["abstract", "抽象思维", "ABSTRACT"],
  ["spatial", "空间想象", "SPATIAL"],
  ["common-sense", "常识判断", "COMMON SENSE"],
  ["language", "语言理解", "LANGUAGE"],
  ["instruction", "指令遵循", "INSTRUCTIONS"],
  ["critical", "批判性思维", "CRITICAL"],
  ["traps", "反直觉与陷阱", "TRAPS"],
  ["causal", "因果推理", "CAUSAL"],
  ["memory", "长文本记忆", "MEMORY"],
  ["coding", "编程能力", "CODING"],
  ["science", "科学推理", "SCIENCE"],
  ["safety", "安全与鲁棒性", "SAFETY"],
  ["creativity", "创造性思维", "CREATIVITY"],
];
const navGroups = [
  {
    label: "工作台",
    items: [
      ["dashboard", "总览", "LayoutDashboard"],
      ["tasks", "题库探索", "BookOpen"],
      ["challenges", "测试中心", "Target"],
      ["compare", "模型对比", "Activity"],
      ["promptlab", "提示词工作台", "Wrench"],
    ],
  },
  {
    label: "洞察",
    items: [
      ["leaderboard", "模型排行榜", "Trophy"],
      ["history", "测试历史", "History"],
      ["analytics", "数据分析", "BarChart3"],
    ],
  },
  {
    label: "系统",
    items: [
      ["providers", "模型管理", "Settings2"],
      ["import", "题库导入", "Database"],
      ["research", "研究资料", "FileText"],
    ],
  },
];
const difficultyLabel = {
  easy: "入门",
  medium: "进阶",
  hard: "挑战",
  expert: "专家",
};
const palette = [
  "#76a9fa",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#f472b6",
  "#22d3ee",
];
const request = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error ?? `请求失败 (${response.status})`);
  return data;
};
const CLIENT_VERSION = __MIND_BENCH_VERSION__;
const CLIENT_BUILD_ID = __MIND_BENCH_BUILD_ID__;
const Icon = ({ name, ...props }) => {
  const Component = icons[name] ?? Sparkles;
  return <Component {...props} />;
};
const formatNum = (value, decimals = 0) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: decimals,
      }).format(value);
const timeAgo = (stamp) => {
  if (!stamp) return "—";
  const seconds = Math.max(
    1,
    Math.floor((Date.now() - new Date(stamp).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  return new Date(stamp).toLocaleDateString("zh-CN");
};
const download = (name, content, type = "application/json") => {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const useApi = (path, dependency = []) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setData(await request(path));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path, ...dependency]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, error, loading, refresh };
};
const useUpdateStatus = () => {
  const [status, setStatus] = useState({
    checking: false,
    available: false,
    currentVersion: CLIENT_VERSION,
    currentBuildId: CLIENT_BUILD_ID,
    serverVersion: CLIENT_VERSION,
    serverBuildId: CLIENT_BUILD_ID,
    error: '',
    checkedAt: null,
  });
  const check = useCallback(async () => {
    setStatus((current) => ({ ...current, checking: true, error: '' }));
    try {
      const remote = await request('/api/version', { cache: 'no-store' });
      const available = remote.version !== CLIENT_VERSION || remote.buildId !== CLIENT_BUILD_ID;
      setStatus({
        checking: false,
        available,
        currentVersion: CLIENT_VERSION,
        currentBuildId: CLIENT_BUILD_ID,
        serverVersion: remote.version,
        serverBuildId: remote.buildId,
        releaseUrl: remote.releaseUrl,
        channel: remote.channel,
        checkedAt: remote.checkedAt,
        error: '',
      });
    } catch (error) {
      setStatus((current) => ({ ...current, checking: false, error: error.message }));
    }
  }, []);
  useEffect(() => {
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [check]);
  return { status, check };
};

export default function App() {
  const [page, setPage] = useState(
    () => location.hash.slice(1).split("/")[0] || "dashboard",
  );
  const [detailId, setDetailId] = useState(
    () => location.hash.slice(1).split("/")[1] || "",
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [notice, setNotice] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("mindbench-theme") || "dark",
  );
  const [activeRun, setActiveRun] = useState(null);
  const [updateStatusDismissed, setUpdateStatusDismissed] = useState(false);
  const { status: updateStatus, check: checkForUpdate } = useUpdateStatus();
  const { data: dashboard, refresh: refreshDashboard } =
    useApi("/api/dashboard");
  const { data: categoryData, refresh: refreshCategories } =
    useApi("/api/categories");
  const { data: modelsData, refresh: refreshModels } = useApi("/api/providers");
  const models = modelsData?.models ?? [];
  const categories = categoryData ?? [];
  const tasksReq = useApi(
    `/api/tasks?${new URLSearchParams({ ...(categoryFilter !== "all" ? { category: categoryFilter } : {}), ...(query ? { q: query } : {}) })}`,
    [categoryFilter, query],
  );
  const showNotice = (message, type = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 4200);
  };
  const navigate = (next, id = "") => {
    setPage(next);
    setDetailId(id);
    location.hash = id ? `${next}/${id}` : next;
    setSidebarOpen(false);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mindbench-theme", theme);
  }, [theme]);
  useEffect(() => {
    const sync = () => {
      const [p, id = ""] = location.hash.slice(1).split("/");
      setPage(p || "dashboard");
      setDetailId(id);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (models.length && !selectedModels.length) {
      const enabled = models.filter((m) => m.enabled && m.provider_enabled);
      if (enabled.length)
        setSelectedModels([
          enabled.find((m) => m.is_default)?.id ?? enabled[0].id,
        ]);
    }
  }, [models, selectedModels.length]);
  const refreshAll = () => {
    refreshDashboard();
    refreshCategories();
    refreshModels();
    tasksReq.refresh();
  };
  const toggleModel = (id) =>
    setSelectedModels((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const toggleTask = (id) =>
    setSelectedTasks((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const submitRun = async ({
    taskIds,
    mode = "single",
    manualAnswers = {},
    questionCount,
    categoryId,
    difficulty,
    repeats,
  }) => {
    if (!selectedModels.length) {
      showNotice("请先在模型管理中启用至少一个模型。", "error");
      navigate("providers");
      return;
    }
    const body =
      mode === "single"
        ? {
            taskId: taskIds[0],
            modelIds: selectedModels,
            deferred: true,
            ...(manualAnswers[taskIds[0]] !== undefined
              ? { manualText: manualAnswers[taskIds[0]] }
              : {}),
          }
        : {
            mode,
            taskIds,
            modelIds: selectedModels,
            deferred: true,
            questionCount,
            categoryId,
            difficulty,
            repeats,
          };
    try {
      const started = await request(
        mode === "single" ? "/api/test-runs" : "/api/test-sessions",
        { method: "POST", body: JSON.stringify(body) },
      );
      setActiveRun(started.sessionId);
      showNotice("测试已加入运行队列，可在右下角查看进度。", "success");
    } catch (e) {
      showNotice(e.message, "error");
    }
  };
  const cancelRun = async () => {
    if (!activeRun) return;
    try {
      await request(`/api/sessions/${activeRun}/cancel`, {
        method: "POST",
        body: "{}",
      });
      showNotice("已发送停止请求。");
    } catch (e) {
      showNotice(e.message, "error");
    }
  };
  useEffect(() => {
    if (!activeRun) return;
    let alive = true;
    const poll = async () => {
      try {
        const result = await request(`/api/sessions/${activeRun}`);
        if (!alive) return;
        if (
          ["completed", "failed", "partial", "cancelled"].includes(result.session.status)
        ) {
          setActiveRun(null);
          refreshDashboard();
          refreshCategories();
          showNotice(
            `测试完成：${result.runs.filter((r) => r.status === "completed").length} 条完成，${result.runs.filter((r) => r.status === "failed").length} 条失败。${result.runs.some((r) => r.isMock) ? "含模拟结果，仅供流程验证。" : ""}`,
          );
          navigate("history");
        }
      } catch {}
    };
    const timer = setInterval(poll, 1400);
    poll();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activeRun]);
  const counts = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.task_count])),
    [categories],
  );
  return (
    <div className="app-shell" data-theme={theme}>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span>MB</span>
            <i />
          </div>
          <div>
            <strong>
              MIND<span>BENCH</span>
            </strong>
            <small>INTELLIGENCE ARENA</small>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="关闭导航"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-icon">
            <Atom size={17} />
          </div>
          <div>
            <b>评测工作台</b>
            <span>本地私有空间</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="sidebar-scroll">
          <div className="nav-label">WORKSPACE</div>
          {navGroups.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-caption">{group.label}</div>
              {group.items.map(([key, label, icon]) => (
                <button
                  key={key}
                  className={`nav-item ${page === key ? "nav-active" : ""}`}
                  onClick={() => navigate(key)}
                >
                  <Icon name={icon} size={16} />
                  <span>{label}</span>
                  {key === "tasks" && (
                    <em>{formatNum(dashboard?.stats?.taskCount)}</em>
                  )}
                </button>
              ))}
            </div>
          ))}
          <div className="nav-group category-nav">
            <div className="nav-caption">
              能力分类{" "}
              <button
                className="text-icon"
                onClick={() => navigate("tasks")}
                aria-label="查看全部分类"
              >
                <ArrowRight size={13} />
              </button>
            </div>
            {categories.map((category) => (
              <button
                key={category.id}
                className={`nav-item nav-category ${categoryFilter === category.id && page === "tasks" ? "nav-category-active" : ""}`}
                onClick={() => {
                  setCategoryFilter(category.id);
                  navigate("tasks");
                }}
              >
                <Icon name={category.icon} size={15} />
                <span>{category.name}</span>
                <em>{formatNum(category.task_count)}</em>
              </button>
            ))}
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <span className="live-dot" />
            <span>本地运行 · 数据不出设备</span>
            <LockKeyhole size={13} />
          </div>
          <button className="profile-card" onClick={() => navigate("settings")}>
            <div className="avatar">M</div>
            <div>
              <b>MIND BENCH</b>
              <span>个人研究者</span>
            </div>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="关闭导航"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="main-column">
        <UpdateBanner status={updateStatus} dismissed={updateStatusDismissed} onRefresh={() => location.reload()} onDismiss={() => {
          setUpdateStatusDismissed(true);
        }} />
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{pageLabel(page)}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="system-status">
              <span className="live-dot" /> LOCAL SYSTEM <b>ONLINE</b>
            </div>
            <button
              className="icon-button theme-toggle"
              title="切换主题"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="topbar-avatar"
              onClick={() => navigate("providers")}
            >
              M
            </button>
          </div>
        </header>
        <div className="page-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={page + detailId}
              className="page-content"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18 }}
            >
              {page === "dashboard" && (
                <Dashboard
                  data={dashboard}
                  categories={categories}
                  onNavigate={navigate}
                  onRefresh={refreshAll}
                  loading={!dashboard}
                />
              )}
              {page === "tasks" && (
                <TaskLibrary
                  data={tasksReq.data}
                  error={tasksReq.error}
                  loading={tasksReq.loading}
                  categories={categories}
                  categoryFilter={categoryFilter}
                  setCategory={setCategoryFilter}
                  query={query}
                  setQuery={setQuery}
                  selectedTasks={selectedTasks}
                  toggleTask={toggleTask}
                  onOpen={(id) => navigate("task", id)}
                  onChallenge={(ids) =>
                    submitRun({
                      taskIds: ids,
                      mode: "custom",
                      questionCount: ids.length,
                    })
                  }
                  onNotice={showNotice}
                />
              )}
              {page === "task" && (
                <TaskDetail
                  id={detailId}
                  models={models}
                  selectedModels={selectedModels}
                  toggleModel={toggleModel}
                  onRun={(id, manual) =>
                    submitRun({
                      taskIds: [id],
                      mode: "single",
                      manualAnswers:
                        manual === undefined ? {} : { [id]: manual },
                    })
                  }
                  onBack={() => navigate("tasks")}
                  onNotice={showNotice}
                  onEdit={(taskId) => navigate("promptlab", taskId)}
                  onNavigate={navigate}
                />
              )}
              {page === "promptlab" && (
                <PromptLab
                  focusId={detailId}
                  categories={categories}
                  onNotice={showNotice}
                  onOpenTask={(id) => navigate("task", id)}
                  onRefresh={refreshAll}
                />
              )}
              {page === "model" && (
                <ModelDetail
                  id={detailId}
                  onBack={() => navigate("providers")}
                  onOpenReport={(id) => navigate("report", id)}
                />
              )}
              {page === "challenges" && (
                <Challenges
                  categories={categories}
                  models={models}
                  selectedModels={selectedModels}
                  toggleModel={toggleModel}
                  onRun={submitRun}
                  onNavigate={navigate}
                />
              )}
              {page === "compare" && (
                <Compare
                  tasks={tasksReq.data?.tasks ?? []}
                  categories={categories}
                  models={models}
                  selectedModels={selectedModels}
                  toggleModel={toggleModel}
                  selectedTasks={selectedTasks}
                  toggleTask={toggleTask}
                  onRun={(ids) =>
                    submitRun({
                      taskIds: ids,
                      mode: "custom",
                      questionCount: ids.length,
                    })
                  }
                  onNavigate={navigate}
                />
              )}
              {page === "leaderboard" && (
                <Leaderboard
                  categories={categories}
                  onOpenHistory={() => navigate("history")}
                  onNavigate={navigate}
                />
              )}
              {page === "history" && (
                <HistoryPage
                  onOpen={(id) => navigate("report", id)}
                  onRefresh={refreshDashboard}
                />
              )}
              {page === "report" && (
                <ReportPage
                  id={detailId}
                  onBack={() => navigate("history")}
                  onNotice={showNotice}
                />
              )}
              {page === "analytics" && <AnalyticsPage />}
              {page === "providers" && (
                <ProvidersPage
                  data={modelsData}
                  onRefresh={refreshModels}
                  onNotice={showNotice}
                  onNavigate={navigate}
                />
              )}
              {page === "import" && (
                <ImportPage
                  categories={categories}
                  onNotice={showNotice}
                  onRefresh={refreshAll}
                />
              )}
              {page === "research" && <ResearchPage />}
              {page === "settings" && (
                <SettingsPage
                  onNotice={showNotice}
                  theme={theme}
                  setTheme={setTheme}
                  updateStatus={updateStatus}
                  checkForUpdate={checkForUpdate}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <footer className="footer">
          <span>© 2026 MIND BENCH</span>
          <span>
            <span className="live-dot" /> 仅展示可追溯的真实评测 · 不测量人类 IQ
          </span>
          <button onClick={() => navigate("research")}>
            研究方法 <ArrowRight size={12} />
          </button>
        </footer>
      </main>
      <AnimatePresence>
        {activeRun && (
          <motion.div
            className="run-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="run-spinner">
              <LoaderCircle size={17} />
            </div>
            <div>
              <b>正在运行模型测试</b>
              <span>
                任务已保存 · 最多并发 {modelsData?.concurrencyLimit ?? 4}
              </span>
            </div>
            <button
              className="icon-button"
              onClick={cancelRun}
              title="停止生成"
            >
              <Square size={14} />
            </button>
            <button
              className="icon-button"
              onClick={() => navigate("history")}
              title="查看历史"
            >
              <ArrowRight size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {notice && (
          <motion.div
            className={`toast ${notice.type}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <span>
              {notice.type === "error" ? (
                <AlertTriangle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
            </span>
            {notice.message}
            <button className="icon-button" onClick={() => setNotice(null)}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function pageLabel(key) {
  return (
    {
      dashboard: "总览",
      tasks: "题库探索",
      task: "测试题目",
      challenges: "测试中心",
      compare: "模型对比",
      promptlab: "提示词工作台",
      model: "模型详情",
      leaderboard: "模型排行榜",
      history: "测试历史",
      report: "测试报告",
      analytics: "数据分析",
      providers: "模型管理",
      import: "题库导入",
      research: "研究资料",
      settings: "系统设置",
    }[key] ?? "总览"
  );
}
function PageHeader({ eyebrow, title, subtitle, actions, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <i />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function EmptyState({
  icon: Glyph = Database,
  title = "暂无数据",
  text,
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Glyph size={23} />
      </div>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Dashboard({ data, categories, onNavigate, onRefresh, loading }) {
  const [chartRange, setChartRange] = useState("7D");
  const stats = data?.stats;
  const windowDays = chartRange === "7D" ? 7 : chartRange === "30D" ? 30 : 3650;
  const cutoff = new Date(Date.now() - windowDays * 86400000)
    .toISOString()
    .slice(0, 10);
  const trendSeries = (data?.trend ?? [])
    .filter((row) => row.day >= cutoff && Number.isFinite(Number(row.score)))
    .map((row) => ({ day: row.day.slice(5), score: Number(row.score) }));
  return (
    <>
      <PageHeader
        eyebrow="AI INTELLIGENCE ARENA / OVERVIEW"
        title="评测工作台"
        subtitle="从一道好题开始，观察模型在能力边界上的真实表现。"
        actions={
          <>
            <button className="button button-ghost" onClick={onRefresh}>
              <RefreshCw size={15} />
              刷新数据
            </button>
            <button
              className="button button-primary"
              onClick={() => onNavigate("challenges")}
            >
              <Play size={15} fill="currentColor" />
              开始挑战
            </button>
          </>
        }
      />
      <div className="status-ribbon">
        <span className="ribbon-icon">
          <Activity size={16} />
        </span>
        <div>
          <b>本地评测环境已就绪</b>
          <span>
            {formatNum(stats?.taskCount)} 道原创草案题目 ·{" "}
            {formatNum(stats?.categoryCount)} 个能力维度 · API
            密钥仅加密保存在本机
          </span>
        </div>
        <span className="ribbon-right">
          <span className="live-dot" />
          SYSTEM NOMINAL
        </span>
      </div>
      <div className="metric-grid">
        <Metric
          label="题库题目"
          value={formatNum(stats?.taskCount)}
          change="15 个能力分类"
          icon={Database}
          tone="blue"
          onClick={() => onNavigate("tasks")}
        />
        <Metric
          label="已配置模型"
          value={formatNum(stats?.modelCount)}
          change={stats?.modelCount ? "可开始评测" : "连接一个模型以开始"}
          icon={Atom}
          tone="purple"
          onClick={() => onNavigate("providers")}
        />
        <Metric
          label="真实评测记录"
          value={formatNum(stats?.realRuns)}
          change="Mock 数据不计入"
          icon={Activity}
          tone="green"
          onClick={() => onNavigate("history")}
        />
        <Metric
          label="真实平均得分"
          value={stats?.averageScore == null ? "—" : `${stats.averageScore}`}
          suffix={stats?.averageScore == null ? "" : "/ 100"}
          change="仅统计可评分的真实运行"
          icon={Target}
          tone="orange"
          onClick={() => onNavigate("analytics")}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel performance-panel">
          <div className="panel-head">
            <div>
              <div className="panel-kicker">PERFORMANCE OVERVIEW</div>
              <h2>成绩趋势</h2>
              <span>真实模型运行 · 日均得分</span>
            </div>
            <div className="segmented">
              {["7D", "30D", "ALL"].map((r) => (
                <button
                  className={chartRange === r ? "selected" : ""}
                  key={r}
                  onClick={() => setChartRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-empty">
            <div className="chart-backdrop">
              <div className="chart-grid-lines">
                <i />
                <i />
                <i />
                <i />
              </div>
              {trendSeries.length ? (
                <div className="dashboard-chart">
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={trendSeries}>
                      <defs>
                        <linearGradient
                          id="trendFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#7c9cff"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#7c9cff"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="var(--line)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="day"
                        stroke="var(--text-3)"
                        fontSize={10}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="var(--text-3)"
                        fontSize={10}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--panel)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          color: "var(--text)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#7c9cff"
                        fill="url(#trendFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="chart-empty-content">
                  <div className="chart-orbit">
                    <div />
                    <div />
                    <Activity size={18} />
                  </div>
                  <b>等待首轮真实评测</b>
                  <span>
                    完成模型连接和测试后，这里会展示按日汇总的真实得分趋势。
                  </span>
                  <button
                    className="text-link"
                    onClick={() => onNavigate("providers")}
                  >
                    配置模型 <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="panel-foot">
            <span>
              <i className="legend-dot blue-dot" />
              真实模型
            </span>
            <span className="muted">仅统计当前题库版本 · 不含模拟运行</span>
            <button
              className="text-link"
              onClick={() => onNavigate("analytics")}
            >
              详细分析 <ArrowRight size={13} />
            </button>
          </div>
        </section>
        <section className="panel category-panel">
          <div className="panel-head">
            <div>
              <div className="panel-kicker">CAPABILITY COVERAGE</div>
              <h2>能力覆盖</h2>
              <span>分类及题库数量</span>
            </div>
            <button className="icon-button" onClick={() => onNavigate("tasks")}>
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="category-mini-list">
            {categories.slice(0, 7).map((c, i) => (
              <button
                className="category-mini-row"
                key={c.id}
                onClick={() => onNavigate("tasks", c.id)}
              >
                <span
                  className="mini-icon"
                  style={{ "--tone": palette[i % palette.length] }}
                >
                  <Icon name={c.icon} size={15} />
                </span>
                <span className="mini-label">{c.name}</span>
                <span className="mini-track">
                  <i
                    style={{
                      width: `${Math.min(100, ((c.task_count || 0) / 10) * 100)}%`,
                      "--tone": palette[i % palette.length],
                    }}
                  />
                </span>
                <span className="mini-count">{formatNum(c.task_count)}</span>
              </button>
            ))}
          </div>
          <button
            className="panel-bottom-link"
            onClick={() => onNavigate("tasks")}
          >
            探索全部 15 个分类 <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <div className="section-spacer">
        <SectionTitle
          title="最近活动"
          subtitle="按时间排列的模型评测记录"
          action={
            <button className="text-link" onClick={() => onNavigate("history")}>
              查看全部 <ArrowRight size={13} />
            </button>
          }
        />
      </div>
      <RecentRuns
        recent={data?.recent ?? []}
        onOpen={(id) => onNavigate("report", id)}
        loading={loading}
      />
      <div className="dashboard-lower">
        <section className="panel quickstart-panel">
          <div className="panel-kicker">QUICK START</div>
          <h2>构建你的第一场评测</h2>
          <p>
            连接兼容的模型
            API，选择一道有明确评分标准的题目，开始可追溯的对比测试。
          </p>
          <div className="quick-steps">
            <div>
              <span>01</span>
              <b>配置模型</b>
            </div>
            <i />
            <div>
              <span>02</span>
              <b>选择题目</b>
            </div>
            <i />
            <div>
              <span>03</span>
              <b>对比表现</b>
            </div>
          </div>
          <button
            className="button button-primary"
            onClick={() =>
              onNavigate(stats?.modelCount ? "tasks" : "providers")
            }
          >
            {stats?.modelCount ? "浏览测试题库" : "添加第一个模型"}
            <ArrowRight size={14} />
          </button>
        </section>
        <section className="panel integrity-panel">
          <div className="integrity-icon">
            <ShieldCheck size={19} />
          </div>
          <div>
            <b>成绩完整性保护</b>
            <p>
              排行榜只接纳真实、完整且具有评分依据的模型运行。模拟数据和未完成运行不会计入榜单。
            </p>
            <button
              className="text-link"
              onClick={() => onNavigate("research")}
            >
              阅读评测方法 <ArrowRight size={13} />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
function Metric({ label, value, suffix, change, icon: Glyph, tone, onClick }) {
  return (
    <button className={`metric-card tone-${tone}`} onClick={onClick}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Glyph size={17} />
        </span>
      </div>
      <div className="metric-value">
        {value}
        <small>{suffix}</small>
      </div>
      <div className="metric-bottom">
        <span className="metric-spark">
          {tone === "green" ? (
            <ArrowUpRight size={13} />
          ) : tone === "orange" ? (
            <ArrowDownRight size={13} />
          ) : (
            <span className="metric-bar" />
          )}
        </span>
        {change}
      </div>
    </button>
  );
}
function RecentRuns({ recent, onOpen, loading }) {
  if (loading)
    return (
      <div className="panel table-panel loading-panel">
        <LoaderCircle className="spin" size={20} />
        <span>正在加载评测活动…</span>
      </div>
    );
  if (!recent.length)
    return (
      <div className="panel table-panel">
        <EmptyState
          icon={History}
          title="还没有评测记录"
          text="运行第一道测试后，模型原始回答与评分依据会完整保存在这里。"
        />
      </div>
    );
  return (
    <div className="panel table-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>测试项目</th>
              <th>能力维度</th>
              <th>模型</th>
              <th>运行状态</th>
              <th>得分</th>
              <th>运行时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {recent.map((run) => (
              <tr key={run.id} onClick={() => onOpen(run.id)}>
                <td>
                  <div className="table-primary">{run.task_title}</div>
                  <small>{run.task_id}</small>
                </td>
                <td>
                  <span className="pill category-pill">
                    {run.category_name}
                  </span>
                </td>
                <td>
                  <span className="model-inline">
                    <i />
                    {run.model_name}
                  </span>
                </td>
                <td>
                  <RunStatus status={run.is_external ? "external" : run.is_mock ? "mock" : run.status} />
                </td>
                <td>
                  {run.score == null ? (
                    <span className="muted">未评分</span>
                  ) : (
                    <b className="score-cell">
                      {formatNum(run.score)}
                      <small>/100</small>
                    </b>
                  )}
                </td>
                <td className="muted">{timeAgo(run.started_at)}</td>
                <td>
                  <ChevronRight size={15} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function RunStatus({ status }) {
  const label =
    {
      completed: "已完成",
      running: "运行中",
      failed: "失败",
      cancelled: "已取消",
      mock: "模拟运行",
      partial: "部分完成",
    }[status] ?? status;
  return (
    <span className={`run-status status-${status}`}>
      <i />
      {label}
    </span>
  );
}

function TaskLibrary({
  data,
  error,
  loading,
  categories,
  categoryFilter,
  setCategory,
  query,
  setQuery,
  selectedTasks,
  toggleTask,
  onOpen,
  onChallenge,
  onNotice,
}) {
  const tasks = data?.tasks ?? [];
  const [sort, setSort] = useState("default");
  const [layout, setLayout] = useState("grid");
  const [difficulty, setDifficulty] = useState("all");
  const filtered = tasks.filter(
    (t) => difficulty === "all" || t.difficulty === difficulty,
  );
  const ordered = [...filtered].sort((a, b) =>
    sort === "hard"
      ? ["easy", "medium", "hard", "expert"].indexOf(b.difficulty) -
        ["easy", "medium", "hard", "expert"].indexOf(a.difficulty)
      : sort === "easy"
        ? ["easy", "medium", "hard", "expert"].indexOf(a.difficulty) -
          ["easy", "medium", "hard", "expert"].indexOf(b.difficulty)
        : 0,
  );
  return (
    <>
      <PageHeader
        eyebrow="BENCHMARK LIBRARY / TASK EXPLORER"
        title="提示词测试中心"
        subtitle="浏览透明、带来源标签和可追溯评分规则的测试任务。"
        actions={
          <>
            <button
              className="button button-ghost"
              onClick={() =>
                fetch("/api/tasks/export")
                  .then((r) => r.json())
                  .then((d) =>
                    download(
                      "mind-bench-tasks.json",
                      JSON.stringify(d, null, 2),
                    ),
                  )
                  .catch((e) => onNotice(e.message, "error"))
              }
            >
              <Download size={15} />
              导出题库
            </button>
            <button
              className="button button-primary"
              onClick={() =>
                onChallenge(
                  selectedTasks.length
                    ? selectedTasks
                    : ordered.slice(0, 5).map((t) => t.id),
                )
              }
            >
              <Play size={15} fill="currentColor" />
              开始挑战{selectedTasks.length ? ` · ${selectedTasks.length}` : ""}
            </button>
          </>
        }
      />
      <div className="library-hero">
        <div className="library-hero-top">
          <div>
            <div className="panel-kicker">
              CURATED TEST SUITE{" "}
              <span className="license-tag">ORIGINAL · REVIEW REQUIRED</span>
            </div>
            <h2>发现模型的能力边界</h2>
            <p>
              每道题都关联能力分类、参考答案、评分规则和来源说明。原创题为初始草案，使用前需人工复核；不是权威基准。
            </p>
          </div>
          <div className="library-total">
            <b>{formatNum(data?.total ?? tasks.length)}</b>
            <span>可检索题目</span>
            <small>15 个能力维度</small>
          </div>
        </div>
        <div className="library-search-row">
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label="搜索测试题"
              placeholder="搜索题目、提示词或能力关键词..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="filter-control">
            <Filter size={14} />
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              aria-label="按难度筛选"
            >
              <option value="all">全部难度</option>
              <option value="easy">入门</option>
              <option value="medium">进阶</option>
              <option value="hard">挑战</option>
              <option value="expert">专家</option>
            </select>
          </div>
          <div className="filter-control">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="排序"
            >
              <option value="default">默认排序</option>
              <option value="easy">由易到难</option>
              <option value="hard">由难到易</option>
            </select>
            <ChevronDown size={13} />
          </div>
        </div>
      </div>
      <div className="category-chips">
        <button
          className={categoryFilter === "all" ? "chip-active" : ""}
          onClick={() => setCategory("all")}
        >
          全部分类 <span>{formatNum(data?.total)}</span>
        </button>
        {categories.map((c) => (
          <button
            className={categoryFilter === c.id ? "chip-active" : ""}
            key={c.id}
            onClick={() => setCategory(c.id)}
          >
            <Icon name={c.icon} size={14} />
            {c.name}
            <span>{formatNum(c.task_count)}</span>
          </button>
        ))}
      </div>
      <div className="library-list-head">
        <div>
          <b>
            {categoryFilter === "all"
              ? "精选测试题"
              : (categories.find((c) => c.id === categoryFilter)?.name ??
                "测试题")}
          </b>
          <span> {ordered.length} 道结果 · 题库版本 v1.0.0</span>
        </div>
        <div>
          <button
            className={`icon-button ${layout === "grid" ? "is-active" : ""}`}
            title="卡片视图"
            onClick={() => setLayout("grid")}
          >
            <Shapes size={15} />
          </button>
          <button
            className={`icon-button ${layout === "list" ? "is-active" : ""}`}
            title="列表视图"
            onClick={() => setLayout("list")}
          >
            <ListChecks size={15} />
          </button>
        </div>
      </div>
      {error ? (
        <div className="panel">
          <EmptyState icon={AlertTriangle} title="题库加载失败" text={error} />
        </div>
      ) : loading ? (
        <div className="task-card-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="task-card skeleton-card" key={i} />
          ))}
        </div>
      ) : !ordered.length ? (
        <div className="panel">
          <EmptyState
            title="没有匹配题目"
            text="尝试调整搜索关键词或筛选条件。"
          />
        </div>
      ) : (
        <div
          className={
            layout === "list"
              ? "task-card-grid task-list-view"
              : "task-card-grid"
          }
        >
          {ordered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              checked={selectedTasks.includes(task.id)}
              onToggle={() => toggleTask(task.id)}
              onOpen={() => onOpen(task.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
function TaskCard({ task, checked, onToggle, onOpen }) {
  return (
    <article className={`task-card ${checked ? "task-selected" : ""}`}>
      <div className="task-card-top">
        <span className="task-category-dot" />
        <span>{task.category_name}</span>
        <span className={`difficulty difficulty-${task.difficulty}`}>
          {difficultyLabel[task.difficulty]}
        </span>
        <button
          className={`select-checkbox ${checked ? "checked" : ""}`}
          onClick={onToggle}
          aria-label={checked ? "取消选择" : "选择题目"}
        >
          {checked && <Check size={12} />}
        </button>
      </div>
      <button className="task-card-title" onClick={onOpen}>
        {task.title}
      </button>
      <p className="task-card-prompt">{task.prompt_zh}</p>
      <div className="task-card-foot">
        <span className="task-source">
          <span className="source-dot" />
          {task.source_type === "original"
            ? "原创草案"
            : task.source_type === "user"
              ? "用户添加"
              : "公开基准"}
        </span>
        <span className="task-card-actions">
          <span>{task.subcategory}</span>
          <button className="arrow-button" onClick={onOpen}>
            <ArrowRight size={14} />
          </button>
        </span>
      </div>
    </article>
  );
}

function TaskDetail({
  id,
  models,
  selectedModels,
  toggleModel,
  onRun,
  onBack,
  onNotice,
  onEdit,
  onNavigate,
}) {
  const { data, error, loading, refresh } = useApi(`/api/tasks/${id}`, [id]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [view, setView] = useState("markdown");
  const [manual, setManual] = useState("");
  const [copied, setCopied] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versions, setVersions] = useState(null);
  const [variantOpen, setVariantOpen] = useState(false);
  const [variantDraft, setVariantDraft] = useState({ name: "", prompt: "" });
  const [busy, setBusy] = useState(false);
  const task = data?.task;
  const copy = async () => {
    if (!task) return;
    try {
      await navigator.clipboard.writeText(task.prompt_zh);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onNotice("剪贴板访问失败，请手动选择提示词复制。", "error");
    }
  };
  const favorite = async () => {
    try {
      await request(`/api/tasks/${id}/favorite`, {
        method: "POST",
        body: "{}",
      });
      refresh();
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  const openVersions = async () => {
    setVersionOpen(true);
    if (versions) return;
    try {
      setVersions(await request(`/api/tasks/${id}/versions`));
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  const makeCopy = async () => {
    setBusy(true);
    try {
      const created = await request(`/api/tasks/${id}/copy`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      onNotice("已创建可编辑副本，修改不会影响原题。");
      onEdit?.(created.task.id);
    } catch (e) {
      onNotice(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const saveVariant = async () => {
    if (!variantDraft.prompt.trim()) return;
    try {
      await request(`/api/tasks/${id}/variants`, {
        method: "POST",
        body: JSON.stringify(variantDraft),
      });
      setVariantDraft({ name: "", prompt: "" });
      setVariantOpen(false);
      refresh();
      onNotice("变体已保存，可在提示词工作台管理。");
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  const removeVariant = async (variantId) => {
    if (!confirm("删除这个提示词变体？已有测试记录不会受影响。")) return;
    try {
      await request(`/api/variants/${variantId}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  if (loading)
    return (
      <div className="panel loading-panel">
        <LoaderCircle className="spin" />
        正在载入题目
      </div>
    );
  if (error || !task)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="题目无法载入"
        text={error}
        action={
          <button className="button button-ghost" onClick={onBack}>
            返回题库
          </button>
        }
      />
    );
  return (
    <>
      <div className="detail-back">
        <button className="text-link" onClick={onBack}>
          <ChevronLeft size={15} />
          返回题库
        </button>
        <span>
          题库 / {task.category_name} / {task.title}
        </span>
      </div>
      <PageHeader
        eyebrow={`${task.category_name_en?.toUpperCase() ?? "BENCHMARK TASK"} / ${task.id}`}
        title={task.title}
        subtitle={task.objective}
        actions={
          <button
            className={`button button-ghost ${data.favorite ? "is-favorite" : ""}`}
            onClick={favorite}
          >
            <Bookmark
              size={15}
              fill={data.favorite ? "currentColor" : "none"}
            />
            {data.favorite ? "已收藏" : "收藏题目"}
          </button>
        }
      />
      <div className="task-meta-row">
        <span className="pill category-pill">
          <Icon
            name={
              categoriesMeta.find((c) => c[0] === task.category_id)?.[0] ??
              "Sparkles"
            }
            size={13}
          />
          {task.category_name}
        </span>
        <span className={`difficulty difficulty-${task.difficulty}`}>
          {difficultyLabel[task.difficulty]}
        </span>
        <span className="source-label">
          <span className="source-dot" />
          {task.source_name} · {task.source_license}
        </span>
        <span className="version-label">v{task.version}</span>
        <span className="review-label">
          {{
            review_required: "待人工复核",
            draft: "草案 · 未验证",
            user: "用户自建",
            imported: "外部导入 · 未验证",
            verified: "已人工验证",
          }[task.verification_status] ?? task.verification_status}
        </span>
        {data.derivedFrom && (
          <button
            className="version-label"
            onClick={() => onNavigate?.("task", data.derivedFrom.id)}
            title="打开原题"
          >
            复制自 {data.derivedFrom.id} · v{data.derivedFrom.version}
          </button>
        )}
      </div>
      <div className="task-run-layout">
        <section className="panel prompt-panel">
          <div className="detail-panel-head">
            <div>
              <div className="panel-kicker">TEST PROMPT / INPUT</div>
              <h2>测试提示词</h2>
            </div>
            <div className="tab-switch">
              <button
                className={view === "markdown" ? "selected" : ""}
                onClick={() => setView("markdown")}
              >
                Markdown
              </button>
              <button
                className={view === "plain" ? "selected" : ""}
                onClick={() => setView("plain")}
              >
                纯文本
              </button>
              <button
                className={view === "source" ? "selected" : ""}
                onClick={() => setView("source")}
              >
                原始版本
              </button>
            </div>
          </div>
          <div className="prompt-objective">
            <Target size={15} />
            <span>{task.objective}</span>
          </div>
          <pre
            className={`prompt-content ${view === "source" ? "source-view" : ""}`}
          >
            {view === "source"
              ? `# ${task.title}\n\n${task.prompt_zh}\n\n---\n来源：${task.source_name}\n版本：${task.version}\n许可证：${task.source_license}`
              : task.prompt_zh}
          </pre>
          <div className="prompt-actions">
            <button className="button button-primary" onClick={copy}>
              {copied ? <Check size={14} /> : <Clipboard size={14} />}{" "}
              {copied ? "已复制" : "复制完整提示词"}
            </button>
            <button
              className="button button-ghost"
              disabled={busy}
              onClick={makeCopy}
            >
              <CopyPlus size={14} />
              {busy ? "正在复制…" : "编辑副本"}
            </button>
            <button
              className="icon-button"
              title="版本历史"
              onClick={openVersions}
            >
              <History size={15} />
            </button>
          </div>
          <div className="variant-block">
            <div className="variant-head">
              <div>
                <b>提示词变体</b>
                <span>
                  {data.variants?.length
                    ? `${data.variants.length} 个本地变体 · 不修改原始题目`
                    : "可在不改动原题的前提下保存自己的改写版本"}
                </span>
              </div>
              <button
                className="text-link"
                onClick={() => {
                  setVariantDraft({
                    name: `${task.title} · 变体`,
                    prompt: task.prompt_zh,
                  });
                  setVariantOpen(true);
                }}
              >
                <Plus size={13} />
                新建变体
              </button>
            </div>
            {data.variants?.length > 0 && (
              <div className="variant-list">
                {data.variants.map((variant) => (
                  <div className="variant-row" key={variant.id}>
                    <span>
                      <b>{variant.name}</b>
                      <small>{variant.prompt.slice(0, 90)}</small>
                    </span>
                    <button
                      className="icon-button"
                      title="复制变体提示词"
                      onClick={() => {
                        navigator.clipboard?.writeText(variant.prompt);
                        onNotice("变体提示词已复制。");
                      }}
                    >
                      <Clipboard size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="删除变体"
                      onClick={() => removeVariant(variant.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className="answer-reveal"
            onClick={() => setShowAnswer(!showAnswer)}
          >
            <span>
              <CircleHelp size={15} />
              {showAnswer ? "隐藏" : "查看"}标准答案与评分依据
            </span>
            <ChevronDown className={showAnswer ? "rotated" : ""} size={15} />
          </button>
          {showAnswer && (
            <div className="answer-block">
              <div>
                <b>参考答案</b>
                <p>
                  {task.reference_answer ||
                    "该题暂无单一参考答案，请使用评分量表人工复核。"}
                </p>
              </div>
              <div>
                <b>评分规则</b>
                <p>{JSON.stringify(task.scoring_rule, null, 2)}</p>
              </div>
              <div>
                <b>来源与注意事项</b>
                <p>{task.notes}</p>
              </div>
            </div>
          )}
        </section>
        <section className="panel response-panel">
          <div className="detail-panel-head">
            <div>
              <div className="panel-kicker">MODEL RESPONSE / OUTPUT</div>
              <h2>模型回答</h2>
            </div>
            <span className="connection-badge">
              <span className="live-dot" />
              {models.length ? "模型可选" : "待配置"}
            </span>
          </div>
          <div className="model-selector-detail">
            <b>
              选择参与模型 <span>· 可多选</span>
            </b>
            <div className="model-option-list">
              {models
                .filter((m) => m.enabled && m.provider_enabled)
                .map((model) => (
                  <button
                    className={`model-option ${selectedModels.includes(model.id) ? "model-option-selected" : ""}`}
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                  >
                    <span className="model-check">
                      {selectedModels.includes(model.id) && <Check size={11} />}
                    </span>
                    <span
                      className="provider-avatar"
                      style={{
                        "--avatar-tone": providerTone(model.provider_kind),
                      }}
                    >
                      {model.name.slice(0, 1)}
                    </span>
                    <span className="model-option-name">
                      <b>{model.name}</b>
                      <small>
                        {model.provider_name} · {model.model_id}
                      </small>
                    </span>
                    <i className="model-ready-dot" />
                  </button>
                ))}
              {!models.length && (
                <div className="inline-empty">
                  <Atom size={15} />
                  尚未配置模型{" "}
                  <button
                    className="text-link"
                    onClick={() => (location.hash = "providers")}
                  >
                    前往管理 <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="run-settings">
            <div>
              <span>温度参数</span>
              <b>
                {selectedModels.length === 1
                  ? (models.find((m) => m.id === selectedModels[0])
                      ?.temperature ?? "—")
                  : "按模型配置"}
              </b>
            </div>
            <div>
              <span>最大输出</span>
              <b>
                {selectedModels.length === 1
                  ? (models.find((m) => m.id === selectedModels[0])
                      ?.max_tokens ?? "—")
                  : "按模型配置"}
              </b>
            </div>
            <div>
              <span>安全策略</span>
              <b>请求隔离</b>
            </div>
          </div>
          <button
            className="button button-primary run-task-button"
            disabled={!selectedModels.length}
            onClick={() => onRun(id)}
          >
            <Send size={15} />
            发送测试 <span>· {selectedModels.length} 个模型</span>
          </button>
          <button
            className="button button-ghost run-all-button"
            disabled={!models.some((m) => m.enabled && m.provider_enabled)}
            onClick={() => {
              const enabled = models
                .filter((m) => m.enabled && m.provider_enabled)
                .map((m) => m.id);
              enabled.forEach((modelId) => {
                if (!selectedModels.includes(modelId)) toggleModel(modelId);
              });
              onNotice(
                `已将 ${enabled.length} 个已启用模型加入本次对比；请再次点击发送测试。`,
              );
            }}
          >
            <ArrowLeftRight size={14} />
            选择全部已启用模型
          </button>
          <div className="manual-answer">
            <div className="manual-head">
              <span>
                <Clipboard size={14} />
                外部模型回答
              </span>
              <span>用于统一评分 · 保留原文</span>
            </div>
            <textarea
              aria-label="粘贴外部模型回答"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="粘贴你在其他 AI 平台得到的原始回答…"
            />
            <button
              className="button button-ghost"
              disabled={!manual.trim()}
              onClick={() => onRun(id, manual)}
            >
              <FileText size={14} />
              评分并保存回答
            </button>
          </div>
          <div className="response-integrity">
            <LockKeyhole size={13} />
            API Key 不会返回浏览器，模型原始回答按原文保存。
          </div>
        </section>
      </div>
      {versionOpen && (
        <Modal title="版本历史" onClose={() => setVersionOpen(false)}>
          <div className="version-list">
            {!versions && (
              <div className="loading-panel">
                <LoaderCircle className="spin" size={16} />
                正在读取版本…
              </div>
            )}
            {(versions ?? []).map((version) => (
              <details className="version-row" key={version.id}>
                <summary>
                  <b>v{version.version}</b>
                  <span>{version.change_note || "无变更说明"}</span>
                  <small>
                    {new Date(version.created_at).toLocaleString("zh-CN")}
                  </small>
                </summary>
                <pre className="version-snapshot">
                  {version.snapshot?.promptZh ||
                    version.snapshot?.prompt_zh ||
                    JSON.stringify(version.snapshot, null, 2)}
                </pre>
              </details>
            ))}
            {versions && !versions.length && (
              <div className="inline-empty">这道题还没有版本记录。</div>
            )}
          </div>
          <p className="modal-note">
            版本快照在写入时冻结。修改题目会生成新版本，旧测试记录仍指向当时的版本号。
          </p>
        </Modal>
      )}
      {variantOpen && (
        <Modal title="新建提示词变体" onClose={() => setVariantOpen(false)}>
          <div className="modal-form">
            <label className="field">
              <span>变体名称</span>
              <input
                value={variantDraft.name}
                maxLength={120}
                onChange={(e) =>
                  setVariantDraft({ ...variantDraft, name: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>变体提示词</span>
              <textarea
                className="code-area"
                rows={10}
                value={variantDraft.prompt}
                onChange={(e) =>
                  setVariantDraft({ ...variantDraft, prompt: e.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button
                className="button button-ghost"
                onClick={() => setVariantOpen(false)}
              >
                取消
              </button>
              <button
                className="button button-primary"
                disabled={!variantDraft.prompt.trim()}
                onClick={saveVariant}
              >
                <Save size={14} />
                保存变体
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function providerTone(kind) {
  return (
    {
      openai: "#48cfae",
      anthropic: "#e9ad6a",
      gemini: "#75a7fa",
      deepseek: "#5ca5ff",
      qwen: "#a890ff",
      mock: "#8d91a0",
    }[kind] ?? "#a78bfa"
  );
}

function ModelChooser({ models, selected, toggle, compact = false }) {
  const enabled = models.filter((m) => m.enabled && m.provider_enabled);
  if (!enabled.length)
    return (
      <div className="panel-empty-inline">
        <Atom size={16} />
        尚未配置模型。
        <button
          className="text-link"
          onClick={() => (location.hash = "providers")}
        >
          前往模型管理 <ArrowRight size={13} />
        </button>
      </div>
    );
  return (
    <div className={`model-chooser ${compact ? "compact" : ""}`}>
      {enabled.map((model) => (
        <button
          key={model.id}
          className={`model-chip ${selected.includes(model.id) ? "chosen" : ""}`}
          onClick={() => toggle(model.id)}
        >
          <span className="model-check">
            {selected.includes(model.id) && <Check size={10} />}
          </span>
          <i style={{ background: providerTone(model.provider_kind) }} />
          {model.name}
          <small>{model.provider_name}</small>
        </button>
      ))}
    </div>
  );
}
function Challenges({
  categories,
  models,
  selectedModels,
  toggleModel,
  onRun,
  onNavigate,
}) {
  const [mode, setMode] = useState("custom");
  const [category, setCategory] = useState(categories[0]?.id ?? "logic");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("all");
  const [repeats, setRepeats] = useState(3);
  const modes = [
    ["single", "单题挑战", "选择一题并对比模型。", Target],
    ["category", "分类挑战", "抽取单项能力下的多道测试题。", Shapes],
    ["comprehensive", "综合评测", "跨分类采样，构建能力快照。", Atom],
    ["extreme", "极限挑战", "优先运行高难度与专家级题目。", Zap],
    ["random", "随机挑战", "每次随机生成不同的题目组合。", Sparkles],
    ["stability", "稳定性测试", "重复相同题目，衡量输出一致性。", RefreshCw],
    ["custom", "自定义测试", "自行配置分类、题量、难度和模型。", Settings2],
    ["external", "外部回答评分", "输入已有回答后进行人工评分。", Clipboard],
  ];
  return (
    <>
      <PageHeader
        eyebrow="TEST LAB / EXPERIMENT DESIGN"
        title="测试中心"
        subtitle="用可复现的运行配置组织批量评测；失败模型不会阻断同组其他请求。"
        actions={
          <button
            className="button button-ghost"
            onClick={() => onNavigate("providers")}
          >
            <Settings2 size={15} />
            模型管理
          </button>
        }
      />
      <div className="challenge-layout">
        <section className="challenge-main">
          <SectionTitle
            title="选择测试模式"
            subtitle="不同模式使用同一套可追溯运行记录。"
          />
          <div className="mode-grid">
            {modes.map(([id, label, desc, Glyph]) => (
              <button
                key={id}
                className={`mode-card ${mode === id ? "mode-card-active" : ""}`}
                onClick={() => setMode(id)}
              >
                <span className="mode-glyph">
                  <Glyph size={17} />
                </span>
                <span className="mode-radio">{mode === id && <i />}</span>
                <b>{label}</b>
                <p>{desc}</p>
              </button>
            ))}
          </div>
          <section className="panel challenge-config">
            <div className="panel-kicker">EXPERIMENT CONFIGURATION</div>
            <h2>测试配置</h2>
            <div className="config-grid">
              <label className="field">
                <span>测试分类</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">全部 15 个能力分类</option>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name} · {c.task_count} 题
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  题目数量 <b className="field-value">{count}</b>
                </span>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
                <small>1—30 道 · 仅运行已创建的题库任务</small>
              </label>
              <label className="field">
                <span>难度范围</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="all">全部难度</option>
                  <option value="medium">进阶及以上</option>
                  <option value="hard">挑战及以上</option>
                  <option value="expert">仅专家级</option>
                </select>
              </label>
              {mode === "stability" && (
                <label className="field">
                  <span>每道题重复次数</span>
                  <select
                    value={repeats}
                    onChange={(e) => setRepeats(Number(e.target.value))}
                  >
                    <option value="2">2 次</option>
                    <option value="3">3 次</option>
                    <option value="5">5 次</option>
                  </select>
                </label>
              )}
            </div>
            <div className="config-note">
              <AlertTriangle size={14} />
              <span>
                主观评分题暂不自动计分；未评分、失败和模拟运行不会当作零分混入真实排行榜。
              </span>
            </div>
          </section>
        </section>
        <aside className="challenge-sidebar panel">
          <div className="panel-kicker">MODEL SELECTION</div>
          <h2>参测模型</h2>
          <p>
            支持同时测试任意数量的已启用模型。请求并发上限为{" "}
            {window.MIND_BENCH_CONCURRENCY ?? 4} 个。
          </p>
          <ModelChooser
            models={models}
            selected={selectedModels}
            toggle={toggleModel}
          />
          <div className="challenge-summary">
            <b>本次评测摘要</b>
            <div>
              <span>测试模式</span>
              <strong>{modes.find((m) => m[0] === mode)?.[1]}</strong>
            </div>
            <div>
              <span>计划模型</span>
              <strong>{selectedModels.length} 个</strong>
            </div>
            <div>
              <span>预计运行任务</span>
              <strong>{count * selectedModels.length} 个</strong>
            </div>
          </div>
          <button
            className="button button-primary challenge-start"
            disabled={!selectedModels.length}
            onClick={() =>
              onRun({
                mode:
                  mode === "comprehensive"
                    ? "challenge"
                    : mode === "category"
                      ? "custom"
                      : mode,
                categoryId: category === "all" ? undefined : category,
                questionCount: count,
                difficulty: difficulty === "all" ? undefined : difficulty,
                repeats,
              })
            }
          >
            <Play size={15} fill="currentColor" />
            运行评测
            <ArrowRight size={14} />
          </button>
          <span className="helper-caption">
            只有真实模型运行才会进入排行榜候选
          </span>
        </aside>
      </div>
    </>
  );
}

function Compare({
  tasks,
  categories,
  models,
  selectedModels,
  toggleModel,
  selectedTasks,
  toggleTask,
  onRun,
  onNavigate,
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const filtered = tasks.filter(
    (t) =>
      (category === "all" || t.category_id === category) &&
      (!query || `${t.title}${t.prompt_zh}`.includes(query)),
  );
  return (
    <>
      <PageHeader
        eyebrow="MODEL ARENA / HEAD-TO-HEAD"
        title="多模型对比"
        subtitle="选择同一组测试题与模型，并列保留每个供应商返回的原始答案。"
        actions={
          <button
            className="button button-primary"
            disabled={!selectedTasks.length || !selectedModels.length}
            onClick={() => onRun(selectedTasks)}
          >
            <Play size={15} />
            运行对比 · {selectedTasks.length} 题 / {selectedModels.length} 模型
          </button>
        }
      />
      <section className="panel compare-selection">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">01 / MODEL SET</div>
            <h2>选择参测模型</h2>
            <span>选择两个或更多模型以开始并排对比。</span>
          </div>
          <button className="text-link" onClick={() => onNavigate("providers")}>
            模型管理 <ArrowRight size={13} />
          </button>
        </div>
        <ModelChooser
          models={models}
          selected={selectedModels}
          toggle={toggleModel}
        />
      </section>
      <section className="compare-task-section">
        <div className="compare-toolbar">
          <SectionTitle
            title="02 / 测试任务"
            subtitle={`${selectedTasks.length} 道题已选择`}
          />
          <div className="compare-filters">
            <div className="search-box compact-search">
              <Search size={14} />
              <input
                aria-label="搜索对比测试"
                placeholder="搜索测试…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">全部能力</option>
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="compare-task-list">
          {filtered.map((task) => (
            <button
              className={`compare-task-row ${selectedTasks.includes(task.id) ? "active" : ""}`}
              key={task.id}
              onClick={() => toggleTask(task.id)}
            >
              <span
                className={`select-checkbox ${selectedTasks.includes(task.id) ? "checked" : ""}`}
              >
                {selectedTasks.includes(task.id) && <Check size={12} />}
              </span>
              <span className="compare-task-info">
                <b>{task.title}</b>
                <small>
                  {task.category_name} · {task.subcategory}
                </small>
              </span>
              <span className={`difficulty difficulty-${task.difficulty}`}>
                {difficultyLabel[task.difficulty]}
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!filtered.length && (
            <div className="inline-empty">没有符合筛选条件的题目。</div>
          )}
        </div>
      </section>
      <div className="comparison-note">
        <ShieldCheck size={16} />
        <span>
          响应原文不会被润色。系统会分别保存模型版本、提示词版本、耗时、Token
          与评分规则。
        </span>
      </div>
    </>
  );
}

function Leaderboard({ categories, onOpenHistory, onNavigate }) {
  const [category, setCategory] = useState("overall");
  const [version, setVersion] = useState("");
  const [expanded, setExpanded] = useState("");
  const { data, error, loading, refresh } = useApi(
    `/api/leaderboard?category=${category}&version=${encodeURIComponent(version)}`,
    [category, version],
  );
  const rows = data?.leaderboard ?? [];
  const provisional = data?.provisional ?? [];
  const threshold = data?.threshold ?? 10;
  const weights = data?.weights ?? {};
  const customWeights = Object.values(weights).some(
    (value) => Number(value) !== 1,
  );
  const categoryName = (id) =>
    categories.find((item) => item.id === id)?.name ?? id;
  const exportFile = async (format) => {
    if (format === "json") {
      const payload = await request(
        `/api/leaderboard/export?format=json&category=${category}&version=${encodeURIComponent(version)}`,
      );
      download("mind-bench-leaderboard.json", JSON.stringify(payload, null, 2));
      return;
    }
    const response = await fetch(
      `/api/leaderboard/export?format=csv&category=${category}&version=${encodeURIComponent(version)}`,
    );
    download("mind-bench-leaderboard.csv", await response.text(), "text/csv");
  };
  return (
    <>
      <PageHeader
        eyebrow="MIND BENCH SCORE / RANKINGS"
        title="模型排行榜"
        subtitle={`按能力分类加权计算，所有分数可追溯到具体测试记录；正式排名要求至少 ${threshold} 条真实有效评分。`}
        actions={
          <>
            <select
              className="leaderboard-version"
              aria-label="按模型版本过滤"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            >
              <option value="">全部模型版本</option>
              {(data?.versions ?? []).map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              className="button button-ghost"
              onClick={() => exportFile("csv")}
            >
              <Download size={14} />
              导出 CSV
            </button>
            <button
              className="button button-ghost"
              onClick={() => exportFile("json")}
            >
              <FileText size={14} />
              导出 JSON
            </button>
          </>
        }
      />
      <div className="score-disclaimer">
        <span className="disclaimer-icon">
          <CircleHelp size={16} />
        </span>
        <span>
          <b>MIND BENCH SCORE</b> 是平台自定义的 1000 分制评测指数，
          <strong>不是人类 IQ 或心理测量结果。</strong>{" "}
          综合分按分类均值与系统权重加权，缺测分类不计 0
          分；仅统计真实、已完成且可评分的运行。
        </span>
        <button
          className="text-link"
          onClick={() => (location.hash = "research")}
        >
          评分方法 <ArrowRight size={12} />
        </button>
      </div>
      <div className="leaderboard-top">
        <div className="lb-summary panel">
          <span>合格模型</span>
          <b>{rows.length}</b>
          <small>≥{threshold} 条有效真实评分</small>
        </div>
        <div className="lb-summary panel">
          <span>平均 MIND BENCH SCORE</span>
          <b>
            {rows.length
              ? formatNum(
                  Math.round(
                    rows.reduce((sum, row) => sum + row.mind_bench_score, 0) /
                      rows.length,
                  ),
                )
              : "—"}
          </b>
          <small>当前筛选范围 · 1000 分制</small>
        </div>
        <div className="lb-summary panel">
          <span>加权方式</span>
          <b className="lb-weight-state">
            {customWeights ? "自定义权重" : "等权 15 类"}
          </b>
          <small>
            {customWeights
              ? "来自系统设置中的分类权重"
              : "可在系统设置中调整分类权重"}
          </small>
        </div>
      </div>
      <div className="category-tabs leaderboard-tabs">
        <button
          className={category === "overall" ? "active" : ""}
          onClick={() => setCategory("overall")}
        >
          综合能力
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            className={category === item.id ? "active" : ""}
            onClick={() => setCategory(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="panel leaderboard-panel">
        <div className="leaderboard-table-head">
          <span>RANK / MODEL</span>
          <span>供应商</span>
          <span>有效测试</span>
          <span>覆盖度</span>
          <span>近 7 日趋势</span>
          <span>MIND BENCH SCORE</span>
          <span>最近测试</span>
          <span />
        </div>
        {loading ? (
          <div className="loading-panel">
            <LoaderCircle className="spin" />
            正在计算可追溯排名…
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="排行榜读取失败"
            text={error}
            action={
              <button className="button button-ghost" onClick={refresh}>
                重试
              </button>
            }
          />
        ) : rows.length ? (
          rows.map((row) => (
            <div className="lb-entry" key={row.model_id}>
              <div className="leaderboard-row">
                <div className="lb-model">
                  <span
                    className={`rank-medal ${row.rank <= 3 ? "medal-" + row.rank : ""}`}
                  >
                    {String(row.rank).padStart(2, "0")}
                  </span>
                  <span
                    className="provider-avatar"
                    style={{ "--avatar-tone": providerTone(row.provider_kind) }}
                  >
                    {row.model_name.slice(0, 1)}
                  </span>
                  <span>
                    <button
                      className="lb-model-link"
                      onClick={() => onNavigate?.("model", row.model_id)}
                    >
                      {row.model_name}
                    </button>
                    <small>
                      {row.model_identifier}
                      {row.model_version ? ` · ${row.model_version}` : ""}
                    </small>
                  </span>
                </div>
                <span>{row.provider_name}</span>
                <span>
                  <b>{formatNum(row.scored_count)}</b>
                  <small className="table-muted">有效评分</small>
                </span>
                <span>
                  <b>{row.category_coverage}%</b>
                  <small className="table-muted">
                    {Object.keys(row.category_scores ?? {}).length}/15 类
                  </small>
                </span>
                <span>
                  {row.trend === null ? (
                    <span className="muted">样本不足</span>
                  ) : (
                    <b className={row.trend >= 0 ? "trend-up" : "trend-down"}>
                      {row.trend >= 0 ? (
                        <ArrowUpRight size={13} />
                      ) : (
                        <ArrowDownRight size={13} />
                      )}
                      {row.trend > 0 ? "+" : ""}
                      {row.trend}
                    </b>
                  )}
                </span>
                <span>
                  <b className="lb-score">
                    {formatNum(row.mind_bench_score)}
                    <small>/1000</small>
                  </b>
                  <span className="score-meter">
                    <i style={{ width: `${row.average_score}%` }} />
                  </span>
                </span>
                <span className="muted">{timeAgo(row.last_tested)}</span>
                <button
                  className="icon-button"
                  aria-label="展开分项"
                  onClick={() =>
                    setExpanded(expanded === row.model_id ? "" : row.model_id)
                  }
                >
                  <ChevronDown
                    size={15}
                    className={expanded === row.model_id ? "rotated" : ""}
                  />
                </button>
              </div>
              {expanded === row.model_id && (
                <div className="lb-detail">
                  <div className="lb-detail-head">
                    <b>分项能力得分</b>
                    <span>
                      未测量分类不显示，也不会按 0 分计入综合分 ·{" "}
                      {Object.entries(row.score_sources ?? {})
                        .map(
                          ([source, count]) =>
                            `${scoreSourceLabel(source)} ${count}`,
                        )
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="lb-category-grid">
                    {categories.map((item) => {
                      const value = row.category_scores?.[item.id];
                      return (
                        <div className="lb-category" key={item.id}>
                          <span>{item.name}</span>
                          <div className="lb-category-track">
                            <i
                              style={{
                                width: `${value ?? 0}%`,
                                opacity: value === undefined ? 0.12 : 1,
                              }}
                            />
                          </div>
                          <b>{value === undefined ? "未测" : value}</b>
                        </div>
                      );
                    })}
                  </div>
                  <div className="lb-detail-actions">
                    <button
                      className="button button-ghost"
                      onClick={() => onNavigate?.("model", row.model_id)}
                    >
                      <Cpu size={14} />
                      模型详情
                    </button>
                    <button
                      className="button button-ghost"
                      onClick={onOpenHistory}
                    >
                      <History size={14} />
                      查看测试记录
                    </button>
                    <span className="muted">
                      加权平均 {row.weighted_score} / 100 · 样本{" "}
                      {row.scored_count} 条
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="leaderboard-empty">
            <div className="rank-illustration">
              <Trophy size={22} />
            </div>
            <h3>排行榜尚未开放排名</h3>
            <p>
              目前没有模型达到至少 {threshold}{" "}
              条非模拟、已完成且可评分的测试记录。
            </p>
            <span>未达门槛的结果只显示为候选，不会伪装成正式排名。</span>
            <button
              className="button button-primary"
              onClick={() => (location.hash = "challenges")}
            >
              <Play size={14} />
              开始真实评测
            </button>
          </div>
        )}
      </div>
      <div className="provisional-box">
        <div>
          <AlertTriangle size={15} />
          <b>预备排名 · {provisional.length} 个模型样本不足</b>
          <span>
            样本不足模型不进入正式榜单；分数仅供观察，不能当作正式结论。
          </span>
        </div>
        {provisional.length > 0 && (
          <div className="provisional-list">
            {provisional.map((item) => (
              <button
                className="provisional-item"
                key={item.model_id}
                onClick={() => onNavigate?.("model", item.model_id)}
              >
                <b>{item.model_name}</b>
                <span>
                  {item.scored_count}/{threshold} 条 · 均分 {item.average_score}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
function scoreSourceLabel(source) {
  return (
    {
      objective: "规则评分",
      ai_judge: "AI 裁判",
      human: "人工复核",
      manual: "未评分",
      mock: "模拟",
    }[source] ?? source
  );
}

function HistoryPage({ onOpen, onRefresh }) {
  const { data, error, loading, refresh } = useApi("/api/sessions?limit=100");
  const sessions = data ?? [];
  useEffect(() => {
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);
  return (
    <>
      <PageHeader
        eyebrow="EXPERIMENT LOG / TRACEABILITY"
        title="测试历史"
        subtitle="每次运行都保存原始提示词、模型版本、供应商响应、评分结果和可复现配置。"
        actions={
          <button className="button button-ghost" onClick={refresh}>
            <RefreshCw size={14} />
            刷新记录
          </button>
        }
      />
      <div className="history-summary">
        {[
          ["运行总数", sessions.reduce((n, s) => n + s.run_count, 0)],
          [
            "真实完成",
            sessions.reduce((n, s) => n + (s.real_completed ?? 0), 0),
          ],
          ["模拟运行", sessions.reduce((n, s) => n + (s.mock_count ?? 0), 0)],
          ["测试批次", sessions.length],
        ].map(([l, v]) => (
          <div className="history-kpi" key={l}>
            <span>{l}</span>
            <b>{formatNum(v)}</b>
          </div>
        ))}
      </div>
      <div className="panel history-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>测试批次</th>
                <th>模式</th>
                <th>执行状态</th>
                <th>任务数</th>
                <th>真实平均分</th>
                <th>开始时间</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} onClick={() => onOpen(s.id)}>
                  <td>
                    <div className="table-primary">{s.name}</div>
                    <small className="session-id">{s.id}</small>
                  </td>
                  <td>
                    <span className="pill category-pill">
                      {modeLabel(s.mode)}
                    </span>
                  </td>
                  <td>
                    <RunStatus status={s.status} />
                    {s.mock_count > 0 && (
                      <span className="mock-inline">
                        含 {s.mock_count} 个 Mock
                      </span>
                    )}
                    {s.external_count > 0 && (
                      <span className="mock-inline">
                        含 {s.external_count} 个外部回答
                      </span>
                    )}
                  </td>
                  <td>{s.run_count}</td>
                  <td>
                    {s.average_score == null ? (
                      "—"
                    ) : (
                      <b>
                        {Math.round(s.average_score)}
                        <small>/100</small>
                      </b>
                    )}
                  </td>
                  <td className="muted">
                    {new Date(s.started_at).toLocaleString("zh-CN")}
                  </td>
                  <td>
                    <ChevronRight size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="loading-panel">
            <LoaderCircle className="spin" />
            正在加载测试历史…
          </div>
        )}
        {!loading && !sessions.length && (
          <EmptyState
            icon={History}
            title="尚无测试历史"
            text="开始一场测试后，完整运行记录将在此处呈现。"
            action={
              <button
                className="button button-primary"
                onClick={() => (location.hash = "challenges")}
              >
                <Play size={14} />
                开始评测
              </button>
            }
          />
        )}
        {error && <p className="inline-error">{error}</p>}
      </div>
    </>
  );
}
function modeLabel(mode) {
  return (
    {
      single: "单题挑战",
      custom: "自定义测试",
      challenge: "综合挑战",
      random: "随机挑战",
      extreme: "极限挑战",
      stability: "稳定性测试",
      external: "外部回答评分",
    }[mode] ?? mode
  );
}

function ReportPage({ id, onBack, onNotice }) {
  const { data, error, loading, refresh } = useApi(`/api/sessions/${id}`, [id]);
  const judgesReq = useApi("/api/judges");
  const [manual, setManual] = useState({});
  const [tab, setTab] = useState("runs");
  const [judgeIds, setJudgeIds] = useState([]);
  const [judging, setJudging] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [diffMode, setDiffMode] = useState(true);
  const judges = judgesReq.data?.judges ?? [];

  const runs = data?.runs ?? [];
  const manifest = data?.session?.manifest ?? {};
  const running = data?.session?.id === id && data.session.status === "running";
  useEffect(() => {
    if (!running) return;
    let alive = true;
    let timer;
    const poll = async () => {
      await refresh();
      if (alive) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1500);
    return () => { alive = false; clearTimeout(timer); };
  }, [running, refresh]);
  const stopSession = async () => {
    setCancelling(true);
    try {
      await request(`/api/sessions/${id}/cancel`, { method: "POST", body: "{}" });
      onNotice("已发送停止请求，后续排队任务不会调用模型。");
      await refresh();
    } catch (e) {
      onNotice(e.message, "error");
    } finally {
      setCancelling(false);
    }
  };
  const real = runs.filter(
    (run) => !run.isMock && !run.isExternal && run.status === "completed" && run.score !== null,
  );
  const categoryScores = Object.entries(
    real.reduce((acc, run) => {
      acc[run.category_name] ??= [];
      acc[run.category_name].push(run.score);
      return acc;
    }, {}),
  ).map(([subject, values]) => ({
    subject,
    score: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    fullMark: 100,
  }));
  const grouped = useMemo(() => {
    const map = new Map();
    for (const run of runs) {
      if (!map.has(run.task_id))
        map.set(run.task_id, {
          taskId: run.task_id,
          title: run.task_title,
          category: run.category_name,
          difficulty: run.difficulty,
          runs: [],
        });
      map.get(run.task_id).runs.push(run);
    }
    return [...map.values()];
  }, [runs]);
  const judged = runs.filter((run) => run.evaluator_type === "ai_judge" && !run.isExternal).length;
  const unscored = runs.filter(
    (run) =>
      !run.isMock &&
      run.status === "completed" &&
      (run.score === null || run.evaluator_type !== "human") &&
      run.evaluator_type !== "ai_judge",
  );

  const judgeRun = async (runId) => {
    if (!judgeIds.length) {
      onNotice("请先选择裁判模型。", "error");
      return;
    }
    setJudging(runId);
    try {
      const result = await request(`/api/runs/${runId}/judge`, {
        method: "POST",
        body: JSON.stringify({ judgeModelIds: judgeIds }),
      });
      onNotice(
        `AI 裁判完成：${result.aggregate.overall}/100 · 分歧 ${result.aggregate.spread} 分${result.applied.applied ? "" : "（未覆盖人工评分）"}`,
      );
      refresh();
    } catch (e) {
      onNotice(e.message, "error");
    } finally {
      setJudging("");
    }
  };
  const judgeBatch = async () => {
    if (!judgeIds.length) {
      onNotice("请先选择裁判模型。", "error");
      return;
    }
    setJudging("batch");
    try {
      const result = await request(`/api/sessions/${id}/judge`, {
        method: "POST",
        body: JSON.stringify({ judgeModelIds: judgeIds, limit: 12 }),
      });
      onNotice(
        result.judged
          ? `批量裁判完成：${result.applied} 条写入评分，${result.failed} 条失败。`
          : result.note || "没有需要裁判的运行。",
        result.failed ? "error" : "success",
      );
      refresh();
    } catch (e) {
      onNotice(e.message, "error");
    } finally {
      setJudging("");
    }
  };
  const exportJson = async () => {
    const report = await request(`/api/report/${id}/export`);
    download(
      `mind-bench-report-${id.slice(0, 8)}.json`,
      JSON.stringify(report, null, 2),
    );
  };
  const exportManifest = async () => {
    const result = await request(`/api/sessions/${id}/manifest`);
    download(
      `mind-bench-manifest-${id.slice(0, 8)}.json`,
      JSON.stringify(result, null, 2),
    );
  };
  const submitScore = async (runId) => {
    try {
      await request(`/api/runs/${runId}/evaluation`, {
        method: "PUT",
        body: JSON.stringify({
          score: manual[runId],
          rationale: "用户人工复核",
        }),
      });
      onNotice("人工复核评分已保存。");
      refresh();
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  if (loading && data?.session?.id !== id)
    return (
      <div className="loading-panel">
        <LoaderCircle className="spin" />
        正在生成测试报告…
      </div>
    );
  if (error || !data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="测试报告无法载入"
        text={error}
        action={
          <button className="button button-ghost" onClick={onBack}>
            返回历史
          </button>
        }
      />
    );
  return (
    <>
      <div className="detail-back">
        <button className="text-link" onClick={onBack}>
          <ChevronLeft size={15} />
          返回测试历史
        </button>
        <span>报告 / {id.slice(0, 12)}</span>
      </div>
      <PageHeader
        eyebrow={`RUN REPORT / ${id}`}
        title={data.session.name}
        subtitle={`创建于 ${new Date(data.session.started_at).toLocaleString("zh-CN")} · ${modeLabel(data.session.mode)} · ${runs.length} 条模型运行`}
        actions={
          <>
            {running && (
              <button className="button button-ghost" onClick={stopSession} disabled={cancelling}>
                <Square size={14} />
                {cancelling ? "正在停止…" : "停止测试"}
              </button>
            )}
            <button className="button button-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              刷新报告
            </button>
            <button className="button button-ghost" onClick={exportJson}>
              <Download size={14} />
              导出 JSON
            </button>
            <button className="button button-ghost" onClick={exportManifest}>
              <ShieldCheck size={14} />
              导出清单
            </button>
            <button
              className="button button-ghost"
              onClick={() =>
                window.open(`/api/report/${id}/export?format=csv`, "_blank")
              }
            >
              <FileText size={14} />
              导出 CSV
            </button>
          </>
        }
      />
      {running && (
        <div className="panel report-progress" role="status">
          <RunStatus status={data.session.status} />
          <span>已结束 {runs.filter((run) => run.status !== "running").length} 条运行 · 报告自动刷新中</span>
        </div>
      )}
      <div className="report-kpis">
        <div className="panel">
          <span>运行任务</span>
          <b>{runs.length}</b>
        </div>
        <div className="panel">
          <span>真实完成</span>
          <b>
            {
              runs.filter((run) => !run.isMock && !run.isExternal && run.status === "completed")
                .length
            }
          </b>
        </div>
        <div className="panel">
          <span>有评分结果</span>
          <b>{real.length}</b>
        </div>
        <div className="panel">
          <span>AI 裁判覆盖</span>
          <b>
            {judged}
            <small> / {runs.filter((run) => !run.isMock && !run.isExternal).length || 0}</small>
          </b>
        </div>
        <div className="panel">
          <span>真实平均分</span>
          <b>
            {real.length
              ? formatNum(
                  Math.round(
                    real.reduce((a, run) => a + run.score, 0) / real.length,
                  ),
                )
              : "—"}
            <small>{real.length ? "/100" : ""}</small>
          </b>
        </div>
      </div>
      <section className="panel reproducibility-panel">
        <div className="reproducibility-head">
          <div>
            <div className="eyebrow"><i /> REPRODUCIBILITY MANIFEST</div>
            <h3>可复现性运行清单</h3>
            <p>本批次在启动时冻结的题目、模型、评分和环境快照；用于复跑、审计和结果对比。</p>
          </div>
          <span className="manifest-badge"><ShieldCheck size={14} /> v{manifest.manifestVersion ?? "—"}</span>
        </div>
        <div className="reproducibility-grid">
          <div><span>题目版本</span><b>{manifest.tasks?.length ?? 0} 道 · {new Set((manifest.tasks ?? []).map((task) => task.version)).size || 0} 个版本</b></div>
          <div><span>模型快照</span><b>{manifest.models?.length ?? 0} 个模型</b></div>
          <div><span>评分权重</span><b>{Object.keys(manifest.scoring?.weightSnapshot ?? {}).length} 个分类</b></div>
          <div><span>执行环境</span><b>{manifest.execution?.nodeVersion ?? "—"} · {manifest.execution?.platform ?? "—"}</b></div>
        </div>
        <div className="reproducibility-details">
          <span>评分器：{manifest.scoring?.objectiveScorer ?? "—"} · 裁判协议：{manifest.scoring?.judgeProtocol ?? "—"}</span>
          <span>完整性：{manifest.integrity?.algorithm ?? "—"} {manifest.integrity?.value ? manifest.integrity.value.slice(0, 16) : "—"}…</span>
          <span>权重快照：{Object.entries(manifest.scoring?.weightSnapshot ?? {}).slice(0, 5).map(([key, value]) => `${key}=${value}`).join(" · ") || "—"}</span>
        </div>
      </section>
      <div className="report-grid">
        <section className="panel report-chart">
          <SectionTitle
            title="能力得分分布"
            subtitle="排除模拟运行、失败及未评分结果"
          />
          {categoryScores.length ? (
            <ResponsiveContainer width="100%" height={270}>
              <RadarChart data={categoryScores}>
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "var(--text-2)", fontSize: 11 }}
                />
                <Radar
                  dataKey="score"
                  stroke="#7c9cff"
                  fill="#7c9cff"
                  fillOpacity={0.18}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    color: "var(--text)",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Target}
              title="暂无可视化得分"
              text="此批次尚无已评分的真实模型结果。"
            />
          )}
        </section>
        <section className="panel judge-panel">
          <div className="judge-head">
            <span className="integrity-icon">
              <ScrollText size={18} />
            </span>
            <div>
              <h3>AI 裁判</h3>
              <p>
                模型身份对裁判隐藏，使用题目固定
                rubric，逐维度给出分数与理由；服务端校验 JSON 结构并重算总分。
              </p>
            </div>
          </div>
          {judges.length ? (
            <>
              <div className="judge-list">
                {judges.map((judge) => (
                  <label
                    className={`judge-option ${judgeIds.includes(judge.id) ? "chosen" : ""}`}
                    key={judge.id}
                  >
                    <input
                      type="checkbox"
                      checked={judgeIds.includes(judge.id)}
                      onChange={() =>
                        setJudgeIds((current) =>
                          current.includes(judge.id)
                            ? current.filter((item) => item !== judge.id)
                            : [...current, judge.id].slice(0, 3),
                        )
                      }
                    />
                    <span>
                      <b>{judge.name}</b>
                      <small>
                        {judge.provider_name} · {judge.model_id}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="judge-actions">
                <button
                  className="button button-primary"
                  disabled={
                    !judgeIds.length || judging === "batch" || !unscored.length
                  }
                  onClick={judgeBatch}
                >
                  {judging === "batch" ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  批量裁判 {unscored.length} 条未评分运行
                </button>
                <span className="muted">
                  最多 3 位裁判 · 分歧会被记录 · 被测模型不能自评
                </span>
              </div>
            </>
          ) : (
            <div className="inline-empty">
              还没有可用的真实裁判模型。
              <button
                className="text-link"
                onClick={() => (location.hash = "providers")}
              >
                配置模型 <ArrowRight size={12} />
              </button>
            </div>
          )}
          <div className="judge-caveat">
            <AlertTriangle size={13} />
            AI
            裁判属于主观评分，不冒充客观正确率；可随时用人工评分覆盖，人工复核后不会被自动覆盖。
          </div>
        </section>
      </div>
      <div className="report-tabs">
        <button
          className={tab === "runs" ? "active" : ""}
          onClick={() => setTab("runs")}
        >
          <ScrollText size={14} />
          回答与评分
        </button>
        <button
          className={tab === "compare" ? "active" : ""}
          onClick={() => setTab("compare")}
        >
          <ArrowLeftRight size={14} />
          并排对比
        </button>
      </div>
      {tab === "runs" ? (
        <section className="report-runs">
          <SectionTitle
            title="模型回答与评分"
            subtitle="展开查看未经修改的原始回答、评分依据、裁判维度与人工复核入口。"
          />
          <div className="report-run-list">
            {runs.map((run, index) => (
              <ReportRun
                key={run.id}
                run={run}
                index={index}
                manual={manual[run.id] ?? ""}
                setManual={(value) => setManual({ ...manual, [run.id]: value })}
                onScore={() => submitScore(run.id)}
                judgeIds={judgeIds}
                judging={judging === run.id}
                onJudge={() => judgeRun(run.id)}
              />
            ))}
          </div>
        </section>
      ) : (
        <ComparisonMatrix
          grouped={grouped}
          diffMode={diffMode}
          setDiffMode={setDiffMode}
          onOpenModel={(modelId) => (location.hash = `model/${modelId}`)}
        />
      )}
      <section className="panel report-integrity report-integrity-wide">
        <span className="integrity-icon">
          <LockKeyhole size={18} />
        </span>
        <div>
          <h3>结果统计说明</h3>
          <p>
            仅将真实模型的已完成结果纳入能力平均值。规则评分、AI
            裁判和人工复核会分别标注来源；未评分的主观题不会按零分处理，模拟运行永远不参与排名。
          </p>
        </div>
        <RunStatus status={data.session.status} />
      </section>
    </>
  );
}

function ComparisonMatrix({ grouped, diffMode, setDiffMode, onOpenModel }) {
  const [pairTask, setPairTask] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const activeTask =
    grouped.find((group) => group.taskId === pairTask) ?? grouped[0];
  const models = activeTask?.runs ?? [];
  const left = models.find((run) => run.id === leftId) ?? models[0];
  const right =
    models.find((run) => run.id === rightId) ??
    models.find((run) => run.id !== left?.id);
  const segments = useMemo(
    () =>
      left && right
        ? diffSegments(
            String(left.raw_text ?? ""),
            String(right.raw_text ?? ""),
          )
        : [],
    [left?.raw_text, right?.raw_text],
  );
  if (!grouped.length)
    return (
      <div className="panel">
        <EmptyState
          icon={ArrowLeftRight}
          title="没有可对比的回答"
          text="运行一次多模型测试后，这里会按题目并列展示每个模型的原始回答。"
        />
      </div>
    );
  return (
    <section className="compare-result">
      <div className="compare-result-head">
        <SectionTitle
          title="并排回答对比"
          subtitle={`${grouped.length} 道题 · 每个模型独立保存，原文不改写`}
        />
        <div className="compare-controls">
          <select
            aria-label="选择对比题目"
            value={activeTask?.taskId ?? ""}
            onChange={(event) => setPairTask(event.target.value)}
          >
            {grouped.map((group) => (
              <option value={group.taskId} key={group.taskId}>
                {group.title}
              </option>
            ))}
          </select>
          <button
            className={`button button-small ${diffMode ? "button-primary" : "button-ghost"}`}
            onClick={() => setDiffMode(!diffMode)}
          >
            <ArrowLeftRight size={13} />
            {diffMode ? "差异高亮已开启" : "开启差异高亮"}
          </button>
        </div>
      </div>
      <div className="compare-matrix">
        {models.map((run) => (
          <article className="panel compare-cell" key={run.id}>
            <header>
              <div>
                <b>{run.model_name}</b>
                <small>
                  {run.provider_name} · {run.model_identifier ?? ""}
                </small>
              </div>
              <span
                className={`lb-score-small ${run.score === null ? "unscored" : ""}`}
              >
                {run.score === null ? "未评分" : `${formatNum(run.score)}/100`}
              </span>
            </header>
            <div className="compare-meta">
              <RunStatus status={run.isExternal ? "external" : run.isMock ? "mock" : run.status} />
              <span>
                <Clock3 size={12} />
                {run.latency_ms ? `${formatNum(run.latency_ms)} ms` : "—"}
              </span>
              <span>{formatNum(run.output_tokens)} 输出 Token</span>
              <span className="compare-source">
                {scoreSourceLabel(run.evaluator_type ?? "manual")}
              </span>
            </div>
            {run.status === "failed" ? (
              <div className="error-box">
                <AlertTriangle size={14} />
                <span>{run.error || "请求失败"}</span>
              </div>
            ) : (
              <pre className="compare-text">{run.raw_text || "（无回答）"}</pre>
            )}
            {run.verdicts?.filter((verdict) => verdict.valid).length > 0 && (
              <div className="compare-verdicts">
                {run.verdicts
                  .filter((verdict) => verdict.valid)
                  .map((verdict) => (
                    <span key={verdict.id}>
                      <Sparkles size={11} />
                      {verdict.judge_label} · {Math.round(verdict.overall)}
                    </span>
                  ))}
              </div>
            )}
            <button
              className="text-link"
              onClick={() => onOpenModel(run.model_id)}
            >
              模型详情 <ArrowRight size={12} />
            </button>
          </article>
        ))}
      </div>
      {models.length >= 2 && (
        <section className="panel diff-panel">
          <div className="diff-head">
            <div>
              <b>逐词差异</b>
              <span>
                同一道题的两个模型回答，按词/字切分对比，仅高亮差异，不修改原文。
              </span>
            </div>
            <div className="diff-pickers">
              <select
                value={left?.id ?? ""}
                onChange={(event) => setLeftId(event.target.value)}
                aria-label="选择左侧模型回答"
              >
                {models.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.model_name}
                  </option>
                ))}
              </select>
              <ArrowLeftRight size={14} />
              <select
                value={right?.id ?? ""}
                onChange={(event) => setRightId(event.target.value)}
                aria-label="选择右侧模型回答"
              >
                {models
                  .filter((run) => run.id !== left?.id)
                  .map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.model_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className={`diff-body ${diffMode ? "diff-on" : ""}`}>
            <div className="diff-column">
              <b>{left?.model_name}</b>
              <p>
                {segments.map((segment, index) =>
                  segment.type === "same" ? (
                    <span key={index}>{segment.text}</span>
                  ) : segment.side === "left" ? (
                    <mark key={index} className="diff-remove">
                      {segment.text}
                    </mark>
                  ) : null,
                )}
              </p>
            </div>
            <div className="diff-column">
              <b>{right?.model_name}</b>
              <p>
                {segments.map((segment, index) =>
                  segment.type === "same" ? (
                    <span key={index}>{segment.text}</span>
                  ) : segment.side === "right" ? (
                    <mark key={index} className="diff-add">
                      {segment.text}
                    </mark>
                  ) : null,
                )}
              </p>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

function diffSegments(left, right) {
  const tokenize = (text) =>
    text
      .split(/(\s+|(?<=[，。；：、！？])|(?=[，。；：、！？]))/u)
      .filter(Boolean);
  const a = tokenize(left.slice(0, 6000));
  const b = tokenize(right.slice(0, 6000));
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  const push = (type, side, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type && last.side === side) last.text += text;
    else out.push({ type, side, text });
  };
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", "both", a[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("change", "left", a[i]);
      i += 1;
    } else {
      push("change", "right", b[j]);
      j += 1;
    }
  }
  while (i < a.length) {
    push("change", "left", a[i]);
    i += 1;
  }
  while (j < b.length) {
    push("change", "right", b[j]);
    j += 1;
  }
  return out;
}

function ReportRun({
  run,
  index,
  manual,
  setManual,
  onScore,
  judgeIds = [],
  judging = false,
  onJudge,
}) {
  const [open, setOpen] = useState(index === 0);
  const verdict = (run.verdicts ?? []).filter((item) => item.valid);
  const selfJudge = judgeIds.includes(run.model_id);
  return (
    <article className="panel report-run">
      <button className="report-run-head" onClick={() => setOpen(!open)}>
        <span className="report-run-index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="report-run-title">
          <b>{run.model_name}</b>
          <small>
            {run.task_title} · {run.provider_name}
          </small>
        </span>
        <RunStatus status={run.isExternal ? "external" : run.isMock ? "mock" : run.status} />
        <span className="run-stat">
          <Clock3 size={13} />
          {run.latency_ms ? `${formatNum(run.latency_ms)} ms` : "—"}
        </span>
        <span className="run-stat">
          <Zap size={13} />
          {run.score === null ? "未评分" : `${formatNum(run.score)}/100`}
        </span>
        <ChevronDown className={open ? "rotated" : ""} size={16} />
      </button>
      {open && (
        <div className="report-run-body">
          {run.status === "failed" ? (
            <div className="error-box">
              <AlertTriangle size={15} />
              <span>{run.error || "模型请求失败"}</span>
            </div>
          ) : (
            <>
              <div className="response-meta">
                <span>原始模型回答</span>
                <span>
                  {run.isMock && <b className="mock-warning">模拟输出 · 不是真实成绩</b>}
                  {run.isExternal && <b className="external-warning">外部粘贴回答 · 不代表所选模型真实调用</b>}
                  <i>{formatNum(run.input_tokens)} 输入 Token</i>
                  <i>{formatNum(run.output_tokens)} 输出 Token</i>
                  <i>
                    {run.cost
                      ? `$${Number(run.cost).toFixed(6)}`
                      : "费用未配置"}
                  </i>
                </span>
              </div>
              <pre className="raw-response">
                {run.raw_text || "（无响应文本）"}
              </pre>
              {run.score !== null && (
                <div className="evaluation-box">
                  <div>
                    <b>
                      评分依据 ·{" "}
                      {scoreSourceLabel(run.evaluator_type ?? "manual")}
                      {run.judge_model ? ` · ${run.judge_model}` : ""}
                    </b>
                    <p>{run.rationale}</p>
                  </div>
                  <strong>
                    {formatNum(run.score)}
                    <small>/100</small>
                  </strong>
                </div>
              )}
              {verdict.length > 0 && (
                <div className="verdict-box">
                  <div className="verdict-head">
                    <b>
                      <Sparkles size={13} /> 裁判明细
                    </b>
                    <span>
                      {verdict.length} 位裁判 · 分歧{" "}
                      {Math.max(...verdict.map((v) => v.overall)) -
                        Math.min(...verdict.map((v) => v.overall))}{" "}
                      分
                    </span>
                  </div>
                  {verdict.map((item) => (
                    <div className="verdict-row" key={item.id}>
                      <div className="verdict-judge">
                        <b>{item.judge_label}</b>
                        <small>
                          {item.judge_model_identifier} · {item.verdict} · 置信{" "}
                          {item.confidence ?? "—"}
                        </small>
                      </div>
                      <div className="verdict-dims">
                        {item.dimensions.map((dimension) => (
                          <div className="verdict-dim" key={dimension.name}>
                            <span>{dimension.name}</span>
                            <div className="verdict-track">
                              <i style={{ width: `${dimension.score}%` }} />
                            </div>
                            <b>{dimension.score}</b>
                            {dimension.reason && (
                              <small title={dimension.reason}>
                                {dimension.reason}
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                      <strong>{Math.round(item.overall ?? 0)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {run.verdicts?.some((item) => !item.valid) && (
                <div className="verdict-invalid">
                  <AlertTriangle size={13} />
                  {run.verdicts
                    .filter((item) => !item.valid)
                    .map((item) => `${item.judge_label}: ${item.error}`)
                    .join("；")}
                </div>
              )}
              <div className="run-actions">
                {run.score === null &&
                    !run.isMock &&
                  run.status === "completed" && (
                    <div className="manual-review">
                      <label>
                        人工评分 (0—100)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={manual}
                          onChange={(event) => setManual(event.target.value)}
                        />
                      </label>
                      <button
                        className="button button-ghost"
                        disabled={
                          manual === "" ||
                          Number(manual) < 0 ||
                          Number(manual) > 100
                        }
                        onClick={onScore}
                      >
                        保存人工复核
                      </button>
                      <span>人工评分不会伪装成客观正确率。</span>
                    </div>
                  )}
                {!run.isMock && run.status === "completed" && onJudge && (
                  <div className="judge-run-action">
                    <button
                      className="button button-ghost button-small"
                      disabled={judging || selfJudge}
                      onClick={onJudge}
                      title={
                        selfJudge
                          ? "被测模型不能给自己评分"
                          : "使用报告顶部选择的裁判模型评分"
                      }
                    >
                      {judging ? (
                        <LoaderCircle className="spin" size={13} />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      {run.evaluator_type === "ai_judge"
                        ? "重新裁判"
                        : "AI 裁判"}
                    </button>
                    {selfJudge && (
                      <span className="muted">
                        该模型被选为裁判，已阻止自评
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function AnalyticsPage() {
  const { data, error, loading } = useApi("/api/analytics");
  const cats = data?.categories ?? [];
  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS / EXPERIMENT INSIGHTS"
        title="数据分析"
        subtitle="分布、运行速度与评分趋势仅使用可追溯的真实模型记录。"
        actions={
          <button
            className="button button-ghost"
            onClick={() => (location.hash = "history")}
          >
            <History size={14} />
            查看运行历史
          </button>
        }
      />
      <div className="analytics-summary">
        {[
          ["真实运行", cats.reduce((s, c) => s + (c.real_runs ?? 0), 0)],
          ["有成绩分类", cats.filter((c) => c.average_score !== null).length],
          ["覆盖分类", cats.filter((c) => c.real_runs > 0).length],
          ["评分维度", 15],
        ].map(([l, v]) => (
          <div className="panel" key={l}>
            <span>{l}</span>
            <b>{formatNum(v)}</b>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel analytics-chart">
          <SectionTitle
            title="各项能力得分"
            subtitle="类别平均分 · 0—100 · 排除 Mock 和未评分结果"
          />
          {loading ? (
            <div className="loading-panel">
              <LoaderCircle className="spin" />
            </div>
          ) : cats.some((c) => c.average_score !== null) ? (
            <ResponsiveContainer width="100%" height={310}>
              <RadarChart
                data={cats.map((c) => ({
                  subject: c.name,
                  score: c.average_score ?? 0,
                }))}
              >
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "var(--text-2)", fontSize: 10 }}
                />
                <Radar
                  dataKey="score"
                  stroke="#a78bfa"
                  fill="#8b7cf6"
                  fillOpacity={0.17}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="等待评测数据"
              text="完成真实模型评测后，会显示分项能力分析。"
            />
          )}
        </section>
        <section className="panel analytics-side">
          <SectionTitle
            title="题库难度构成"
            subtitle="已录入题目按难度等级统计"
          />
          {(() => {
            const counts = [
              {
                name: "入门",
                value: cats.reduce((s, c) => s + (c.easy_count ?? 0), 0),
                color: "#34d399",
              },
              {
                name: "进阶",
                value: cats.reduce((s, c) => s + (c.medium_count ?? 0), 0),
                color: "#76a9fa",
              },
              {
                name: "挑战",
                value: cats.reduce((s, c) => s + (c.hard_count ?? 0), 0),
                color: "#a78bfa",
              },
              {
                name: "专家",
                value: cats.reduce((s, c) => s + (c.expert_count ?? 0), 0),
                color: "#fb923c",
              },
            ];
            return (
              <>
                <div className="difficulty-chart">
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={counts}
                        dataKey="value"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={4}
                      >
                        {counts.map((c) => (
                          <Cell key={c.name} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-center">
                    <b>{formatNum(counts.reduce((s, c) => s + c.value, 0))}</b>
                    <span>道题</span>
                  </div>
                </div>
                <div className="difficulty-legend">
                  {counts.map((c) => (
                    <span key={c.name}>
                      <i style={{ background: c.color }} />
                      {c.name}
                      <b>{c.value}</b>
                    </span>
                  ))}
                </div>
              </>
            );
          })()}
        </section>
      </div>
      <section className="panel analytics-table">
        <SectionTitle
          title="分类运行明细"
          subtitle="题目覆盖与真实评测有效样本"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>能力分类</th>
                <th>题库题目</th>
                <th>真实测试</th>
                <th>平均分</th>
                <th>平均耗时</th>
                <th>平均费用</th>
                <th>数据状态</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c, i) => (
                <tr key={c.id}>
                  <td>
                    <span className="category-name-cell">
                      <span
                        className="mini-icon"
                        style={{ "--tone": palette[i % palette.length] }}
                      >
                        <Icon name={c.icon} size={14} />
                      </span>
                      <b>{c.name}</b>
                    </span>
                  </td>
                  <td>{c.task_count}</td>
                  <td>{c.real_runs}</td>
                  <td>
                    {c.average_score == null ? (
                      "—"
                    ) : (
                      <b>
                        {c.average_score}
                        <small>/100</small>
                      </b>
                    )}
                  </td>
                  <td>
                    {c.average_latency == null
                      ? "—"
                      : `${formatNum(Math.round(c.average_latency))} ms`}
                  </td>
                  <td>
                    {c.average_cost == null
                      ? "—"
                      : `$${Number(c.average_cost).toFixed(5)}`}
                  </td>
                  <td>
                    {c.real_runs ? (
                      <span className="run-status status-completed">
                        <i />
                        有运行
                      </span>
                    ) : (
                      <span className="muted">待测试</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ProvidersPage({ data, onRefresh, onNotice, onNavigate }) {
  const providers = data?.providers ?? [];
  const models = data?.models ?? [];
  const [showProvider, setShowProvider] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [busy, setBusy] = useState("");
  const [discover, setDiscover] = useState(null);
  const [providerForm, setProviderForm] = useState({
    name: "",
    kind: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
  });
  const [modelForm, setModelForm] = useState({
    providerId: "",
    name: "",
    modelId: "",
    temperature: 0,
    maxTokens: 2048,
    timeoutMs: 60000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    isDefault: false,
  });
  const saveProvider = async (e) => {
    e.preventDefault();
    try {
      await request("/api/providers", {
        method: "POST",
        body: JSON.stringify(providerForm),
      });
      setShowProvider(false);
      setProviderForm({
        name: "",
        kind: "openai-compatible",
        baseUrl: "",
        apiKey: "",
      });
      onRefresh();
      onNotice("供应商配置已加密保存。");
    } catch (err) {
      onNotice(err.message, "error");
    }
  };
  const saveModel = async (e) => {
    e.preventDefault();
    try {
      await request("/api/models", {
        method: "POST",
        body: JSON.stringify(modelForm),
      });
      setShowModel(false);
      setModelForm({
        providerId: "",
        name: "",
        modelId: "",
        temperature: 0,
        maxTokens: 2048,
        timeoutMs: 60000,
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
        isDefault: false,
      });
      onRefresh();
      onNotice("模型已添加。");
    } catch (err) {
      onNotice(err.message, "error");
    }
  };
  const testConnection = async (id) => {
    setBusy(id);
    try {
      const r = await request(`/api/models/${id}/test-connection`, {
        method: "POST",
        body: "{}",
      });
      onNotice(r.message, r.isMock ? "error" : "success");
    } catch (e) {
      onNotice(e.message, "error");
    } finally {
      setBusy("");
    }
  };
  const toggleEnabled = async (model) => {
    try {
      await request(`/api/models/${model.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !model.enabled }),
      });
      onRefresh();
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  const removeModel = async (model) => {
    if (!confirm(`删除模型“${model.name}”？已有历史记录时需要停用而不能删除。`))
      return;
    try {
      await request(`/api/models/${model.id}`, { method: "DELETE" });
      onRefresh();
      onNotice("模型已删除。");
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  const providerKinds = [
    ["openai", "OpenAI"],
    ["anthropic", "Anthropic"],
    ["gemini", "Google Gemini"],
    ["deepseek", "DeepSeek"],
    ["zhipu", "智谱 GLM"],
    ["moonshot", "Moonshot"],
    ["minimax", "MiniMax"],
    ["qwen", "通义千问"],
    ["openrouter", "OpenRouter"],
    ["ollama", "Ollama"],
    ["lmstudio", "LM Studio"],
    ["openai-compatible", "OpenAI 兼容接口"],
    ["mock", "Mock 沙盒"],
  ];
  const discoverModels = async (providerId) => {
    setDiscover({ providerId, loading: true, models: [], error: "" });
    try {
      const result = await request(`/api/providers/${providerId}/models`);
      setDiscover({
        providerId,
        loading: false,
        models: result.models ?? [],
        endpoint: result.endpoint,
        error: "",
        note: result.note,
      });
    } catch (error) {
      setDiscover({
        providerId,
        loading: false,
        models: [],
        error: error.message,
      });
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="MODEL PROVIDER CENTER / CONFIGURATION"
        title="模型管理"
        subtitle="通过服务端调用模型。API Key 采用 AES-256-GCM 加密后保存在本机数据库，不会返回前端。"
        actions={
          <>
            <button
              className="button button-ghost"
              onClick={() => setShowProvider(true)}
            >
              <Plus size={15} />
              添加供应商
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                if (!providers.length) {
                  onNotice("请先添加供应商。", "error");
                  setShowProvider(true);
                } else {
                  setModelForm({ ...modelForm, providerId: providers[0].id });
                  setShowModel(true);
                }
              }}
            >
              <Plus size={15} />
              添加模型
            </button>
          </>
        }
      />
      <div className="security-notice">
        <span>
          <LockKeyhole size={16} />
        </span>
        <div>
          <b>密钥隔离与本地存储</b>
          <p>
            密钥通过本地随机密钥（AES-256-GCM）加密后保存于
            data/。配置真实模型请保持目录权限安全，并做好密钥备份。
          </p>
        </div>
        <span className="security-check">
          <CheckCircle2 size={15} /> SERVER-SIDE ONLY
        </span>
      </div>
      {providers.length > 0 && (
        <section className="panel provider-strip">
          <div className="provider-strip-head">
            <div>
              <div className="panel-kicker">PROVIDER REGISTRY</div>
              <h2>供应商</h2>
              <span>
                查看已保存的接入端点；模型清单从供应商官方接口实时读取。
              </span>
            </div>
          </div>
          <div className="provider-strip-list">
            {providers.map((provider) => (
              <div className="provider-strip-row" key={provider.id}>
                <span
                  className="provider-avatar"
                  style={{ "--avatar-tone": providerTone(provider.kind) }}
                >
                  {provider.name.slice(0, 1)}
                </span>
                <span className="provider-strip-name">
                  <b>{provider.name}</b>
                  <small>
                    {provider.kind} · {provider.base_url || "使用默认端点"}
                  </small>
                </span>
                <span
                  className={`connection-badge ${provider.enabled ? "" : "connection-off"}`}
                >
                  <i className="live-dot" />
                  {provider.enabled ? "启用" : "停用"}
                </span>
                <span className="muted">
                  {provider.has_api_key ? "密钥已加密" : "无密钥"}
                </span>
                <button
                  className="button button-small button-ghost"
                  disabled={provider.kind === "mock"}
                  onClick={() => discoverModels(provider.id)}
                >
                  {discover?.providerId === provider.id && discover.loading ? (
                    <LoaderCircle className="spin" size={13} />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  获取模型列表
                </button>
              </div>
            ))}
          </div>
          {discover && !discover.loading && (
            <div className="discover-box">
              {discover.error ? (
                <div className="error-box">
                  <AlertTriangle size={14} />
                  <span>{discover.error}</span>
                </div>
              ) : (
                <>
                  <div className="discover-head">
                    <b>可用模型 · {discover.models.length}</b>
                    <span>{discover.endpoint}</span>
                  </div>
                  {discover.models.length ? (
                    <div className="discover-chips">
                      {discover.models.slice(0, 60).map((item) => (
                        <button
                          key={item.id}
                          className="discover-chip"
                          onClick={() => {
                            setModelForm({
                              ...modelForm,
                              providerId: discover.providerId,
                              name: item.name || item.id,
                              modelId: item.id,
                            });
                            setShowModel(true);
                          }}
                        >
                          {item.id}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">
                      {discover.note || "供应商没有返回模型。"}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}
      <SectionTitle
        title="已配置模型"
        subtitle={`${models.length} 个模型 · 支持多供应商并行测试`}
      />
      {models.length ? (
        <div className="provider-model-grid">
          {models.map((model) => (
            <article
              className={`panel provider-model-card ${!model.enabled ? "model-disabled" : ""}`}
              key={model.id}
            >
              <div className="provider-card-top">
                <div
                  className="provider-avatar provider-avatar-large"
                  style={{ "--avatar-tone": providerTone(model.provider_kind) }}
                >
                  {model.name.slice(0, 1)}
                </div>
                <span
                  className={`connection-badge ${model.enabled && model.provider_enabled ? "" : "connection-off"}`}
                >
                  <i className="live-dot" />
                  {model.enabled && model.provider_enabled
                    ? "已启用"
                    : "已停用"}
                </span>
                <button
                  className="icon-button more-button"
                  title="删除模型"
                  onClick={() => removeModel(model)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <h3>
                {model.name}{" "}
                {Boolean(model.is_default) && (
                  <span className="default-label">DEFAULT</span>
                )}
              </h3>
              <div className="model-provider-line">
                {model.provider_name}
                <span>·</span>
                {model.model_id}
              </div>
              <div className="model-params">
                <span>
                  <i>temperature</i>
                  <b>{model.temperature}</b>
                </span>
                <span>
                  <i>max tokens</i>
                  <b>{formatNum(model.max_tokens)}</b>
                </span>
                <span>
                  <i>timeout</i>
                  <b>{model.timeout_ms / 1000}s</b>
                </span>
              </div>
              <div className="provider-card-foot">
                <span>
                  {model.has_api_key ? (
                    <>
                      <LockKeyhole size={12} />
                      密钥已加密配置
                    </>
                  ) : model.provider_kind === "mock" ? (
                    <>
                      <AlertTriangle size={12} />
                      模拟模式 · 不计入排名
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} />
                      未配置密钥
                    </>
                  )}
                </span>
                <div>
                  <button
                    className="button button-small button-ghost"
                    onClick={() => onNavigate?.("model", model.id)}
                  >
                    <Cpu size={13} />
                    详情
                  </button>
                  <button
                    className="button button-small button-ghost"
                    disabled={
                      busy === model.id || model.provider_kind === "mock"
                    }
                    onClick={() => testConnection(model.id)}
                  >
                    {busy === model.id ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : (
                      <Zap size={13} />
                    )}
                    测试连接
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => toggleEnabled(model)}
                    title={model.enabled ? "停用模型" : "启用模型"}
                  >
                    {model.enabled ? <Square size={14} /> : <Check size={14} />}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            icon={Atom}
            title="还没有添加真实模型"
            text="通过 OpenAI 兼容接口或任意已支持供应商添加模型。真实 API Key 不会离开本机服务端。"
            action={
              <button
                className="button button-primary"
                onClick={() => setShowProvider(true)}
              >
                <Plus size={14} />
                添加供应商
              </button>
            }
          />
        </div>
      )}
      <div className="provider-guides">
        <div className="panel">
          <span className="guide-number">01</span>
          <b>供应商 API</b>
          <p>
            OpenAI、Anthropic、Google
            Gemini、DeepSeek、智谱、Moonshot、MiniMax、Qwen、OpenRouter 和兼容
            API。
          </p>
        </div>
        <div className="panel">
          <span className="guide-number">02</span>
          <b>本地推理服务</b>
          <p>
            支持 Ollama 和 LM Studio。它们默认使用本机 HTTP 接口，不需要云端 API
            Key。
          </p>
        </div>
        <div className="panel">
          <span className="guide-number">03</span>
          <b>成本与复现</b>
          <p>
            配置输入/输出每百万 Token 单价。每次运行保存模型标识、参数、Token
            数和耗时。
          </p>
        </div>
      </div>
      {showProvider && (
        <Modal title="添加模型供应商" onClose={() => setShowProvider(false)}>
          <form className="form-stack" onSubmit={saveProvider}>
            <label className="field">
              <span>供应商名称</span>
              <input
                required
                value={providerForm.name}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, name: e.target.value })
                }
                placeholder="例如：公司 OpenAI 代理"
              />
            </label>
            <label className="field">
              <span>供应商类型</span>
              <select
                value={providerForm.kind}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, kind: e.target.value })
                }
              >
                {providerKinds.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {providerForm.kind !== "mock" && (
              <>
                <label className="field">
                  <span>API Base URL</span>
                  <input
                    value={providerForm.baseUrl}
                    onChange={(e) =>
                      setProviderForm({
                        ...providerForm,
                        baseUrl: e.target.value,
                      })
                    }
                    placeholder={
                      providerForm.kind === "ollama"
                        ? "http://127.0.0.1:11434/v1"
                        : "https://api.example.com/v1"
                    }
                  />
                </label>
                {!["ollama", "lmstudio"].includes(providerForm.kind) && (
                  <label className="field">
                    <span>
                      API Key <i>仅保存密文，不会返回</i>
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={providerForm.apiKey}
                      onChange={(e) =>
                        setProviderForm({
                          ...providerForm,
                          apiKey: e.target.value,
                        })
                      }
                    />
                  </label>
                )}
              </>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowProvider(false)}
              >
                取消
              </button>
              <button className="button button-primary" type="submit">
                <LockKeyhole size={14} />
                加密保存
              </button>
            </div>
          </form>
        </Modal>
      )}
      {showModel && (
        <Modal title="添加模型" onClose={() => setShowModel(false)}>
          <form className="form-stack" onSubmit={saveModel}>
            <label className="field">
              <span>供应商</span>
              <select
                required
                value={modelForm.providerId}
                onChange={(e) =>
                  setModelForm({ ...modelForm, providerId: e.target.value })
                }
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.kind}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-discover">
              <button
                type="button"
                className="text-link"
                onClick={() => discoverModels(modelForm.providerId)}
              >
                <RefreshCw size={13} />
                从供应商接口获取模型列表
              </button>
              {discover?.providerId === modelForm.providerId &&
                discover.models?.length > 0 && (
                  <select
                    aria-label="选择供应商返回的模型"
                    value={modelForm.modelId}
                    onChange={(event) => {
                      const picked = discover.models.find(
                        (item) => item.id === event.target.value,
                      );
                      setModelForm({
                        ...modelForm,
                        modelId: event.target.value,
                        name: picked?.name || event.target.value,
                      });
                    }}
                  >
                    <option value="">选择模型 ID…</option>
                    {discover.models.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id}
                      </option>
                    ))}
                  </select>
                )}
              {discover?.providerId === modelForm.providerId &&
                discover.error && (
                  <span className="inline-error">{discover.error}</span>
                )}
            </div>
            <label className="field">
              <span>模型显示名称</span>
              <input
                required
                value={modelForm.name}
                onChange={(e) =>
                  setModelForm({ ...modelForm, name: e.target.value })
                }
                placeholder="例如 GPT-4o"
              />
            </label>
            <label className="field">
              <span>
                模型 ID <i>由供应商定义</i>
              </span>
              <input
                required
                value={modelForm.modelId}
                onChange={(e) =>
                  setModelForm({ ...modelForm, modelId: e.target.value })
                }
                placeholder="gpt-4o-mini"
              />
            </label>
            <div className="form-two">
              <label className="field">
                <span>温度</span>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={modelForm.temperature}
                  onChange={(e) =>
                    setModelForm({
                      ...modelForm,
                      temperature: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>最大输出 Token</span>
                <input
                  type="number"
                  min="1"
                  max="32768"
                  value={modelForm.maxTokens}
                  onChange={(e) =>
                    setModelForm({
                      ...modelForm,
                      maxTokens: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="form-two">
              <label className="field">
                <span>输入成本 / 百万 Token ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modelForm.inputCostPerMillion}
                  onChange={(e) =>
                    setModelForm({
                      ...modelForm,
                      inputCostPerMillion: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>输出成本 / 百万 Token ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modelForm.outputCostPerMillion}
                  onChange={(e) =>
                    setModelForm({
                      ...modelForm,
                      outputCostPerMillion: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={modelForm.isDefault}
                onChange={(e) =>
                  setModelForm({ ...modelForm, isDefault: e.target.checked })
                }
              />
              设为默认模型
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowModel(false)}
              >
                取消
              </button>
              <button type="submit" className="button button-primary">
                <Plus size={14} />
                添加模型
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ImportPage({ categories, onNotice, onRefresh }) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dataset, setDataset] = useState({
    sourceName: "",
    sourceUrl: "",
    license: "",
    categoryId: categories[0]?.id ?? "logic",
    content: "",
    format: "auto",
  });
  const [datasetResult, setDatasetResult] = useState(null);
  const importDataset = async () => {
    if (!dataset.license.trim()) {
      onNotice("必须填写数据集许可证后才能导入。", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await request("/api/tasks/import-dataset", {
        method: "POST",
        body: JSON.stringify(dataset),
      });
      setDatasetResult(response);
      onRefresh();
      onNotice(
        `数据集导入 ${response.imported} 条${response.failed ? `，${response.failed} 条失败` : ""}。`,
        response.failed ? "error" : "success",
      );
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file) => {
    try {
      setRaw(await file.text());
      setResult(null);
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  const importJson = async () => {
    try {
      const parsed = JSON.parse(raw);
      setBusy(true);
      const response = await request("/api/tasks/import", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      setResult(response);
      onRefresh();
      onNotice(
        `成功导入 ${response.imported} 道题目${response.errors.length ? `，${response.errors.length} 条失败` : ""}`,
        response.errors.length ? "error" : "success",
      );
    } catch (e) {
      onNotice(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const template = {
    title: "示例：条件推理",
    categoryId: categories[0]?.id ?? "logic",
    subcategory: "逻辑判断",
    difficulty: "medium",
    promptZh: "在此填写完整测试提示词。",
    promptEn: "Optional original English prompt.",
    sourceName: "您的合法来源",
    sourceUrl: "https://example.org/dataset",
    license: "CC BY 4.0 / 待核验",
    sourceType: "user",
    objective: "说明该题实际测量的能力。",
    referenceAnswer: "参考答案或评分说明。",
    scoringRule: { method: "manual" },
    scoringDimensions: [],
    commonErrors: [],
    notes: "核实题目许可及来源后再导入。",
    version: "1.0.0",
    verificationStatus: "user",
    isPublic: true,
  };
  return (
    <>
      <PageHeader
        eyebrow="BENCHMARK DATA / IMPORT & EXPORT"
        title="题库导入与导出"
        subtitle="通过 JSON 扩展题库；保留来源、许可证和评分规则元数据，避免无许可再分发。"
        actions={
          <button
            className="button button-ghost"
            onClick={() =>
              fetch("/api/tasks/export")
                .then((r) => r.json())
                .then((d) =>
                  download("mind-bench-tasks.json", JSON.stringify(d, null, 2)),
                )
                .catch((e) => onNotice(e.message, "error"))
            }
          >
            <Download size={14} />
            导出现有题库
          </button>
        }
      />
      <div className="import-warning">
        <AlertTriangle size={17} />
        <div>
          <b>导入前请核查授权和内容</b>
          <p>
            导入不代表题目已获许可证授权。对外分发前核实原始数据集许可；用户与第三方题目会单独标注来源。
          </p>
        </div>
      </div>
      <div className="import-layout">
        <section className="panel import-editor">
          <div className="panel-head">
            <div>
              <div className="panel-kicker">JSON BENCHMARK SCHEMA</div>
              <h2>导入测试题</h2>
              <span>最多一次导入 1,000 道，单次可导入 JSON 数组或对象。</span>
            </div>
            <label className="button button-ghost file-pick">
              <Upload size={14} />
              选择 JSON 文件
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) =>
                  e.target.files?.[0] && upload(e.target.files[0])
                }
              />
            </label>
          </div>
          <textarea
            className="json-editor"
            aria-label="JSON 题库导入内容"
            spellCheck="false"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={JSON.stringify([template], null, 2)}
          />
          <div className="import-editor-foot">
            <button
              className="button button-ghost"
              onClick={() => setRaw(JSON.stringify([template], null, 2))}
            >
              载入结构示例
            </button>
            <button
              className="button button-primary"
              disabled={!raw.trim() || busy}
              onClick={importJson}
            >
              {busy ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Database size={14} />
              )}
              验证并导入
            </button>
          </div>
          {result && (
            <div className="import-result">
              <CheckCircle2 size={15} />
              <span>
                已导入 <b>{result.imported}</b> 道
              </span>
              {result.errors.map((e) => (
                <span className="inline-error" key={e.index}>
                  第 {e.index + 1} 项：{e.error}
                </span>
              ))}
            </div>
          )}
        </section>
        <aside className="import-side">
          <div className="panel schema-panel">
            <div className="panel-kicker">REQUIRED FIELDS</div>
            <h3>题目数据规范</h3>
            {[
              ["title", "测试名称"],
              ["categoryId", "15个分类之一"],
              ["promptZh", "完整中文提示词"],
              [
                "sourceType",
                "original / public / community / ai_verified / user",
              ],
              ["sourceName + license", "来源名称与许可"],
              ["objective + scoringRule", "测试目标和评分规则"],
            ].map(([a, b]) => (
              <div key={a}>
                <code>{a}</code>
                <span>{b}</span>
              </div>
            ))}
            <button
              className="text-link"
              onClick={() =>
                download(
                  "mind-bench-task-template.json",
                  JSON.stringify([template], null, 2),
                )
              }
            >
              <Download size={13} />
              下载 JSON 模板
            </button>
          </div>
          <div className="panel import-notes">
            <BookOpen size={17} />
            <b>来源标签不可省略</b>
            <p>
              题库将分别标记自主设计、公开基准、开源社区、人工验证的 AI
              辅助生成及用户添加数据。未知许可证默认标为待核验。
            </p>
            <button
              className="text-link"
              onClick={() => (location.hash = "research")}
            >
              查看来源指南 <ArrowRight size={13} />
            </button>
          </div>
        </aside>
      </div>
      <section className="panel dataset-import">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">EXTERNAL DATASET ADAPTER</div>
            <h2>外部数据集导入（JSONL / CSV）</h2>
            <span>
              用于合法获取的公开数据集（如带许可证的问答/选择题数据）。字段自动识别
              question、answer、choices、category 等常见命名。
            </span>
          </div>
        </div>
        <div className="dataset-form">
          <div className="form-two">
            <label className="field">
              <span>数据集名称</span>
              <input
                value={dataset.sourceName}
                onChange={(event) =>
                  setDataset({ ...dataset, sourceName: event.target.value })
                }
                placeholder="例如：公开数学应用题数据集 v1"
              />
            </label>
            <label className="field">
              <span>来源链接</span>
              <input
                value={dataset.sourceUrl}
                onChange={(event) =>
                  setDataset({ ...dataset, sourceUrl: event.target.value })
                }
                placeholder="https://…"
              />
            </label>
          </div>
          <div className="form-two">
            <label className="field">
              <span>
                许可证 <b className="field-required">必填</b>
              </span>
              <input
                value={dataset.license}
                onChange={(event) =>
                  setDataset({ ...dataset, license: event.target.value })
                }
                placeholder="例如：CC BY 4.0 / MIT / Apache-2.0"
              />
            </label>
            <label className="field">
              <span>默认分类（记录无 category 时使用）</span>
              <select
                value={dataset.categoryId}
                onChange={(event) =>
                  setDataset({ ...dataset, categoryId: event.target.value })
                }
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>
              数据内容 <i>JSONL 每行一个对象，或带表头的 CSV</i>
            </span>
            <textarea
              className="code-area"
              rows={8}
              value={dataset.content}
              onChange={(event) =>
                setDataset({ ...dataset, content: event.target.value })
              }
              placeholder={
                '{"question":"…","answer":"…","category":"math"}\n{"question":"…","answer":"…"}'
              }
            />
          </label>
          <div className="dataset-actions">
            <label className="button button-ghost file-pick">
              <Upload size={14} />
              选择文件（.jsonl / .csv）
              <input
                type="file"
                accept=".jsonl,.json,.csv,text/plain"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setDataset({
                      ...dataset,
                      content: await file.text(),
                      sourceName: dataset.sourceName || file.name,
                    });
                  }
                }}
              />
            </label>
            <button
              className="button button-primary"
              disabled={busy || !dataset.content.trim()}
              onClick={importDataset}
            >
              {busy ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Database size={14} />
              )}
              导入数据集
            </button>
          </div>
          {datasetResult && (
            <div className="import-result">
              <CheckCircle2 size={15} />
              <span>
                已导入 <b>{datasetResult.imported}</b> 条 · 格式{" "}
                {datasetResult.detected} · 来源 {datasetResult.sourceName}（
                {datasetResult.license}）
              </span>
              {datasetResult.errors.slice(0, 5).map((error) => (
                <span className="inline-error" key={error.index}>
                  第 {error.index + 1} 行：{error.error}
                </span>
              ))}
            </div>
          )}
          <p className="dataset-warning">
            <AlertTriangle size={13} />
            导入的题目会被标记为“外部导入 ·
            未验证”，不会自动变成权威基准；请在报告中复核答案与许可证，并对再分发负责。
          </p>
        </div>
      </section>
    </>
  );
}

function ResearchPage() {
  const docs = [
    [
      "OPEN_SOURCE_RESEARCH",
      "开源评测项目研究",
      "指定框架的真实实现、接口与许可梳理。",
      "docs/OPEN_SOURCE_RESEARCH.md",
      FileText,
    ],
    [
      "BENCHMARK_METHODOLOGY",
      "评测方法与复现原则",
      "评分、运行记录、版本冻结和 MIND BENCH SCORE 说明。",
      "docs/BENCHMARK_METHODOLOGY.md",
      FlaskConical,
    ],
    [
      "PROMPT_DATA_SOURCES",
      "提示词数据来源与许可",
      "哪些数据可以内置、哪些必须以适配器或授权导入。",
      "docs/PROMPT_DATA_SOURCES.md",
      Database,
    ],
    [
      "ARCHITECTURE",
      "系统架构",
      "应用边界、SQLite 数据模型和模型调用数据流。",
      "docs/ARCHITECTURE.md",
      Workflow,
    ],
    [
      "SCORING_GUIDE",
      "评分指南",
      "规则评分、人工评分和未来裁判评分的适用范围。",
      "docs/SCORING_GUIDE.md",
      Target,
    ],
    [
      "USER_GUIDE",
      "用户指南",
      "题库浏览、模型接入、对比运行和结果导出。",
      "docs/USER_GUIDE.md",
      BookOpen,
    ],
  ];
  return (
    <>
      <PageHeader
        eyebrow="RESEARCH DESK / OPEN SCIENCE"
        title="研究资料"
        subtitle="以官方仓库与一手配置为优先来源；项目代码许可证与基准数据许可证分开核查。"
      />
      <div className="research-banner">
        <div className="research-orbit">
          <Atom size={22} />
        </div>
        <div>
          <span className="panel-kicker">REPRODUCIBLE EVALUATION</span>
          <h2>可复现，先于排行榜</h2>
          <p>
            一条可信的成绩必须关联题目与版本、模型标识、运行参数、评分器、原始输出及数据许可证。
          </p>
        </div>
      </div>
      <div className="research-doc-grid">
        {docs.map(([slug, title, desc, path, Glyph]) => (
          <a
            className="panel research-doc"
            href={path}
            key={slug}
            target="_blank"
          >
            <span className="research-doc-icon">
              <Glyph size={18} />
            </span>
            <span className="research-doc-meta">
              <small>{slug}</small>
              <b>{title}</b>
              <i>{desc}</i>
            </span>
            <ExternalLink size={14} />
          </a>
        ))}
      </div>
      <section className="panel research-source-panel">
        <SectionTitle
          title="参考框架"
          subtitle="研究实现思路，不复制未授权基准数据。"
        />
        <div className="source-grid">
          {[
            [
              "lm-evaluation-harness",
              "EleutherAI",
              "统一任务 YAML、模型请求接口与指标注册。",
              "https://github.com/EleutherAI/lm-evaluation-harness",
            ],
            [
              "OpenAI Evals",
              "OpenAI",
              "Registry、eval/solver/grader 分层。",
              "https://github.com/openai/evals",
            ],
            [
              "promptfoo",
              "promptfoo",
              "声明式测试用例、provider 与 CI 回归。",
              "https://github.com/promptfoo/promptfoo",
            ],
            [
              "HELM",
              "Stanford CRFM",
              "Scenario、model adapter、run spec 与 metrics 解耦。",
              "https://github.com/stanford-crfm/helm",
            ],
            [
              "LightEval",
              "Hugging Face",
              "任务定义、指标与多后端评估框架。",
              "https://github.com/huggingface/lighteval",
            ],
            [
              "BIG-bench",
              "Google Research",
              "多样化挑战任务集合；各任务许可需分别核验。",
              "https://github.com/google/BIG-bench",
            ],
            [
              "ARC-AGI",
              "ARC Prize",
              "抽象推理挑战；数据使用限制须按仓库条款核实。",
              "https://github.com/arcprize/ARC-AGI",
            ],
            [
              "AI Evaluation Tools",
              "aglio-lab",
              "社区评估工具目录，需逐项目审核质量和许可。",
              "https://github.com/aglio-lab/ai-evaluation-tools",
            ],
          ].map(([name, org, desc, url]) => (
            <a href={url} target="_blank" rel="noreferrer" key={name}>
              <span>
                <Globe2 size={14} />
              </span>
              <b>{name}</b>
              <small>{org}</small>
              <p>{desc}</p>
              <ExternalLink size={12} />
            </a>
          ))}
        </div>
        <div className="research-method-note">
          <AlertTriangle size={15} />
          <span>
            框架许可证不能替代题目/数据集许可证。外部 benchmark
            只有在确认可再分发授权后才能内置；否则须使用官方下载或用户自行导入。
          </span>
        </div>
      </section>
    </>
  );
}

function UpdateBanner({ status, dismissed, onRefresh, onDismiss }) {
  if (!status.available || dismissed) return null;
  return (
    <div className="update-banner" role="status">
      <div className="update-banner-icon">
        <RefreshCw size={16} />
      </div>
      <div className="update-banner-copy">
        <b>发现新的 MIND BENCH 部署</b>
        <span>
          当前 {status.currentVersion} · 新版本 {status.serverVersion}。刷新页面后加载新版本，当前运行中的测试不会被中断。
        </span>
      </div>
      <button className="button button-primary button-small" onClick={onRefresh}>
        立即刷新
      </button>
      <button className="icon-button" aria-label="稍后提醒" title="稍后提醒" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}

function SettingsPage({ onNotice, theme, setTheme, updateStatus, checkForUpdate }) {
  const { data, refresh } = useApi("/api/settings");
  const [audit, setAudit] = useState([]);
  useEffect(() => {
    request("/api/audit")
      .then(setAudit)
      .catch(() => {});
  }, []);
  const [weights, setWeights] = useState(null);
  const [minRuns, setMinRuns] = useState(10);
  useEffect(() => {
    if (data?.settings?.score_weights) setWeights(data.settings.score_weights);
  }, [data]);
  useEffect(() => {
    const raw = data?.settings?.minimum_leaderboard_runs;
    const value = Number(raw?.value ?? raw);
    if (Number.isFinite(value) && value > 0) setMinRuns(value);
  }, [data]);
  const save = async () => {
    try {
      await request("/api/settings/score_weights", {
        method: "PUT",
        body: JSON.stringify({ value: weights }),
      });
      onNotice("评分权重已保存，排行榜会按新权重重算。");
      refresh();
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  const saveMinRuns = async () => {
    try {
      await request("/api/settings/minimum_leaderboard_runs", {
        method: "PUT",
        body: JSON.stringify({ value: Math.max(1, Number(minRuns) || 10) }),
      });
      onNotice("排行榜准入样本数已保存。");
      refresh();
    } catch (e) {
      onNotice(e.message, "error");
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="SYSTEM CONFIGURATION / LOCAL INSTANCE"
        title="系统设置"
        subtitle="个人本地实例 · SQLite 持久化 · API 服务绑定 127.0.0.1。"
      />
      <div className="settings-grid">
        <section className="panel settings-panel update-settings-panel">
          <div className="settings-section-head">
            <span className="settings-icon green-settings">
              <RefreshCw size={17} />
            </span>
            <div>
              <b>版本与更新</b>
              <small>Web 部署通过 GitHub Actions 发布，浏览器检测到新构建后提示刷新</small>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <b>当前版本</b>
              <span>{updateStatus.currentVersion} · 构建 {updateStatus.currentBuildId}</span>
            </div>
            <span className="run-status status-completed"><i />稳定通道</span>
          </div>
          <div className="setting-row">
            <div>
              <b>{updateStatus.available ? "发现 " + updateStatus.serverVersion : "更新状态"}</b>
              <span>
                {updateStatus.error
                  ? "检查失败：" + updateStatus.error
                  : updateStatus.available
                    ? "新构建已部署，刷新后加载；不会自动下载或中断正在运行的测试。"
                    : updateStatus.checkedAt
                      ? "已检查：" + new Date(updateStatus.checkedAt).toLocaleString("zh-CN")
                      : "尚未检查"}
              </span>
            </div>
            <button className="button button-small button-ghost" onClick={checkForUpdate} disabled={updateStatus.checking}>
              <RefreshCw size={12} className={updateStatus.checking ? "spin" : ""} />
              {updateStatus.checking ? "检查中" : "检查更新"}
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="settings-section-head">
            <span className="settings-icon">
              <Settings2 size={17} />
            </span>
            <div>
              <b>应用外观</b>
              <small>调整主题以适应工作环境</small>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <b>界面主题</b>
              <span>
                当前主题：{theme === "dark" ? "深色实验室" : "浅色工作台"}
              </span>
            </div>
            <button
              className="theme-choice"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              切换主题
            </button>
          </div>
          <div className="setting-row">
            <div>
              <b>模型并发上限</b>
              <span>为避免供应商限流，并发数量有上限</span>
            </div>
            <code>{data?.concurrencyLimit ?? 4} 并发</code>
          </div>
          <div className="setting-row">
            <div>
              <b>数据存储</b>
              <span>本机 SQLite，数据库和密钥位于 data/</span>
            </div>
            <code>WAL · FK ON</code>
          </div>
          <div className="setting-row">
            <div>
              <b>密钥加密</b>
              <span>AES-256-GCM · data/.key</span>
            </div>
            <span className="run-status status-completed">
              <i />
              已启用
            </span>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="settings-section-head">
            <span className="settings-icon purple-settings">
              <Target size={17} />
            </span>
            <div>
              <b>排行榜准入标准</b>
              <small>只影响计算，不会改写历史运行数据</small>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <b>正式排名最小样本数</b>
              <span>未达门槛展示为预备排名</span>
            </div>
            <div className="setting-inline">
              <input
                aria-label="最小样本数"
                type="number"
                min="1"
                max="500"
                value={minRuns}
                onChange={(event) => setMinRuns(Number(event.target.value))}
              />
              <button
                className="button button-small button-ghost"
                onClick={saveMinRuns}
              >
                <Check size={12} />
                保存
              </button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <b>综合指数名称</b>
              <span>平台自定义，不是人类心理测量</span>
            </div>
            <code>MIND BENCH SCORE / 1000</code>
          </div>
          <div className="setting-row">
            <div>
              <b>可评分结果</b>
              <span>无评分题不按零分纳入综合分</span>
            </div>
            <span className="run-status status-completed">
              <i />
              已启用
            </span>
          </div>
        </section>
        <section className="panel settings-panel scoring-settings">
          <div className="settings-section-head">
            <span className="settings-icon orange-settings">
              <BarChart3 size={17} />
            </span>
            <div>
              <b>能力权重</b>
              <small>为综合 MIND BENCH SCORE 设置类别权重</small>
            </div>
          </div>
          <div className="weight-grid">
            {categoriesMeta.map(([id, name]) => (
              <label key={id}>
                <span>{name}</span>
                <input
                  aria-label={`${name} 权重`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={weights?.[id] ?? 1}
                  onChange={(e) =>
                    setWeights({
                      ...weights,
                      [id]: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="setting-row weight-save-row">
            <span>权重为 0 的分类不会计入综合指数。未评分题目始终排除。</span>
            <button
              className="button button-primary button-small"
              onClick={save}
              disabled={!weights}
            >
              <Check size={13} />
              保存权重
            </button>
          </div>
        </section>
        <section className="panel settings-panel audit-panel">
          <div className="settings-section-head">
            <span className="settings-icon green-settings">
              <History size={17} />
            </span>
            <div>
              <b>审计日志</b>
              <small>本地配置变更与题库操作记录</small>
            </div>
          </div>
          {audit.length ? (
            audit.slice(0, 8).map((row) => (
              <div className="audit-row" key={row.id}>
                <span>{row.action}</span>
                <b>{row.entity_type}</b>
                <code>{row.entity_id || "—"}</code>
                <time>{timeAgo(row.created_at)}</time>
              </div>
            ))
          ) : (
            <div className="audit-empty">尚无系统审计事件。</div>
          )}
        </section>
      </div>
    </>
  );
}

function emptyDraft(categoryId = "logic") {
  return {
    title: "",
    categoryId,
    subcategory: "",
    difficulty: "medium",
    promptZh: "",
    promptEn: "",
    objective: "",
    referenceAnswer: "",
    notes: "自建题目：请注明来源与许可证；未经验证不得标记为权威基准。",
    method: "manual",
    methodTarget: "",
    keywords: "",
    pattern: "",
    maxWords: 80,
    dimensions: [
      { name: "任务完成度", weight: 2 },
      { name: "推理与约束遵循", weight: 1 },
    ],
    isPublic: true,
  };
}
const scoringMethods = [
  ["manual", "人工评分 / AI 裁判"],
  ["exact", "精确匹配"],
  ["one_of", "多选一精确匹配"],
  ["contains", "包含文本"],
  ["all_keywords", "包含全部关键词"],
  ["any_keywords", "包含任一关键词"],
  ["numeric", "数值匹配（可多值）"],
  ["regex", "正则匹配"],
  ["json", "JSON 结构"],
  ["word_limit", "字数上限"],
];
function buildRule(draft) {
  const list = (value) =>
    String(value ?? "")
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  switch (draft.method) {
    case "exact":
      return { method: "exact", target: draft.methodTarget };
    case "one_of":
      return { method: "one_of", targets: list(draft.methodTarget) };
    case "contains":
      return { method: "contains", target: draft.methodTarget };
    case "all_keywords":
    case "any_keywords":
      return { method: draft.method, keywords: list(draft.keywords) };
    case "numeric": {
      const targets = list(draft.methodTarget)
        .map(Number)
        .filter(Number.isFinite);
      return { method: "numeric", targets };
    }
    case "regex":
      return { method: "regex", pattern: draft.pattern, flags: "i" };
    case "json":
      return {
        method: "json",
        requiredKeys: list(draft.methodTarget),
      };
    case "word_limit":
      return { method: "word_limit", max: Number(draft.maxWords) || 80 };
    default:
      return { method: "manual" };
  }
}
function draftFromTask(task) {
  const rule = task.scoring_rule ?? {};
  const join = (value) =>
    Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return {
    ...emptyDraft(task.category_id),
    title: task.title,
    categoryId: task.category_id,
    subcategory: task.subcategory,
    difficulty: task.difficulty,
    promptZh: task.prompt_zh,
    promptEn: task.prompt_en ?? "",
    objective: task.objective,
    referenceAnswer: task.reference_answer,
    notes: task.notes,
    method: rule.method ?? "manual",
    methodTarget:
      rule.target ??
      (Array.isArray(rule.targets)
        ? rule.targets.join(", ")
        : Array.isArray(rule.requiredKeys)
          ? rule.requiredKeys.join(", ")
          : ""),
    keywords: join(rule.keywords),
    pattern: rule.pattern ?? "",
    maxWords: rule.max ?? 80,
    dimensions:
      (task.scoring_dimensions ?? []).length > 0
        ? task.scoring_dimensions.map((item) => ({
            name: item.name,
            weight: Number(item.weight) || 1,
          }))
        : emptyDraft().dimensions,
    isPublic: task.is_public === undefined ? true : Boolean(task.is_public),
  };
}

function PromptLab({ focusId, categories, onNotice, onOpenTask, onRefresh }) {
  const { data, loading, refresh } = useApi("/api/custom-tasks");
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft());
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState([]);
  const tasks = data?.tasks ?? [];
  const active = tasks.find((task) => task.id === (activeId || focusId));

  useEffect(() => {
    if (!tasks.length) return;
    const target = tasks.find((task) => task.id === focusId) ?? tasks[0];
    if (target && !activeId) {
      setActiveId(target.id);
      setDraft(draftFromTask(target));
    }
  }, [tasks.length, focusId]);
  useEffect(() => {
    if (!focusId || !tasks.length) return;
    const target = tasks.find((task) => task.id === focusId);
    if (target) {
      setActiveId(target.id);
      setDraft(draftFromTask(target));
    }
  }, [focusId, tasks.length]);
  const selectTask = async (task) => {
    setActiveId(task.id);
    setCreating(false);
    setDraft(draftFromTask(task));
    try {
      setVersions(await request(`/api/tasks/${task.id}/versions`));
    } catch {
      setVersions([]);
    }
  };
  const startNew = () => {
    setCreating(true);
    setActiveId("");
    setVersions([]);
    setDraft(emptyDraft(categories[0]?.id ?? "logic"));
  };
  const save = async () => {
    if (
      !draft.title.trim() ||
      !draft.promptZh.trim() ||
      !draft.subcategory.trim()
    ) {
      onNotice("标题、子分类和提示词为必填项。", "error");
      return;
    }
    setSaving(true);
    const payload = {
      title: draft.title,
      categoryId: draft.categoryId,
      subcategory: draft.subcategory,
      difficulty: draft.difficulty,
      promptZh: draft.promptZh,
      promptEn: draft.promptEn,
      objective: draft.objective || "用户自建测试题，用于测量所选能力。",
      referenceAnswer: draft.referenceAnswer,
      scoringRule: buildRule(draft),
      scoringDimensions: draft.dimensions.filter((item) => item.name.trim()),
      notes: draft.notes,
      isPublic: draft.isPublic,
      changeNote: "提示词工作台编辑",
    };
    try {
      if (creating || !activeId) {
        const created = await request("/api/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onNotice("自建题目已创建。");
        setCreating(false);
        setActiveId(created.task.id);
        setDraft(draftFromTask(created.task));
      } else {
        const updated = await request(`/api/tasks/${activeId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        onNotice(`已保存新版本 v${updated.task.version}。`);
        setDraft(draftFromTask(updated.task));
        setVersions(await request(`/api/tasks/${activeId}/versions`));
      }
      refresh();
      onRefresh?.();
    } catch (error) {
      onNotice(error.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const removeTask = async () => {
    if (
      !activeId ||
      !confirm("删除这道自建题目？已有测试记录的题目不会允许删除。")
    )
      return;
    try {
      await request(`/api/tasks/${activeId}`, { method: "DELETE" });
      onNotice("自建题目已删除。");
      setActiveId("");
      setCreating(false);
      setDraft(emptyDraft());
      refresh();
    } catch (error) {
      onNotice(error.message, "error");
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="PROMPT WORKSHOP / AUTHORING"
        title="提示词工作台"
        subtitle="创建与迭代自建题目、保存提示词变体，并保留每次修改的版本快照。内置题目通过“编辑副本”进入这里。"
        actions={
          <>
            <button className="button button-ghost" onClick={startNew}>
              <Plus size={15} />
              新建自建题目
            </button>
            <button
              className="button button-primary"
              disabled={saving || (!creating && !activeId)}
              onClick={save}
            >
              {saving ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Save size={14} />
              )}
              保存
            </button>
          </>
        }
      />
      <div className="lab-layout">
        <aside className="panel lab-list">
          <div className="lab-list-head">
            <b>自建题库</b>
            <span>{tasks.length} 道 · 仅本地可见</span>
          </div>
          {loading && (
            <div className="loading-panel">
              <LoaderCircle className="spin" size={16} />
              正在加载…
            </div>
          )}
          {!loading && !tasks.length && (
            <div className="lab-empty">
              <Wrench size={18} />
              <p>还没有自建题目。</p>
              <span>在题库中点击“编辑副本”，或从空白开始创建。</span>
            </div>
          )}
          {tasks.map((task) => (
            <button
              key={task.id}
              className={`lab-item ${activeId === task.id ? "active" : ""}`}
              onClick={() => selectTask(task)}
            >
              <b>{task.title}</b>
              <small>
                {task.category_name} · {task.subcategory} · v{task.version}
              </small>
              <span className="lab-item-meta">
                {task.variant_count} 变体 · {task.run_count} 次测试
              </span>
            </button>
          ))}
        </aside>
        <section className="panel lab-editor">
          <div className="lab-editor-head">
            <div>
              <div className="panel-kicker">TASK EDITOR</div>
              <h2>
                {creating
                  ? "新建自建题目"
                  : active
                    ? active.title
                    : "选择或新建题目"}
              </h2>
              <span>
                {active
                  ? `ID ${active.id} · 版本 v${active.version} · ${
                      { user: "用户自建", imported: "外部导入", draft: "草案" }[
                        active.verification_status
                      ] ?? active.verification_status
                    }`
                  : "保存后会生成独立题目 ID，不会覆盖内置题库"}
              </span>
            </div>
            <div className="lab-editor-actions">
              {active && (
                <>
                  <button
                    className="button button-small button-ghost"
                    onClick={() => onOpenTask?.(active.id)}
                  >
                    <ExternalLink size={13} />
                    打开测试页
                  </button>
                  <button
                    className="button button-small button-ghost"
                    onClick={removeTask}
                  >
                    <Trash2 size={13} />
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="lab-form">
            <div className="form-two">
              <label className="field">
                <span>题目名称</span>
                <input
                  value={draft.title}
                  maxLength={180}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  placeholder="例如：多约束座位安排"
                />
              </label>
              <label className="field">
                <span>能力分类</span>
                <select
                  value={draft.categoryId}
                  onChange={(event) =>
                    setDraft({ ...draft, categoryId: event.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-two">
              <label className="field">
                <span>子分类</span>
                <input
                  value={draft.subcategory}
                  maxLength={100}
                  onChange={(event) =>
                    setDraft({ ...draft, subcategory: event.target.value })
                  }
                  placeholder="例如：多条件约束"
                />
              </label>
              <label className="field">
                <span>难度</span>
                <select
                  value={draft.difficulty}
                  onChange={(event) =>
                    setDraft({ ...draft, difficulty: event.target.value })
                  }
                >
                  <option value="easy">入门</option>
                  <option value="medium">进阶</option>
                  <option value="hard">挑战</option>
                  <option value="expert">专家</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>测试目标</span>
              <input
                value={draft.objective}
                maxLength={2000}
                onChange={(event) =>
                  setDraft({ ...draft, objective: event.target.value })
                }
                placeholder="这道题实际测量什么能力？"
              />
            </label>
            <label className="field">
              <span>完整中文提示词</span>
              <textarea
                rows={7}
                className="code-area"
                value={draft.promptZh}
                onChange={(event) =>
                  setDraft({ ...draft, promptZh: event.target.value })
                }
                placeholder="写清题目、约束、输出格式与评分要求。"
              />
            </label>
            <label className="field">
              <span>
                原始英文提示词 <i>可选</i>
              </span>
              <textarea
                rows={3}
                className="code-area"
                value={draft.promptEn}
                onChange={(event) =>
                  setDraft({ ...draft, promptEn: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>参考答案 / 评分要点</span>
              <textarea
                rows={3}
                value={draft.referenceAnswer}
                onChange={(event) =>
                  setDraft({ ...draft, referenceAnswer: event.target.value })
                }
              />
            </label>
            <div className="form-two">
              <label className="field">
                <span>评分方式</span>
                <select
                  value={draft.method}
                  onChange={(event) =>
                    setDraft({ ...draft, method: event.target.value })
                  }
                >
                  {scoringMethods.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {draft.method === "word_limit" ? (
                <label className="field">
                  <span>最大词数</span>
                  <input
                    type="number"
                    min="1"
                    value={draft.maxWords}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        maxWords: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ) : (
                <label className="field">
                  <span>
                    {draft.method === "regex"
                      ? "正则表达式"
                      : draft.method === "json"
                        ? "必需键（逗号分隔）"
                        : "目标答案（多值用逗号分隔）"}
                  </span>
                  <input
                    value={
                      draft.method === "regex"
                        ? draft.pattern
                        : draft.methodTarget
                    }
                    onChange={(event) =>
                      setDraft(
                        draft.method === "regex"
                          ? { ...draft, pattern: event.target.value }
                          : { ...draft, methodTarget: event.target.value },
                      )
                    }
                    disabled={draft.method === "manual"}
                    placeholder={
                      draft.method === "manual" ? "人工/AI 裁判无需目标值" : ""
                    }
                  />
                </label>
              )}
            </div>
            {(draft.method === "all_keywords" ||
              draft.method === "any_keywords") && (
              <label className="field">
                <span>关键词（逗号或换行分隔）</span>
                <input
                  value={draft.keywords}
                  onChange={(event) =>
                    setDraft({ ...draft, keywords: event.target.value })
                  }
                />
              </label>
            )}
            <div className="field">
              <span>评分维度与权重（AI 裁判使用）</span>
              <div className="dimension-editor">
                {draft.dimensions.map((dimension, index) => (
                  <div className="dimension-row" key={index}>
                    <input
                      value={dimension.name}
                      placeholder="维度名称"
                      onChange={(event) => {
                        const next = [...draft.dimensions];
                        next[index] = {
                          ...dimension,
                          name: event.target.value,
                        };
                        setDraft({ ...draft, dimensions: next });
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={dimension.weight}
                      onChange={(event) => {
                        const next = [...draft.dimensions];
                        next[index] = {
                          ...dimension,
                          weight: Number(event.target.value),
                        };
                        setDraft({ ...draft, dimensions: next });
                      }}
                    />
                    <button
                      className="icon-button"
                      aria-label="删除维度"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          dimensions: draft.dimensions.filter(
                            (_, position) => position !== index,
                          ),
                        })
                      }
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-link"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      dimensions: [
                        ...draft.dimensions,
                        { name: "", weight: 1 },
                      ],
                    })
                  }
                >
                  <Plus size={13} />
                  添加维度
                </button>
              </div>
            </div>
            <label className="field">
              <span>注意事项 / 来源说明</span>
              <textarea
                rows={2}
                value={draft.notes}
                onChange={(event) =>
                  setDraft({ ...draft, notes: event.target.value })
                }
              />
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={draft.isPublic}
                onChange={(event) =>
                  setDraft({ ...draft, isPublic: event.target.checked })
                }
              />
              <span>在题库中公开显示（仍标记为自建/未验证）</span>
            </label>
          </div>
          {active && versions.length > 0 && (
            <div className="lab-versions">
              <div className="lab-versions-head">
                <b>版本快照</b>
                <span>{versions.length} 个版本</span>
              </div>
              {versions.map((version) => (
                <details key={version.id}>
                  <summary>
                    v{version.version} · {version.change_note}
                    <small>
                      {new Date(version.created_at).toLocaleString("zh-CN")}
                    </small>
                  </summary>
                  <pre>{version.snapshot?.promptZh || ""}</pre>
                </details>
              ))}
            </div>
          )}
        </section>
        <aside className="panel lab-preview">
          <div className="panel-kicker">SCORING PREVIEW</div>
          <h3>评分规则预览</h3>
          <pre className="lab-rule">
            {JSON.stringify(buildRule(draft), null, 2)}
          </pre>
          <div className="lab-preview-note">
            <ShieldCheck size={14} />
            规则评分只适用于确实可客观判定的题目；开放式题目请使用人工或 AI
            裁判，并保留复核记录。
          </div>
          <div className="lab-variants">
            <b>提示词变体</b>
            {active ? (
              <VariantEditor
                key={active.id}
                taskId={active.id}
                taskTitle={active.title}
                onNotice={onNotice}
                onOpenTask={onOpenTask}
                onChanged={refresh}
              />
            ) : (
              <p className="muted">保存题目后可添加变体。</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function VariantEditor({ taskId, taskTitle, onNotice, onOpenTask, onChanged }) {
  const { data, refresh } = useApi(`/api/tasks/${taskId}`, [taskId]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const variants = data?.variants ?? [];
  const save = async () => {
    if (!prompt.trim()) return;
    try {
      await request(`/api/tasks/${taskId}/variants`, {
        method: "POST",
        body: JSON.stringify({ name: name || "未命名变体", prompt }),
      });
      setAdding(false);
      setName("");
      setPrompt("");
      refresh();
      onChanged?.();
      onNotice("变体已保存。");
    } catch (error) {
      onNotice(error.message, "error");
    }
  };
  const remove = async (id) => {
    try {
      await request(`/api/variants/${id}`, { method: "DELETE" });
      refresh();
      onChanged?.();
    } catch (error) {
      onNotice(error.message, "error");
    }
  };
  return (
    <div className="variant-editor">
      {variants.map((variant) => (
        <div className="variant-row" key={variant.id}>
          <span>
            <b>{variant.name}</b>
            <small>{variant.prompt.slice(0, 70)}</small>
          </span>
          <button className="icon-button" onClick={() => remove(variant.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      {!variants.length && <p className="muted">还没有变体。</p>}
      {adding ? (
        <div className="variant-new">
          <input
            value={name}
            placeholder="变体名称"
            onChange={(event) => setName(event.target.value)}
          />
          <textarea
            rows={5}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="变体提示词…"
          />
          <div className="modal-actions">
            <button
              className="button button-small button-ghost"
              onClick={() => setAdding(false)}
            >
              取消
            </button>
            <button
              className="button button-small button-primary"
              onClick={save}
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <button
          className="text-link"
          onClick={() => {
            setAdding(true);
            setPrompt(data?.task?.prompt_zh ?? "");
            setName(`${taskTitle ?? data?.task?.title ?? "题目"} · 变体`);
          }}
        >
          <Plus size={12} />
          新建变体
        </button>
      )}
      <button className="text-link" onClick={() => onOpenTask?.(taskId)}>
        打开测试页 <ArrowRight size={12} />
      </button>
    </div>
  );
}

function ModelDetail({ id, onBack, onOpenReport }) {
  const { data, error, loading, refresh } = useApi(`/api/models/${id}`, [id]);
  if (loading)
    return (
      <div className="loading-panel">
        <LoaderCircle className="spin" />
        正在读取模型档案…
      </div>
    );
  if (error || !data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="模型档案无法载入"
        text={error}
        action={
          <button className="button button-ghost" onClick={onBack}>
            返回模型管理
          </button>
        }
      />
    );
  const { model, stats, categoryScores, recent, history } = data;
  const radar = categoryScores.map((row) => ({
    subject: row.name,
    score: row.average_score,
  }));
  return (
    <>
      <div className="detail-back">
        <button className="text-link" onClick={onBack}>
          <ChevronLeft size={15} />
          返回模型管理
        </button>
        <span>模型 / {model.name}</span>
      </div>
      <PageHeader
        eyebrow={`MODEL PROFILE / ${model.model_id}`}
        title={model.name}
        subtitle={`${data.provider.name} · ${model.model_id}${model.model_version ? ` · ${model.model_version}` : ""}`}
        actions={
          <>
            <span
              className={`connection-badge ${model.enabled ? "" : "connection-off"}`}
            >
              <i className="live-dot" />
              {model.enabled ? "已启用" : "已停用"}
            </span>
            <button className="button button-ghost" onClick={refresh}>
              <RefreshCw size={14} />
              刷新
            </button>
          </>
        }
      />
      <div className="metric-grid model-metrics">
        <Metric
          label="真实平均分"
          value={stats.averageScore === null ? "—" : String(stats.averageScore)}
          suffix={stats.averageScore === null ? "" : "/ 100"}
          change={`${stats.completed} 条真实完成`}
          icon={Target}
          tone="blue"
        />
        <Metric
          label="成功率"
          value={stats.successRate === null ? "—" : `${stats.successRate}%`}
          change={`失败 ${stats.failed} 条 · Mock ${stats.mock} 条`}
          icon={CheckCircle2}
          tone="green"
        />
        <Metric
          label="平均耗时"
          value={
            stats.averageLatency === null
              ? "—"
              : formatNum(stats.averageLatency)
          }
          suffix={stats.averageLatency === null ? "" : "ms"}
          change={`AI 裁判 ${stats.judgedRuns} 条`}
          icon={Clock3}
          tone="purple"
        />
        <Metric
          label="累计费用"
          value={stats.totalCost ? `$${stats.totalCost.toFixed(4)}` : "—"}
          change={`${formatNum(stats.inputTokens + stats.outputTokens)} Token 总量`}
          icon={Zap}
          tone="orange"
        />
      </div>
      <div className="model-detail-grid">
        <section className="panel">
          <SectionTitle
            title="能力画像"
            subtitle="仅统计真实、已完成且有分数的运行"
          />
          {radar.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radar}>
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "var(--text-2)", fontSize: 10 }}
                />
                <Radar
                  dataKey="score"
                  stroke="#7c9cff"
                  fill="#7c9cff"
                  fillOpacity={0.18}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Target}
              title="还没有分项成绩"
              text="完成真实测试并评分后，这里会显示能力雷达。"
            />
          )}
        </section>
        <section className="panel">
          <SectionTitle
            title="成绩走势"
            subtitle={`最近 ${history.length} 次已评分运行`}
          />
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={history.map((row, index) => ({
                  index: index + 1,
                  score: Math.round(row.score),
                }))}
              >
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c9cff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7c9cff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="index" stroke="var(--text-3)" fontSize={10} />
                <YAxis domain={[0, 100]} stroke="var(--text-3)" fontSize={10} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#7c9cff"
                  fill="url(#scoreFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Activity}
              title="样本不足"
              text="至少需要两次已评分运行才能绘制走势。"
            />
          )}
        </section>
      </div>
      <section className="panel model-detail-runs">
        <SectionTitle title="最近运行" subtitle="点击进入对应批次的完整报告" />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>题目</th>
                <th>分类</th>
                <th>状态</th>
                <th>得分</th>
                <th>评分来源</th>
                <th>耗时</th>
                <th>完成时间</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((run) => (
                <tr key={run.id}>
                  <td className="table-primary">{run.task_title}</td>
                  <td>{run.category_name}</td>
                  <td>
                    <RunStatus status={run.is_external ? "external" : run.is_mock ? "mock" : run.status} />
                  </td>
                  <td>
                    {run.score === null ? (
                      <span className="muted">未评分</span>
                    ) : (
                      <b>{Math.round(run.score)}</b>
                    )}
                  </td>
                  <td>{scoreSourceLabel(run.evaluator_type ?? "manual")}</td>
                  <td className="muted">
                    {run.latency_ms ? `${formatNum(run.latency_ms)} ms` : "—"}
                  </td>
                  <td className="muted">
                    {run.completed_at
                      ? new Date(run.completed_at).toLocaleString("zh-CN")
                      : "—"}
                  </td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="inline-empty">该模型还没有运行记录。</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="model-config">
          <span>
            <i>temperature</i>
            <b>{model.temperature}</b>
          </span>
          <span>
            <i>max tokens</i>
            <b>{formatNum(model.max_tokens)}</b>
          </span>
          <span>
            <i>timeout</i>
            <b>{model.timeout_ms / 1000}s</b>
          </span>
          <span>
            <i>retries</i>
            <b>{model.max_retries}</b>
          </span>
          <span>
            <i>cost in/out</i>
            <b>
              ${model.input_cost_per_million}/$
              {model.output_cost_per_million}
            </b>
          </span>
          <span>
            <i>base url</i>
            <b>{data.provider.base_url || "默认端点"}</b>
          </span>
        </div>
      </section>
    </>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="modal panel"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
