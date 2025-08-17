import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
	const { signIn } = useAuth()
	const nav = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)

	const onSubmit = async (e) => {
		e.preventDefault()
		setLoading(true)
		try {
			await signIn(email, password)
			nav('/')
		} catch (e) {
			toast.error(e.message)
		} finally {
			setLoading(false)
		}
	}

	return (
			<div className="auth-card glass">
				<h2>Login</h2>
				<form onSubmit={onSubmit} className="grid-3">
					<label className="span-3">Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
					<label className="span-3">Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label>
					<button className="btn btn-primary span-3" disabled={loading}>{loading ? 'Signing in…' : 'Login'}</button>
			</form>
			<div className="muted">
					<Link to="/reset">Forgot password?</Link> · <Link to="/signup">Create account</Link>
			</div>
		</div>
	)
}
