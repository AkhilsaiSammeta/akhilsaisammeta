import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ensureUser } from '../../lib/firebase'
import toast from 'react-hot-toast'

export default function SignupPage() {
	const { signUp } = useAuth()
	const nav = useNavigate()
		const [name, setName] = useState('')
		const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)

	const onSubmit = async (e) => {
		e.preventDefault()
		setLoading(true)
		try {
			const cred = await signUp(email, password)
			await ensureUser(cred.user.uid, { name, createdAt: new Date() })
			nav('/')
		} catch (e) {
			toast.error(e.message)
		} finally {
			setLoading(false)
		}
	}

	return (
			<div className="auth-card glass">
			<h2>Create account</h2>
						<form onSubmit={onSubmit} className="grid-3">
							<label className="span-3">Name<input type="text" value={name} onChange={(e)=>setName(e.target.value)} required /></label>
					<label className="span-3">Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
					<label className="span-3">Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label>
					<button className="btn btn-primary span-3" disabled={loading}>{loading ? 'Creating…' : 'Sign up'}</button>
			</form>
			<div className="muted">
				<Link to="/login">Have an account? Login</Link>
			</div>
		</div>
	)
}
