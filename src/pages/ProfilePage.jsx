import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { onUser, updateUser, ensureUser } from '../lib/firebase'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({ name: '', mobile: '', age: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsub = onUser(user.uid, (u) => {
      if (!u) {
        ensureUser(user.uid, { name: '', createdAt: new Date() })
      } else {
        setProfile({ name: u.name || '', mobile: u.mobile || '', age: u.age || '' })
      }
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [user])

  const onSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateUser(user.uid, { name: profile.name, mobile: profile.mobile, age: profile.age })
      toast.success('Profile saved')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) return <div className="center">Loading…</div>

  return (
    <div className="card glass">
      <h2>Profile</h2>
      <form onSubmit={onSubmit} className="grid-3">
        <label className="span-3">Name<input className="input" value={profile.name} onChange={(e)=>setProfile(p=>({...p,name:e.target.value}))} /></label>
        <label>Mobile<input className="input" value={profile.mobile} onChange={(e)=>setProfile(p=>({...p,mobile:e.target.value}))} /></label>
        <label>Age<input className="input" type="number" min="0" value={profile.age} onChange={(e)=>setProfile(p=>({...p,age:e.target.value}))} /></label>
        <button className="btn btn-primary span-3">Save</button>
      </form>
    </div>
  )
}
