import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { addTransaction, createRoom, joinRoomByCode, onRoomMembers, onTransactions, onUser, uploadTransactionReceipt, updateTransaction } from '../lib/firebase'
import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { formatCurrency } from '../lib/format'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

function useRoomState() {
  const [room, setRoom] = useState(() => {
    const cached = localStorage.getItem('room')
    return cached ? JSON.parse(cached) : null
  })
  useEffect(() => {
    if (room) localStorage.setItem('room', JSON.stringify(room))
    else localStorage.removeItem('room')
  }, [room])
  return [room, setRoom]
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [room, setRoom] = useRoomState()
  const [members, setMembers] = useState([])
  const [memberProfiles, setMemberProfiles] = useState({})
  const [txs, setTxs] = useState([])
  const [prevCount, setPrevCount] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Attach listeners when room changes
  useEffect(() => {
    if (!room?.id) return
    const unsubMembers = onRoomMembers(room.id, setMembers)
    const unsubTx = onTransactions(room.id, setTxs)
    return () => { unsubMembers && unsubMembers(); unsubTx && unsubTx() }
  }, [room?.id])

  // Filtered transactions for date range
  const filteredTxs = useMemo(() => {
    const fromTs = from ? new Date(from).getTime() : -Infinity
    const toTs = to ? new Date(to).getTime() : Infinity
    return txs.filter((t) => {
      const ts = t.createdAt?.toMillis ? t.createdAt.toMillis() : new Date(t.createdAt).getTime()
      return ts >= fromTs && ts <= toTs
    })
  }, [txs, from, to])

  // Effective member fallback when room.members is empty
  const effectiveMembers = useMemo(() => {
    if (members && members.length) return members
    const ids = new Set()
    if (user?.uid) ids.add(user.uid)
    filteredTxs.forEach((t) => t.paidBy && ids.add(t.paidBy))
    return Array.from(ids)
  }, [members, filteredTxs, user?.uid])

  // Subscribe to profiles for display names
  useEffect(() => {
    if (!effectiveMembers.length) return
    const unsubs = effectiveMembers.map((uid) => onUser(uid, (u) => {
      setMemberProfiles((prev) => ({ ...prev, [uid]: u }))
    }))
    return () => unsubs.forEach((u) => u && u())
  }, [effectiveMembers])

  // Toast on new tx from others
  useEffect(() => {
    if (!user) return
    if (txs.length > prevCount) {
      const latest = txs[0]
      if (latest && latest.paidBy !== user.uid) toast.success(`New transaction: ${latest.name}`)
    }
    setPrevCount(txs.length)
  }, [txs, prevCount, user])

  // Balances
  const balances = useMemo(() => {
    const all = {}
    effectiveMembers.forEach((m) => (all[m] = 0))
    filteredTxs.forEach((t) => {
      const n = effectiveMembers.length || 1
      const split = t.amount / n
      effectiveMembers.forEach((m) => (all[m] -= split))
      all[t.paidBy] = (all[t.paidBy] || 0) + t.amount
    })
    return all
  }, [filteredTxs, effectiveMembers])

  const totalSpend = useMemo(() => filteredTxs.reduce((a, t) => a + (Number(t.amount) || 0), 0), [filteredTxs])
  const perHead = useMemo(() => (effectiveMembers.length ? totalSpend / effectiveMembers.length : 0), [totalSpend, effectiveMembers.length])

  // Settlement plan
  function computeSettlements(bal) {
    const eps = 0.005
    const creditors = []
    const debtors = []
    Object.entries(bal).forEach(([uid, v]) => {
      if (v > eps) creditors.push({ uid, amt: +v })
      else if (v < -eps) debtors.push({ uid, amt: +v })
    })
    creditors.sort((a, b) => b.amt - a.amt)
    debtors.sort((a, b) => a.amt - b.amt)
    const plan = []
    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i]
      const c = creditors[j]
      const pay = Math.min(c.amt, -d.amt)
      plan.push({ from: d.uid, to: c.uid, amount: Math.round(pay * 100) / 100 })
      d.amt += pay
      c.amt -= pay
      if (Math.abs(d.amt) <= eps) i++
      if (Math.abs(c.amt) <= eps) j++
    }
    return plan
  }

  const [settlements, setSettlements] = useState([])
  useEffect(() => { setSettlements(computeSettlements(balances)) }, [balances])

  // Per-person breakdown: spent, fair share, net (spent - share)
  const spentBy = useMemo(() => {
    const map = {}
    effectiveMembers.forEach((uid) => { map[uid] = 0 })
    filteredTxs.forEach((t) => { map[t.paidBy] = (map[t.paidBy] || 0) + (Number(t.amount) || 0) })
    return map
  }, [filteredTxs, effectiveMembers])

  const breakdown = useMemo(() => {
    return effectiveMembers.map((uid) => ({
      uid,
      name: memberProfiles[uid]?.name || uid.slice(0, 6),
      spent: spentBy[uid] || 0,
      share: perHead,
      net: (spentBy[uid] || 0) - perHead,
    }))
  }, [effectiveMembers, spentBy, memberProfiles, perHead])

  const create = async () => {
    try {
      const r = await createRoom(user.uid)
      setRoom(r)
      toast.success(`Room created: ${r.code}`)
    } catch (e) {
      toast.error(e.message)
    }
  }
  const join = async (e) => {
    e.preventDefault()
    const code = e.target.code.value.trim().toUpperCase()
    if (!code) return
    try {
      const r = await joinRoomByCode(user.uid, code)
      setRoom({ id: r.id, code: r.code })
      toast.success('Joined room')
    } catch (e) {
      toast.error(e.message)
    }
  }
  const leave = () => {
    setRoom(null)
  }

  const addTx = async (e) => {
    e.preventDefault()
    const form = e.target
    const amount = parseFloat(form.amount.value)
    const name = form.name.value
    const createdAt = form.date.value ? new Date(form.date.value) : new Date()
    const file = form.receipt?.files?.[0]
    if (!room) return
    if (!(amount > 0)) return toast.error('Enter amount')
    try {
      const ref = await addTransaction(room.id, { amount, name, paidBy: user.uid, createdAt })
      const txId = ref?.id || ref
      if (file && txId) {
        const meta = await uploadTransactionReceipt(room.id, txId, file)
        await updateTransaction(room.id, txId, { receipt: meta })
      }
      form.reset()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const exportCSV = () => {
    // Transactions CSV with payer name and split
    const rows = filteredTxs.map((t) => ({
      name: t.name,
      amount: t.amount,
      paidBy: t.paidBy,
      paidByName: memberProfiles[t.paidBy]?.name || t.paidBy?.slice(0, 6),
      split: effectiveMembers.length ? (t.amount / effectiveMembers.length).toFixed(2) : '0.00',
      date: t.createdAt?.toDate ? format(t.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : String(t.createdAt),
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `room-${room?.code || 'export'}-transactions.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportBreakdownCSV = () => {
    // Per-person breakdown CSV including pays/receives as semicolon-separated lists
    const rows = breakdown.map((b) => {
      const pays = settlements
        .filter((s) => s.from === b.uid)
        .map((p) => `${memberProfiles[p.to]?.name || p.to.slice(0, 6)} (${p.amount})`)
        .join('; ')
      const receives = settlements
        .filter((s) => s.to === b.uid)
        .map((g) => `${memberProfiles[g.from]?.name || g.from.slice(0, 6)} (${g.amount})`)
        .join('; ')
      return {
        uid: b.uid,
        name: b.name,
        spent: b.spent,
        share: Number(perHead.toFixed(2)),
        net: Number(b.net.toFixed(2)),
        pays,
        receives,
      }
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `room-${room?.code || 'export'}-breakdown.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    let y = 10
    const addLine = (text) => {
      doc.text(String(text), 10, y)
      y += 7
      if (y > 280) { doc.addPage(); y = 20 }
    }
    const addHeader = (text) => {
      doc.setFont(undefined, 'bold')
      addLine(text)
      doc.setFont(undefined, 'normal')
    }

    addHeader(`Room ${room?.code} - Report`)
    addLine(`Members: ${effectiveMembers.length}`)
    addLine(`Total: ${formatCurrency(totalSpend)}  Per head: ${formatCurrency(perHead)}`)
    y += 3

    // Breakdown
    addHeader('Breakdown')
    breakdown.forEach((b) => {
      addLine(`${b.name}: Spent ${formatCurrency(b.spent)} | Share ${formatCurrency(b.share)} | Net ${formatCurrency(b.net)}`)
      const pays = settlements.filter((s) => s.from === b.uid)
      const gets = settlements.filter((s) => s.to === b.uid)
      if (pays.length) addLine(`  Pays: ${pays.map(p => `${memberProfiles[p.to]?.name || p.to.slice(0,6)} (${formatCurrency(p.amount)})`).join(', ')}`)
      if (gets.length) addLine(`  Receives: ${gets.map(g => `${memberProfiles[g.from]?.name || g.from.slice(0,6)} (${formatCurrency(g.amount)})`).join(', ')}`)
    })
    y += 3

    // Settlements summary
    addHeader('Settlements')
    if (settlements.length === 0) {
      addLine('All settled!')
    } else {
      settlements.forEach((s) => {
        addLine(`${memberProfiles[s.from]?.name || s.from.slice(0,6)} pays ${memberProfiles[s.to]?.name || s.to.slice(0,6)} ${formatCurrency(s.amount)}`)
      })
    }
    y += 3

    // Transactions section
    addHeader('Transactions')
    filteredTxs.forEach((t) => {
      const payerName = memberProfiles[t.paidBy]?.name || t.paidBy?.slice(0, 6)
      const dt = format(t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt), 'yyyy-MM-dd HH:mm')
      addLine(`${dt}  ${t.name}  ${formatCurrency(t.amount)}  by ${payerName}  (split ${effectiveMembers.length ? formatCurrency(t.amount/effectiveMembers.length) : formatCurrency(0)})`)
    })

    doc.save(`room-${room?.code || 'export'}.pdf`)
  }

  const chartData = useMemo(() => {
    const map = new Map()
    filteredTxs.forEach((t) => {
      const day = format(t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt), 'yyyy-MM-dd')
      map.set(day, (map.get(day) || 0) + t.amount)
    })
    const labels = Array.from(map.keys()).sort()
    const data = labels.map((d) => map.get(d))
    return { labels, datasets: [{ label: 'Spend', data, backgroundColor: '#646cff' }] }
  }, [filteredTxs])

  if (!room) {
    return (
      <div>
        <div className="card glass">
          <h2>Start a room</h2>
          <div className="row">
            <button className="btn btn-primary" onClick={create}>Create Room</button>
          </div>
          <form onSubmit={join} className="inline-form">
            <input className="input" name="code" placeholder="Enter code e.g. ABC123" />
            <button className="btn btn-secondary">Join Room</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="row between center">
        <h2>Room <span className="badge">{room.code}</span></h2>
        <div className="row">
          <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-secondary" onClick={exportBreakdownCSV}>Export Breakdown CSV</button>
          <button className="btn btn-secondary" onClick={exportPDF}>Export PDF</button>
          <button className="btn btn-danger" onClick={leave}>Leave room</button>
        </div>
      </div>

  <div className="muted">Members: {effectiveMembers.length} · {effectiveMembers.map((uid) => (memberProfiles[uid]?.name || uid.slice(0,6))).join(', ')}</div>

      <section className="card glass">
        <h3>Add transaction</h3>
        <form onSubmit={addTx} className="grid-3">
          <input className="input" name="name" placeholder="Expense name" required />
          <input className="input" name="amount" type="number" step="0.01" placeholder="Amount" required />
          <input className="input" name="date" type="datetime-local" />
          <label className="file">
            <span>Receipt (optional)</span>
            <input className="input" type="file" name="receipt" accept="image/*,application/pdf" />
          </label>
          <button className="btn btn-primary span-3">Add</button>
        </form>
      </section>

      <section className="card glass">
        <h3>Balances</h3>
        <div className="muted">Total: {formatCurrency(totalSpend)} · Per head: {formatCurrency(perHead)}</div>
        <ul>
          {Object.entries(balances).map(([uid, v]) => (
            <li key={uid}><strong>{memberProfiles[uid]?.name || uid.slice(0,6)}</strong>: {formatCurrency(v)}</li>
          ))}
        </ul>
      </section>

      <section className="card glass">
        <h3>Detailed breakdown</h3>
        <div className="muted">Each person’s fair share is Total / Members. Net = Spent - Share (positive means they should receive; negative means they owe).</div>
        <ul>
          {breakdown.map((b) => {
            const pays = settlements.filter((s) => s.from === b.uid)
            const gets = settlements.filter((s) => s.to === b.uid)
            return (
              <li key={b.uid} className="list-item">
                <div>
                  <strong>{b.name}</strong>
                  <div className="muted">Spent: {formatCurrency(b.spent)} · Share: {formatCurrency(b.share)} · Net: {formatCurrency(b.net)}</div>
                </div>
                <div className="right" style={{textAlign:'right'}}>
                  {pays.length > 0 && <div className="muted">Pays: {pays.map((p) => `${memberProfiles[p.to]?.name || p.to.slice(0,6)} (${formatCurrency(p.amount)})`).join(', ')}</div>}
                  {gets.length > 0 && <div className="muted">Receives: {gets.map((g) => `${memberProfiles[g.from]?.name || g.from.slice(0,6)} (${formatCurrency(g.amount)})`).join(', ')}</div>}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card glass">
        <div className="row between">
          <h3>Settle up</h3>
          <div className="row">
            <button className="btn btn-secondary" onClick={() => setSettlements(computeSettlements(balances))}>Recalculate</button>
          </div>
        </div>
        <ul>
          {settlements.length ? settlements.map((s, i) => (
            <li key={i} className="list-item">
              <div>
                <strong>{memberProfiles[s.from]?.name || s.from.slice(0,6)}</strong> pays <strong>{memberProfiles[s.to]?.name || s.to.slice(0,6)}</strong>
              </div>
              <div className="right">{formatCurrency(s.amount)}</div>
            </li>
          )) : <li className="muted">All settled!</li>}
        </ul>
        {settlements.length > 0 && (
          <button className="btn btn-secondary" onClick={() => {
            const text = settlements.map(s => `${memberProfiles[s.from]?.name || s.from.slice(0,6)} -> ${memberProfiles[s.to]?.name || s.to.slice(0,6)}: ${formatCurrency(s.amount)}`).join('\n')
            navigator.clipboard.writeText(text)
            toast.success('Settlement plan copied!')
          }}>Copy plan</button>
        )}
      </section>

      <section className="card glass">
        <h3>Spending (by day)</h3>
        <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false }}}} />
      </section>

      <section className="card glass">
        <h3>Transactions</h3>
        <div className="grid-2">
          <label>From<input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(e)=>setTo(e.target.value)} /></label>
        </div>
        <ul className="list">
          {filteredTxs.map((t) => (
            <li key={t.id} className="list-item">
              <div>
                <strong>{t.name}</strong>
                <div className="muted">{format(t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt), 'PPpp')}</div>
                <div className="muted">Paid by {memberProfiles[t.paidBy]?.name || t.paidBy?.slice(0,6)}</div>
              </div>
              <div className="right">
                {formatCurrency(t.amount)}
                <div className="muted">split {effectiveMembers.length ? formatCurrency(t.amount/effectiveMembers.length) : formatCurrency(0)}</div>
                {t.receipt?.url && (
                  <div className="muted" style={{ marginTop: '.25rem' }}>
                    <a href={t.receipt.url} target="_blank" rel="noreferrer">View receipt</a>
                  </div>
                )}
              </div>
            </li>
          ))}
          {!filteredTxs.length && <li className="muted">No transactions</li>}
        </ul>
      </section>
    </div>
  )
}
