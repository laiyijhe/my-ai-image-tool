'use client'
import { useState } from 'react'
export default function Home() {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<unknown>(null)
  async function search() {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    const text = await res.text()
    try {
      const parsed = text ? JSON.parse(text) : null
      setResult(parsed)
    } catch {
      setResult({
        error: "Invalid JSON from server",
        status: res.status,
        raw: text.slice(0, 2000),
      })
    }
  }
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">來就補 AI 補助搜尋</h1>
      <input
        className="border p-2 mt-4 w-full text-black"
        placeholder="輸入: 我23歲想開咖啡店"
        onChange={(e) => setQuery(e.target.value)}
      />
      <button className="p-2 bg-blue-400 text-white mt-3" onClick={search}>搜尋</button>
      {result != null ? (
        <pre className="mt-6 p-4 bg-gray-100 text-black">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}