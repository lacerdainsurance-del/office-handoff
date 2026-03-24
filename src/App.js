import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://hzabdrujojjqnyahkblj.supabase.co",
  "sb_publishable_6nIoa0iN9r4xvr2hHlvI0A_XsrODMx1"
);

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    title: "",
    details: "",
    employee: "",
    office: "",
    priority: "Medium"
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  useEffect(() => {
    if (session) {
      loadItems();
    }
  }, [session]);

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    window.location.reload();
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from("handoff_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setItems(data || []);
  }

  async function addItem(e) {
    e.preventDefault();

    if (!form.title.trim() || !form.details.trim() || !form.employee.trim()) {
      alert("Please enter a title, details, and employee name.");
      return;
    }

    const { error } = await supabase.from("handoff_items").insert({
      title: form.title,
      details: form.details,
      employee: form.employee,
      office: form.office || "Main Office",
      priority: form.priority,
      completed: false
    });

    if (error) {
      alert(error.message);
      return;
    }

    setForm({
      title: "",
      details: "",
      employee: "",
      office: "",
      priority: "Medium"
    });

    loadItems();
  }

  async function toggle(id, completed) {
    const { error } = await supabase
      .from("handoff_items")
      .update({ completed: !completed })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadItems();
  }

  if (!session) {
    return (
      <div style={{ padding: 20, fontFamily: "Arial", maxWidth: 350 }}>
        <h2>Office Handoff Login</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={signIn}>Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Office Handoff Notes</h1>
        <button onClick={signOut}>Sign Out</button>
      </div>

      <form
        onSubmit={addItem}
        style={{
          display: "grid",
          gap: 10,
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20
        }}
      >
        <input
          placeholder="Note title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <textarea
          placeholder="Write the full details for the next shift"
          value={form.details}
          onChange={(e) => setForm({ ...form, details: e.target.value })}
          rows={5}
          style={{ padding: 10 }}
        />

        <input
          placeholder="Employee name"
          value={form.employee}
          onChange={(e) => setForm({ ...form, employee: e.target.value })}
        />

        <input
          placeholder="Office location"
          value={form.office}
          onChange={(e) => setForm({ ...form, office: e.target.value })}
        />

        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>

        <button type="submit">Save Note</button>
      </form>

      <button onClick={loadItems} style={{ marginBottom: 20 }}>Refresh Notes</button>

      {items.length === 0 ? (
        <div>No notes yet.</div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 12,
              marginBottom: 12
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <strong style={{ fontSize: 18 }}>{item.title}</strong>
                <div style={{ color: "#666", marginTop: 4 }}>
                  {item.employee} • {item.office || "Main Office"} • {item.priority || "Medium"}
                </div>
              </div>
              <button onClick={() => toggle(item.id, item.completed)}>
                {item.completed ? "Undo" : "Done"}
              </button>
            </div>

            <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
              {item.details}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
