import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://hzabdrujojjqnyahkblj.supabase.co",
  "sb_publishable_6nIoa0iN9r4xvr2hHlvI0A_XsrODMx1"
);

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "",
    details: "",
    employee: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  async function signIn() {
    await supabase.auth.signInWithPassword({ email, password });
    window.location.reload();
  }

  async function loadItems() {
    const { data } = await supabase
      .from("handoff_items")
      .select("*")
      .order("created_at", { ascending: false });

    setItems(data || []);
  }

  async function addItem(e: any) {
    e.preventDefault();
    await supabase.from("handoff_items").insert({
      ...form,
      completed: false,
    });
    setForm({ title: "", details: "", employee: "" });
    loadItems();
  }

  async function toggle(id: string, val: boolean) {
    await supabase
      .from("handoff_items")
      .update({ completed: !val })
      .eq("id", id);
    loadItems();
  }

  if (!session) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Login</h2>
        <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={signIn}>Sign In</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Office Handoff</h1>

      <form onSubmit={addItem}>
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

      <button onClick={loadItems}>Refresh</button>

      {items.map((item) => (
        <div key={item.id}>
          <b>{item.title}</b> - {item.details} ({item.employee})
          <button onClick={() => toggle(item.id, item.completed)}>
            {item.completed ? "Undo" : "Done"}
          </button>
        </div>
      ))}
    </div>
  );
}
