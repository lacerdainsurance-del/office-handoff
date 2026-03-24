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
    employee: ""
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
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

    const { error } = await supabase.from("handoff_items").insert({
      title: form.title,
      details: form.details,
      employee: form.employee,
      completed: false
    });

    if (error) {
      alert(error.message);
      return;
    }

    setForm({ title: "", details: "", employee: "" });
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
      <div style={{ padding: 20, fontFamily: "Arial" }}>
        <h2>Office Handoff Login</h2>
        <div style={{ display: "grid", gap: 10, maxWidth: 320 }}>
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
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Office Handoff</h1>

      <form onSubmit={addItem} style={{ display: "grid", gap: 10, maxWidth: 500, marginBottom: 20 }}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          placeholder="Details"
          value={form.details}
          onChange={(e) => setForm({ ...form, details: e.target.value })}
        />
        <input
          placeholder="Employee"
          value={form.employee}
          onChange={(e) => setForm({ ...form, employee: e.target.value })}
        />
        <button type="submit">Add</button>
      </form>

      <button onClick={loadItems} style={{ marginBottom: 20 }}>Refresh</button>

      {items.map((item) => (
        <div key={item.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
          <strong>{item.title}</strong>
          <div>{item.details}</div>
          <div>{item.employee}</div>
          <button onClick={() => toggle(item.id, item.completed)}>
            {item.completed ? "Undo" : "Done"}
          </button>
        </div>
      ))}
    </div>
  );
}
