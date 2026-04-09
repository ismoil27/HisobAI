import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useSearchParams } from "react-router-dom";

const currencies = ["UZS", "USD", "KRW", "RUB", "EUR"];

function getTelegramContext() {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  return {
    tgUserId: user?.id ? String(user.id) : "",
    tgName: user?.first_name || "",
    tgUsername: user?.username || ""
  };
}

function formatMoney(amount, currency = "UZS") {
  const locales = {
    UZS: "uz-UZ",
    USD: "en-US",
    KRW: "ko-KR",
    RUB: "ru-RU",
    EUR: "de-DE"
  };

  const zeroDecimal = new Set(["UZS", "KRW"]);
  return new Intl.NumberFormat(locales[currency] || "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
    maximumFractionDigits: zeroDecimal.has(currency) ? 0 : 2
  }).format(Number(amount || 0));
}

function formatCompactAmount(amount) {
  const numeric = Number(amount || 0);
  const absolute = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) return `${sign}${Math.floor(absolute / 1_000_000_000)}b`;
  if (absolute >= 1_000_000) return `${sign}${Math.floor(absolute / 1_000_000)}m`;
  if (absolute >= 1_000) return `${sign}${Math.floor(absolute / 1_000)}k`;
  return `${sign}${Math.round(absolute)}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("hisobai-theme", theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light"))
  };
}

function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="toast-stack">
      <div className="toast-popup">{message}</div>
    </div>
  );
}

function DashboardPage() {
  const telegram = useMemo(getTelegramContext, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toggleTheme } = useTheme();

  const view = searchParams.get("view") || "today";
  const month = searchParams.get("month") || "";
  const date = searchParams.get("date") || "";
  const editId = searchParams.get("editId") || "";

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category: "",
    note: "",
    transactionDate: "",
    transactionTime: ""
  });

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      ...telegram,
      view,
      month,
      date,
      editId
    });

    setLoading(true);
    setError("");
    apiRequest(`/api/dashboard?${params.toString()}`)
      .then((payload) => {
        setData(payload);
        setForm({
          type: payload.draftEntry?.type || "expense",
          amount: payload.draftEntry?.amount || "",
          category: payload.draftEntry?.category || "",
          note: payload.draftEntry?.note || "",
          transactionDate: payload.draftEntry?.transactionDate || payload.selectedDate,
          transactionTime: payload.draftEntry?.transactionTime || payload.defaultTime
        });
      })
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, [telegram, view, month, date, editId]);

  const activeHistory = data?.categoryHistory?.[form.type] || [];
  const selectedCurrency = data?.user?.currency || "UZS";

  function updateParams(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await apiRequest("/api/entries", {
        method: "POST",
        body: JSON.stringify({
          ...telegram,
          userId: data.user.id,
          entryId: editId,
          view,
          month: data.currentMonth,
          transactionDate: view === "today" ? data.todayDate : data.selectedDate,
          transactionTime: form.transactionTime || data.defaultTime,
          type: form.type,
          amount: form.amount,
          category: form.category,
          note: form.note
        })
      });
      setToast(result.message);
      updateParams({ editId: "", date: result.transactionDate, month: data.currentMonth, view });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryIdValue) {
    if (!data) return;
    await apiRequest(`/api/entries/${entryIdValue}/delete`, {
      method: "POST",
      body: JSON.stringify({
        ...telegram,
        userId: data.user.id,
        month: data.currentMonth,
        date: data.selectedDate,
        view
      })
    });
    setToast("Yozuv o'chirildi.");
    updateParams({ editId: "", date: data.selectedDate, month: data.currentMonth, view });
  }

  async function handleCurrencyChange(currency) {
    if (!data) return;
    await apiRequest("/api/settings/currency", {
      method: "POST",
      body: JSON.stringify({
        ...telegram,
        userId: data.user.id,
        currency,
        month: data.currentMonth,
        date: data.selectedDate,
        view
      })
    });
    setToast("Valyuta saqlandi.");
    updateParams({ month: data.currentMonth, date: data.selectedDate, view });
  }

  if (loading) {
    return <div className="app-shell"><div className="surface">Yuklanmoqda...</div></div>;
  }

  if (error || !data) {
    return <div className="app-shell"><div className="surface">{error || "Ma'lumot topilmadi."}</div></div>;
  }

  return (
    <div className="app-shell">
      <Toast message={toast} onDone={() => setToast("")} />

      <section className="surface hero-surface">
        <div className="hero-top">
          <div className="hero-heading">
            <div className="heading-stack">
              <div className="eyebrow-row">
                <p className="eyebrow">{data.viewMode === "month" ? "TO'LIQ OY" : "BUGUNGI HISOB"}</p>
                <div className="header-pills">
                  <button type="button" className="ghost-btn icon-pill theme-toggle" onClick={toggleTheme}>☀︎</button>
                  <button type="button" className={`ghost-btn icon-pill ${view === "today" ? "active-toggle" : ""}`} onClick={() => updateParams({ view: "today", date: data.todayDate, month: data.currentMonth, editId: "" })}>📅</button>
                  <button type="button" className={`ghost-btn icon-pill ${view === "month" ? "active-toggle" : ""}`} onClick={() => updateParams({ view: "month", date: data.selectedDate, month: data.currentMonth, editId: "" })}>🗓</button>
                  {data.isAdmin ? <a className="name-pill admin-pill icon-pill" href={`/admin?tgUsername=${data.telegramUsername}`}>📊</a> : <div className="name-pill icon-pill">👤</div>}
                </div>
              </div>
              <div className="title-row title-row-compact">
                <h1>{data.viewMode === "month" ? data.monthLabel : data.selectedDateLabel}</h1>
              </div>
            </div>
            <div className="hero-stat">
              <span>Bugungi xarajat</span>
              <strong>{formatMoney(data.todayTotals.expense, selectedCurrency)}</strong>
            </div>
          </div>
        </div>
      </section>

      {view === "month" && (
        <section className="surface calendar-surface calendar-priority-surface calendar-expanded">
          <div className="surface-header">
            <button type="button" className="month-btn" onClick={() => updateParams({ month: data.previousMonth, view: "month", editId: "" })}>‹</button>
            <div className="surface-title-wrap">
              <h2>{data.monthLabel}</h2>
              <p>To'liq oy sanalari va kunlik faollik.</p>
            </div>
            <button type="button" className="month-btn" onClick={() => updateParams({ month: data.nextMonth, view: "month", editId: "" })}>›</button>
          </div>
          <div className="legend">
            <span><i className="dot income" /> Tushum</span>
            <span><i className="dot expense" /> Xarajat</span>
            <span><i className="dot debt" /> Qarz</span>
          </div>
          <div className="weekday-row">
            {data.weekdayLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="calendar-grid">
            {data.calendarWeeks.flat().map((day, index) => {
              if (!day) return <div className="calendar-cell empty" key={`empty-${index}`} />;
              return (
                <button
                  type="button"
                  key={day.isoDate}
                  className={`calendar-cell ${day.isSelected ? "selected" : ""} ${day.isToday ? "today" : ""}`}
                  onClick={() => updateParams({ date: day.isoDate, month: data.currentMonth, view: "month", editId: "" })}
                >
                  <span className="day-number">{day.dayNumber}</span>
                  {day.expenseTotal > 0 ? <span className="day-amount">{formatCompactAmount(day.expenseTotal)}</span> : null}
                  <span className="day-dots">
                    {day.hasIncome ? <i className="dot income" /> : null}
                    {day.hasExpense ? <i className="dot expense" /> : null}
                    {day.hasDebt ? <i className="dot debt" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className={`content-grid month-form-grid ${view === "month" ? "month-priority-grid" : ""}`}>
        <section className="surface day-surface">
          <div className="surface-title-wrap compact-title">
            <h2>{editId ? "Yozuvni tahrirlash" : "Yangi yozuv"}</h2>
            <p>{view === "today" ? "Bugungi kun uchun tushum, xarajat yoki qarz qo'shing." : "Kalendar ichidan tanlangan sana uchun tur va miqdorni kiriting."}</p>
          </div>
          <form className="entry-form" onSubmit={handleSubmit}>
            <div className="type-tabs type-tabs-3">
              {[
                ["expense", "💸 Xarajat"],
                ["income", "💚 Tushum"],
                ["debt", "🟠 Qarz"]
              ].map(([type, label]) => (
                <label key={type} className={`type-option ${type}`}>
                  <input type="radio" checked={form.type === type} onChange={() => setForm((current) => ({ ...current, type }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="form-grid amount-currency-grid">
              <label>
                <span>Miqdor</span>
                <input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="25000" />
              </label>
              <div className="inline-currency-wrap">
                <select value={selectedCurrency} onChange={(event) => handleCurrencyChange(event.target.value)}>
                  {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </div>
            </div>

            <label>
              <span>Toifa</span>
              <input list="category-history" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ovqat, Maosh, Yo'l, Qarz" />
              <datalist id="category-history">
                {activeHistory.map((item) => <option key={`${form.type}-${item.category}`} value={item.category} />)}
              </datalist>
            </label>

            <label>
              <span>Izoh</span>
              <input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Ixtiyoriy izoh" />
            </label>

            <div className="form-actions">
              <button type="submit" className="primary-btn">{submitting ? "Saqlanmoqda..." : editId ? "Yangilash" : "Saqlash"}</button>
              {editId ? <button type="button" className="secondary-btn" onClick={() => updateParams({ editId: "" })}>Bekor qilish</button> : null}
            </div>
          </form>
        </section>

        <section className="surface timeline-surface">
          <div className="surface-title-wrap compact-title">
            <h2>Bugungi yozuvlar</h2>
            <p>Tanlangan kun uchun saqlangan yozuvlar.</p>
          </div>
          {data.entries.length === 0 ? (
            <div className="empty-state">Hozircha yozuv yo'q.</div>
          ) : (
            <div className="entry-list">
              {data.entries.map((entry) => (
                <article className={`entry-card ${entry.type}`} key={entry.id}>
                  <div>
                    <p className="entry-category">{entry.category}</p>
                    <p className="entry-note">{entry.note || "Izoh yo'q"}</p>
                  </div>
                  <div className="entry-side">
                    <div className="entry-amount">
                      <span>{entry.type === "expense" ? "Xarajat" : entry.type === "income" ? "Tushum" : "Qarz"}</span>
                      <strong>{formatMoney(entry.converted_amount ?? entry.amount, selectedCurrency)}</strong>
                    </div>
                    <div className="entry-actions">
                      <button type="button" className="micro-btn icon-action edit-action" onClick={() => updateParams({ editId: String(entry.id) })}>✏️</button>
                      <button type="button" className="micro-btn icon-action danger-btn" onClick={() => handleDelete(entry.id)}>🗑️</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function AdminPage() {
  const telegram = useMemo(getTelegramContext, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams({
      tgUsername: telegram.tgUsername,
      userId: searchParams.get("userId") || ""
    });

    apiRequest(`/api/admin?${params.toString()}`)
      .then(setData)
      .catch((adminError) => setError(adminError.message));
  }, [telegram, searchParams]);

  if (error) return <div className="app-shell"><div className="surface">{error}</div></div>;
  if (!data) return <div className="app-shell"><div className="surface">Yuklanmoqda...</div></div>;

  return (
    <div className="app-shell admin-shell">
      <section className="surface admin-header">
        <div className="surface-title-wrap">
          <h1>Admin panel</h1>
          <p>@{data.viewerUsername}</p>
        </div>
        <button type="button" className="ghost-btn" onClick={() => navigate("/")}>Orqaga</button>
      </section>
      <section className="admin-layout">
        <section className="surface admin-users">
          <div className="surface-title-wrap compact-title">
            <h2>Foydalanuvchilar</h2>
            <p>Jami: {data.users.length}</p>
          </div>
          <div className="admin-user-list">
            {data.users.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`admin-user-card ${data.selectedUser?.id === item.id ? "active" : ""}`}
                onClick={() => setSearchParams({ userId: String(item.id) })}
              >
                <div className="admin-user-main">
                  <strong>{item.first_name || item.username || item.telegram_id}</strong>
                  <p>@{item.username || "noma'lum"}</p>
                </div>
                <div className="admin-user-metrics">
                  <span className="metric income">Tushum <strong>{formatMoney(item.monthSummary.current.income, item.currency || "UZS")}</strong></span>
                  <span className="metric expense">Xarajat <strong>{formatMoney(item.monthSummary.current.expense, item.currency || "UZS")}</strong></span>
                  <span className="metric debt">Qarz <strong>{formatMoney(item.monthSummary.current.debt, item.currency || "UZS")}</strong></span>
                  <span className="metric balance">Balans <strong>{formatMoney(item.monthSummary.current.income - item.monthSummary.current.expense - item.monthSummary.current.debt, item.currency || "UZS")}</strong></span>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="surface admin-detail">
          {!data.selectedUser ? (
            <div className="empty-state">Hali foydalanuvchi yo'q.</div>
          ) : (
            <>
              <div className="surface-title-wrap compact-title">
                <h2>{data.selectedUser.first_name || data.selectedUser.telegram_id}</h2>
                <p>@{data.selectedUser.username || "noma'lum"}</p>
              </div>
              <div className="admin-meta">
                <div className="meta-row"><span>Telegram ID</span><strong>{data.selectedUser.telegram_id}</strong></div>
                <div className="meta-row"><span>Username</span><strong>@{data.selectedUser.username || "noma'lum"}</strong></div>
                <div className="meta-row"><span>Telefon</span><strong>Taqdim etilmagan</strong></div>
                <div className="meta-row"><span>Vaqt zonasi</span><strong>{data.selectedUser.timezone}</strong></div>
              </div>
              <div className="stats-grid month-stats">
                <div className="mini-stat income"><span>Tushum</span><strong>{formatMoney(data.selectedUser.monthSummary.current.income, data.selectedUser.currency || "UZS")}</strong></div>
                <div className="mini-stat expense"><span>Xarajat</span><strong>{formatMoney(data.selectedUser.monthSummary.current.expense, data.selectedUser.currency || "UZS")}</strong></div>
                <div className="mini-stat debt"><span>Qarz</span><strong>{formatMoney(data.selectedUser.monthSummary.current.debt, data.selectedUser.currency || "UZS")}</strong></div>
                <div className="mini-stat balance"><span>Balans</span><strong>{formatMoney(data.selectedUser.monthSummary.current.income - data.selectedUser.monthSummary.current.expense - data.selectedUser.monthSummary.current.debt, data.selectedUser.currency || "UZS")}</strong></div>
              </div>
              <div className="surface-title-wrap compact-title">
                <h2>So'nggi yozuvlar</h2>
                <p>Oxirgi faollik</p>
              </div>
              {data.selectedUser.latestEntries.length === 0 ? (
                <div className="empty-state">Hali yozuv yo'q.</div>
              ) : (
                <div className="entry-list">
                  {data.selectedUser.latestEntries.map((entry) => (
                    <article className={`entry-card ${entry.type}`} key={entry.id}>
                      <div>
                        <p className="entry-category">{entry.category}</p>
                        <p className="entry-note">{entry.transaction_date} · {entry.transaction_time || "12:00"} · {entry.note || "Izoh yo'q"}</p>
                      </div>
                      <div className="entry-amount">
                        <span>{entry.type === "expense" ? "Xarajat" : entry.type === "income" ? "Tushum" : "Qarz"}</span>
                        <strong>{formatMoney(entry.converted_amount ?? entry.amount, data.selectedUser.currency || "UZS")}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
