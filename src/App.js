import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hzabdrujojjqnyahkblj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6nIoa0iN9r4xvr2hHlvI0A_XsrODMx1";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Put manager emails here
const MANAGERS = [
  "cristinalacerda01@gmail.com",
  "dandrade@lacerdainsurances.com",
  "fvasquezcruz@lacerdainsurances.com"
];

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const todayLabel = new Date().toLocaleDateString();

function normalizeType(value) {
  const v = String(value || "").trim().toLowerCase();

  if (v === "pending matter" || v === "pending" || v === "pending matters") {
    return "Pending Matter";
  }

  return "Note";
}

function priorityColor(priority) {
  if (priority === "High") {
    return {
      borderLeft: "6px solid #dc2626",
      badgeBg: "#fee2e2",
      badgeColor: "#991b1b"
    };
  }

  if (priority === "Medium") {
    return {
      borderLeft: "6px solid #d97706",
      badgeBg: "#fef3c7",
      badgeColor: "#92400e"
    };
  }

  return {
    borderLeft: "6px solid #16a34a",
    badgeBg: "#dcfce7",
    badgeColor: "#166534"
  };
}

function boxStyle(extra = {}) {
  return {
    background: "white",
    border: "1px solid #d9dde3",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    ...extra
  };
}

function startsWithSearchMatch(item, rawTerm) {
  const term = rawTerm.trim().toLowerCase();
  if (!term) return false;

  const fields = [
    item.title || "",
    item.details || "",
    item.follow_up_needed || "",
    item.employee || "",
    item.assigned_to || "",
    item.office || "",
    item.shift || "",
    item.priority || "",
    item.type || ""
  ];

  return fields.some((field) => {
    const value = String(field).toLowerCase();
    if (value.startsWith(term)) return true;

    const words = value.split(/\s+/).filter(Boolean);
    return words.some((word) => word.startsWith(term));
  });
}

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("All Offices");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    type: "Note",
    title: "",
    details: "",
    follow_up_needed: "",
    employee: "",
    assigned_to: "",
    office: "Main Office",
    shift: "Morning",
    priority: "Medium",
    due_date: "",
    pinned: false
  });

  const isManager = MANAGERS.includes(session?.user?.email || "");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    loadItems();

    const channel = supabase
      .channel("handoff-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "handoff_items" },
        () => loadItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  async function loadItems() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("handoff_items")
      .select("*")
      .order("pinned", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setItems(data || []);
    setLoading(false);
  }

  async function signIn() {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  function handlePrint() {
  window.print();
}

  async function signOut() {
    await supabase.auth.signOut();
    setItems([]);
  }

  function resetForm() {
    setForm({
      type: "Note",
      title: "",
      details: "",
      follow_up_needed: "",
      employee: "",
      assigned_to: "",
      office: "Main Office",
      shift: "Morning",
      priority: "Medium",
      due_date: "",
      pinned: false
    });
    setEditId(null);
  }

  function startEdit(item) {
    setEditId(item.id);
    setForm({
      type: item.type || "Note",
      title: item.title || "",
      details: item.details || "",
      follow_up_needed: item.follow_up_needed || "",
      employee: item.employee || "",
      assigned_to: item.assigned_to || "",
      office: item.office || "Main Office",
      shift: item.shift || "Morning",
      priority: item.priority || "Medium",
      due_date: item.due_date ? String(item.due_date).slice(0, 10) : "",
      pinned: !!item.pinned
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveItem(e) {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.details.trim() || !form.employee.trim()) {
      setError("Please fill in title, details, and employee name.");
      return;
    }

    const payload = {
  type: normalizeType(form.type),
  title: form.title.trim(),
  details: form.details.trim(),
  follow_up_needed: form.follow_up_needed.trim(),
  employee: form.employee.trim(),
  assigned_to: form.assigned_to.trim(),
  office: form.office,
  shift: form.shift,
  priority: form.priority,
  due_date: form.due_date || null,
  pinned: form.pinned
};

    if (editId) {
      const { error } = await supabase
        .from("handoff_items")
        .update(payload)
        .eq("id", editId);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("handoff_items").insert({
        ...payload,
        completed: false
      });

      if (error) {
        setError(error.message);
        return;
      }
    }

    resetForm();
    loadItems();
  }

  async function toggleCompleted(id, currentValue) {
    const { error } = await supabase
      .from("handoff_items")
      .update({ completed: !currentValue })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    loadItems();
  }

  async function togglePinned(id, currentValue) {
    const { error } = await supabase
      .from("handoff_items")
      .update({ pinned: !currentValue })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    loadItems();
  }

  async function deleteItem(id) {
    if (!isManager) {
      setError("Only managers can delete notes.");
      return;
    }

    const confirmed = window.confirm("Delete this note?");
    if (!confirmed) return;

    const { error } = await supabase.from("handoff_items").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    loadItems();
  }

  const offices = useMemo(() => {
    const dynamicOffices = Array.from(
      new Set(items.map((item) => item.office).filter(Boolean))
    );
    return ["All Offices", ...dynamicOffices];
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    let result = items.filter((item) => {
      const normalMatch =
        !term ||
        String(item.title || "").toLowerCase().includes(term) ||
        String(item.details || "").toLowerCase().includes(term) ||
        String(item.follow_up_needed || "").toLowerCase().includes(term) ||
        String(item.employee || "").toLowerCase().includes(term) ||
        String(item.assigned_to || "").toLowerCase().includes(term);

      const completedSearchRecovery =
        !!term && item.completed && startsWithSearchMatch(item, term);

      const matchesSearch = normalMatch || completedSearchRecovery;

      const matchesOffice =
        officeFilter === "All Offices" ? true : item.office === officeFilter;

      let matchesStatus = true;
      if (statusFilter === "Open") {
        matchesStatus =
          !item.completed ||
          (!!term && item.completed && startsWithSearchMatch(item, term));
      } else if (statusFilter === "Completed") {
        matchesStatus = !!item.completed;
      }

      return matchesSearch && matchesOffice && matchesStatus;
    });

    result.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;

      const aPriorityRank =
        a.priority === "High" ? 0 : a.priority === "Medium" ? 1 : 2;
      const bPriorityRank =
        b.priority === "High" ? 0 : b.priority === "Medium" ? 1 : 2;

      if (aPriorityRank !== bPriorityRank) return aPriorityRank - bPriorityRank;

      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;

      if (aDue !== bDue) return aDue - bDue;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [items, search, officeFilter, statusFilter]);

  const notes = filteredItems.filter((item) => normalizeType(item.type) === "Note");
const pendingMatters = filteredItems.filter(
  (item) => normalizeType(item.type) === "Pending Matter"
);
  const openCount = items.filter((item) => !item.completed).length;
  const pinnedCount = items.filter((item) => item.pinned && !item.completed).length;

  if (!session) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", background: "#f4f6f8", minHeight: "100vh", padding: 20 }}>
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
          <div style={boxStyle()}>
            <h2 style={{ marginTop: 0 }}>Office Shift Handoff Login</h2>

            {error ? <div style={errorStyle}>{error}</div> : null}

            <div style={{ marginBottom: 12 }}>
              <label>Email</label>
              <input
                style={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@office.com"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Password</label>
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
            </div>

            <button onClick={signIn} style={buttonPrimary}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f4f6f8", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0 }}>Office Shift Handoff</h1>
            <p style={{ margin: "8px 0 0 0", color: "#555" }}>
              Signed in as {session.user.email} {isManager ? "• Manager" : "• Staff"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
  {editId ? (
    <button onClick={resetForm} style={buttonSecondary}>
      Cancel Edit
    </button>
  ) : null}

  <button onClick={handlePrint} style={buttonSecondary}>
    Print Report
  </button>

  <button onClick={signOut} style={buttonSecondary}>
    Sign Out
  </button>
</div>
        </div>

        {error ? <div style={{ ...errorStyle, marginBottom: 20 }}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <div style={boxStyle()}>
            <h2 style={{ marginTop: 0 }}>
              {editId ? "Edit Entry" : "Add Note or Pending Matter"}
            </h2>

            <form onSubmit={saveItem}>
              <div style={grid3}>
                <div>
                  <label>Type</label>
                  <select
                    style={inputStyle}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option>Note</option>
                    <option>Pending Matter</option>
                  </select>
                </div>

                <div>
                  <label>Priority</label>
                  <select
                    style={inputStyle}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>

                <div>
                  <label>Due Date</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Title</label>
                <input
                  style={inputStyle}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Example: Call client back"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Details</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 160, resize: "vertical", lineHeight: 1.5 }}
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  placeholder="Write a full note for the next shift."
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Follow-up Needed</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 110, resize: "vertical", lineHeight: 1.5 }}
                  value={form.follow_up_needed}
                  onChange={(e) => setForm({ ...form, follow_up_needed: e.target.value })}
                  placeholder="Leave this blank for the assigned employee to respond."
                />
              </div>

              <div style={grid4}>
                <div>
                  <label>Created By / Employee</label>
                  <input
                    style={inputStyle}
                    value={form.employee}
                    onChange={(e) => setForm({ ...form, employee: e.target.value })}
                    placeholder="Your Name"
                  />
                </div>

                <div>
                  <label>Assigned To</label>
                  <input
                    style={inputStyle}
                    value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    placeholder="Assigned Employee"
                  />
                </div>

                <div>
                  <label>Office</label>
                  <select
                    style={inputStyle}
                    value={form.office}
                    onChange={(e) => setForm({ ...form, office: e.target.value })}
                  >
                    <option>Main Office</option>
                    <option>Insurance</option>
                    <option>Real Estate</option>
                    <option>Remote</option>
                  </select>
                </div>

                <div>
                  <label>Shift</label>
                  <select
                    style={inputStyle}
                    value={form.shift}
                    onChange={(e) => setForm({ ...form, shift: e.target.value })}
                  >
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                    <option>Weekend</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                  />
                  Pin urgent item to the top
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="submit" style={buttonPrimary}>
                  {editId ? "Update Entry" : "Save Entry"}
                </button>

                <button type="button" onClick={resetForm} style={buttonSecondary}>
                  Clear Form
                </button>

                <button onClick={handlePrint} style={buttonSecondary}>
                  Print Report
                </button>
              </div>
            </form>
          </div>

          <div style={boxStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <strong>Open Items:</strong> {openCount}
              </div>
              <div>
                <strong>Pinned:</strong> {pinnedCount}
              </div>
              <div>
                <strong>{loading ? "Loading..." : `${filteredItems.length} items shown`}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              <input
                style={inputStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes or start typing content to retrieve hidden completed items"
              />

              <select
                style={inputStyle}
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
              >
                {offices.map((office) => (
                  <option key={office} value={office}>
                    {office}
                  </option>
                ))}
              </select>

              <select
                style={inputStyle}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>Open</option>
                <option>All</option>
                <option>Completed</option>
                <option>Print</option>
              </select>
            </div>

           <div id="print-report">
  <div className="print-header">
    <h1>Office Shift Handoff Report</h1>

    <div className="print-meta">
      <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
      <div><strong>Prepared by:</strong> {session.user.email}</div>
      <div><strong>Open Items:</strong> {openCount}</div>
      <div><strong>Pinned:</strong> {pinnedCount}</div>
    </div>
  </div>

  <div className="print-section">
    <h2>Notes</h2>
    {notes.length === 0 ? (
      <div>No notes found.</div>
    ) : (
      notes.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isManager={isManager}
          onEdit={startEdit}
          onToggle={toggleCompleted}
          onTogglePin={togglePinned}
          onDelete={deleteItem}
        />
      ))
    )}
  </div>

  <div className="print-section">
    <h2>Pending Matters</h2>
    {pendingMatters.length === 0 ? (
      <div>No pending matters found.</div>
    ) : (
      pendingMatters.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isManager={isManager}
          onEdit={startEdit}
          onToggle={toggleCompleted}
          onTogglePin={togglePinned}
          onDelete={deleteItem}
        />
      ))
    )}
  </div>
</div>

              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, isManager, onEdit, onToggle, onTogglePin, onDelete }) {
  const colors = priorityColor(item.priority);

  return (
    <div
      className="print-item"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        background: item.completed ? "#f8fafc" : "#fff",
        ...colors
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                textDecoration: item.completed ? "line-through" : "none"
              }}
            >
              {item.title}
            </div>

            {item.pinned ? (
              <span style={pinBadgeStyle}>Pinned</span>
            ) : null}

            <span
              style={{
                background: colors.badgeBg,
                color: colors.badgeColor,
                padding: "4px 8px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700
              }}
            >
              {item.priority || "Medium"}
            </span>
          </div>

          <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
            {item.type} | {item.office} | {item.shift} | Created by: {item.employee}
          </div>

          <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
            Assigned to: {item.assigned_to || "Unassigned"}
          </div>

          <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
            Due: {item.due_date ? formatDate(item.due_date) : "No due date"}
          </div>

          <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
            Created: {formatDate(item.created_at)}
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
          <button onClick={() => onEdit(item)} style={buttonSecondary}>
            Edit
          </button>

          <button onClick={() => onTogglePin(item.id, item.pinned)} style={buttonSecondary}>
            {item.pinned ? "Unpin" : "Pin"}
          </button>

          <button onClick={() => onToggle(item.id, item.completed)} style={buttonSecondary}>
            {item.completed ? "Reopen" : "Complete"}
          </button>

          {isManager ? (
            <button onClick={() => onDelete(item.id)} style={buttonDanger}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        <strong>Details:</strong>
        <div>{item.details}</div>
      </div>

      {item.follow_up_needed ? (
        <div
          style={{
            marginTop: 12,
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
            background: "#f8fafc",
            padding: 10,
            borderRadius: 8
          }}
        >
          <strong>Follow-up Needed:</strong>
          <div>{item.follow_up_needed}</div>
        </div>
      ) : null}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  marginTop: 6,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: 14
};

const buttonPrimary = {
  background: "#0f766e",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14
};

const buttonSecondary = {
  background: "white",
  color: "#111827",
  border: "1px solid #cbd5e1",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14
};

const buttonDanger = {
  background: "#b91c1c",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14
};

const pinBadgeStyle = {
  background: "#e0f2fe",
  color: "#075985",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700
};

const errorStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12
};

const grid3 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 12
};

const grid4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 16
};
