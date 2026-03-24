import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hzabdrujojjqnyahkblj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6nIoa0iN9r4xvr2hHlvI0A_XsrODMx1";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const setupSQL = `create table if not exists public.handoff_items (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'Note',
  title text not null,
  details text not null,
  employee text not null,
  office text not null default 'Main Office',
  shift text not null default 'Morning',
  priority text not null default 'Medium',
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.handoff_items enable row level security;

alter table public.handoff_items
add column if not exists office text default 'Main Office',
add column if not exists priority text default 'Medium';

drop policy if exists "Allow read access to authenticated users" on public.handoff_items;
drop policy if exists "Allow insert to authenticated users" on public.handoff_items;
drop policy if exists "Allow update to authenticated users" on public.handoff_items;
drop policy if exists "Allow delete to authenticated users" on public.handoff_items;

create policy "Allow read access to authenticated users"
on public.handoff_items
for select
using (auth.role() = 'authenticated');

create policy "Allow insert to authenticated users"
on public.handoff_items
for insert
with check (auth.role() = 'authenticated');

create policy "Allow update to authenticated users"
on public.handoff_items
for update
using (auth.role() = 'authenticated');

create policy "Allow delete to authenticated users"
on public.handoff_items
for delete
using (auth.role() = 'authenticated');`;

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function boxStyle(extra = {}) {
  return {
    background: "white",
    border: "1px solid #d9dde3",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    ...extra,
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("All Offices");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [form, setForm] = useState({
    type: "Note",
    title: "",
    details: "",
    employee: "",
    office: "Insurance",
    shift: "Morning",
    priority: "Medium",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || null);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "handoff_items" }, () => {
        loadItems();
      })
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
      .order("completed", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  async function signIn() {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setItems([]);
  }

  async function addItem(e) {
    e.preventDefault();
    setError("");

    if (!form.title.trim() || !form.details.trim() || !form.employee.trim()) {
      setError("Please fill in title, details, and employee name.");
      return;
    }

    const { error } = await supabase.from("handoff_items").insert({
      type: form.type,
      title: form.title,
      details: form.details,
      employee: form.employee,
      office: form.office,
      shift: form.shift,
      priority: form.priority,
      completed: false,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setForm({
      type: "Note",
      title: "",
      details: "",
      employee: "",
      office: "Insurance",
      shift: "Morning",
      priority: "Medium",
    });

    loadItems();
  }

  async function toggleCompleted(id, currentValue) {
    const { error } = await supabase
      .from("handoff_items")
      .update({ completed: !currentValue })
      .eq("id", id);

    if (error) setError(error.message);
  }

  async function deleteItem(id) {
    const { error } = await supabase.from("handoff_items").delete().eq("id", id);
    if (error) setError(error.message);
  }

  const offices = useMemo(() => {
    return ["All Offices", ...Array.from(new Set(items.map((item) => item.office)))];
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(term) ||
        item.details.toLowerCase().includes(term) ||
        item.employee.toLowerCase().includes(term);

      const matchesOffice = officeFilter === "All Offices" ? true : item.office === officeFilter;

      const matchesStatus =
        statusFilter === "All"
          ? true
          : statusFilter === "Open"
          ? !item.completed
          : item.completed;

      return matchesSearch && matchesOffice && matchesStatus;
    });
  }, [items, search, officeFilter, statusFilter]);

  const openCount = items.filter((item) => !item.completed).length;
  const notes = filteredItems.filter((item) => item.type === "Note");
  const pendingMatters = filteredItems.filter((item) => item.type === "Pending Matter");

  if (!session) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", background: "#f4f6f8", minHeight: "100vh", padding: 20 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={boxStyle({ marginBottom: 20 })}>
            <h1 style={{ marginTop: 0 }}>Office Shift Handoff</h1>
            <p style={{ marginBottom: 10 }}>
              This is a simplified version that works better in CodeSandbox.
            </p>
            <button onClick={() => setShowSetup(!showSetup)} style={buttonSecondary}>
              {showSetup ? "Hide Setup" : "Show Setup"}
            </button>
            {showSetup && (
              <div style={{ marginTop: 16 }}>
                <p><strong>Run this in Supabase SQL Editor:</strong></p>
                <pre style={{ background: "#111827", color: "#f9fafb", padding: 12, borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap" }}>
                  {setupSQL}
                </pre>
                <p style={{ fontSize: 14, color: "#555" }}>
                  Then create employee users in Supabase Authentication.
                </p>
              </div>
            )}
          </div>

          <div style={{ ...boxStyle(), maxWidth: 420, margin: "0 auto" }}>
            <h2 style={{ marginTop: 0 }}>Employee Sign In</h2>
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

            <button onClick={signIn} style={buttonPrimary}>Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f4f6f8", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0 }}>Office Shift Handoff</h1>
            <p style={{ margin: "8px 0 0 0", color: "#555" }}>Signed in as {session.user.email}</p>
          </div>
          <button onClick={signOut} style={buttonSecondary}>Sign Out</button>
        </div>

        {error ? <div style={{ ...errorStyle, marginBottom: 20 }}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <div style={boxStyle()}>
            <h2 style={{ marginTop: 0 }}>Add Note or Pending Matter</h2>
            <form onSubmit={addItem}>
              <div style={grid2}>
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
                  style={{ ...inputStyle, minHeight: 180, resize: "vertical", lineHeight: 1.5 }}
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  placeholder="Write detailed notes, pending items, instructions for the next shift, deadlines, and anything the next staff member needs to know."
                />
              </div>

              <div style={grid3}>
                <div>
                  <label>Employee</label>
                  <input
                    style={inputStyle}
                    value={form.employee}
                    onChange={(e) => setForm({ ...form, employee: e.target.value })}
                    placeholder="Cristina"
                  />
                </div>
                <div>
                  <label>Office</label>
                  <select
                    style={inputStyle}
                    value={form.office}
                    onChange={(e) => setForm({ ...form, office: e.target.value })}
                  >
                    <option>Insurance</option>
                    <option>Real_Estate</option>
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

              <button type="submit" style={buttonPrimary}>Save Entry</button>
            </form>
          </div>

          <div style={boxStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <strong>Open Items:</strong> {openCount}
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
                placeholder="Search"
              />

              <select style={inputStyle} value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)}>
                {offices.map((office) => (
                  <option key={office} value={office}>{office}</option>
                ))}
              </select>

              <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option>All</option>
                <option>Open</option>
                <option>Completed</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Notes</h3>
                {notes.length === 0 ? (
                  <div style={{ color: "#666" }}>No notes found.</div>
                ) : (
                  notes.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onToggle={toggleCompleted}
                      onDelete={deleteItem}
                    />
                  ))
                )}
              </div>

              <div>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Pending Matters</h3>
                {pendingMatters.length === 0 ? (
                  <div style={{ color: "#666" }}>No pending matters found.</div>
                ) : (
                  pendingMatters.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onToggle={toggleCompleted}
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
  );
}

function ItemCard({ item, onToggle, onDelete }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 12, background: item.completed ? "#f8fafc" : "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, textDecoration: item.completed ? "line-through" : "none" }}>
            {item.title}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
            {item.type} | {item.priority} | {item.office} | {item.shift} | {item.employee}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
            {formatDate(item.created_at)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
          <button onClick={() => onToggle(item.id, item.completed)} style={buttonSecondary}>
            {item.completed ? "Reopen" : "Complete"}
          </button>
          <button onClick={() => onDelete(item.id)} style={buttonDanger}>
            Delete
          </button>
        </div>
      </div>
      <div style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.details}</div>
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
  fontSize: 14,
};

const buttonPrimary = {
  background: "#0f766e",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const buttonSecondary = {
  background: "white",
  color: "#111827",
  border: "1px solid #cbd5e1",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const buttonDanger = {
  background: "#b91c1c",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const errorStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const grid3 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 16,
};
